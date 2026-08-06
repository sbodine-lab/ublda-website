import { useMemo } from 'react'
import EmptyState from './EmptyState'
import StatusPill from './StatusPill'
import type { StatusTone } from './StatusPill'
import { accessNeedLabel } from '../../lib/portalAccess'
import type { AccessPriority } from '../../lib/portalAccess'
import { ACCESS_COMMITMENT_LABELS } from '../../lib/portalEvents'
import type {
  AccessCommitmentId,
  ClubEvent,
  CommitmentState,
  EventRsvp,
} from '../../lib/portalEvents'
import type { ConsentedAccessView } from '../../lib/portalAccess'
// Styles live beside the only screen that renders this component (spec §5, T2).
import '../../pages/admin/AdminEvents.css'

/**
 * The round trip that is the whole feature (spec §6 T2).
 *
 *   A member states a need → a lead confirms it → the member sees
 *   "Live captions: confirmed" on the card they RSVP'd from.
 *
 * Everything here is computed at READ TIME from `bootstrap.admin.rsvps` plus the
 * consented member rows. Nothing is cached and nothing is denormalised, which is
 * what makes withdrawal retroactive by construction (spec §3.4): the moment a
 * member withdraws, `access` stops resolving on the server and their need simply
 * stops appearing here on the next load.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Two rules this component exists to keep:
 *
 * 1. NO NAMES. A lead planning a room needs the requirement and the count, not
 *    a roster of who asked. This screen gets opened on a laptop in a shared
 *    room, and the club's own consent wording already warns that a small room
 *    makes a request guessable — the portal should not make that easier. The
 *    per-RSVP notes block below is the one place a member deliberately wrote to
 *    the leads, and it carries the address they wrote from so a lead can reply.
 *
 * 2. NOTHING HERE IS EVER ANNOUNCED. The caller announces the commitment it
 *    changed ("Live captions marked confirmed") — a fact that is published on
 *    the public event card — and never the need that prompted it (spec §7.1).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `access` on a `MemberAdminRow` is present only where `consentedAccessView`
 * resolved for the signed-in reader. A non-lead exec therefore sees an empty
 * checklist, correctly, with no role short-circuit anywhere.
 */

/**
 * Catalog need → the event commitment that answers it. Deliberately partial:
 * a need with no commitment on the list is shown in its own group rather than
 * folded into an approximate match, because "Food labeled with allergens" is
 * not an answer to "Halal" and pretending otherwise is the failure mode this
 * whole feature exists to prevent.
 */
const NEED_TO_COMMITMENT: Record<string, AccessCommitmentId> = {
  'step-free-entry': 'step-free-route',
  'step-free-route-inside': 'step-free-route',
  'accessible-restroom': 'accessible-restroom-same-floor',
  'seat-near-front': 'seating-reserved-front',
  'asl-interpreter': 'asl-interpreter',
  'live-captioning': 'live-captions',
  'captions-on-video': 'live-captions',
  'mic-always-used': 'mic-always-used',
  'agenda-in-advance': 'slides-shared-in-advance',
  'slides-in-advance': 'slides-shared-in-advance',
  'quiet-space': 'quiet-space-available',
  'no-strobe-or-flashing': 'no-flashing-content',
  'ingredients-labeled': 'food-labeled-allergens',
  'allergy-nut': 'food-labeled-allergens',
  'allergy-gluten': 'food-labeled-allergens',
  'allergy-dairy': 'food-labeled-allergens',
  'allergy-shellfish': 'food-labeled-allergens',
  'allergy-other': 'food-labeled-allergens',
  'recording-if-absent': 'recording-available-after',
}

const COMMITMENT_TONE: Record<CommitmentState, StatusTone> = {
  confirmed: 'success',
  'on-request': 'info',
  'not-available': 'neutral',
}

const COMMITMENT_WORD: Record<CommitmentState, string> = {
  confirmed: 'Confirmed',
  'on-request': 'On request',
  'not-available': 'Not available',
}

type ChecklistRow = {
  key: string
  label: string
  commitmentId: AccessCommitmentId | ''
  state: CommitmentState | ''
  priority: AccessPriority
  people: number
  details: string[]
}

export type EventAccessChecklistNote = {
  email: string
  note: string
}

export type EventAccessChecklistProps = {
  event: ClubEvent
  /** Every RSVP in the workspace. Filtered to this event here. */
  rsvps: EventRsvp[]
  /**
   * Consented access views for the people going to THIS event, resolved server-side with
   * this event as the context. Already filtered — do not filter by RSVP again here.
   */
  accessViews: ConsentedAccessView[]
  /** One click, one write. Omit to render read-only. */
  onConfirm?: (commitmentId: AccessCommitmentId) => void
  /** The commitment currently being written, so its button can say so. */
  pendingCommitmentId?: string
  className?: string
}

