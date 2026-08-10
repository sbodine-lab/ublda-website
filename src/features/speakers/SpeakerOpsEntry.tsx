import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CircleDot,
  DoorOpen,
  FolderKanban,
  Home,
  KeyRound,
  ListFilter,
  LogOut,
  MessageCircleQuestion,
  MicVocal,
  PanelLeft,
  Search,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  PROGRAM_SLOT_STATUS_LABELS,
  PROGRAM_TERM_LABELS,
  ROOM_REQUEST_STATUS_LABELS,
  SPEAKER_FORMAT_LABELS,
  SPEAKER_OPS_MEMBERS,
  SPEAKER_OPS_SESSION_DAYS,
  SPEAKER_STAGE_LABELS,
  type ProgramSlot,
  type ProgramSlotStatus,
  type ProgramTerm,
  type RoomRequest,
  type RoomRequestStatus,
  type SpeakerFormat,
  type SpeakerLead,
  type SpeakerOpsAccount,
  type SpeakerOpsWorkspace,
  type SpeakerStage,
} from '@/lib/speakerOps'
import './speaker-ops.css'

type WorkspaceView = 'pipeline' | 'slots' | 'rooms' | 'calendar' | 'access'
type ApiRecord = Record<string, unknown>

const SESSION_KEY = 'ublda-speaker-ops-session'
const ROSS_ROOM_URL = 'https://rossweb.bus.umich.edu/ross-operations/event-form-instructions/'
const ROSS_CALENDAR_URL = 'https://rossweb.bus.umich.edu/academics/studentresources/ross-academic-calendar/'

const navigation: Array<{ id: WorkspaceView; label: string; icon: typeof Users }> = [
  { id: 'pipeline', label: 'Pipeline', icon: Users },
  { id: 'slots', label: 'Program slots', icon: CircleDot },
  { id: 'rooms', label: 'Room requests', icon: DoorOpen },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'access', label: 'Access', icon: ShieldCheck },
]

const leadershipNavigation = [
  { to: '/workspace', label: 'Overview', icon: Home },
  { to: '/decisions', label: 'Questions', icon: MessageCircleQuestion },
  { to: '/scheduling', label: 'Scheduling', icon: CalendarClock },
  { to: '/leadership/speakers', label: 'Speaker Ops', icon: MicVocal, current: true },
  { to: '/calendar', label: 'Club calendar', icon: CalendarDays },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/people', label: 'People', icon: Users },
]

const mobileLeadershipNavigation = leadershipNavigation.filter((item) => (
  ['/decisions', '/scheduling', '/leadership/speakers', '/calendar'].includes(item.to)
))

const api = async (body: ApiRecord) => {
  const response = await fetch('/api/speaker-ops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({ error: 'Speaker Ops returned an invalid response.' })) as ApiRecord
  if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Speaker Ops is unavailable.')
  return payload
}

const formatShortDate = (value: string) => {
  if (!value) return 'Not set'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Detroit',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const relativeDate = (value: string) => {
  if (!value) return 'No contact'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value))
}

const ownerName = (email: string) => SPEAKER_OPS_MEMBERS.find((member) => member.email === email)?.name.split(' ')[0] || email

const stageTone = (stage: SpeakerStage) => {
  if (stage === 'committed') return 'blue'
  if (stage === 'funding-blocked') return 'yellow'
  if (stage === 'closed' || stage === 'deferred') return 'muted'
  return 'outline'
}

const slotTone = (status: ProgramSlotStatus) => {
  if (status === 'confirmed' || status === 'room-approved') return 'blue'
  if (status === 'room-requested') return 'yellow'
  return 'outline'
}

function StatusBadge({ label, tone = 'outline' }: { label: string; tone?: string }) {
  return <Badge variant="outline" className={cn('speaker-badge', `speaker-badge--${tone}`)}>{label}</Badge>
}

