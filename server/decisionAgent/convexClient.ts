import {
  authorizationResponseSchema,
  hasScope,
  OPERATION_SCOPES,
  sanitizeAggregateResults,
  sanitizeResponseStatus,
  type DecisionAgentOperation,
  type DecisionAgentPrincipal,
  type DecisionAgentScope,
} from './contracts.ts'

const DEFAULT_TIMEOUT_MS = 8_000
const MAX_UPSTREAM_BYTES = 512 * 1024
const GATEWAY_SECRET_HEADER = 'X-UBLDA-Gateway-Secret'

export class DecisionAgentGatewayError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfterSeconds?: number

  constructor(
    status: number,
    code: string,
    message: string,
    options: { retryAfterSeconds?: number } = {},
  ) {
    super(message)
    this.name = 'DecisionAgentGatewayError'
    this.status = status
    this.code = code
    this.retryAfterSeconds = options.retryAfterSeconds
  }
}

export type ConvexDecisionAgentClientOptions = {
  siteUrl?: string
  gatewaySecret?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

type RequestContext = {
  token: string
  requestId: string
  clientIp?: string
  idempotencyKey?: string
}

const headerValue = (response: Response, name: string) => response.headers.get(name)?.trim() || ''

const normalizedSiteUrl = (siteUrl: string | undefined) => {
  const value = siteUrl?.trim().replace(/\/+$/, '') || ''
  if (!value) {
    throw new DecisionAgentGatewayError(
      503,
      'gateway_not_configured',
      'Decision agent access is not configured yet.',
    )
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new DecisionAgentGatewayError(
      503,
      'gateway_not_configured',
      'Decision agent access is not configured correctly.',
    )
  }

  const localHttp = parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  if (parsed.protocol !== 'https:' && !localHttp) {
    throw new DecisionAgentGatewayError(
      503,
      'gateway_not_configured',
      'Decision agent access requires an HTTPS Convex endpoint.',
    )
  }

  return parsed.toString().replace(/\/+$/, '')
}

const validatedGatewaySecret = (secret: string | undefined) => {
  const value = secret || ''
  if (value.length < 32 || value.length > 512 || !/^[\x21-\x7E]+$/.test(value)) {
    throw new DecisionAgentGatewayError(
      503,
      'gateway_not_configured',
      'Decision agent access is not configured correctly.',
    )
  }
  return value
}

const redactedMessage = (
  value: unknown,
  sensitiveValues: readonly string[],
  fallback: string,
) => {
  if (typeof value !== 'string') return fallback
  const redacted = sensitiveValues.reduce(
    (message, sensitive) => sensitive ? message.replaceAll(sensitive, '[REDACTED]') : message,
    value,
  )
  const withoutControls = Array.from(redacted, (character) => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127 ? ' ' : character
  }).join('')
  return withoutControls
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .trim()
    .slice(0, 300) || fallback
}

const publicStatus = (upstreamStatus: number) => {
  if ([400, 401, 403, 404, 409, 422, 429].includes(upstreamStatus)) return upstreamStatus
  return upstreamStatus >= 500 ? 502 : 400
}

const statusForErrorCode = (code: string, upstreamStatus: number) => {
  const normalized = code.toUpperCase()
  if (normalized === 'UNAUTHENTICATED' || normalized === 'INVALID_TOKEN') return 401
  if (normalized === 'FORBIDDEN' || normalized === 'INSUFFICIENT_SCOPE') return 403
  if (normalized === 'NOT_FOUND') return 404
  if (normalized === 'CONFLICT' || normalized === 'IDEMPOTENCY_CONFLICT') return 409
  if (normalized === 'RATE_LIMITED') return 429
  if (normalized === 'VALIDATION_ERROR') return 400
  return publicStatus(upstreamStatus)
}

const responseJson = async (
  response: Response,
  sensitiveValues: readonly string[],
): Promise<unknown> => {
  const contentLength = Number(headerValue(response, 'content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_UPSTREAM_BYTES) {
    throw new DecisionAgentGatewayError(502, 'upstream_response_too_large', 'The decision service returned too much data.')
  }

  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_UPSTREAM_BYTES) {
    throw new DecisionAgentGatewayError(502, 'upstream_response_too_large', 'The decision service returned too much data.')
  }

  if (!text) return {}

  try {
    return redactSensitiveFromValue(JSON.parse(text) as unknown, sensitiveValues)
  } catch {
    throw new DecisionAgentGatewayError(
      502,
      'invalid_upstream_response',
      redactedMessage(text, sensitiveValues, 'The decision service returned an invalid response.'),
    )
  }
}

const redactSensitiveFromValue = (
  value: unknown,
  sensitiveValues: readonly string[],
): unknown => {
  if (typeof value === 'string') {
    return sensitiveValues.reduce(
      (message, sensitive) => sensitive ? message.replaceAll(sensitive, '[REDACTED]') : message,
      value,
    )
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveFromValue(item, sensitiveValues))
  }
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
    sensitiveValues.reduce(
      (name, sensitive) => sensitive ? name.replaceAll(sensitive, '[REDACTED]') : name,
      key,
    ),
    redactSensitiveFromValue(item, sensitiveValues),
  ]))
}

