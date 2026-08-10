import type { AuthInfo } from '@modelcontextprotocol/server'
import type { ZodType } from 'zod'
import type { VercelRequest, VercelResponse } from '../types.ts'
import {
  aggregateResultsSchema,
  closeSchema,
  createDraftSchema,
  DECISION_AGENT_OPERATIONS,
  getSchema,
  idempotencyKeySchema,
  listSchema,
  OPERATION_SCOPES,
  publishSchema,
  responseStatusSchema,
  type DecisionAgentOperation,
} from './contracts.ts'
import {
  ConvexDecisionAgentClient,
  DecisionAgentGatewayError,
  type DecisionAgentClient,
} from './convexClient.ts'
import { createDecisionAgentMcpHandler } from './mcp.ts'

const MAX_REQUEST_BYTES = 64 * 1024
const MAX_MCP_RESPONSE_BYTES = 768 * 1024
const GATEWAY_OWNED_RESPONSE_HEADERS = new Set([
  'access-control-allow-headers',
  'access-control-allow-methods',
  'access-control-allow-origin',
  'access-control-expose-headers',
  'access-control-max-age',
  'cache-control',
  'pragma',
  'referrer-policy',
  'vary',
  'x-content-type-options',
  'x-frame-options',
  'x-request-id',
])
const ALLOWED_METHODS = 'GET, POST, OPTIONS'
const ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'Idempotency-Key',
  'MCP-Method',
  'MCP-Name',
  'MCP-Protocol-Version',
  'X-Request-Id',
].join(', ')

type HeaderRecord = Record<string, string | string[] | undefined>

type DecisionAgentHandlerOptions = {
  client?: DecisionAgentClient
  siteUrl?: string
  gatewaySecret?: string
  fetchImpl?: typeof fetch
  allowedOrigins?: string[]
}

type RestRoute = {
  operation: DecisionAgentOperation
  schema: ZodType
  input: Record<string, unknown>
  requiresIdempotency: boolean
}

const firstHeader = (value: string | string[] | undefined) => (
  Array.isArray(value) ? value[0] || '' : value || ''
)

const requestHeader = (headers: HeaderRecord, name: string) => {
  const lower = name.toLowerCase()
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === lower)
  return firstHeader(entry?.[1]).trim()
}

const setHeader = (res: VercelResponse, name: string, value: string) => {
  res.setHeader?.(name, value)
}

const setBaseHeaders = (res: VercelResponse, requestId: string) => {
  setHeader(res, 'Cache-Control', 'no-store, max-age=0')
  setHeader(res, 'Pragma', 'no-cache')
  setHeader(res, 'X-Content-Type-Options', 'nosniff')
  setHeader(res, 'X-Frame-Options', 'DENY')
  setHeader(res, 'Referrer-Policy', 'no-referrer')
  setHeader(res, 'X-Request-Id', requestId)
}

const safeRequestId = (headers: HeaderRecord) => {
  const proposed = requestHeader(headers, 'x-request-id')
  return /^[A-Za-z0-9._:-]{8,100}$/.test(proposed) ? proposed : crypto.randomUUID()
}

const requestIp = (req: VercelRequest) => (
  requestHeader(req.headers, 'x-forwarded-for').split(',')[0]?.trim()
  || req.socket?.remoteAddress
  || 'unknown'
)

const bearerToken = (headers: HeaderRecord) => {
  const match = requestHeader(headers, 'authorization').match(/^Bearer\s+(.+)$/i)
  const token = match?.[1]?.trim() || ''
  if (!token) {
    throw new DecisionAgentGatewayError(401, 'missing_token', 'A decision agent bearer token is required.')
  }
  if (token.length < 20 || token.length > 512 || !/^[\x21-\x7E]+$/.test(token)) {
    throw new DecisionAgentGatewayError(401, 'invalid_token', 'The decision agent token is invalid, expired, or revoked.')
  }
  return token
}

const forwardedHost = (headers: HeaderRecord) => (
  requestHeader(headers, 'x-forwarded-host') || requestHeader(headers, 'host')
).split(',')[0]?.trim().toLowerCase() || ''

