import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  ClipboardCheck,
  FileText,
  Gavel,
  History,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { LeadershipSection } from '@/features/leadership/components/LeadershipPage'
import { useLeadershipIdentity } from '@/features/decisions/leadershipIdentityContext'
import { withLeadershipRequestTimeout } from '@/features/decisions/logtoConvexAuth'
import {
  ATTENDANCE_STATUS_LABELS,
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_STATUS_LABELS,
  EVENT_STATUS_LABELS,
  OPERATIONS_ROLE_LABELS,
  OPERATIONS_SUPER_ADMINS,
  REVIEW_STAGE_LABELS,
  STRIKE_REASON_LABELS,
  STRIKE_STATUS_LABELS,
  type AdversarialReview,
  type AttendanceRecord,
  type AttendanceStatus,
  type DocumentCurrentStatus,
  type DocumentSourceStatus,
  type OperationsDocument,
  type OperationsRole,
  type OperationsWorkspace,
  type ReviewDecision,
  type StrikeReason,
  type StrikeRecord,
  type StrikeStatus,
} from '@/lib/operations'
import './operations.css'

type OperationsView = 'overview' | 'attendance' | 'strikes' | 'accounts' | 'documents' | 'reviews'
type ApiRecord = Record<string, unknown>

const tabs: Array<{ id: OperationsView; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'strikes', label: 'Strikes' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'documents', label: 'Documents' },
  { id: 'reviews', label: 'Reviews' },
]

class OperationsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const api = async (body: ApiRecord, idToken: string) => {
  const response = await withLeadershipRequestTimeout((signal) => fetch('/api/operations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, idToken }),
    cache: 'no-store',
    credentials: 'same-origin',
    signal,
  }))
  const payload = await response.json().catch(() => ({ error: 'Operations returned an invalid response.' })) as ApiRecord
  if (!response.ok) throw new OperationsApiError(
    typeof payload.error === 'string' ? payload.error : 'Operations is unavailable.',
    response.status,
  )
  return payload
}

const memberName = (workspace: OperationsWorkspace, email: string) => (
  workspace.accounts.find((account) => account.email === email)?.name || email
)

