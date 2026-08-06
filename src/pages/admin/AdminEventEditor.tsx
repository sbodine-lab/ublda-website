import { useEffect, useMemo, useState } from 'react'
import ErrorSummary from '../../components/portal/ErrorSummary'
import PortalDialog from '../../components/portal/PortalDialog'
import StatusPill from '../../components/portal/StatusPill'
import { Choice, Field, FieldGroup, SelectField, TextareaField } from '../../components/portal/Field'
import { callPortal } from '../../lib/portalClient'
import {
  ACCESS_COMMITMENT_CATALOG,
  ACCESS_COMMITMENT_LABELS,
  CLUB_EVENT_FORMATS,
  CLUB_EVENT_KINDS,
  COMMITMENT_STATES,
  EVENT_INTERNAL_NOTES_LIMIT,
  EVENT_SUMMARY_LIMIT,
  EVENT_TITLE_LIMIT,
  ROOM_STATUSES,
} from '../../lib/portalEvents'
import type {
  AccessCommitment,
  AccessCommitmentId,
  ClubEvent,
  ClubEventFormat,
  ClubEventKind,
  CommitmentState,
  RoomStatus,
} from '../../lib/portalEvents'
import './AdminEvents.css'

/**
 * The full event editor (spec §6 T2, §3.3).
 *
 * The section that matters is Access commitments. Every catalog item carries a
 * THREE-WAY explicit radio — confirmed / on request / not available — because an
 * event that cannot provide captions has to say so. Silence is not a promise and
 * it is not a refusal; it is the thing this club exists to stop happening, so
 * the editor counts what is still unstated and the list refuses to publish until
 * every one of them has an answer.
 *
 * `status` is never in this form. A create is forced to `draft` server-side and
 * an edit never moves it; publishing is its own gated action (spec §4.3).
 */

const KIND_LABEL: Record<ClubEventKind, string> = {
  fireside: 'Fireside chat',
  workshop: 'Workshop',
  social: 'Social',
  tabling: 'Tabling',
  meeting: 'Meeting',
  service: 'Service',
  'info-session': 'Info session',
}

const FORMAT_LABEL: Record<ClubEventFormat, string> = {
  'in-person': 'In person',
  virtual: 'Virtual',
  hybrid: 'Hybrid',
}

const ROOM_LABEL: Record<RoomStatus, string> = {
  'not-requested': 'Not requested yet',
  requested: 'Requested, waiting to hear',
  confirmed: 'Confirmed',
}

const COMMITMENT_CHOICE: Record<CommitmentState, string> = {
  confirmed: 'Yes',
  'on-request': 'On request',
  'not-available': 'No',
}

const easternWhen = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Detroit',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** "Wed, Oct 1, 7:00 PM Eastern" — never a bare "ET" (spec §6 T4). */
function easternLabel(iso: string): string {
  if (!iso) return ''
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return ''
  return `${easternWhen.format(new Date(parsed))} Eastern`
}

const pad = (value: number) => String(value).padStart(2, '0')

