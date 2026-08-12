import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import {
  authBridgeConfig,
  exchangeLogtoIdTokenWithIdentity,
  type VerifiedLogtoIdentity,
} from './convexAuthBridge.ts'
import {
  createSpeakerOpsStore,
  type SpeakerOpsActor,
  type SpeakerOpsStore,
} from './speakerOpsStore.js'
import type { ProgramSlot, RoomRequest, SpeakerLead } from '../src/lib/speakerOps.ts'

type RequestBody = Record<string, unknown>
type ServiceResponse = { status: number; body: Record<string, unknown> }
type Environment = Record<string, string | undefined>

type ConvexViewer = {
  memberId: string
  displayName: string
  role: 'admin' | 'member'
  status: 'active' | 'inactive'
  avatarUrl: string | null
}

type IdentityExchange = {
  identity: VerifiedLogtoIdentity
  token: string
  expiresIn: number
}

type IdentityVerifierDependencies = {
  environment?: Environment
  exchange?: (idToken: string) => Promise<IdentityExchange>
  queryViewer?: (convexToken: string, convexUrl: string) => Promise<ConvexViewer>
  viewerTimeoutMs?: number
}

export type SpeakerOpsIdentityVerifier = (idToken: string) => Promise<SpeakerOpsActor>

export type SpeakerOpsServiceOptions = {
  store?: SpeakerOpsStore
  verifyIdentity?: SpeakerOpsIdentityVerifier
}

const defaultStore = createSpeakerOpsStore()
const allowedActions = new Set(['workspace', 'updateLead', 'updateRoomRequest', 'updateSlot'])
const MAX_ID_TOKEN_LENGTH = 24_000
const CONVEX_VIEWER_TIMEOUT_MS = 8_000

const viewerReference = makeFunctionReference<
  'query',
  Record<string, never>,
  ConvexViewer
>('viewer:current')

class SpeakerOpsAuthError extends Error {
  readonly status: 401 | 403 | 503

  constructor(status: 401 | 403 | 503, message: string) {
    super(message)
    this.name = 'SpeakerOpsAuthError'
    this.status = status
  }
}

const textValue = (body: RequestBody, key: string) => (
  typeof body[key] === 'string' ? body[key].trim() : ''
)

