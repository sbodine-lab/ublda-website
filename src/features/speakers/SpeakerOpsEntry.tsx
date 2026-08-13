import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  CircleDot,
  ListFilter,
  Search,
  Settings2,
  Users,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { LeadershipSection } from '@/features/leadership/components/LeadershipPage'
import {
  PROGRAM_SLOT_STATUS_LABELS,
  PROGRAM_TERM_LABELS,
  ROOM_REQUEST_STATUS_LABELS,
  SPEAKER_FORMAT_LABELS,
  SPEAKER_OPS_MEMBERS,
  SPEAKER_STAGE_LABELS,
  type ProgramSlot,
  type ProgramSlotStatus,
  type ProgramTerm,
  type RoomRequest,
  type RoomRequestStatus,
  type SpeakerFormat,
  type SpeakerLead,
  type SpeakerOpsWorkspace,
  type SpeakerStage,
} from '@/lib/speakerOps'
import { useLeadershipIdentity } from '@/features/decisions/leadershipIdentityContext'
import { withLeadershipRequestTimeout } from '@/features/decisions/logtoConvexAuth'
import './speaker-ops.css'

type WorkspaceView = 'pipeline' | 'rooms' | 'calendar'
type ApiRecord = Record<string, unknown>

const ROSS_ROOM_URL = 'https://rossweb.bus.umich.edu/ross-operations/event-form-instructions/'
const ROSS_CALENDAR_URL = 'https://rossweb.bus.umich.edu/academics/studentresources/ross-academic-calendar/'

const workflowTabs: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'calendar', label: 'Calendar' },
]

class SpeakerOpsApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const api = async (body: ApiRecord, idToken: string) => {
  const response = await withLeadershipRequestTimeout((signal) => fetch('/api/speaker-ops', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, idToken }),
    cache: 'no-store',
    credentials: 'same-origin',
    signal,
  }))
  const payload = await response.json().catch(() => ({ error: 'Speaker Ops returned an invalid response.' })) as ApiRecord
  if (!response.ok) throw new SpeakerOpsApiError(
    typeof payload.error === 'string' ? payload.error : 'Speaker Ops is unavailable.',
    response.status,
  )
  return payload
}

const formatShortDate = (value: string) => {
  if (!value) return '—'
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
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(value))
}

const ownerName = (email: string) => SPEAKER_OPS_MEMBERS.find((member) => member.email === email)?.name || email

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

function ProgramSlots({
  workspace,
  onEdit,
}: {
  workspace: SpeakerOpsWorkspace
  onEdit: (slot: ProgramSlot) => void
}) {
  return (
    <LeadershipSection title="Program slots" titleId="program-slots-title" flush>
      {workspace.slots.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><CircleDot /></EmptyMedia>
            <EmptyTitle>No slots yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="speaker-slot-list">
          {workspace.slots.map((slot) => {
            const room = workspace.roomRequests.find((request) => request.id === slot.roomRequestId)
            const lead = workspace.leads.find((candidate) => candidate.id === slot.leadId)
            return (
              <button key={slot.id} type="button" className="speaker-slot-row" onClick={() => onEdit(slot)}>
                <span className="speaker-slot-row__name">{slot.label}</span>
                <StatusBadge label={PROGRAM_SLOT_STATUS_LABELS[slot.status]} tone={slotTone(slot.status)} />
                <span><span className="speaker-label-inline">Preferred time</span>{formatShortDate(slot.preferredStart)}</span>
                <span><span className="speaker-label-inline">Speaker</span>{lead?.name || '—'}</span>
                <span><span className="speaker-label-inline">Room</span>{room?.roomName || '—'}</span>
                <Settings2 aria-hidden="true" />
              </button>
            )
          })}
        </div>
      )}
    </LeadershipSection>
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

  const filters = (
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
  )

  return (
    <LeadershipSection
      title={(
        <span className="speaker-title-row">
          Pipeline
          <span className="speaker-count">{visibleLeads.length}</span>
        </span>
      )}
      titleId="pipeline-title"
      action={filters}
      flush
    >
      {visibleLeads.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>No leads yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
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
      )}
    </LeadershipSection>
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
      <SheetContent className="speaker-sheet">
        <SheetHeader>
          <SheetTitle>{draft.name}</SheetTitle>
          <SheetDescription>{draft.organization}</SheetDescription>
        </SheetHeader>
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
            </Field>
          </FieldGroup>
        </div>
        <SheetFooter className="speaker-sheet__footer">
          <Button onClick={save} disabled={busy}>
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
      <SheetContent className="speaker-sheet">
        <SheetHeader>
          <SheetTitle>{draft.label}</SheetTitle>
          <SheetDescription>Dates stay internal until Ross approves the room.</SheetDescription>
        </SheetHeader>
        <div className="speaker-sheet__body">
          {error && <p className="speaker-form-error" role="alert">{error}</p>}
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
          <Button onClick={save} disabled={busy}>{busy && <Spinner data-icon="inline-start" />}Save slot</Button>
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
    <LeadershipSection
      title="Room requests"
      titleId="room-requests-title"
      action={(
        <Button asChild variant="outline" size="sm">
          <a href={ROSS_ROOM_URL} target="_blank" rel="noreferrer">Ross instructions<ArrowUpRight data-icon="inline-end" /></a>
        </Button>
      )}
    >
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
                {draft.responseDueAt ? <span>Follow up {formatShortDate(draft.responseDueAt)}</span> : null}
              </div>
              <Button size="sm" onClick={() => save(draft)} disabled={saving === request.id}>{saving === request.id && <Spinner data-icon="inline-start" />}Save request</Button>
            </div>
          )
        })}
      </div>
    </LeadershipSection>
  )
}