const formatMoment = (value: string) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const formatEventRange = (startsAt: string, endsAt: string) => {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(start)
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${day}, ${time.format(start)}–${time.format(end)} ET`
}

function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'amber' | 'red' | 'green' }) {
  return <Badge variant="outline" className={`operations-badge operations-badge--${tone}`}>{children}</Badge>
}

function Overview({ workspace }: { workspace: OperationsWorkspace }) {
  const event = workspace.events[0]
  const invitedAttendance = workspace.attendance.filter((item) => item.invited)
  const activeStrikeCount = workspace.strikes.filter((strike) => strike.status === 'active').length
  const escalations = workspace.strikeSummary.filter((summary) => summary.escalationRequired).length
  if (!event) return null
  const eventTone = event.status === 'active' ? 'green' : event.status === 'upcoming' ? 'blue' : 'neutral'
  return (
    <div className="ws-page operations-content">
      <LeadershipSection title="Today’s team meeting" titleId="operations-event-title">
        <div className="operations-event">
          <div className="operations-event__main">
            <div className="operations-event__icon"><ClipboardCheck aria-hidden="true" /></div>
            <div>
              <div className="operations-row-title">
                <h3>{event.title}</h3>
                <StatusBadge tone={eventTone}>{EVENT_STATUS_LABELS[event.status]}</StatusBadge>
              </div>
              <p className="operations-event__time">{formatEventRange(event.startsAt, event.endsAt)}</p>
              <p>{event.location}</p>
            </div>
          </div>
          {event.calendarUrl ? (
            <a href={event.calendarUrl} target="_blank" rel="noreferrer" className="operations-link">Calendar <ArrowUpRight aria-hidden="true" /></a>
          ) : null}
        </div>
      </LeadershipSection>

      <div className="operations-metric-grid" aria-label="Operations summary">
        <div className="operations-metric"><span>Attendance</span><strong>{invitedAttendance.filter((item) => item.status !== 'unrecorded').length}/{invitedAttendance.length}</strong></div>
        <div className="operations-metric"><span>Active strikes</span><strong>{activeStrikeCount}</strong>{escalations ? <StatusBadge tone="red">{escalations} due</StatusBadge> : null}</div>
        <div className="operations-metric"><span>Verified docs</span><strong>{workspace.documents.filter((document) => document.sourceStatus === 'verified').length}/{workspace.documents.length}</strong></div>
        <div className="operations-metric"><span>Approved reviews</span><strong>{workspace.reviews.filter((review) => review.stage === 'approved').length}/{workspace.reviews.length}</strong></div>
      </div>
    </div>
  )
}

function AttendanceRow({
  record,
  workspace,
  busy,
  onSave,
}: {
  record: AttendanceRecord
  workspace: OperationsWorkspace
  busy: boolean
  onSave: (attendance: Partial<AttendanceRecord> & Pick<AttendanceRecord, 'eventId' | 'memberEmail'>) => Promise<void>
}) {
  const [status, setStatus] = useState(record.status)
  const [noticeAt, setNoticeAt] = useState(record.noticeAt)
  const [notes, setNotes] = useState(record.notes)
  const editable = workspace.viewer.canWrite && record.invited
  return (
    <TableRow>
      <TableCell><span className="operations-person">{memberName(workspace, record.memberEmail)}</span><span className="operations-email">{record.memberEmail}</span></TableCell>
      <TableCell>
        <Select value={status} onValueChange={(value) => setStatus(value as AttendanceStatus)} disabled={!editable || busy}>
          <SelectTrigger size="sm" aria-label={`Attendance for ${memberName(workspace, record.memberEmail)}`}><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>{Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
      </TableCell>
      <TableCell><Input type="datetime-local" aria-label={`Notice time for ${memberName(workspace, record.memberEmail)}`} value={noticeAt} disabled={!editable || busy} onChange={(event) => setNoticeAt(event.target.value)} /></TableCell>
      <TableCell>{record.invited ? <Input aria-label={`Attendance notes for ${memberName(workspace, record.memberEmail)}`} value={notes} disabled={!editable || busy} onChange={(event) => setNotes(event.target.value)} placeholder="Evidence or exception" /> : <span className="operations-invite-note">{record.inviteSourceNote}</span>}</TableCell>
      <TableCell><Button size="sm" variant="outline" disabled={!editable || busy} onClick={() => onSave({ eventId: record.eventId, memberEmail: record.memberEmail, status, noticeAt, notes })}>{busy ? <Spinner data-icon="inline-start" /> : null}Save</Button></TableCell>
    </TableRow>
  )
}

function AttendancePanel({ workspace, busyKey, onMutate }: PanelProps) {
  const event = workspace.events[0]
  return (
    <div className="ws-page operations-content">
      <LeadershipSection title="Meeting attendance" titleId="attendance-title" flush>
        <div className="operations-table-wrap">
          <Table>
            <TableHeader><TableRow><TableHead>Member</TableHead><TableHead>Status</TableHead><TableHead>Notice received</TableHead><TableHead>Notes</TableHead><TableHead><span className="sr-only">Save</span></TableHead></TableRow></TableHeader>
            <TableBody>{workspace.attendance.filter((record) => record.eventId === event?.id).map((record) => (
              <AttendanceRow
                key={`${record.id}:${record.updatedAt}`}
                record={record}
                workspace={workspace}
                busy={busyKey === record.id}
                onSave={(attendance) => onMutate(record.id, 'updateAttendance', { attendance })}
              />
            ))}</TableBody>
          </Table>
        </div>
      </LeadershipSection>
    </div>
  )
}

function StrikeRow({ strike, workspace, busyKey, onMutate }: { strike: StrikeRecord } & PanelProps) {
  const [status, setStatus] = useState(strike.status)
  const [note, setNote] = useState('')
  return (
    <div className="operations-strike-row">
      <div>
        <div className="operations-row-title"><strong>{memberName(workspace, strike.memberEmail)}</strong><StatusBadge tone={strike.status === 'active' ? 'red' : 'neutral'}>{STRIKE_STATUS_LABELS[strike.status]}</StatusBadge></div>
        <p>{STRIKE_REASON_LABELS[strike.reason]} · {strike.detail}</p>
        <small>Issued {formatMoment(strike.issuedAt)} by {memberName(workspace, strike.issuedBy)}</small>
      </div>
      <div className="operations-inline-controls">
        <Select value={status} onValueChange={(value) => setStatus(value as StrikeStatus)} disabled={!workspace.viewer.canWrite || busyKey === strike.id}>
          <SelectTrigger size="sm" aria-label="Strike status"><SelectValue /></SelectTrigger>
          <SelectContent><SelectGroup>{Object.entries(STRIKE_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
        </Select>
        <Input aria-label="Strike audit note" placeholder="Required audit note" value={note} disabled={!workspace.viewer.canWrite || busyKey === strike.id} onChange={(event) => setNote(event.target.value)} />
        <Button size="sm" variant="outline" disabled={!workspace.viewer.canWrite || busyKey === strike.id || !note.trim()} onClick={() => onMutate(strike.id, 'updateStrikeStatus', { strike: { id: strike.id, status, note } })}>Update</Button>
      </div>
      <details className="operations-history"><summary><History aria-hidden="true" />Audit history ({strike.audit.length})</summary>{strike.audit.map((entry) => <p key={entry.id}><strong>{STRIKE_STATUS_LABELS[entry.toStatus]}</strong> · {entry.note}<span>{formatMoment(entry.createdAt)} · {memberName(workspace, entry.actorEmail)}</span></p>)}</details>
    </div>
  )
}

function StrikesPanel({ workspace, busyKey, onMutate }: PanelProps) {
  const [memberEmail, setMemberEmail] = useState(workspace.accounts.find((account) => account.role !== 'super_admin')?.email || workspace.accounts[0]?.email || '')
  const [reason, setReason] = useState<StrikeReason>('meeting_absence')
  const [detail, setDetail] = useState('')
  const create = async () => {
    await onMutate('new-strike', 'createStrike', { strike: { memberEmail, reason, detail, eventId: workspace.events[0]?.id || '' } })
    setDetail('')
  }
  return (
    <div className="ws-page operations-content">
      <details className="operations-policy-disclosure">
        <summary>Strike policy</summary>
        <ol>{workspace.policy.rules.map((rule) => <li key={rule}>{rule}</li>)}</ol>
        <a href={workspace.policy.sourceUrl} target="_blank" rel="noreferrer">Source <ArrowUpRight aria-hidden="true" /></a>
      </details>
      <LeadershipSection title="Add a documented strike" titleId="new-strike-title">
        <FieldGroup className="operations-strike-form">
          <Field><FieldLabel>Member</FieldLabel><Select value={memberEmail} onValueChange={setMemberEmail} disabled={!workspace.viewer.canWrite}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{workspace.accounts.map((account) => <SelectItem key={account.email} value={account.email}>{account.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
          <Field><FieldLabel>Reason</FieldLabel><Select value={reason} onValueChange={(value) => setReason(value as StrikeReason)} disabled={!workspace.viewer.canWrite}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{Object.entries(STRIKE_REASON_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>
          <Field className="operations-strike-form__detail"><FieldLabel>Evidence</FieldLabel><Input value={detail} onChange={(event) => setDetail(event.target.value)} disabled={!workspace.viewer.canWrite} placeholder="What happened, and what notice was or was not provided?" /></Field>
          <Button disabled={!workspace.viewer.canWrite || busyKey === 'new-strike' || !detail.trim()} onClick={() => void create()}>{busyKey === 'new-strike' ? <Spinner data-icon="inline-start" /> : null}Add strike</Button>
        </FieldGroup>
      </LeadershipSection>

      {workspace.strikeSummary.some((summary) => summary.escalationRequired) ? (
        <Alert variant="destructive"><AlertTriangle aria-hidden="true" /><AlertTitle>Three-strike escalation required</AlertTitle><AlertDescription>{workspace.strikeSummary.filter((summary) => summary.escalationRequired).map((summary) => memberName(workspace, summary.memberEmail)).join(', ')} must meet with Sam, Alexa, and Cooper to review e-board standing.</AlertDescription></Alert>
      ) : null}

      <LeadershipSection title={`Escalations (${workspace.escalations.length})`} titleId="strike-escalations-title" flush>
        {workspace.escalations.length ? <div className="operations-list">{workspace.escalations.map((escalation) => <div className="operations-strike-row" key={escalation.id}><div className="operations-row-title"><strong>{memberName(workspace, escalation.memberEmail)}</strong><StatusBadge tone={escalation.status === 'open' ? 'red' : 'green'}>{escalation.status}</StatusBadge></div><p>{memberName(workspace, escalation.ownerEmail)} · Due {formatMoment(escalation.dueAt)}</p><details className="operations-history"><summary><History aria-hidden="true" />History ({escalation.history.length})</summary>{escalation.history.map((entry) => <p key={entry.id}><strong>{entry.action}</strong> · {entry.note}<span>{formatMoment(entry.createdAt)} · {entry.activeStrikeCount} active strikes</span></p>)}</details></div>)}</div> : <div className="operations-empty"><ShieldCheck aria-hidden="true" /><strong>No escalations</strong></div>}
      </LeadershipSection>

      <LeadershipSection title={`Strike ledger (${workspace.strikes.length})`} titleId="strike-ledger-title" flush>
        {workspace.strikes.length ? <div className="operations-list">{workspace.strikes.map((strike) => <StrikeRow key={`${strike.id}:${strike.updatedAt}`} strike={strike} workspace={workspace} busyKey={busyKey} onMutate={onMutate} />)}</div> : <div className="operations-empty"><Gavel aria-hidden="true" /><strong>No strikes</strong></div>}
      </LeadershipSection>
    </div>
  )
}

function AccountsPanel({ workspace, busyKey, onMutate }: PanelProps) {
  return (
    <div className="ws-page operations-content">
      <LeadershipSection title="Account roles and views" titleId="accounts-title" flush>
        <div className="operations-table-wrap"><Table><TableHeader><TableRow><TableHead>Person</TableHead><TableHead>Title</TableHead><TableHead>Operations view</TableHead><TableHead>Write access</TableHead></TableRow></TableHeader><TableBody>{workspace.accounts.map((account) => {
          const fixedAdmin = (OPERATIONS_SUPER_ADMINS as readonly string[]).includes(account.email)
          return <TableRow key={account.email}><TableCell><span className="operations-person">{account.name}</span><span className="operations-email">{account.email}</span></TableCell><TableCell>{account.title}</TableCell><TableCell><Select value={account.role} disabled={!workspace.viewer.canWrite || fixedAdmin || busyKey === account.email} onValueChange={(role) => onMutate(account.email, 'updateAccount', { account: { email: account.email, role: role as OperationsRole } })}><SelectTrigger size="sm" aria-label={`Role for ${account.name}`}><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{(fixedAdmin ? ['super_admin'] : ['officer', 'member', 'inactive']).map((role) => <SelectItem key={role} value={role}>{OPERATIONS_ROLE_LABELS[role as OperationsRole]}</SelectItem>)}</SelectGroup></SelectContent></Select></TableCell><TableCell>{fixedAdmin ? <StatusBadge tone="blue"><LockKeyhole aria-hidden="true" />Privileged</StatusBadge> : <span className="operations-muted">Read only</span>}</TableCell></TableRow>
        })}</TableBody></Table></div>
      </LeadershipSection>
    </div>
  )
}

function DocumentRow({ document, workspace, busyKey, onMutate }: { document: OperationsDocument } & PanelProps) {
  const [driveUrl, setDriveUrl] = useState(document.driveUrl)
  const [sourceStatus, setSourceStatus] = useState(document.sourceStatus)
  const [currentStatus, setCurrentStatus] = useState(document.currentStatus)
  const [sourceNote, setSourceNote] = useState(document.sourceNote)
  return (
    <div className="operations-document-row">
      <div className="operations-document-row__heading"><FileText aria-hidden="true" /><div><div className="operations-row-title"><strong>{document.title}</strong><StatusBadge tone={document.sourceStatus === 'verified' ? 'green' : 'amber'}>{document.sourceStatus}</StatusBadge></div><span>{DOCUMENT_CATEGORY_LABELS[document.category]} · Owner {memberName(workspace, document.ownerEmail)}</span></div>{document.driveUrl ? <a href={document.driveUrl} target="_blank" rel="noreferrer" aria-label={`Open ${document.title}`}>Open <ArrowUpRight aria-hidden="true" /></a> : null}</div>
      {workspace.viewer.canWrite ? <FieldGroup className="operations-document-fields"><Field><FieldLabel>Drive link</FieldLabel><Input value={driveUrl} onChange={(event) => setDriveUrl(event.target.value)} /></Field><Field><FieldLabel>Source</FieldLabel><Select value={sourceStatus} onValueChange={(value) => setSourceStatus(value as DocumentSourceStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="verified">Verified</SelectItem><SelectItem value="unverified">Unverified</SelectItem></SelectGroup></SelectContent></Select></Field><Field><FieldLabel>Current status</FieldLabel><Select value={currentStatus} onValueChange={(value) => setCurrentStatus(value as DocumentCurrentStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{Object.entries(DOCUMENT_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field><Field className="operations-document-fields__note"><FieldLabel>Source / status note</FieldLabel><Textarea value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} /></Field><Button variant="outline" disabled={busyKey === document.id} onClick={() => onMutate(document.id, 'updateDocument', { document: { id: document.id, driveUrl, sourceStatus, currentStatus, sourceNote } })}>Save metadata</Button></FieldGroup> : <p className="operations-document-note">{document.sourceNote}</p>}
    </div>
  )
}

function DocumentsPanel({ workspace, busyKey, onMutate }: PanelProps) {
  return <div className="ws-page operations-content"><LeadershipSection title="Document library" titleId="document-library-title" flush><div className="operations-list">{workspace.documents.map((document) => <DocumentRow key={`${document.id}:${document.updatedAt}`} document={document} workspace={workspace} busyKey={busyKey} onMutate={onMutate} />)}</div></LeadershipSection></div>
}

function ReviewCard({ review, workspace, busyKey, onMutate }: { review: AdversarialReview } & PanelProps) {
  const [reviewerEmail, setReviewerEmail] = useState(review.reviewerEmail)
  const [note, setNote] = useState('')
  const reviewerOnly = workspace.viewer.email === review.reviewerEmail
  const assignmentOpen = review.stage === 'draft' || review.stage === 'changes_requested'
  const canAssign = workspace.viewer.canWrite && workspace.viewer.email !== review.ownerEmail && assignmentOpen
  const decide = (decision: ReviewDecision) => onMutate(review.id, 'updateReview', { review: { id: review.id, decision, note } })
  return (
    <div className="operations-review-card">
      <div className="operations-review-card__header"><div><div className="operations-row-title"><strong>{review.title}</strong><StatusBadge tone={review.stage === 'approved' ? 'green' : review.stage === 'changes_requested' ? 'red' : 'blue'}>{REVIEW_STAGE_LABELS[review.stage]}</StatusBadge></div><p>{memberName(workspace, review.ownerEmail)} → {memberName(workspace, review.reviewerEmail)}</p></div>{!review.independentReviewer ? <StatusBadge tone="red">Conflict</StatusBadge> : null}</div>
      {workspace.viewer.canWrite ? <div className="operations-review-controls"><Field><FieldLabel>Independent reviewer</FieldLabel><Select value={reviewerEmail} disabled={!canAssign} onValueChange={setReviewerEmail}><SelectTrigger aria-label={`Independent reviewer for ${review.title}`}><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{workspace.accounts.filter((account) => (OPERATIONS_SUPER_ADMINS as readonly string[]).includes(account.email) && account.email !== review.ownerEmail).map((account) => <SelectItem key={account.email} value={account.email}>{account.name}</SelectItem>)}</SelectGroup></SelectContent></Select>{!canAssign ? <span className="operations-control-note">{workspace.viewer.email === review.ownerEmail ? 'The artifact owner cannot assign its reviewer.' : 'Reviewer assignment is frozen at this stage.'}</span> : null}</Field><Button variant="outline" disabled={!canAssign || reviewerEmail === review.reviewerEmail || busyKey === review.id} onClick={() => onMutate(review.id, 'updateReview', { review: { id: review.id, reviewerEmail, note: `Assigned ${memberName(workspace, reviewerEmail)} as independent reviewer.` } })}>Assign</Button><Field className="operations-review-controls__note"><FieldLabel>Review note</FieldLabel><Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record evidence, concerns, or required changes" /></Field><div className="operations-review-actions">{(review.stage === 'draft' || review.stage === 'changes_requested') && <Button onClick={() => void decide('submit')}>Submit for review</Button>}{review.stage === 'ready_for_review' && reviewerOnly && <Button onClick={() => void decide('start_review')}>Start review</Button>}{review.stage === 'in_review' && reviewerOnly && <><Button variant="outline" disabled={!note.trim()} onClick={() => void decide('request_changes')}>Request changes</Button><Button disabled={!note.trim()} onClick={() => void decide('approve')}>Approve</Button></>}{review.stage === 'approved' && <Button variant="outline" onClick={() => void decide('reopen')}>Reopen</Button>}</div></div> : null}
      <details className="operations-history"><summary><History aria-hidden="true" />Stage history ({review.history.length})</summary>{review.history.length ? review.history.map((entry) => <p key={entry.id}><strong>{REVIEW_STAGE_LABELS[entry.toStage]}</strong> · {entry.note || entry.action.replaceAll('_', ' ')}<span>{formatMoment(entry.createdAt)} · {memberName(workspace, entry.actorEmail)}</span></p>) : <p>No stage changes yet.</p>}</details>
    </div>
  )
}

function ReviewsPanel({ workspace, busyKey, onMutate }: PanelProps) {
  return <div className="ws-page operations-content"><LeadershipSection title="Review queue" titleId="review-queue-title" flush><div className="operations-list">{workspace.reviews.map((review) => <ReviewCard key={`${review.id}:${review.updatedAt}`} review={review} workspace={workspace} busyKey={busyKey} onMutate={onMutate} />)}</div></LeadershipSection></div>
}

type PanelProps = {
  workspace: OperationsWorkspace
  busyKey: string
  onMutate: (key: string, action: string, payload: ApiRecord) => Promise<void>
}

function OperationsWorkspaceView({
  workspace,
  setWorkspace,
  callApi,
}: {
  workspace: OperationsWorkspace
  setWorkspace: (workspace: OperationsWorkspace) => void
  callApi: (body: ApiRecord) => Promise<ApiRecord>
}) {
  const [view, setView] = useState<OperationsView>('overview')
  const [busyKey, setBusyKey] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const now = Date.now()
    const nextBoundary = workspace.events
      .flatMap((event) => [Date.parse(event.startsAt), Date.parse(event.endsAt)])
      .filter((value) => Number.isFinite(value) && value > now)
      .sort((left, right) => left - right)[0]
    if (!nextBoundary) return
    const timer = window.setTimeout(() => {
      void callApi({ action: 'workspace' }).then((result) => {
        setWorkspace(result.workspace as OperationsWorkspace)
      }).catch(() => {
        // A boundary refresh is a convenience; an expired session should not
        // replace the already-visible workspace with an error screen.
      })
    }, Math.min(nextBoundary - now + 250, 2_147_000_000))
    return () => window.clearTimeout(timer)
  }, [callApi, setWorkspace, workspace.events])

  const onMutate = async (key: string, action: string, payload: ApiRecord) => {
    setBusyKey(key)
    setError('')
    try {
      await callApi({ action, ...payload })
      const refreshed = await callApi({ action: 'workspace' })
      setWorkspace(refreshed.workspace as OperationsWorkspace)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The Operations change could not be saved.')
    } finally {
      setBusyKey('')
    }
  }

  return (
    <Tabs value={view} onValueChange={(value) => setView(value as OperationsView)} className="operations-root">
      <TabsList className="operations-tabs" aria-label="Operations sections">{tabs.map((tab) => <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>)}</TabsList>
      {!workspace.viewer.canWrite ? <div className="ws-page operations-readonly"><Alert><LockKeyhole aria-hidden="true" /><AlertTitle>Read-only Operations view</AlertTitle><AlertDescription>Only Sam, Alexa, and Cooper can change attendance, strikes, accounts, documents, or reviews.</AlertDescription></Alert></div> : null}
      {error ? <div className="ws-page operations-error"><Alert variant="destructive"><AlertTitle>Change not saved</AlertTitle><AlertDescription>{error}</AlertDescription></Alert></div> : null}
      <TabsContent value="overview"><Overview workspace={workspace} /></TabsContent>
      <TabsContent value="attendance"><AttendancePanel workspace={workspace} busyKey={busyKey} onMutate={onMutate} /></TabsContent>
      <TabsContent value="strikes"><StrikesPanel workspace={workspace} busyKey={busyKey} onMutate={onMutate} /></TabsContent>
      <TabsContent value="accounts"><AccountsPanel workspace={workspace} busyKey={busyKey} onMutate={onMutate} /></TabsContent>
      <TabsContent value="documents"><DocumentsPanel workspace={workspace} busyKey={busyKey} onMutate={onMutate} /></TabsContent>
      <TabsContent value="reviews"><ReviewsPanel workspace={workspace} busyKey={busyKey} onMutate={onMutate} /></TabsContent>
    </Tabs>
  )
}

export function OperationsEntry() {
  const identity = useLeadershipIdentity()
  const [workspace, setWorkspace] = useState<OperationsWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const callApi = useCallback(async (body: ApiRecord) => {
    let idToken = await withLeadershipRequestTimeout(() => identity.getIdToken())
    if (!idToken) throw new Error('Your leadership session could not be verified.')
    try {
      return await api(body, idToken)
    } catch (caught) {
      if (!(caught instanceof OperationsApiError) || caught.status !== 401) throw caught
      idToken = await withLeadershipRequestTimeout(() => identity.getIdToken(true))
      if (!idToken) throw caught
      return await api(body, idToken)
    }
  }, [identity])

  useEffect(() => {
    let active = true
    callApi({ action: 'workspace' })
      .then((result) => active && setWorkspace(result.workspace as OperationsWorkspace))
      .catch((caught) => active && setError(caught instanceof Error ? caught.message : 'Operations could not be loaded.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [attempt, callApi])

  const retry = () => { setError(''); setLoading(true); setAttempt((value) => value + 1) }
  if (loading) return <div className="operations-loading" aria-live="polite"><Spinner /><span>Loading Operations…</span></div>
  if (error || !workspace) return <div className="ws-page operations-load-error"><Alert variant="destructive"><AlertTitle>Operations could not be opened</AlertTitle><AlertDescription>{error || 'Try refreshing the leadership workspace.'}</AlertDescription></Alert><Button variant="outline" onClick={retry}>Try again</Button></div>
  return <OperationsWorkspaceView workspace={workspace} setWorkspace={setWorkspace} callApi={callApi} />
}