const defaultViewerQuery = async (
  convexToken: string,
  convexUrl: string,
  timeoutMs = CONVEX_VIEWER_TIMEOUT_MS,
) => {
  const fetchWithTimeout: typeof fetch = (input, init) => fetch(input, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  })
  const client = new ConvexHttpClient(convexUrl, {
    auth: convexToken,
    logger: false,
    fetch: fetchWithTimeout,
  })
  return client.query(viewerReference, {})
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<T>((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new Error('Leadership membership verification timed out.')
      error.name = 'TimeoutError'
      reject(error)
    }, timeoutMs)
  })
  try {
    return await Promise.race([promise, deadline])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export const verifySpeakerOpsIdentity = async (
  idToken: string,
  dependencies: IdentityVerifierDependencies = {},
): Promise<SpeakerOpsActor> => {
  if (!idToken || idToken.length > MAX_ID_TOKEN_LENGTH) {
    throw new SpeakerOpsAuthError(401, 'Sign in with your UBLDA leadership account.')
  }

  const environment = dependencies.environment || process.env
  const convexUrl = environment.CONVEX_URL?.trim() || environment.VITE_CONVEX_URL?.trim()
  if (!convexUrl) throw new SpeakerOpsAuthError(503, 'Leadership authentication is not configured.')

  let exchange: IdentityExchange
  try {
    if (dependencies.exchange) {
      exchange = await dependencies.exchange(idToken)
    } else {
      const config = authBridgeConfig(environment)
      exchange = await exchangeLogtoIdTokenWithIdentity(idToken, config)
    }
  } catch (error) {
    if (error instanceof SpeakerOpsAuthError) throw error
    if (!dependencies.exchange && error instanceof Error && error.message.startsWith('Missing ')) {
      throw new SpeakerOpsAuthError(503, 'Leadership authentication is not configured.')
    }
    throw new SpeakerOpsAuthError(401, 'Your leadership sign-in is invalid or expired.')
  }

  let viewer: ConvexViewer
  try {
    const timeoutMs = dependencies.viewerTimeoutMs ?? CONVEX_VIEWER_TIMEOUT_MS
    const viewerPromise = dependencies.queryViewer
      ? dependencies.queryViewer(exchange.token, convexUrl)
      : defaultViewerQuery(exchange.token, convexUrl, timeoutMs)
    viewer = await withTimeout(viewerPromise, timeoutMs)
  } catch (error) {
    if (error instanceof ConvexError) {
      throw new SpeakerOpsAuthError(403, 'This account is not approved for the UBLDA leadership workspace.')
    }
    throw new SpeakerOpsAuthError(503, 'Leadership membership could not be verified.')
  }

  if (!viewer || viewer.status !== 'active') {
    throw new SpeakerOpsAuthError(403, 'This account is not an active UBLDA leadership member.')
  }

  return {
    memberId: viewer.memberId,
    displayName: viewer.displayName || exchange.identity.name || exchange.identity.email,
    email: exchange.identity.email,
    role: viewer.role,
  }
}

export const handleSpeakerOpsRequest = async (
  rawBody: unknown,
  _ip = 'unknown',
  options: SpeakerOpsServiceOptions = {},
): Promise<ServiceResponse> => {
  void _ip
  const body = rawBody && typeof rawBody === 'object' ? rawBody as RequestBody : {}
  const action = textValue(body, 'action')

  if (!allowedActions.has(action)) {
    return { status: 400, body: { error: 'Unknown Speaker Ops action.' } }
  }

  const store = options.store || defaultStore
  const verifyIdentity = options.verifyIdentity || verifySpeakerOpsIdentity

  try {
    let actor: SpeakerOpsActor
    try {
      actor = await verifyIdentity(textValue(body, 'idToken'))
    } catch (error) {
      if (error instanceof SpeakerOpsAuthError) throw error
      if (options.verifyIdentity) {
        throw new SpeakerOpsAuthError(401, 'Your leadership sign-in is invalid or expired.')
      }
      throw error
    }

    if (action === 'workspace') {
      const workspace = await store.workspace(actor)
      return { status: 200, body: { success: true, workspace } }
    }

    if (action === 'updateLead') {
      const lead = body.lead && typeof body.lead === 'object' ? body.lead as Partial<SpeakerLead> & { id: string } : null
      if (!lead?.id) return { status: 400, body: { error: 'Speaker is required.' } }
      const result = await store.updateLead(actor, lead)
      return result.ok
        ? { status: 200, body: { success: true, ...result } }
        : { status: 400, body: { error: result.error } }
    }

    if (action === 'updateRoomRequest') {
      const roomRequest = body.roomRequest && typeof body.roomRequest === 'object'
        ? body.roomRequest as Partial<RoomRequest> & { id: string }
        : null
      if (!roomRequest?.id) return { status: 400, body: { error: 'Room request is required.' } }
      const result = await store.updateRoomRequest(actor, roomRequest)
      return result.ok
        ? { status: 200, body: { success: true, ...result } }
        : { status: 400, body: { error: result.error } }
    }

    const slot = body.slot && typeof body.slot === 'object'
      ? body.slot as Partial<ProgramSlot> & { id: ProgramSlot['id'] }
      : null
    if (!slot?.id) return { status: 400, body: { error: 'Program slot is required.' } }
    const result = await store.updateSlot(actor, slot)
    return result.ok
      ? { status: 200, body: { success: true, ...result } }
      : { status: 400, body: { error: result.error } }
  } catch (error) {
    if (error instanceof SpeakerOpsAuthError) {
      return { status: error.status, body: { error: error.message } }
    }
    console.error('speaker_ops_request_failed', error instanceof Error ? error.name : 'UnknownError')
    return { status: 500, body: { error: 'Speaker Ops is temporarily unavailable.' } }
  }
}
