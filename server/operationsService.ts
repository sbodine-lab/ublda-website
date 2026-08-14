import type {
  AttendanceRecord,
  OperationsDocument,
  OperationsRole,
  ReviewDecision,
  StrikeReason,
  StrikeStatus,
} from '../src/lib/operations.ts'
import {
  createOperationsStore,
  isOperationsSuperAdmin,
  type OperationsStore,
} from './operationsStore.js'
import {
  verifySpeakerOpsIdentity,
  type SpeakerOpsIdentityVerifier,
} from './speakerOpsService.js'

type RequestBody = Record<string, unknown>
type ServiceResponse = { status: number; body: Record<string, unknown> }

export type OperationsServiceOptions = {
  store?: OperationsStore
  verifyIdentity?: SpeakerOpsIdentityVerifier
}

const defaultStore = createOperationsStore()
const allowedActions = new Set([
  'workspace',
  'updateAttendance',
  'createStrike',
  'updateStrikeStatus',
  'updateAccount',
  'updateDocument',
  'updateReview',
])

const textValue = (body: RequestBody, key: string) => (
  typeof body[key] === 'string' ? body[key].trim() : ''
)

const authStatus = (error: unknown): 401 | 403 | 503 | null => {
  if (!error || typeof error !== 'object' || !('status' in error)) return null
  const status = Number((error as { status?: unknown }).status)
  return [401, 403, 503].includes(status) ? status as 401 | 403 | 503 : null
}

const writeErrorStatus = (error: string) => /only the three operations super admins/i.test(error) ? 403 : 400

export const handleOperationsRequest = async (
  rawBody: unknown,
  _ip = 'unknown',
  options: OperationsServiceOptions = {},
): Promise<ServiceResponse> => {
  void _ip
  const body = rawBody && typeof rawBody === 'object' ? rawBody as RequestBody : {}
  const action = textValue(body, 'action')
  if (!allowedActions.has(action)) return { status: 400, body: { error: 'Unknown Operations action.' } }

  const store = options.store || defaultStore
  const verifyIdentity = options.verifyIdentity || verifySpeakerOpsIdentity
  try {
    const actor = await verifyIdentity(textValue(body, 'idToken'))
    if (action === 'workspace') {
      return { status: 200, body: { success: true, workspace: await store.workspace(actor) } }
    }

    // This explicit service-layer gate is repeated inside the store so neither
    // API routing nor direct store use can turn UI visibility into authority.
    if (!isOperationsSuperAdmin(actor.email)) {
      return { status: 403, body: { error: 'Only the three Operations super admins can change this workspace.' } }
    }

    if (action === 'updateAttendance') {
      const attendance = body.attendance && typeof body.attendance === 'object'
        ? body.attendance as Pick<AttendanceRecord, 'eventId' | 'memberEmail'> & Partial<AttendanceRecord>
        : null
      if (!attendance?.eventId || !attendance.memberEmail) return { status: 400, body: { error: 'Event and member are required.' } }
      const result = await store.updateAttendance(actor, attendance)
      return result.ok
        ? { status: 200, body: { success: true, ...result } }
        : { status: writeErrorStatus(result.error), body: { error: result.error } }
    }

    if (action === 'createStrike') {
      const input = body.strike && typeof body.strike === 'object'
        ? body.strike as { memberEmail?: string; reason?: StrikeReason; detail?: string; eventId?: string }
        : null
      if (!input?.memberEmail || !input.reason || !input.detail) return { status: 400, body: { error: 'Member, reason, and evidence are required.' } }
      const result = await store.createStrike(actor, {
        memberEmail: input.memberEmail,
        reason: input.reason,
        detail: input.detail,
        eventId: input.eventId,
      })
      return result.ok
        ? { status: 200, body: { success: true, ...result } }
        : { status: writeErrorStatus(result.error), body: { error: result.error } }
    }

    if (action === 'updateStrikeStatus') {
      const input = body.strike && typeof body.strike === 'object'
        ? body.strike as { id?: string; status?: StrikeStatus; note?: string }
        : null
      if (!input?.id || !input.status) return { status: 400, body: { error: 'Strike and status are required.' } }
      const result = await store.updateStrikeStatus(actor, {
        id: input.id,
        status: input.status,
        note: input.note || '',
      })
      return result.ok
        ? { status: 200, body: { success: true, ...result } }
        : { status: writeErrorStatus(result.error), body: { error: result.error } }
    }

    if (action === 'updateAccount') {
      const input = body.account && typeof body.account === 'object'
        ? body.account as { email?: string; role?: OperationsRole }
        : null
      if (!input?.email || !input.role) return { status: 400, body: { error: 'Account and role are required.' } }
      const result = await store.updateAccount(actor, { email: input.email, role: input.role })
      return result.ok
        ? { status: 200, body: { success: true, ...result } }
        : { status: writeErrorStatus(result.error), body: { error: result.error } }
    }

    if (action === 'updateDocument') {
      const document = body.document && typeof body.document === 'object'
        ? body.document as Partial<OperationsDocument> & { id?: string }
        : null
      if (!document?.id) return { status: 400, body: { error: 'Document is required.' } }
      const result = await store.updateDocument(actor, { ...document, id: document.id })
      return result.ok
        ? { status: 200, body: { success: true, ...result } }
        : { status: writeErrorStatus(result.error), body: { error: result.error } }
    }

    const review = body.review && typeof body.review === 'object'
      ? body.review as { id?: string; decision?: ReviewDecision; reviewerEmail?: string; note?: string }
      : null
    if (!review?.id) return { status: 400, body: { error: 'Review is required.' } }
    const result = await store.updateReview(actor, {
      id: review.id,
      decision: review.decision,
      reviewerEmail: review.reviewerEmail,
      note: review.note || '',
    })
    return result.ok
      ? { status: 200, body: { success: true, ...result } }
      : { status: writeErrorStatus(result.error), body: { error: result.error } }
  } catch (error) {
    const status = authStatus(error)
    if (status) return { status, body: { error: error instanceof Error ? error.message : 'Leadership sign-in failed.' } }
    if (options.verifyIdentity) return { status: 401, body: { error: 'Your leadership sign-in is invalid or expired.' } }
    console.error('operations_request_failed', error instanceof Error ? error.name : 'UnknownError')
    return { status: 500, body: { error: 'Operations is temporarily unavailable.' } }
  }
}