function buildAccessChecklistRows(input: {
  event: ClubEvent
  accessViews: ConsentedAccessView[]
}): ChecklistRow[] {
  const stateById = new Map<string, CommitmentState>(
    input.event.accessCommitments.map((commitment) => [commitment.id, commitment.state]),
  )

  const rows = new Map<string, ChecklistRow>()

  input.accessViews
    .forEach((view) => {
      view.needs.forEach((need: ConsentedAccessView['needs'][number]) => {
        const commitmentId = NEED_TO_COMMITMENT[need.id] || ''
        const key = commitmentId || `need:${need.id}`
        const existing = rows.get(key)

        if (existing) {
          existing.people += 1
          if (need.priority === 'required') existing.priority = 'required'
          if (need.detail) existing.details.push(need.detail)
          return
        }

        rows.set(key, {
          key,
          label: commitmentId ? ACCESS_COMMITMENT_LABELS[commitmentId] : accessNeedLabel(need.id),
          commitmentId,
          state: commitmentId ? stateById.get(commitmentId) || '' : '',
          priority: need.priority,
          people: 1,
          details: need.detail ? [need.detail] : [],
        })
      })
    })

  // Required first, then the ones nobody has answered yet, then alphabetical.
  return Array.from(rows.values()).sort((left, right) => (
    Number(right.priority === 'required') - Number(left.priority === 'required')
    || Number(left.state === 'confirmed') - Number(right.state === 'confirmed')
    || left.label.localeCompare(right.label)
  ))
}

export function EventAccessChecklist({
  event, rsvps, accessViews, onConfirm, pendingCommitmentId, className,
}: EventAccessChecklistProps) {
  const rows = useMemo(
    () => buildAccessChecklistRows({ event, accessViews }),
    [event, accessViews],
  )

  const notes = useMemo<EventAccessChecklistNote[]>(() => rsvps
    .filter((rsvp) => (
      rsvp.eventId === event.id
      && rsvp.shareAccommodationWithLeads
      && Boolean(rsvp.accommodationNote)
    ))
    .map((rsvp) => ({ email: rsvp.email, note: rsvp.accommodationNote })),
  [rsvps, event.id])

  const classes = ['evtaccess']
  if (className) classes.push(className)

  if (rows.length === 0 && notes.length === 0) {
    return (
      <div className={classes.join(' ')}>
        <EmptyState
          headingLevel={4}
          align="left"
          title="Nothing requested for this one yet."
          body="When somebody who has shared their access profile RSVPs going, what they need shows up here — and one click turns it into a commitment printed on the event."
        />
      </div>
    )
  }

  return (
    <div className={classes.join(' ')}>
      {rows.length > 0 ? (
        <ul className="evtaccess__list">
          {rows.map((row) => {
            const pending = Boolean(row.commitmentId) && pendingCommitmentId === row.commitmentId
            return (
              <li className="evtaccess__row" key={row.key}>
                <div className="evtaccess__text">
                  <p className="evtaccess__label">{row.label}</p>
                  <p className="p-meta">
                    {row.priority === 'required' ? 'Required' : 'Helpful'}
                    {' · '}
                    {row.people === 1 ? '1 person asked' : `${row.people} people asked`}
                  </p>
                  {row.details.length > 0 ? (
                    <ul className="evtaccess__details">
                      {row.details.map((detail, index) => (
                        <li className="p-meta" key={`${row.key}-detail-${index}`}>{detail}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>

                <div className="evtaccess__state">
                  {row.commitmentId ? (
                    <StatusPill
                      label={row.state ? COMMITMENT_WORD[row.state] : 'Not stated'}
                      tone={row.state ? COMMITMENT_TONE[row.state] : 'warn'}
                    />
                  ) : (
                    <StatusPill label="Handle directly" tone="info" />
                  )}

                  {row.commitmentId && onConfirm && row.state !== 'confirmed' ? (
                    <button
                      type="button"
                      className="p-btn p-btn--sm"
                      disabled={pending}
                      onClick={() => onConfirm(row.commitmentId as AccessCommitmentId)}
                    >
                      {pending ? 'Saving' : 'Mark confirmed'}
                      <span className="p-visually-hidden">{` — ${row.label}`}</span>
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {rows.some((row) => !row.commitmentId) ? (
        <p className="p-meta">
          Requests marked “Handle directly” have no matching commitment on the event, so answer
          them in a reply rather than on the card.
        </p>
      ) : null}

      {notes.length > 0 ? (
        <div className="evtaccess__notes">
          <h4 className="evtaccess__notestitle">Notes written to the leads</h4>
          <p className="p-meta">
            Each person chose to send this with their RSVP. Reply from the accommodations address so
            answers stay in one place.
          </p>
          <ul className="evtaccess__list">
            {notes.map((entry) => (
              <li className="evtaccess__row" key={entry.email}>
                <div className="evtaccess__text">
                  <p className="evtaccess__label">{entry.note}</p>
                  <p className="p-meta">
                    <a className="p-link" href={`mailto:${entry.email}`}>{entry.email}</a>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default EventAccessChecklist