const errorFromResponse = (
  response: Response,
  payload: unknown,
  sensitiveValues: readonly string[],
): DecisionAgentGatewayError => {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const nested = record.error && typeof record.error === 'object'
    ? record.error as Record<string, unknown>
    : record
  const codeValue = typeof nested.code === 'string' ? nested.code : ''
  const code = /^[a-z0-9_:-]{1,80}$/i.test(codeValue) ? codeValue : 'upstream_rejected_request'
  const fallback = response.status === 401
    ? 'The decision agent token is invalid, expired, or revoked.'
    : response.status === 403
      ? 'This token does not have permission for that decision operation.'
      : response.status === 429
        ? 'The decision agent rate limit was reached. Try again shortly.'
        : 'The decision service could not complete that request.'
  const retryAfter = Number(headerValue(response, 'retry-after'))

  return new DecisionAgentGatewayError(
    statusForErrorCode(code, response.status),
    code,
    redactedMessage(nested.message ?? nested.error, sensitiveValues, fallback),
    Number.isInteger(retryAfter) && retryAfter > 0 ? { retryAfterSeconds: retryAfter } : {},
  )
}

export class ConvexDecisionAgentClient {
  private readonly siteUrl: string
  private readonly gatewaySecret: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: ConvexDecisionAgentClientOptions) {
    this.siteUrl = normalizedSiteUrl(options.siteUrl)
    this.gatewaySecret = validatedGatewaySecret(options.gatewaySecret)
    this.fetchImpl = options.fetchImpl || fetch
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS
  }

  private async post(
    path: string,
    payload: Record<string, unknown>,
    context: RequestContext,
  ): Promise<unknown> {
    const headers = new Headers({
      Accept: 'application/json',
      Authorization: `Bearer ${context.token}`,
      'Content-Type': 'application/json',
      [GATEWAY_SECRET_HEADER]: this.gatewaySecret,
      'X-Request-Id': context.requestId,
    })
    if (context.idempotencyKey) headers.set('Idempotency-Key', context.idempotencyKey)

    let response: Response
    try {
      response = await this.fetchImpl(`${this.siteUrl}/decision-agent/${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      if (error instanceof DecisionAgentGatewayError) throw error
      const timedOut = error instanceof Error && error.name === 'TimeoutError'
      throw new DecisionAgentGatewayError(
        502,
        timedOut ? 'upstream_timeout' : 'upstream_unavailable',
        timedOut
          ? 'The decision service took too long to respond.'
          : 'The decision service is temporarily unavailable.',
      )
    }

    const sensitiveValues = [context.token, this.gatewaySecret]
    const responsePayload = await responseJson(response, sensitiveValues)
    if (!response.ok) throw errorFromResponse(response, responsePayload, sensitiveValues)
    return responsePayload
  }

  async authorize(
    context: RequestContext & {
      operation: DecisionAgentOperation | 'mcp'
      requiredScope?: DecisionAgentScope
      method: string
      path: string
    },
  ): Promise<DecisionAgentPrincipal> {
    const payload = await this.post('authorize', {
      operation: context.operation,
      requiredScope: context.requiredScope,
      method: context.method,
      path: context.path,
      clientIp: context.clientIp,
    }, context)
    const parsed = authorizationResponseSchema.safeParse(payload)

    if (!parsed.success) {
      throw new DecisionAgentGatewayError(
        502,
        'invalid_authorization_response',
        'The decision service returned an invalid authorization response.',
      )
    }

    if (context.requiredScope && !hasScope(
      parsed.data.principal.scopes,
      context.requiredScope,
    )) {
      throw new DecisionAgentGatewayError(
        403,
        'insufficient_scope',
        'This token does not have permission for that decision operation.',
      )
    }

    const principal = parsed.data.principal
    return {
      ...principal,
      // Convex stores timestamps in milliseconds; MCP AuthInfo uses epoch seconds.
      expiresAt: principal.expiresAt && principal.expiresAt > 100_000_000_000
        ? Math.floor(principal.expiresAt / 1_000)
        : principal.expiresAt,
    }
  }

  async execute(
    operation: DecisionAgentOperation,
    input: Record<string, unknown>,
    context: RequestContext,
  ): Promise<unknown> {
    const result = await this.post(operation, input, context)
    if (operation === 'aggregate-results') return sanitizeAggregateResults(result)
    if (operation === 'response-status') return sanitizeResponseStatus(result)
    return result
  }

  requiredScope(operation: DecisionAgentOperation) {
    return OPERATION_SCOPES[operation]
  }
}

export type DecisionAgentClient = Pick<
  ConvexDecisionAgentClient,
  'authorize' | 'execute' | 'requiredScope'
>