const sameOrigin = (origin: string, req: VercelRequest) => {
  try {
    const parsed = new URL(origin)
    const host = forwardedHost(req.headers)
    if (!host || parsed.host.toLowerCase() !== host) return false
    if (parsed.protocol === 'https:') return true
    return parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)
  } catch {
    return false
  }
}

const normalizedOrigins = (values: string[]) => new Set(values.flatMap((value) => value.split(','))
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter((value) => value && value !== '*'))

const applyCors = (
  req: VercelRequest,
  res: VercelResponse,
  configuredOrigins: string[],
) => {
  const origin = requestHeader(req.headers, 'origin').replace(/\/$/, '')
  if (!origin) return

  const allowed = sameOrigin(origin, req) || normalizedOrigins(configuredOrigins).has(origin)
  if (!allowed) {
    throw new DecisionAgentGatewayError(403, 'origin_not_allowed', 'This browser origin is not allowed to use the decision agent API.')
  }

  setHeader(res, 'Access-Control-Allow-Origin', origin)
  setHeader(res, 'Access-Control-Allow-Methods', ALLOWED_METHODS)
  setHeader(res, 'Access-Control-Allow-Headers', ALLOWED_HEADERS)
  setHeader(res, 'Access-Control-Expose-Headers', 'Retry-After, X-Request-Id')
  setHeader(res, 'Access-Control-Max-Age', '600')
  setHeader(res, 'Vary', 'Origin')
}

const responseError = (
  res: VercelResponse,
  error: unknown,
  requestId: string,
) => {
  const known = error instanceof DecisionAgentGatewayError
    ? error
    : new DecisionAgentGatewayError(500, 'internal_error', 'The decision agent request could not be completed.')

  if (known.status === 401) {
    setHeader(res, 'WWW-Authenticate', 'Bearer realm="UBLDA Decision Center", error="invalid_token"')
  }
  if (known.retryAfterSeconds) setHeader(res, 'Retry-After', String(known.retryAfterSeconds))

  return res.status(known.status).json({
    error: {
      code: known.code,
      message: known.message,
      requestId,
    },
  })
}

const bodySize = (body: unknown) => {
  if (typeof body === 'string') return Buffer.byteLength(body, 'utf8')
  if (Buffer.isBuffer(body)) return body.byteLength
  try {
    return Buffer.byteLength(JSON.stringify(body ?? {}), 'utf8')
  } catch {
    throw new DecisionAgentGatewayError(400, 'invalid_json', 'Request body must be valid JSON.')
  }
}

const parsedBody = (req: VercelRequest) => {
  const announcedLength = Number(requestHeader(req.headers, 'content-length'))
  if (Number.isFinite(announcedLength) && announcedLength > MAX_REQUEST_BYTES) {
    throw new DecisionAgentGatewayError(413, 'request_too_large', 'Decision agent requests are limited to 64 KB.')
  }
  if (bodySize(req.body) > MAX_REQUEST_BYTES) {
    throw new DecisionAgentGatewayError(413, 'request_too_large', 'Decision agent requests are limited to 64 KB.')
  }

  if (req.body === undefined || req.body === null || req.body === '') return {}
  if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString()) as unknown
    } catch {
      throw new DecisionAgentGatewayError(400, 'invalid_json', 'Request body must be valid JSON.')
    }
  }
  return req.body
}

const queryValue = (req: VercelRequest, name: string) => firstHeader(req.query?.[name]).trim()