function CalendarView({ workspace }: { workspace: SpeakerOpsWorkspace }) {
  return (
    <>
      <LeadershipSection
        title="Calendar"
        titleId="calendar-title"
        action={(
          <Button asChild variant="outline" size="sm">
            <a href={ROSS_CALENDAR_URL} target="_blank" rel="noreferrer">Ross calendar<ArrowUpRight data-icon="inline-end" /></a>
          </Button>
        )}
      >
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
      </LeadershipSection>

      <LeadershipSection title="Dates to avoid" titleId="dates-to-avoid-title" flush>
        <ul className="speaker-calendar-notes">
          <li><span>Oct 19–20, 2026</span><span>Fall study break</span></li>
          <li><span>Nov 25–28, 2026</span><span>Thanksgiving recess</span></li>
          <li><span>Dec 14–21, 2026</span><span>Ross final exams</span></li>
          <li><span>Jan 18, 2027</span><span>Martin Luther King Jr. Day</span></li>
          <li><span>Mar 6–15, 2027</span><span>Winter break</span></li>
          <li><span>Apr 29–May 6, 2027</span><span>Ross final exams</span></li>
        </ul>
      </LeadershipSection>
    </>
  )
}

function SpeakerWorkspace({
  workspace,
  onWorkspaceChange,
  callApi,
}: {
  workspace: SpeakerOpsWorkspace
  onWorkspaceChange: (workspace: SpeakerOpsWorkspace) => void
  callApi: (body: ApiRecord) => Promise<ApiRecord>
}) {
  const [view, setView] = useState<WorkspaceView>('pipeline')
  const [selectedLead, setSelectedLead] = useState<SpeakerLead | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<ProgramSlot | null>(null)
  const [leadOpen, setLeadOpen] = useState(false)
  const [slotOpen, setSlotOpen] = useState(false)

  const refresh = async () => {
    const result = await callApi({ action: 'workspace' })
    onWorkspaceChange(result.workspace as SpeakerOpsWorkspace)
  }

  const saveLead = async (lead: SpeakerLead) => {
    await callApi({ action: 'updateLead', lead })
    await refresh()
  }
  const saveSlot = async (slot: ProgramSlot) => {
    await callApi({ action: 'updateSlot', slot })
    await refresh()
  }
  const saveRoom = async (roomRequest: RoomRequest) => {
    await callApi({ action: 'updateRoomRequest', roomRequest })
    await refresh()
  }

  return (
    <Tabs
      value={view}
      onValueChange={(next) => setView(next as WorkspaceView)}
      className="speaker-ops speaker-page"
    >
      <TabsList variant="line" className="speaker-workflow-tabs" aria-label="Speaker Ops sections">
        {workflowTabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id}>{tab.label}</TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="pipeline">
        <div className="ws-page speaker-content">
          <ProgramSlots
            workspace={workspace}
            onEdit={(slot) => { setSelectedSlot(slot); setSlotOpen(true) }}
          />
          <Pipeline
            workspace={workspace}
            selectedLead={selectedLead}
            onSelect={(lead) => { setSelectedLead(lead); setLeadOpen(true) }}
          />
        </div>
      </TabsContent>

      <TabsContent value="rooms">
        <div className="ws-page speaker-content">
          <RoomRequests workspace={workspace} onSave={saveRoom} />
        </div>
      </TabsContent>

      <TabsContent value="calendar">
        <div className="ws-page speaker-content">
          <CalendarView workspace={workspace} />
        </div>
      </TabsContent>

      <LeadSheet lead={selectedLead} open={leadOpen} onOpenChange={setLeadOpen} onSave={saveLead} />
      <SlotSheet slot={selectedSlot} workspace={workspace} open={slotOpen} onOpenChange={setSlotOpen} onSave={saveSlot} />
    </Tabs>
  )
}

export function SpeakerOpsEntry() {
  const identity = useLeadershipIdentity()
  const [workspace, setWorkspace] = useState<SpeakerOpsWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)

  useEffect(() => {
    localStorage.removeItem('ublda-speaker-ops-session')
  }, [])

  const callApi = useCallback(async (body: ApiRecord) => {
    let idToken = await withLeadershipRequestTimeout(() => identity.getIdToken())
    if (!idToken) throw new Error('Your leadership session could not be verified.')
    try {
      return await api(body, idToken)
    } catch (caught) {
      if (!(caught instanceof SpeakerOpsApiError) || caught.status !== 401) throw caught
      idToken = await withLeadershipRequestTimeout(() => identity.getIdToken(true))
      if (!idToken) throw caught
      return await api(body, idToken)
    }
  }, [identity])

  useEffect(() => {
    let active = true
    callApi({ action: 'workspace' })
      .then((result) => {
        if (!active) return
        setWorkspace(result.workspace as SpeakerOpsWorkspace)
      })
      .catch((caught) => {
        if (!active) return
        setError(caught instanceof Error ? caught.message : 'Speaker Ops could not be loaded.')
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [callApi, loadAttempt])

  const retryLoad = () => {
    setError('')
    setLoading(true)
    setLoadAttempt((attempt) => attempt + 1)
  }

  if (loading) {
    return <div className="speaker-loading" aria-live="polite"><Spinner /><span>Loading…</span></div>
  }
  if (error || !workspace) {
    return (
      <div className="ws-page speaker-page--error">
        <Alert variant="destructive">
          <AlertTitle>Speaker Ops could not be opened</AlertTitle>
          <AlertDescription>{error || 'Try refreshing the leadership workspace.'}</AlertDescription>
        </Alert>
        <Button type="button" variant="outline" onClick={retryLoad}>Try again</Button>
      </div>
    )
  }

  return (
    <SpeakerWorkspace
      workspace={workspace}
      onWorkspaceChange={setWorkspace}
      callApi={callApi}
    />
  )
}
