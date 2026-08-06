import { useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode, RefObject } from 'react'
import PortalDialog from './PortalDialog'
import StatusPill from './StatusPill'
import ErrorSummary from './ErrorSummary'
import { SelectField, TextareaField, Field } from './Field'
import { accessNeedLabel } from '../../lib/portalAccess'
import type { AccessFollowUpPreference } from '../../lib/portalAccess'
import {
  MEMBER_NOTES_LIMIT,
  MEMBER_SCHOOLS,
  MEMBER_SOURCES,
  MEMBER_STATUSES,
  MEMBER_YEARS,
  memberDisplayName,
} from '../../lib/portalMembers'
import type {
  MemberAdminRow,
  MemberSchool,
  MemberSource,
  MemberStatus,
  MemberYear,
} from '../../lib/portalMembers'
import type { ClubEvent, EventRsvp } from '../../lib/portalEvents'
// The drawer is only ever opened from the roster, so its handful of layout rules
// live in that screen's stylesheet rather than growing the shared system.
import '../../pages/admin/AdminRoster.css'

/**
 * One member, everything the club actually knows about them (spec §6 T1).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE ACCESS BLOCK IS THE REASON THIS COMPONENT IS CAREFUL.
 *
 * `member.access` is present ONLY when `consentedAccessView` resolved for the
 * signed-in reader on the server. When it is absent this renders the literal
 * string "Not shared" — never "No access needs" (spec §3.4 rule 2). A blank
 * must never be presentable as an assertion about a person, and being
 * super-admin grants nothing here.
 *
 * Nothing in this block is ever passed to `announce()`. Accommodation needs get
 * read aloud into whatever room the officer is standing in (spec §7.1).
 * ─────────────────────────────────────────────────────────────────────────
 */

export type MemberAdminPatch = {
  email: string
  firstName: string
  lastName: string
  status: MemberStatus
  source: MemberSource
  year: MemberYear
  school: MemberSchool
  joinedAt: string
  notes: string
}

export type MemberDrawerProps = {
  open: boolean
  member: MemberAdminRow | null
  /** All admin-visible events, used to name the rows in the RSVP history. */
  events: ClubEvent[]
  /** All admin-visible RSVPs. Filtered to this member here. */
  rsvps: EventRsvp[]
  onClose: () => void
  onSave: (patch: MemberAdminPatch) => Promise<void>
  saving: boolean
  /** Server-side validation messages from the last failed save. */
  errors: string[]
}

const STATUS_LABEL: Record<MemberStatus, string> = {
  prospect: 'Prospect',
  active: 'Active',
  inactive: 'Inactive',
  alumni: 'Alumni',
}

const SOURCE_LABEL: Record<MemberSource, string> = {
  'self-signup': 'Signed up themselves',
  festifall: 'Festifall',
  'interest-form': 'Interest form',
  referral: 'Referral',
  recruiting: 'Recruiting',
  manual: 'Added by an officer',
}

const FOLLOW_UP_LABEL: Record<AccessFollowUpPreference, string> = {
  email: 'Email is fine',
  'before-event': 'Check in before the event',
  'do-not-contact': 'Prefers no follow-up',
}

/**
 * Shared with the roster table so a status reads the same in the row and in the
 * drawer. Exported from a component file the way `PanelHead` exports
 * `formatRelativeTime` — one small helper is not worth a second module.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const memberStatusTone = (status: MemberStatus) => (
  status === 'active' ? 'success' : status === 'prospect' ? 'info' : 'neutral'
)

const RESPONSE_LABEL: Record<string, string> = {
  going: 'Going',
  interested: 'Interested',
  'not-going': "Can't make it",
}

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Detroit',
})

/** '' for anything that is not a real date, so a gap renders as a gap. */
// eslint-disable-next-line react-refresh/only-export-components
export const formatDay = (iso: string) => {
  if (!iso) return ''
  const parsed = new Date(iso)
  return Number.isNaN(parsed.getTime()) ? '' : dayFormatter.format(parsed)
}