const requestPath = (req: VercelRequest) => {
  const rewritten = queryValue(req, 'decisionAgentPath') || queryValue(req, 'path')
  if (rewritten) return `/${rewritten.replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/'

  const url = new URL(req.url || '/api/decision-agent', 'http://localhost')
  const suffix = url.pathname.replace(/^\/api\/decision-agent/, '')
  return `/${suffix.replace(/^\/+/, '')}`.replace(/\/+$/, '') || '/'
}

const decodeDecisionId = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    throw new DecisionAgentGatewayError(400, 'invalid_decision_id', 'Decision ID is invalid.')
  }
}

const restRoute = (req: VercelRequest, path: string, body: unknown): RestRoute | undefined => {
  const method = (req.method || 'GET').toUpperCase()

  if (method === 'POST' && path === '/v1/decisions/drafts') {
    return {
      operation: DECISION_AGENT_OPERATIONS.createDraft,
      schema: createDraftSchema,
      input: body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {},
      requiresIdempotency: true,
    }
  }

  if (method === 'GET' && path === '/v1/decisions') {
    const limit = queryValue(req, 'limit')
    return {
      operation: DECISION_AGENT_OPERATIONS.list,
      schema: listSchema,
      input: {
        ...(queryValue(req, 'status') ? { status: queryValue(req, 'status') } : {}),
        ...(limit ? { limit: Number(limit) } : {}),
        ...(queryValue(req, 'cursor') ? { cursor: queryValue(req, 'cursor') } : {}),
      },
      requiresIdempotency: false,
    }
  }

  const publish = path.match(/^\/v1\/decisions\/([^/]+)\/publish$/)
  if (method === 'POST' && publish) {
    return {
      operation: DECISION_AGENT_OPERATIONS.publish,
      schema: publishSchema,
      input: { decisionId: decodeDecisionId(publish[1]) },
      requiresIdempotency: true,
    }
  }

  const status = path.match(/^\/v1\/decisions\/([^/]+)\/response-status$/)
  if (method === 'GET' && status) {
    return {
      operation: DECISION_AGENT_OPERATIONS.responseStatus,
      schema: responseStatusSchema,
      input: { decisionId: decodeDecisionId(status[1]) },
      requiresIdempotency: false,
    }
  }

  const results = path.match(/^\/v1\/decisions\/([^/]+)\/results$/)
  if (method === 'GET' && results) {
    return {
      operation: DECISION_AGENT_OPERATIONS.aggregateResults,
      schema: aggregateResultsSchema,
      input: { decisionId: decodeDecisionId(results[1]) },
      requiresIdempotency: false,
    }
  }

  const close = path.match(/^\/v1\/decisions\/([^/]+)\/close$/)
  if (method === 'POST' && close) {
    const payload = body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {}
    return {
      operation: DECISION_AGENT_OPERATIONS.close,
      schema: closeSchema,
      input: { ...payload, decisionId: decodeDecisionId(close[1]) },
      requiresIdempotency: false,
    }
  }

  const get = path.match(/^\/v1\/decisions\/([^/]+)$/)
  if (method === 'GET' && get) {
    return {
      operation: DECISION_AGENT_OPERATIONS.get,
      schema: getSchema,
      input: { decisionId: decodeDecisionId(get[1]) },
      requiresIdempotency: false,
    }
  }

  return undefined
}

const validationMessage = (issues: Array<{ path: PropertyKey[]; message: string }>) => {
  const issue = issues[0]
  if (!issue) return 'Decision agent input is invalid.'
  const path = issue.path.map(String).join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}

const idempotencyKey = (req: VercelRequest, required: boolean) => {
  const value = requestHeader(req.headers, 'idempotency-key')
  if (!value && required) {
    throw new DecisionAgentGatewayError(
      400,
      'idempotency_key_required',
      'An Idempotency-Key header is required for this operation.',
    )
  }
  if (!value) return undefined

  const result = idempotencyKeySchema.safeParse(value)
  if (!result.success) {
    throw new DecisionAgentGatewayError(400, 'invalid_idempotency_key', validationMessage(result.error.issues))
  }
  return result.data
}

const webRequest = (req: VercelRequest, body: unknown) => {
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item))
    else if (value !== undefined) headers.set(name, value)
  }

  const host = forwardedHost(req.headers) || 'localhost'
  const protocol = requestHeader(req.headers, 'x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  const method = (req.method || 'POST').toUpperCase()
  return new Request(`${protocol}://${host}${req.url || '/api/decision-agent/mcp'}`, {
    method,
    headers,
    ...(['GET', 'HEAD'].includes(method) ? {} : { body: JSON.stringify(body) }),
  })
}

const sendWebResponse = async (
  response: Response,
  res: VercelResponse,
) => {
  response.headers.forEach((value, name) => {
    const normalized = name.toLowerCase()
    if (
      !['content-length', 'transfer-encoding'].includes(normalized)
      && !GATEWAY_OWNED_RESPONSE_HEADERS.has(normalized)
    ) {
      setHeader(res, name, value)
    }
  })
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_MCP_RESPONSE_BYTES) {
    throw new DecisionAgentGatewayError(502, 'mcp_response_too_large', 'The MCP response exceeded the gateway limit.')
  }
  return res.status(response.status).send(text)
}

