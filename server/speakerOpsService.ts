import { createSpeakerOpsStore } from './speakerOpsStore.js'
import type { ProgramSlot, RoomRequest, SpeakerLead } from '../src/lib/speakerOps.ts'

type RequestBody = Record<string, unknown>
type ServiceResponse = { status: number; body: Record<string, unknown> }

const store = createSpeakerOpsStore()
const attempts = new Map<string, { count: number; resetAt: number }>()
const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_MAX = 8

const textValue = (body: RequestBody, key: string) => (
  typeof body[key] === 'string' ? body[key].trim() : ''
)

const sessionToken = (body: RequestBody) => textValue(body, 'sessionToken')

const failureKey = (ip: string, email: string) => `${ip}:${email.trim().toLowerCase()}`

const rateLimited = (key: string) => {
  const now = Date.now()
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.delete(key)
    return false
  }
  return current.count >= RATE_MAX
}

const recordFailure = (key: string) => {
  const now = Date.now()
  const current = attempts.get(key)
  attempts.set(key, !current || current.resetAt <= now
    ? { count: 1, resetAt: now + RATE_WINDOW_MS }
    : { count: current.count + 1, resetAt: current.resetAt })
}

export const handleSpeakerOpsRequest = async (rawBody: unknown, ip = 'unknown'): Promise<ServiceResponse> => {
  const body = rawBody && typeof rawBody === 'object' ? rawBody as RequestBody : {}
  const action = textValue(body, 'action')

  try {
    if (action === 'signIn') {
      const email = textValue(body, 'email')
      const key = failureKey(ip, email)
      if (rateLimited(key)) return { status: 429, body: { error: 'Too many sign-in attempts. Try again in a few minutes.' } }
      const session = await store.signIn(email, textValue(body, 'password'))
      if (!session) {
        recordFailure(key)
        return { status: 401, body: { error: 'Invalid email or password.' } }
      }
      attempts.delete(key)
      return { status: 200, body: { success: true, ...session } }
    }

    if (action === 'session') {
      const session = await store.restoreSession(sessionToken(body))
      return session
        ? { status: 200, body: { success: true, ...session } }
        : { status: 401, body: { error: 'Session expired. Sign in again.' } }
    }

    if (action === 'logout') {
      await store.logout(sessionToken(body))
      return { status: 200, body: { success: true } }
    }

    if (action === 'changePassword') {
      const result = await store.changePassword(
        sessionToken(body),
        textValue(body, 'currentPassword'),
        textValue(body, 'nextPassword'),
      )
      return result.ok
        ? { status: 200, body: { success: true, ...result } }
        : { status: result.error.startsWith('Session') ? 401 : 400, body: { error: result.error } }
    }

    if (action === 'workspace') {
      const workspace = await store.workspace(sessionToken(body))
      return workspace
        ? { status: 200, body: { success: true, workspace } }
        : { status: 401, body: { error: 'Session expired. Sign in again.' } }
    }

    if (action === 'updateLead') {
      const lead = body.lead && typeof body.lead === 'object' ? body.lead as Partial<SpeakerLead> & { id: string } : null
      if (!lead?.id) return { status: 400, body: { error: 'Speaker is required.' } }
      const result = await store.updateLead(sessionToken(body), lead)
      return result.ok
        ? { status: 200, body: { success: true, ...result } }
        : { status: result.error.startsWith('Session') ? 401 : 400, body: { error: result.error } }
    }

    if (action === 'updateRoomRequest') {
      const roomRequest = body.roomRequest && typeof body.roomRequest === 'object'
        ? body.roomRequest as Partial<RoomRequest> & { id: string }
        : null
      if (!roomRequest?.id) return { status: 400, body: { error: 'Room request is required.' } }
      const result = await store.updateRoomRequest(sessionToken(body), roomRequest)
      return result.ok
        ? { status: 200, body: { success: true, ...result } }
        : { status: result.error.startsWith('Session') ? 401 : 400, body: { error: result.error } }
    }

    if (action === 'updateSlot') {
      const slot = body.slot && typeof body.slot === 'object'
        ? body.slot as Partial<ProgramSlot> & { id: ProgramSlot['id'] }
        : null
      if (!slot?.id) return { status: 400, body: { error: 'Program slot is required.' } }
      const result = await store.updateSlot(sessionToken(body), slot)
      return result.ok
        ? { status: 200, body: { success: true, ...result } }
        : { status: result.error.startsWith('Session') ? 401 : 400, body: { error: result.error } }
    }

    return { status: 400, body: { error: 'Unknown Speaker Ops action.' } }
  } catch (error) {
    console.error('speaker_ops_request_failed', error instanceof Error ? error.name : 'UnknownError')
    return { status: 500, body: { error: 'Speaker Ops is temporarily unavailable.' } }
  }
}