/** ISO → the `yyyy-mm-dd` a date input needs, read in the reader's own zone. */
const toDateInputValue = (iso: string) => {
  if (!iso) return ''
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getDate()}`.padStart(2, '0')
  return `${parsed.getFullYear()}-${month}-${day}`
}

/**
 * Midday, not midnight: a date-only value parsed as UTC midnight renders as the
 * previous day everywhere west of Greenwich, which is where this club is.
 */
const fromDateInputValue = (value: string, previous: string) => {
  if (!value) return ''
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? previous : parsed.toISOString()
}

type DrawerForm = {
  firstName: string
  lastName: string
  status: MemberStatus
  source: MemberSource
  year: MemberYear
  school: MemberSchool
  joinedAt: string
  notes: string
}

const formFor = (member: MemberAdminRow): DrawerForm => ({
  firstName: member.firstName,
  lastName: member.lastName,
  status: member.status,
  source: member.source,
  year: member.year,
  school: member.school,
  joinedAt: toDateInputValue(member.joinedAt),
  notes: member.notes,
})

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="roster-drawer__row">
      <dt className="roster-drawer__term">{label}</dt>
      <dd className="roster-drawer__value">{children}</dd>
    </div>
  )
}

type MemberRecordProps = {
  member: MemberAdminRow
  events: ClubEvent[]
  rsvps: EventRsvp[]
  onSave: (patch: MemberAdminPatch) => Promise<void>
  errors: string[]
  bodyRef: RefObject<HTMLDivElement | null>
}

/**
 * The dialog's contents, remounted by `key` whenever the underlying record
 * changes. Resetting a form by remounting is the pattern React documents for
 * exactly this; the alternative — reseeding from an effect — costs a cascading
 * render on every parent refetch and can overwrite what an officer is typing.
 */
function MemberRecord({ member, events, rsvps, onSave, errors, bodyRef }: MemberRecordProps) {
  const [form, setForm] = useState<DrawerForm>(() => formFor(member))

  const history = useMemo(() => {
    const byId = new Map(events.map((event) => [event.id, event]))
    return rsvps
      .filter((rsvp) => rsvp.email === member.email)
      .map((rsvp) => ({ rsvp, event: byId.get(rsvp.eventId) || null }))
      .sort((left, right) => (
        (right.event?.startsAt || right.rsvp.respondedAt || '')
          .localeCompare(left.event?.startsAt || left.rsvp.respondedAt || '')
      ))
  }, [events, member.email, rsvps])

  const access = member.access

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onSave({
      email: member.email,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      status: form.status,
      source: form.source,
      year: form.year,
      school: form.school,
      joinedAt: fromDateInputValue(form.joinedAt, member.joinedAt),
      notes: form.notes,
    })
  }

  return (
    /* The body is a scrollable region of mostly reading material, so focus
       lands here rather than on a control halfway down it. */
    <div className="roster-drawer" ref={bodyRef} tabIndex={-1}>
        <section className="roster-drawer__block" aria-labelledby="roster-drawer-contact">
          <h3 className="roster-drawer__heading" id="roster-drawer-contact">Contact</h3>
          <dl className="roster-drawer__list">
            <DetailRow label="Email">
              <a className="p-link" href={`mailto:${member.email}`}>{member.email}</a>
            </DetailRow>
            <DetailRow label="Uniqname">{member.uniqname || '—'}</DetailRow>
            <DetailRow label="Pronouns">{member.pronouns || '—'}</DetailRow>
            <DetailRow label="Phone">{member.phone || '—'}</DetailRow>
            <DetailRow label="Major">{member.major || '—'}</DetailRow>
            <DetailRow label="Graduation year">{member.gradYear || '—'}</DetailRow>
            <DetailRow label="LinkedIn">
              {member.linkedinUrl
                ? <a className="p-link" href={member.linkedinUrl} rel="noreferrer noopener" target="_blank">Profile</a>
                : '—'}
            </DetailRow>
            <DetailRow label="Dietary preferences">{member.dietary || '—'}</DetailRow>
          </dl>
          <p className="p-meta">
            These are the member&rsquo;s own answers. Only they can change them.
          </p>
        </section>

        <section className="roster-drawer__block" aria-labelledby="roster-drawer-interests">
          <h3 className="roster-drawer__heading" id="roster-drawer-interests">Interests</h3>
          {member.interests.length > 0 ? (
            <ul className="p-cluster roster-drawer__tags">
              {member.interests.map((interest) => (
                <li key={interest}><StatusPill label={interest} tone="neutral" glyph="◦" /></li>
              ))}
            </ul>
          ) : (
            <p className="p-muted">Nothing chosen yet.</p>
          )}
        </section>

        <section className="roster-drawer__block" aria-labelledby="roster-drawer-participation">
          <h3 className="roster-drawer__heading" id="roster-drawer-participation">Participation</h3>
          <p className="p-meta">
            {`${member.attendanceCount} attended · ${member.rsvpCount} RSVP${member.rsvpCount === 1 ? '' : 's'}`}
            {member.lastAttendedAt ? ` · last on ${formatDay(member.lastAttendedAt)}` : ''}
          </p>
          {history.length > 0 ? (
            <ul className="roster-drawer__history">
              {history.map(({ rsvp, event }) => (
                <li key={rsvp.id} className="roster-drawer__historyrow">
                  <span className="roster-drawer__historytitle">{event?.title || 'Event no longer listed'}</span>
                  {event?.startsAt ? (
                    <time className="p-meta" dateTime={event.startsAt}>{formatDay(event.startsAt)}</time>
                  ) : null}
                  <StatusPill
                    label={RESPONSE_LABEL[rsvp.response] || rsvp.response}
                    tone={rsvp.response === 'going' ? 'accent' : 'neutral'}
                  />
                  {rsvp.checkedInAt ? <StatusPill label="Checked in" tone="success" /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-muted">No RSVPs yet — the club&rsquo;s first events are still being planned.</p>
          )}
        </section>

        {/*
          Access. Rendered, never announced. "Not shared" is the literal wording
          the spec requires; it says what the portal knows, not what is true
          about this person.
        */}
        <section className="roster-drawer__block roster-drawer__block--access" aria-labelledby="roster-drawer-access">
          <h3 className="roster-drawer__heading" id="roster-drawer-access">Access</h3>
          {access ? (
            <>
              <ul className="roster-drawer__needs">
                {access.needs.map((need) => (
                  <li key={need.id} className="roster-drawer__need">
                    <span className="roster-drawer__needlabel">{accessNeedLabel(need.id)}</span>
                    <StatusPill
                      label={need.priority === 'required' ? 'Required' : 'Helpful'}
                      tone={need.priority === 'required' ? 'warn' : 'neutral'}
                    />
                    {need.detail ? <span className="p-meta">{need.detail}</span> : null}
                  </li>
                ))}
              </ul>
              {access.generalNote ? <p className="roster-drawer__note">{access.generalNote}</p> : null}
              <p className="p-meta">{`Follow-up: ${FOLLOW_UP_LABEL[access.followUpPreference]}`}</p>
              <p className="p-meta">
                {`${access.preferredName} chose to share this with the four named leads. Do not forward it.`}
              </p>
            </>
          ) : (
            <>
              <p className="roster-drawer__notshared">Not shared</p>
              <p className="p-meta">
                Nothing has been shared with you. That is all this says — it is not a statement
                about what this member needs.
              </p>
            </>
          )}
        </section>

        <section className="roster-drawer__block" aria-labelledby="roster-drawer-admin">
          <h3 className="roster-drawer__heading" id="roster-drawer-admin">Officer record</h3>
          <ErrorSummary errors={errors} headingLevel={4} />
          <form className="roster-drawer__form" id="roster-drawer-form" onSubmit={submit} noValidate>
            <div className="roster-drawer__grid">
              <Field
                label="First name"
                required
                autoComplete="given-name"
                value={form.firstName}
                onChange={(event) => setForm({ ...form, firstName: event.target.value })}
              />
              <Field
                label="Last name"
                required
                autoComplete="family-name"
                value={form.lastName}
                onChange={(event) => setForm({ ...form, lastName: event.target.value })}
              />
              <SelectField
                label="Status"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as MemberStatus })}
                options={MEMBER_STATUSES.map((status) => ({ value: status, label: STATUS_LABEL[status] }))}
              />
              <SelectField
                label="Where they came from"
                value={form.source}
                onChange={(event) => setForm({ ...form, source: event.target.value as MemberSource })}
                options={MEMBER_SOURCES.map((source) => ({ value: source, label: SOURCE_LABEL[source] }))}
              />
              <SelectField
                label="Year"
                value={form.year}
                onChange={(event) => setForm({ ...form, year: event.target.value as MemberYear })}
                options={MEMBER_YEARS.map((year) => ({ value: year, label: year || 'Not set' }))}
              />
              <SelectField
                label="School"
                value={form.school}
                onChange={(event) => setForm({ ...form, school: event.target.value as MemberSchool })}
                options={MEMBER_SCHOOLS.map((school) => ({ value: school, label: school || 'Not set' }))}
              />
              <Field
                label="Joined"
                type="date"
                value={form.joinedAt}
                onChange={(event) => setForm({ ...form, joinedAt: event.target.value })}
              />
            </div>
            <TextareaField
              label="Officer notes"
              hint={`Only officers see this. ${MEMBER_NOTES_LIMIT} characters. Never record anything about health or access here — that belongs to the member.`}
              maxLength={MEMBER_NOTES_LIMIT}
              showCount
              rows={4}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </form>
          <p className="p-meta">
            {member.updatedBy
              ? `Last edited by ${member.updatedBy}`
              : 'No officer has edited this record yet.'}
            {member.updatedAt ? ' · ' : ''}
            {member.updatedAt ? <time dateTime={member.updatedAt}>{formatDay(member.updatedAt)}</time> : null}
          </p>
        </section>
    </div>
  )
}

export function MemberDrawer({ open, member, events, rsvps, onClose, onSave, saving, errors }: MemberDrawerProps) {
  const bodyRef = useRef<HTMLDivElement>(null)

  // The parent keeps the last opened member mounted through the close, so the
  // native <dialog> can run close() and hand focus back to the row's Open button.
  if (!member) return null

  const name = memberDisplayName(member)

  return (
    <PortalDialog
      open={open}
      onClose={onClose}
      title={name}
      description={member.email}
      size="wide"
      closeLabel={`${name}'s record`}
      initialFocusRef={bodyRef}
      footer={(
        <>
          <button type="button" className="p-btn" onClick={onClose}>Close</button>
          <button type="submit" form="roster-drawer-form" className="p-btn p-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      )}
    >
      {/*
        Keyed by email and NOTHING else. Keying on `updatedAt` too would look
        tidier — the form would always mirror what was stored — but a save
        refetches, which would change the key, remount the body, and destroy the
        element holding focus while the modal is still open. Focus would land on
        an inert <body> and the next Tab would go nowhere. The officer's own
        values are what was just saved, so keeping them is also the right answer.
      */}
      <MemberRecord
        key={member.email}
        member={member}
        events={events}
        rsvps={rsvps}
        onSave={onSave}
        errors={errors}
        bodyRef={bodyRef}
      />
    </PortalDialog>
  )
}

export default MemberDrawer