const allowedMethodForKnownPath = (path: string) => (
  path === '/mcp'
  || path === '/v1/decisions'
  || path === '/v1/decisions/drafts'
  || /^\/v1\/decisions\/[^/]+(?:\/(?:publish|response-status|results|close))?$/.test(path)
)

export const createDecisionAgentHandler = (options: DecisionAgentHandlerOptions = {}) => {
  let client = options.client
  let mcpHandler: ReturnType<typeof createDecisionAgentMcpHandler> | undefined

  const getClient = () => {
    client ||= new ConvexDecisionAgentClient({
      siteUrl: options.siteUrl || process.env.CONVEX_SITE_URL,
      gatewaySecret: options.gatewaySecret || process.env.DECISION_AGENT_GATEWAY_SECRET,
      fetchImpl: options.fetchImpl,
    })
    return client
  }

  return async (req: VercelRequest, res: VercelResponse) => {
    const requestId = safeRequestId(req.headers)
    setBaseHeaders(res, requestId)

    try {
      const configuredOrigins = options.allowedOrigins
        || (process.env.DECISION_AGENT_ALLOWED_ORIGINS || '').split(',')
      applyCors(req, res, configuredOrigins)

      if ((req.method || '').toUpperCase() === 'OPTIONS') {
        return res.status(204).send('')
      }

      const path = requestPath(req)
      const method = (req.method || 'GET').toUpperCase()
      if (!['GET', 'POST'].includes(method)) {
        setHeader(res, 'Allow', ALLOWED_METHODS)
        throw new DecisionAgentGatewayError(405, 'method_not_allowed', 'Method not allowed.')
      }

      if (path === '/mcp') {
        if (method !== 'POST') {
          setHeader(res, 'Allow', 'POST, OPTIONS')
          throw new DecisionAgentGatewayError(405, 'method_not_allowed', 'The MCP endpoint accepts POST requests only.')
        }

        const body = parsedBody(req)
        const token = bearerToken(req.headers)
        const activeClient = getClient()
        const principal = await activeClient.authorize({
          token,
          requestId,
          clientIp: requestIp(req),
          operation: 'mcp',
          method,
          path,
        })
        const authInfo: AuthInfo = {
          token,
          clientId: principal.tokenId,
          scopes: principal.scopes,
          expiresAt: principal.expiresAt,
          extra: {
            memberId: principal.memberId,
            clientName: principal.clientName,
            requestId,
            clientIp: requestIp(req),
          },
        }

        mcpHandler ||= createDecisionAgentMcpHandler(activeClient)
        const response = await mcpHandler.fetch(webRequest(req, body), {
          authInfo,
          parsedBody: body,
        })
        return await sendWebResponse(response, res)
      }

      const body = method === 'POST' ? parsedBody(req) : {}
      const route = restRoute(req, path, body)
      if (!route) {
        if (allowedMethodForKnownPath(path)) {
          setHeader(res, 'Allow', ALLOWED_METHODS)
          throw new DecisionAgentGatewayError(405, 'method_not_allowed', 'Method not allowed for this endpoint.')
        }
        throw new DecisionAgentGatewayError(404, 'endpoint_not_found', 'Decision agent endpoint not found.')
      }

      const parsed = route.schema.safeParse(route.input)
      if (!parsed.success) {
        throw new DecisionAgentGatewayError(
          400,
          'invalid_input',
          validationMessage(parsed.error.issues),
        )
      }

      const key = idempotencyKey(req, route.requiresIdempotency)
      const token = bearerToken(req.headers)
      const activeClient = getClient()
      const requiredScope = OPERATION_SCOPES[route.operation]
      await activeClient.authorize({
        token,
        requestId,
        clientIp: requestIp(req),
        operation: route.operation,
        requiredScope,
        method,
        path,
      })
      const result = await activeClient.execute(
        route.operation,
        parsed.data as Record<string, unknown>,
        {
          token,
          requestId,
          clientIp: requestIp(req),
          idempotencyKey: key,
        },
      )

      return res.status(route.operation === DECISION_AGENT_OPERATIONS.createDraft ? 201 : 200).json(result)
    } catch (error) {
      return responseError(res, error, requestId)
    }
  }
}
