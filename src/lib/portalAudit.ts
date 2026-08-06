import type { DashboardRole } from './dashboardAccess.ts'

export type AuditTargetType = 'member' | 'event' | 'rsvp' | 'announcement' | 'resource' | 'admin-account'

export type AuditEntry = {
  id: string
  at: string
  actorEmail: string
  actorRole: DashboardRole
  action: string
  targetType: AuditTargetType
  targetId: string
  summary: string
}

/** Who performed a mutation. Carried into every audit entry the store writes. */
export type PortalAuditActor = {
  email: string
  role: DashboardRole
}

/** The document holds one JSON blob; the log is a capped ring buffer, newest 300. */
export const AUDIT_LOG_LIMIT = 300
export const AUDIT_SUMMARY_LIMIT = 240

const createId = (prefix: string) => {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`

  return `${prefix}_${suffix}`
}

export const buildAuditEntry = (input: Omit<AuditEntry, 'id' | 'at'>): AuditEntry => ({
  actorEmail: input.actorEmail.trim().toLowerCase(),
  actorRole: input.actorRole,
  action: input.action,
  targetType: input.targetType,
  targetId: input.targetId,
  summary: input.summary.replace(/\s+/g, ' ').trim().slice(0, AUDIT_SUMMARY_LIMIT),
  id: createId('audit'),
  at: new Date().toISOString(),
})

/** Appends and prunes to the newest AUDIT_LOG_LIMIT entries. Oldest first. */
export const appendAudit = (log: AuditEntry[], entry: AuditEntry): AuditEntry[] => {
  const current = Array.isArray(log) ? log : []
  const next = [...current, entry]
  return next.length > AUDIT_LOG_LIMIT ? next.slice(next.length - AUDIT_LOG_LIMIT) : next
}

/** Newest first, for the Console table. */
export const readAuditEntries = (log: AuditEntry[], limit = 100): AuditEntry[] => {
  const current = Array.isArray(log) ? log : []
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), AUDIT_LOG_LIMIT) : 100
  return [...current].reverse().slice(0, safeLimit)
}