/** ISO → the value a `datetime-local` input wants, in the author's own zone. */
function toLocalInput(iso: string): string {
  if (!iso) return ''
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return ''
  const when = new Date(parsed)
  return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}T${pad(when.getHours())}:${pad(when.getMinutes())}`
}

function fromLocalInput(value: string): string {
  if (!value) return ''
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? '' : new Date(parsed).toISOString()
}

type EventForm = {
  title: string
  summary: string
  kind: ClubEventKind
  format: ClubEventFormat
  startsAt: string
  endsAt: string
  rsvpDeadline: string
  locationName: string
  locationDetail: string
  virtualUrl: string
  hostName: string
  speakerName: string
  speakerOrg: string
  capacity: string
  accommodationsContactEmail: string
  recordingUrl: string
  slidesUrl: string
  roomStatus: RoomStatus
  internalNotes: string
  commitments: Partial<Record<AccessCommitmentId, CommitmentState>>
}

function blankForm(contactEmail: string): EventForm {
  return {
    title: '',
    summary: '',
    kind: 'fireside',
    format: 'in-person',
    startsAt: '',
    endsAt: '',
    rsvpDeadline: '',
    locationName: '',
    locationDetail: '',
    virtualUrl: '',
    hostName: '',
    speakerName: '',
    speakerOrg: '',
    capacity: '0',
    accommodationsContactEmail: contactEmail,
    recordingUrl: '',
    slidesUrl: '',
    roomStatus: 'not-requested',
    internalNotes: '',
    commitments: {},
  }
}

function formFromEvent(event: ClubEvent): EventForm {
  const commitments: Partial<Record<AccessCommitmentId, CommitmentState>> = {}
  event.accessCommitments.forEach((commitment) => { commitments[commitment.id] = commitment.state })

  return {
    title: event.title,
    summary: event.summary,
    kind: event.kind,
    format: event.format,
    startsAt: toLocalInput(event.startsAt),
    endsAt: toLocalInput(event.endsAt),
    rsvpDeadline: toLocalInput(event.rsvpDeadline),
    locationName: event.locationName,
    locationDetail: event.locationDetail,
    virtualUrl: event.virtualUrl,
    hostName: event.hostName,
    speakerName: event.speakerName,
    speakerOrg: event.speakerOrg,
    capacity: String(event.capacity || 0),
    accommodationsContactEmail: event.accommodationsContactEmail,
    recordingUrl: event.recordingUrl,
    slidesUrl: event.slidesUrl,
    roomStatus: event.roomStatus,
    internalNotes: event.internalNotes,
    commitments,
  }
}

const FIELD_ID = {
  title: 'evt-title',
  startsAt: 'evt-starts-at',
  endsAt: 'evt-ends-at',
  host: 'evt-host',
  contact: 'evt-contact',
}

export type AdminEventEditorProps = {
  open: boolean
  /** null drafts a new event. */
  event: ClubEvent | null
  sessionToken: string
  /** Prefilled on a new draft so the accommodations line is never left blank. */
  defaultContactEmail: string
  onClose: () => void
  onSaved: (event: ClubEvent, message: string) => void
  onCancelled: (event: ClubEvent, message: string) => void
}

export function AdminEventEditor({
  open, event, sessionToken, defaultContactEmail, onClose, onSaved, onCancelled,
}: AdminEventEditorProps) {
  const [form, setForm] = useState<EventForm>(() => blankForm(defaultContactEmail))
  const [errors, setErrors] = useState<{ fieldId?: string; message: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Reset the moment the dialog is asked to show a different event, never while
  // it is open and being typed into.
  useEffect(() => {
    if (!open) return
    setForm(event ? formFromEvent(event) : blankForm(defaultContactEmail))
    setErrors([])
    setCancelReason('')
  }, [open, event, defaultContactEmail])

  /**
   * `showModal()` puts focus on the first tabbable control, which is the close
   * button in the dialog head. Move it to the first thing the officer is
   * actually here to type. One frame later, so it lands after the native focus.
   */
  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(FIELD_ID.title)?.focus()
    })
    return () => { window.cancelAnimationFrame(frame) }
  }, [open])

  const patch = (changes: Partial<EventForm>) => { setForm((previous) => ({ ...previous, ...changes })) }

  const setCommitment = (id: AccessCommitmentId, state: CommitmentState) => {
    setForm((previous) => ({ ...previous, commitments: { ...previous.commitments, [id]: state } }))
  }

  const statedCount = useMemo(
    () => ACCESS_COMMITMENT_CATALOG.filter((id) => Boolean(form.commitments[id])).length,
    [form.commitments],
  )

  const startsPreview = easternLabel(fromLocalInput(form.startsAt))
  const endsPreview = easternLabel(fromLocalInput(form.endsAt))

  const validate = (): { fieldId?: string; message: string }[] => {
    const found: { fieldId?: string; message: string }[] = []
    if (!form.title.trim()) found.push({ fieldId: FIELD_ID.title, message: 'Give the event a title.' })
    if (form.title.length > EVENT_TITLE_LIMIT) {
      found.push({ fieldId: FIELD_ID.title, message: `The title has to be ${EVENT_TITLE_LIMIT} characters or fewer.` })
    }
    if (!form.startsAt) found.push({ fieldId: FIELD_ID.startsAt, message: 'Set a start time.' })
    if (!form.endsAt) found.push({ fieldId: FIELD_ID.endsAt, message: 'Set an end time.' })
    if (form.startsAt && form.endsAt && Date.parse(form.endsAt) <= Date.parse(form.startsAt)) {
      found.push({ fieldId: FIELD_ID.endsAt, message: 'The end time has to come after the start time.' })
    }
    return found
  }

  const submit = async () => {
    const found = validate()
    if (found.length > 0) {
      setErrors(found)
      return
    }

    const accessCommitments: AccessCommitment[] = ACCESS_COMMITMENT_CATALOG
      .filter((id) => Boolean(form.commitments[id]))
      .map((id) => ({ id, state: form.commitments[id] as CommitmentState }))

    setSaving(true)
    try {
      const result = await callPortal<{ event: ClubEvent }>('admin.event.upsert', sessionToken, {
        id: event?.id || '',
        title: form.title,
        summary: form.summary,
        kind: form.kind,
        format: form.format,
        startsAt: fromLocalInput(form.startsAt),
        endsAt: fromLocalInput(form.endsAt),
        locationName: form.locationName,
        locationDetail: form.locationDetail,
        virtualUrl: form.virtualUrl,
        hostName: form.hostName,
        speakerName: form.speakerName,
        speakerOrg: form.speakerOrg,
        capacity: Number(form.capacity) || 0,
        rsvpDeadline: fromLocalInput(form.rsvpDeadline),
        accessCommitments,
        accommodationsContactEmail: form.accommodationsContactEmail,
        recordingUrl: form.recordingUrl,
        slidesUrl: form.slidesUrl,
        roomStatus: form.roomStatus,
        internalNotes: form.internalNotes,
      })

      setErrors([])
      onSaved(result.event, event ? `Saved ${result.event.title}.` : `Drafted ${result.event.title}.`)
    } catch (error) {
      const failure = error as { message?: string; errors?: string[] }
      const list = failure.errors && failure.errors.length > 0
        ? failure.errors
        : [failure.message || 'That event did not save.']
      setErrors(list.map((message) => ({ message })))
    } finally {
      setSaving(false)
    }
  }

  const cancelEvent = async () => {
    if (!event) return
    setCancelling(true)
    try {
      const result = await callPortal<{ event: ClubEvent }>('admin.event.cancel', sessionToken, {
        eventId: event.id,
        reason: cancelReason,
      })
      onCancelled(result.event, `Cancelled ${result.event.title}.`)
    } catch (error) {
      const failure = error as { message?: string }
      setErrors([{ message: failure.message || 'That event did not cancel.' }])
    } finally {
      setCancelling(false)
    }
  }

  const showsRoom = form.format !== 'virtual'
  const showsLink = form.format !== 'in-person'

  return (
    <PortalDialog
      open={open}
      onClose={onClose}
      size="wide"
      title={event ? `Edit ${event.title}` : 'Draft an event'}
      description={event
        ? 'Changes save as soon as you press Save. Publishing stays a separate, deliberate step.'
        : 'This saves as a draft. Members see nothing until a co-president publishes it.'}
      closeLabel="the event editor"
      footer={(
        <>
          <button type="button" className="p-btn" onClick={onClose}>Close without saving</button>
          <button type="button" className="p-btn p-btn--primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving' : event ? 'Save changes' : 'Save draft'}
          </button>
        </>
      )}
    >
      <ErrorSummary headingLevel={3} errors={errors} />

      <div className="evtform">
        <section className="evtform__section" aria-labelledby="evt-section-basics">
          <h3 className="evtform__legend" id="evt-section-basics">What it is</h3>
          <Field
            id={FIELD_ID.title}
            label="Title"
            required
            maxLength={EVENT_TITLE_LIMIT}
            value={form.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
          <TextareaField
            label="Summary"
            hint={`Plain text, ${EVENT_SUMMARY_LIMIT} characters or fewer. This is what a member reads on the card.`}
            maxLength={EVENT_SUMMARY_LIMIT}
            showCount
            rows={3}
            value={form.summary}
            onChange={(e) => patch({ summary: e.target.value })}
          />
          <div className="evtform__pair">
            <SelectField
              label="Kind"
              value={form.kind}
              onChange={(e) => patch({ kind: e.target.value as ClubEventKind })}
              options={CLUB_EVENT_KINDS.map((kind) => ({ value: kind, label: KIND_LABEL[kind] }))}
            />
            <SelectField
              label="Format"
              value={form.format}
              onChange={(e) => patch({ format: e.target.value as ClubEventFormat })}
              options={CLUB_EVENT_FORMATS.map((format) => ({ value: format, label: FORMAT_LABEL[format] }))}
            />
          </div>
        </section>

        <section className="evtform__section" aria-labelledby="evt-section-when">
          <h3 className="evtform__legend" id="evt-section-when">When</h3>
          <div className="evtform__pair">
            <Field
              id={FIELD_ID.startsAt}
              label="Starts"
              required
              type="datetime-local"
              hint={startsPreview ? `Members see: ${startsPreview}` : 'Entered in your computer’s time zone.'}
              value={form.startsAt}
              onChange={(e) => patch({ startsAt: e.target.value })}
            />
            <Field
              id={FIELD_ID.endsAt}
              label="Ends"
              required
              type="datetime-local"
              hint={endsPreview ? `Members see: ${endsPreview}` : 'Entered in your computer’s time zone.'}
              value={form.endsAt}
              onChange={(e) => patch({ endsAt: e.target.value })}
            />
          </div>
          <Field
            label="RSVP closes"
            type="datetime-local"
            hint="Leave empty to keep RSVPs open until the event starts."
            value={form.rsvpDeadline}
            onChange={(e) => patch({ rsvpDeadline: e.target.value })}
          />
        </section>

        <section className="evtform__section" aria-labelledby="evt-section-where">
          <h3 className="evtform__legend" id="evt-section-where">Where</h3>
          {showsRoom ? (
            <>
              <Field
                label="Room"
                hint="How a member would say it out loud: Ross R1240."
                value={form.locationName}
                onChange={(e) => patch({ locationName: e.target.value })}
              />
              <Field
                label="Getting there"
                hint="The sentence that saves somebody a phone call: “Step-free route via the east doors on Tappan.”"
                value={form.locationDetail}
                onChange={(e) => patch({ locationDetail: e.target.value })}
              />
            </>
          ) : null}
          {showsLink ? (
            <Field
              label="Join link"
              type="url"
              hint="Released only to members whose RSVP says going, and only once the event is published."
              value={form.virtualUrl}
              onChange={(e) => patch({ virtualUrl: e.target.value })}
            />
          ) : null}
          <FieldGroup legend="Room status" row>
            {ROOM_STATUSES.map((status) => (
              <Choice
                key={status}
                type="radio"
                name="evt-room-status"
                label={ROOM_LABEL[status]}
                checked={form.roomStatus === status}
                onChange={() => patch({ roomStatus: status })}
              />
            ))}
          </FieldGroup>
        </section>

        <section className="evtform__section" aria-labelledby="evt-section-people">
          <h3 className="evtform__legend" id="evt-section-people">Who is running it</h3>
          <Field
            id={FIELD_ID.host}
            label="Running the room"
            hint="One name. This is who a member asks on the day, and publishing needs it filled in."
            autoComplete="off"
            value={form.hostName}
            onChange={(e) => patch({ hostName: e.target.value })}
          />
          <div className="evtform__pair">
            <Field
              label="Speaker"
              autoComplete="off"
              value={form.speakerName}
              onChange={(e) => patch({ speakerName: e.target.value })}
            />
            <Field
              label="Speaker’s organization"
              autoComplete="off"
              value={form.speakerOrg}
              onChange={(e) => patch({ speakerOrg: e.target.value })}
            />
          </div>
          <Field
            label="Capacity"
            type="number"
            min={0}
            inputMode="numeric"
            hint="0 means no cap."
            value={form.capacity}
            onChange={(e) => patch({ capacity: e.target.value })}
          />
        </section>

        <section className="evtform__section evtform__section--access" aria-labelledby="evt-section-access">
          <div className="evtform__accesshead">
            <h3 className="evtform__legend" id="evt-section-access">What this event can provide</h3>
            <StatusPill
              label={`${statedCount} of ${ACCESS_COMMITMENT_CATALOG.length} answered`}
              tone={statedCount === ACCESS_COMMITMENT_CATALOG.length ? 'success' : 'warn'}
            />
          </div>
          <p className="p-meta">
            Answer every line. “No” is a real answer and members would far rather read it than find
            out in the room — an unanswered line is the only one that helps nobody, so publishing
            waits until all eleven have been answered.
          </p>

          <Field
            id={FIELD_ID.contact}
            label="Accommodations contact"
            type="email"
            autoComplete="email"
            hint="The address a member writes to when they need something that is not on this list. Publishing needs it."
            value={form.accommodationsContactEmail}
            onChange={(e) => patch({ accommodationsContactEmail: e.target.value })}
          />

          <div className="evtform__commitments">
            {ACCESS_COMMITMENT_CATALOG.map((id) => (
              <FieldGroup key={id} legend={ACCESS_COMMITMENT_LABELS[id]} row className="evtform__commitment">
                {COMMITMENT_STATES.map((state) => (
                  <Choice
                    key={state}
                    type="radio"
                    name={`evt-commitment-${id}`}
                    label={COMMITMENT_CHOICE[state]}
                    checked={form.commitments[id] === state}
                    onChange={() => setCommitment(id, state)}
                  />
                ))}
              </FieldGroup>
            ))}
          </div>
        </section>

        <section className="evtform__section" aria-labelledby="evt-section-after">
          <h3 className="evtform__legend" id="evt-section-after">Afterwards</h3>
          <div className="evtform__pair">
            <Field
              label="Recording link"
              type="url"
              value={form.recordingUrl}
              onChange={(e) => patch({ recordingUrl: e.target.value })}
            />
            <Field
              label="Slides link"
              type="url"
              value={form.slidesUrl}
              onChange={(e) => patch({ slidesUrl: e.target.value })}
            />
          </div>
          <TextareaField
            label="Notes for the E-board"
            hint="Never shown to members. Room requests, contacts, what went wrong last time."
            maxLength={EVENT_INTERNAL_NOTES_LIMIT}
            showCount
            rows={3}
            value={form.internalNotes}
            onChange={(e) => patch({ internalNotes: e.target.value })}
          />
        </section>

        {event && event.status !== 'cancelled' ? (
          <section className="evtform__section evtform__section--danger" aria-labelledby="evt-section-cancel">
            <h3 className="evtform__legend" id="evt-section-cancel">Call it off</h3>
            <p className="p-meta">
              Cancelling keeps the event on the member calendar with a cancelled label, so nobody
              turns up to a locked room. The reason is written into the E-board notes.
            </p>
            <Field
              label="Reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="p-btnrow">
              <button type="button" className="p-btn p-btn--danger" onClick={cancelEvent} disabled={cancelling}>
                {cancelling ? 'Cancelling' : 'Cancel this event'}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </PortalDialog>
  )
}

export default AdminEventEditor