function SignIn({ onSignedIn }: { onSignedIn: (account: SpeakerOpsAccount, token: string) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api({ action: 'signIn', email, password })
      const account = result.account as SpeakerOpsAccount
      const token = String(result.sessionToken || '')
      localStorage.setItem(SESSION_KEY, token)
      onSignedIn(account, token)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main id="main-content" className="speaker-auth">
      <section className="speaker-auth__panel" aria-labelledby="speaker-signin-title">
        <a href="/" className="speaker-auth__logo" aria-label="UBLDA home"><img src="/logo.png" alt="" /></a>
        <div className="speaker-auth__heading">
          <h1 id="speaker-signin-title">Speaker Ops</h1>
          <p>Leadership access only.</p>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Sign-in failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="speaker-email">Michigan email</FieldLabel>
              <Input
                id="speaker-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="uniqname@umich.edu"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="speaker-password">Password</FieldLabel>
              <Input
                id="speaker-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
            <Button type="submit" size="sm" disabled={busy} className="w-full">
              {busy && <Spinner data-icon="inline-start" />}
              Sign in
            </Button>
          </FieldGroup>
        </form>
        <p className="speaker-auth__footnote">Only the nine current leadership accounts can sign in. New accounts cannot be created here.</p>
      </section>
    </main>
  )
}

