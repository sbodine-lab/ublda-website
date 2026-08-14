import { FIXED_ADMIN_EMAILS } from './adminPolicy.ts'

export const OPERATIONS_SUPER_ADMINS = FIXED_ADMIN_EMAILS

export type OperationsSuperAdminEmail = typeof OPERATIONS_SUPER_ADMINS[number]
export type OperationsRole = 'super_admin' | 'officer' | 'member' | 'inactive'
export type OperationsEventStatus = 'upcoming' | 'active' | 'inactive'
export type AttendanceStatus = 'not_invited' | 'unrecorded' | 'present' | 'late' | 'absent' | 'excused'
export type StrikeReason = 'meeting_absence' | 'notice' | 'deliverable' | 'communication'
export type StrikeStatus = 'active' | 'excused' | 'voided'
export type StrikeEscalationStatus = 'open' | 'resolved'
export type DocumentCategory = 'constitution' | 'meeting_notes' | 'archive'
export type DocumentSourceStatus = 'verified' | 'unverified'
export type DocumentCurrentStatus = 'current' | 'draft' | 'superseded' | 'archived' | 'unverified'
export type ReviewStage = 'draft' | 'ready_for_review' | 'in_review' | 'changes_requested' | 'approved'
export type ReviewDecision = 'submit' | 'start_review' | 'approve' | 'request_changes' | 'reopen'

export const OPERATIONS_ROLE_LABELS: Record<OperationsRole, string> = {
  super_admin: 'Super admin',
  officer: 'Officer',
  member: 'Member',
  inactive: 'Inactive',
}

export const EVENT_STATUS_LABELS: Record<OperationsEventStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active now',
  inactive: 'Inactive',
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  not_invited: 'Not on invite',
  unrecorded: 'Not recorded',
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused',
}

export const STRIKE_REASON_LABELS: Record<StrikeReason, string> = {
  meeting_absence: 'Meeting absence',
  notice: 'Notice requirement',
  deliverable: 'Missed deliverable',
  communication: 'Communication',
}

export const STRIKE_STATUS_LABELS: Record<StrikeStatus, string> = {
  active: 'Active',
  excused: 'Excused',
  voided: 'Voided',
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  constitution: 'Constitution',
  meeting_notes: 'Meeting notes',
  archive: 'Archive',
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentCurrentStatus, string> = {
  current: 'Current',
  draft: 'Draft',
  superseded: 'Superseded',
  archived: 'Archived',
  unverified: 'Unverified',
}

export const REVIEW_STAGE_LABELS: Record<ReviewStage, string> = {
  draft: 'Draft',
  ready_for_review: 'Ready for review',
  in_review: 'In review',
  changes_requested: 'Changes requested',
  approved: 'Approved',
}

export interface OperationsAccount {
  email: string
  name: string
  title: string
  role: OperationsRole
  updatedAt: string
  updatedBy: string
}

export interface OperationsEvent {
  id: string
  title: string
  startsAt: string
  endsAt: string
  timezone: 'America/Detroit'
  status: OperationsEventStatus
  location: string
  sourceNote: string
  sourceStatus: 'user_directive' | 'calendar_snapshot' | 'user_confirmed'
  calendarStartsAt: string
  calendarEndsAt: string
  calendarUrl: string
  lastVerifiedAt: string
}

export interface AttendanceRecord {
  id: string
  eventId: string
  memberEmail: string
  invited: boolean
  inviteSourceNote: string
  status: AttendanceStatus
  noticeAt: string
  notes: string
  updatedAt: string
  updatedBy: string
}

export interface StrikeEscalationHistoryEntry {
  id: string
  action: 'opened' | 'resolved'
  activeStrikeCount: number
  actorEmail: string
  note: string
  createdAt: string
}

export interface StrikeEscalation {
  id: string
  memberEmail: string
  ownerEmail: string
  dueAt: string
  status: StrikeEscalationStatus
  openedAt: string
  resolvedAt: string
  resolutionNote: string
  history: StrikeEscalationHistoryEntry[]
  updatedAt: string
}

export interface StrikeAuditEntry {
  id: string
  action: 'created' | 'status_changed' | 'note_added'
  fromStatus: StrikeStatus | ''
  toStatus: StrikeStatus
  note: string
  actorEmail: string
  createdAt: string
}

export interface StrikeRecord {
  id: string
  memberEmail: string
  reason: StrikeReason
  detail: string
  eventId: string
  status: StrikeStatus
  issuedAt: string
  issuedBy: string
  updatedAt: string
  audit: StrikeAuditEntry[]
}

export interface StrikeSummary {
  memberEmail: string
  activeCount: number
  escalationRequired: boolean
}

export interface OperationsDocument {
  id: string
  title: string
  category: DocumentCategory
  driveUrl: string
  sourceStatus: DocumentSourceStatus
  currentStatus: DocumentCurrentStatus
  sourceNote: string
  ownerEmail: string
  lastVerifiedAt: string
  updatedAt: string
  updatedBy: string
}

export interface ReviewNote {
  id: string
  authorEmail: string
  note: string
  createdAt: string
}

export interface ReviewHistoryEntry {
  id: string
  action: ReviewDecision | 'assigned'
  fromStage: ReviewStage
  toStage: ReviewStage
  actorEmail: string
  note: string
  createdAt: string
}

export interface AdversarialReview {
  id: string
  title: string
  artifactType: 'document' | 'decision' | 'deliverable'
  artifactId: string
  ownerEmail: string
  reviewerEmail: string
  stage: ReviewStage
  independentReviewer: boolean
  reviewNotes: ReviewNote[]
  history: ReviewHistoryEntry[]
  updatedAt: string
}

export interface OperationsActivity {
  id: string
  actorEmail: string
  action: string
  detail: string
  createdAt: string
}

export interface OperationsViewer {
  memberId: string
  name: string
  email: string
  role: OperationsRole
  canWrite: boolean
}

export interface OperationsWorkspace {
  viewer: OperationsViewer
  accounts: OperationsAccount[]
  events: OperationsEvent[]
  attendance: AttendanceRecord[]
  strikes: StrikeRecord[]
  strikeSummary: StrikeSummary[]
  escalations: StrikeEscalation[]
  documents: OperationsDocument[]
  reviews: AdversarialReview[]
  activity: OperationsActivity[]
  policy: {
    escalationAt: 3
    source: string
    sourceUrl: string
    rules: string[]
  }
}