function PasswordChange({
  open,
  token,
  onChanged,
}: {
  open: boolean
  token: string
  onChanged: (account: SpeakerOpsAccount) => void
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (nextPassword !== confirmPassword) {
      setError('New passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const result = await api({ action: 'changePassword', sessionToken: token, currentPassword, nextPassword })
      onChanged(result.account as SpeakerOpsAccount)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not change the password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="speaker-password-dialog"
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Set your password</DialogTitle>
          <DialogDescription>Replace your temporary password before using Speaker Ops. Use at least 12 characters.</DialogDescription>
        </DialogHeader>
        {error && <p className="speaker-form-error" role="alert">{error}</p>}
        <form id="speaker-password-form" onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="current-password">Temporary password</FieldLabel>
              <Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input id="new-password" type="password" autoComplete="new-password" minLength={12} value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
              <Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </Field>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button form="speaker-password-form" type="submit" size="sm" disabled={busy}>
            {busy && <Spinner data-icon="inline-start" />}
            Save password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProgramSlots({
  workspace,
  onEdit,
}: {
  workspace: SpeakerOpsWorkspace
  onEdit: (slot: ProgramSlot) => void
}) {
  return (
    <section className="speaker-section" aria-labelledby="program-slots-title">
      <div className="speaker-section__heading">
        <div>
          <h2 id="program-slots-title">Program slots</h2>
          <p>One fall fireside and one winter fireside. Either slot can stay empty.</p>
        </div>
      </div>
      <div className="speaker-slot-list">
        {workspace.slots.map((slot) => {
          const room = workspace.roomRequests.find((request) => request.id === slot.roomRequestId)
          const lead = workspace.leads.find((candidate) => candidate.id === slot.leadId)
          return (
            <button key={slot.id} type="button" className="speaker-slot-row" onClick={() => onEdit(slot)}>
              <span className="speaker-slot-row__name">{slot.label}</span>
              <StatusBadge label={PROGRAM_SLOT_STATUS_LABELS[slot.status]} tone={slotTone(slot.status)} />
              <span><span className="speaker-label-inline">Preferred</span>{formatShortDate(slot.preferredStart)}</span>
              <span><span className="speaker-label-inline">Speaker</span>{lead?.name || 'Not chosen'}</span>
              <span><span className="speaker-label-inline">Room</span>{room?.roomName || ROOM_REQUEST_STATUS_LABELS[room?.status || 'draft']}</span>
              <Settings2 aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </section>
  )
}

function Pipeline({
  workspace,
  selectedLead,
  onSelect,
}: {
  workspace: SpeakerOpsWorkspace
  selectedLead: SpeakerLead | null
  onSelect: (lead: SpeakerLead) => void
}) {
  const [query, setQuery] = useState('')
  const [term, setTerm] = useState<ProgramTerm | 'all'>('all')
  const visibleLeads = useMemo(() => workspace.leads
    .filter((lead) => term === 'all' || lead.term === term)
    .filter((lead) => `${lead.name} ${lead.organization} ${lead.nextAction}`.toLowerCase().includes(query.toLowerCase()))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)), [query, term, workspace.leads])

  return (
    <section className="speaker-section speaker-section--pipeline" aria-labelledby="pipeline-title">
      <div className="speaker-section__heading speaker-section__heading--controls">
        <div>
          <h2 id="pipeline-title">Pipeline</h2>
          <p>{visibleLeads.length} speakers</p>
        </div>
        <div className="speaker-filters">
          <div className="speaker-search">
            <Search aria-hidden="true" />
            <Input aria-label="Search speakers" placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <Select value={term} onValueChange={(value) => setTerm(value as ProgramTerm | 'all')}>
            <SelectTrigger size="sm" aria-label="Filter by term">
              <ListFilter aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">All terms</SelectItem>
                <SelectItem value="fall-2026">Fall 2026</SelectItem>
                <SelectItem value="winter-2027">Winter 2027</SelectItem>
                <SelectItem value="later">Later</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="speaker-table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Speaker</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Term</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Next action</TableHead>
              <TableHead>Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleLeads.map((lead) => (
              <TableRow
                key={lead.id}
                data-state={selectedLead?.id === lead.id ? 'selected' : undefined}
                className="speaker-table-row"
                onClick={() => onSelect(lead)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onSelect(lead)
                }}
              >
                <TableCell>
                  <span className="speaker-name">{lead.name}</span>
                  <span className="speaker-org">{lead.organization}</span>
                </TableCell>
                <TableCell><StatusBadge label={SPEAKER_STAGE_LABELS[lead.stage]} tone={stageTone(lead.stage)} /></TableCell>
                <TableCell>{PROGRAM_TERM_LABELS[lead.term]}</TableCell>
                <TableCell>{SPEAKER_FORMAT_LABELS[lead.format]}</TableCell>
                <TableCell>{ownerName(lead.ownerEmail)}</TableCell>
                <TableCell className="speaker-next-action">{lead.nextAction}</TableCell>
                <TableCell>{relativeDate(lead.lastContactAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function LeadSheet({
  lead,
  open,
  onOpenChange,
  onSave,
}: {
  lead: SpeakerLead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (lead: SpeakerLead) => Promise<void>
}) {
  const [draft, setDraft] = useState<SpeakerLead | null>(lead)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => setDraft(lead), [lead])
  if (!draft) return null

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await onSave(draft)
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the speaker.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="speaker-sheet sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{draft.name}</SheetTitle>
          <SheetDescription>{draft.organization}</SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="speaker-sheet__body">
          {error && <p className="speaker-form-error" role="alert">{error}</p>}
          <FieldGroup className="gap-4">
            <div className="speaker-field-grid">
              <Field>
                <FieldLabel>Stage</FieldLabel>
                <Select value={draft.stage} onValueChange={(stage) => setDraft({ ...draft, stage: stage as SpeakerStage })}>
                  <SelectTrigger className="w-full" aria-label="Stage"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>{Object.entries(SPEAKER_STAGE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Term</FieldLabel>
                <Select value={draft.term} onValueChange={(term) => setDraft({ ...draft, term: term as ProgramTerm })}>
                  <SelectTrigger className="w-full" aria-label="Term"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>{Object.entries(PROGRAM_TERM_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Format</FieldLabel>
                <Select value={draft.format} onValueChange={(format) => setDraft({ ...draft, format: format as SpeakerFormat })}>
                  <SelectTrigger className="w-full" aria-label="Format"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>{Object.entries(SPEAKER_FORMAT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Owner</FieldLabel>
                <Select value={draft.ownerEmail} onValueChange={(ownerEmail) => setDraft({ ...draft, ownerEmail: ownerEmail as SpeakerLead['ownerEmail'] })}>
                  <SelectTrigger className="w-full" aria-label="Owner"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectGroup>{SPEAKER_OPS_MEMBERS.map((member) => <SelectItem key={member.email} value={member.email}>{member.name}</SelectItem>)}</SelectGroup></SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="lead-next-action">Next action</FieldLabel>
              <Textarea id="lead-next-action" rows={2} value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-blocker">Blocker</FieldLabel>
              <Textarea id="lead-blocker" rows={2} value={draft.blocker} onChange={(event) => setDraft({ ...draft, blocker: event.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="lead-evidence">Evidence</FieldLabel>
              <Textarea id="lead-evidence" rows={4} value={draft.evidence} onChange={(event) => setDraft({ ...draft, evidence: event.target.value })} />
              <FieldDescription>Keep the source and date. Do not turn an interested reply into a confirmed date.</FieldDescription>
            </Field>
          </FieldGroup>
        </div>
        <SheetFooter className="speaker-sheet__footer">
          <Button size="sm" onClick={save} disabled={busy}>
            {busy && <Spinner data-icon="inline-start" />}
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SlotSheet({
  slot,
  workspace,
  open,
  onOpenChange,
  onSave,
}: {
  slot: ProgramSlot | null
  workspace: SpeakerOpsWorkspace
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (slot: ProgramSlot) => Promise<void>
}) {
  const [draft, setDraft] = useState<ProgramSlot | null>(slot)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setDraft(slot), [slot])
  if (!draft) return null
  const room = workspace.roomRequests.find((request) => request.id === draft.roomRequestId)
  const candidates = workspace.leads.filter((lead) => lead.term === draft.term && !['closed', 'deferred', 'funding-blocked'].includes(lead.stage))

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      await onSave(draft)
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the slot.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="speaker-sheet sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{draft.label}</SheetTitle>
          <SheetDescription>Dates stay internal until Ross approves the room.</SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="speaker-sheet__body">
          {error && <p className="speaker-form-error" role="alert">{error}</p>}
          <Alert className="speaker-room-gate">
            <DoorOpen />
            <AlertTitle>Room gate</AlertTitle>
            <AlertDescription>{room?.status === 'approved' ? `Approved: ${room.roomName}` : `Ross request is ${room?.status || 'not started'}.`}</AlertDescription>
          </Alert>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Speaker</FieldLabel>
              <Select value={draft.leadId || 'none'} onValueChange={(leadId) => setDraft({ ...draft, leadId: leadId === 'none' ? '' : leadId })}>
                <SelectTrigger className="w-full" aria-label="Speaker"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup><SelectItem value="none">Not chosen</SelectItem>{candidates.map((lead) => <SelectItem key={lead.id} value={lead.id}>{lead.name}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select value={draft.status} onValueChange={(status) => setDraft({ ...draft, status: status as ProgramSlotStatus })}>
                <SelectTrigger className="w-full" aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent><SelectGroup>{Object.entries(PROGRAM_SLOT_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
              </Select>
              <FieldDescription>Only Sam or Alexa can confirm. The server checks Ross approval.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="preferred-start">Preferred date and time</FieldLabel>
              <Input id="preferred-start" value={draft.preferredStart} onChange={(event) => setDraft({ ...draft, preferredStart: event.target.value })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="backup-start">Backup date and time</FieldLabel>
              <Input id="backup-start" value={draft.backupStart} onChange={(event) => setDraft({ ...draft, backupStart: event.target.value })} />
            </Field>
          </FieldGroup>
        </div>
        <SheetFooter className="speaker-sheet__footer">
          <Button size="sm" onClick={save} disabled={busy}>{busy && <Spinner data-icon="inline-start" />}Save slot</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function RoomRequests({ workspace, onSave }: { workspace: SpeakerOpsWorkspace; onSave: (request: RoomRequest) => Promise<void> }) {
  const [drafts, setDrafts] = useState<Record<string, RoomRequest>>(() => Object.fromEntries(workspace.roomRequests.map((request) => [request.id, request])))
  const [saving, setSaving] = useState('')
  const [error, setError] = useState('')
  useEffect(() => setDrafts(Object.fromEntries(workspace.roomRequests.map((request) => [request.id, request]))), [workspace.roomRequests])

  const save = async (request: RoomRequest) => {
    setSaving(request.id)
    setError('')
    try {
      await onSave(request)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the room request.')
    } finally {
      setSaving('')
    }
  }

  return (
    <section className="speaker-section speaker-room-section" aria-labelledby="room-requests-title">
      <div className="speaker-section__heading">
        <div>
          <h2 id="room-requests-title">Room requests</h2>
          <p>Submit incomplete details now and update them later. Ross usually replies within three business days.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={ROSS_ROOM_URL} target="_blank" rel="noreferrer">Ross instructions<ArrowUpRight data-icon="inline-end" /></a>
        </Button>
      </div>
      {error && <Alert variant="destructive"><AlertTitle>Could not save</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="speaker-room-grid">
        {workspace.roomRequests.map((request) => {
          const draft = drafts[request.id] || request
          const slot = workspace.slots.find((candidate) => candidate.id === request.slotId)
          const setDraft = (patch: Partial<RoomRequest>) => setDrafts((current) => ({ ...current, [request.id]: { ...draft, ...patch } }))
          return (
            <div className="speaker-room-card" key={request.id}>
              <div className="speaker-room-card__header">
                <div><h3>{slot?.label}</h3><p>{formatShortDate(draft.preferredStart)}</p></div>
                <StatusBadge label={ROOM_REQUEST_STATUS_LABELS[draft.status]} tone={draft.status === 'approved' ? 'blue' : draft.status === 'submitted' ? 'yellow' : 'outline'} />
              </div>
              <FieldGroup className="gap-4">
                <div className="speaker-field-grid">
                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <Select value={draft.status} onValueChange={(status) => setDraft({ status: status as RoomRequestStatus })}>
                      <SelectTrigger className="w-full" aria-label={`${slot?.label || request.slotId} room request status`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectGroup>{Object.entries(ROOM_REQUEST_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent>
                    </Select>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${request.id}-attendance`}>Attendance</FieldLabel>
                    <Input id={`${request.id}-attendance`} type="number" min={1} max={500} value={draft.estimatedAttendance} onChange={(event) => setDraft({ estimatedAttendance: Number(event.target.value) })} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${request.id}-room`}>Ross room</FieldLabel>
                    <Input id={`${request.id}-room`} value={draft.roomName} onChange={(event) => setDraft({ roomName: event.target.value })} placeholder="Required for approval" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${request.id}-reference`}>Request reference</FieldLabel>
                    <Input id={`${request.id}-reference`} value={draft.reference} onChange={(event) => setDraft({ reference: event.target.value })} />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor={`${request.id}-equipment`}>Setup and equipment</FieldLabel>
                  <Textarea id={`${request.id}-equipment`} rows={2} value={draft.equipmentNotes} onChange={(event) => setDraft({ equipmentNotes: event.target.value })} />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`${request.id}-access`}>Access needs</FieldLabel>
                  <Textarea id={`${request.id}-access`} rows={2} value={draft.accessibilityNotes} onChange={(event) => setDraft({ accessibilityNotes: event.target.value })} />
                </Field>
              </FieldGroup>
              <div className="speaker-room-card__meta">
                <span>Owner: {ownerName(draft.requestedByEmail)}</span>
                <span>{draft.responseDueAt ? `Follow up ${formatShortDate(draft.responseDueAt)}` : 'Response clock starts when submitted'}</span>
              </div>
              <Button size="sm" onClick={() => save(draft)} disabled={saving === request.id}>{saving === request.id && <Spinner data-icon="inline-start" />}Save request</Button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CalendarView({ workspace }: { workspace: SpeakerOpsWorkspace }) {
  return (
    <section className="speaker-section" aria-labelledby="calendar-title">
      <div className="speaker-section__heading">
        <div><h2 id="calendar-title">Calendar</h2><p>Working windows, not speaker offers.</p></div>
        <Button asChild variant="outline" size="sm"><a href={ROSS_CALENDAR_URL} target="_blank" rel="noreferrer">Ross calendar<ArrowUpRight data-icon="inline-end" /></a></Button>
      </div>
      <Alert className="speaker-room-gate">
        <CalendarDays />
        <AlertTitle>Calendar-safe does not mean booked</AlertTitle>
        <AlertDescription>Check the room first, then the speaker. Keep both proposed dates internal until Ross replies.</AlertDescription>
      </Alert>
      <div className="speaker-calendar-grid">
        {workspace.slots.map((slot) => (
          <div className="speaker-calendar-card" key={slot.id}>
            <span className="speaker-eyebrow">{PROGRAM_TERM_LABELS[slot.term]}</span>
            <h3>{formatShortDate(slot.preferredStart)}</h3>
            <p>Backup: {formatShortDate(slot.backupStart)}</p>
            <StatusBadge label={PROGRAM_SLOT_STATUS_LABELS[slot.status]} tone={slotTone(slot.status)} />
          </div>
        ))}
      </div>
      <div className="speaker-calendar-notes">
        <h3>Dates to avoid</h3>
        <ul>
          <li><span>Oct 19–20, 2026</span><span>Fall study break</span></li>
          <li><span>Nov 25–28, 2026</span><span>Thanksgiving recess</span></li>
          <li><span>Dec 14–21, 2026</span><span>Ross final exams</span></li>
          <li><span>Jan 18, 2027</span><span>Martin Luther King Jr. Day</span></li>
          <li><span>Mar 6–15, 2027</span><span>Winter break</span></li>
          <li><span>Apr 29–May 6, 2027</span><span>Ross final exams</span></li>
        </ul>
      </div>
    </section>
  )
}

function AccessView({ workspace }: { workspace: SpeakerOpsWorkspace }) {
  return (
    <section className="speaker-section" aria-labelledby="access-title">
      <div className="speaker-section__heading"><div><h2 id="access-title">Access</h2><p>Nine fixed accounts. No public registration.</p></div></div>
      <Alert className="speaker-access-note">
        <KeyRound />
        <AlertTitle>Long session</AlertTitle>
        <AlertDescription>Sessions last {SPEAKER_OPS_SESSION_DAYS} days. Temporary passwords must be changed on first login.</AlertDescription>
      </Alert>
      <div className="speaker-access-list">
        {workspace.members.map((member) => (
          <div className="speaker-access-row" key={member.email}>
            <div className="speaker-avatar" aria-hidden="true">{member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
            <div><strong>{member.name}</strong><span>{member.email}</span></div>
            <span>{member.title}</span>
            {member.canConfirmProgram ? <StatusBadge label="Can confirm dates" tone="blue" /> : <span className="speaker-muted">Pipeline access</span>}
          </div>
        ))}
      </div>
    </section>
  )
}

function SpeakerWorkspace({
  account,
  token,
  workspace,
  onWorkspaceChange,
  onLogout,
}: {
  account: SpeakerOpsAccount
  token: string
  workspace: SpeakerOpsWorkspace
  onWorkspaceChange: (workspace: SpeakerOpsWorkspace) => void
  onLogout: () => void
}) {
  const [view, setView] = useState<WorkspaceView>('pipeline')
  const [selectedLead, setSelectedLead] = useState<SpeakerLead | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<ProgramSlot | null>(null)
  const [leadOpen, setLeadOpen] = useState(false)
  const [slotOpen, setSlotOpen] = useState(false)

  const refresh = async () => {
    const result = await api({ action: 'workspace', sessionToken: token })
    onWorkspaceChange(result.workspace as SpeakerOpsWorkspace)
  }

  const saveLead = async (lead: SpeakerLead) => {
    await api({ action: 'updateLead', sessionToken: token, lead })
    await refresh()
  }
  const saveSlot = async (slot: ProgramSlot) => {
    await api({ action: 'updateSlot', sessionToken: token, slot })
    await refresh()
  }
  const saveRoom = async (roomRequest: RoomRequest) => {
    await api({ action: 'updateRoomRequest', sessionToken: token, roomRequest })
    await refresh()
  }

  return (
    <main id="main-content" className="speaker-ops">
      <aside className="speaker-sidebar">
        <nav className="speaker-suite-nav" aria-label="Leadership workspace">
          {leadershipNavigation.map(({ to, label, icon: Icon, current }) => (
            <Link key={to} to={to} className="speaker-suite-link" data-active={current ? 'true' : undefined} aria-current={current ? 'page' : undefined}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="speaker-sidebar__section">
          <span className="speaker-nav-label">Speaker workflow</span>
          <nav aria-label="Speaker Ops sections">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.id}
                variant="ghost"
                size="sm"
                data-active={view === item.id}
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => setView(item.id)}
              >
                <Icon data-icon="inline-start" />{item.label}
              </Button>
            )
          })}
          </nav>
        </div>
        <div className="speaker-sidebar__account">
          <div className="speaker-avatar" aria-hidden="true">{account.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
          <div><strong>{account.name}</strong><span>{account.title}</span></div>
          <Button variant="ghost" size="icon-sm" onClick={onLogout} aria-label="Sign out"><LogOut /></Button>
        </div>
      </aside>

      <div className="speaker-workspace">
        <header className="speaker-topbar">
          <div>
            <div className="speaker-topbar__title"><PanelLeft aria-hidden="true" /><h1>Speaker Ops</h1><StatusBadge label="2026–27" /></div>
            <p>Plan one or two firesides. Do not offer a date until Ross confirms a room.</p>
          </div>
          <Link to="/workspace" className="speaker-topbar__logo" aria-label="UBLDA workspace"><img src="/logo.png" alt="" /></Link>
        </header>

        <div className="speaker-mobile-nav" aria-label="Speaker Ops sections">
          {navigation.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              size="sm"
              data-active={view === item.id}
              aria-current={view === item.id ? 'page' : undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="speaker-content" data-view={view}>
          {(view === 'pipeline' || view === 'slots') && (
            <ProgramSlots
              workspace={workspace}
              onEdit={(slot) => { setSelectedSlot(slot); setSlotOpen(true) }}
            />
          )}
          {view === 'pipeline' && (
            <Pipeline
              workspace={workspace}
              selectedLead={selectedLead}
              onSelect={(lead) => { setSelectedLead(lead); setLeadOpen(true) }}
            />
          )}
          {view === 'rooms' && <RoomRequests workspace={workspace} onSave={saveRoom} />}
          {view === 'calendar' && <CalendarView workspace={workspace} />}
          {view === 'access' && <AccessView workspace={workspace} />}
        </div>
      </div>
      <nav className="speaker-suite-mobile-nav" aria-label="Leadership workspace">
        {mobileLeadershipNavigation.map(({ to, label, icon: Icon, current }) => (
          <Link key={to} to={to} data-active={current ? 'true' : undefined} aria-current={current ? 'page' : undefined}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <LeadSheet lead={selectedLead} open={leadOpen} onOpenChange={setLeadOpen} onSave={saveLead} />
      <SlotSheet slot={selectedSlot} workspace={workspace} open={slotOpen} onOpenChange={setSlotOpen} onSave={saveSlot} />
    </main>
  )
}

export function SpeakerOpsEntry() {
  const [token, setToken] = useState(() => localStorage.getItem(SESSION_KEY) || '')
  const [account, setAccount] = useState<SpeakerOpsAccount | null>(null)
  const [workspace, setWorkspace] = useState<SpeakerOpsWorkspace | null>(null)
  const [loading, setLoading] = useState(Boolean(token))

  useEffect(() => {
    if (!token) return
    let active = true
    api({ action: 'workspace', sessionToken: token })
      .then((result) => {
        if (!active) return
        const nextWorkspace = result.workspace as SpeakerOpsWorkspace
        setWorkspace(nextWorkspace)
        setAccount(nextWorkspace.account)
      })
      .catch(() => {
        if (!active) return
        localStorage.removeItem(SESSION_KEY)
        setToken('')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [token])

  const signedIn = async (nextAccount: SpeakerOpsAccount, nextToken: string) => {
    setToken(nextToken)
    setAccount(nextAccount)
    const result = await api({ action: 'workspace', sessionToken: nextToken })
    setWorkspace(result.workspace as SpeakerOpsWorkspace)
  }

  const logout = async () => {
    await api({ action: 'logout', sessionToken: token }).catch(() => undefined)
    localStorage.removeItem(SESSION_KEY)
    setToken('')
    setAccount(null)
    setWorkspace(null)
  }

  if (loading) {
    return <main id="main-content" className="speaker-loading"><Spinner /><span>Opening Speaker Ops</span></main>
  }
  if (!account || !token || !workspace) return <SignIn onSignedIn={signedIn} />

  return (
    <>
      <SpeakerWorkspace account={account} token={token} workspace={workspace} onWorkspaceChange={(next) => { setWorkspace(next); setAccount(next.account) }} onLogout={logout} />
      <PasswordChange open={account.mustChangePassword} token={token} onChanged={(nextAccount) => { setAccount(nextAccount); setWorkspace({ ...workspace, account: nextAccount }) }} />
    </>
  )
}
