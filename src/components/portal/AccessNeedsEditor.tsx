/* These portal primitives deliberately export their helper constants and hooks
   alongside the component: splitting one small file into two to satisfy Fast
   Refresh would cost more than the dev-time reload it saves. Same call the
   codebase already makes in src/hooks/useMemberAuth.tsx. */
/* eslint-disable react-refresh/only-export-components */
import { useMemo } from 'react'
import { Choice, FieldGroup, TextareaField } from './Field'
import {
  ACCESS_CATEGORIES,
  ACCESS_CONSENT_TEXT,
  ACCESS_DETAIL_LIMIT,
  ACCESS_GENERAL_NOTE_LIMIT,
  ACCESS_LEAD_EMAILS,
  ACCESS_NEED_CATALOG,
  accessConsentExpiresAt,
  accessNeedLabel,
  consentedAccessView,
} from '../../lib/portalAccess'
import type {
  AccessAppliesTo,
  AccessFollowUpPreference,
  AccessNeed,
  AccessPriority,
  AccessProfile,
  AccessScope,
  ConsentedAccessView,
} from '../../lib/portalAccess'
import { adminAccountForEmail } from '../../lib/dashboardAccess'
import '../../pages/member/Member.css'

/**
 * The accommodations editor (spec §3.4, §6 T4).
 *
 * Three rules this file exists to hold, and which override any convenience:
 *
 *  1. **No diagnosis field. No disability-type field. No "do you have a
 *     disability?" question. Ever.** Every control below asks what someone needs
 *     in a room. Nothing here asks what is true about their body.
 *  2. **Blank is never "no access needs."** The preview renders the literal
 *     "Not shared" when nothing is shared, because that is exactly what a lead
 *     sees, and the absence of data must never be presentable as an assertion
 *     about a person.
 *  3. **Private is the default and nothing is pre-checked.** No option carries a
 *     "recommended" badge; sharing is a choice the member makes cold, with the
 *     four people who would read it named on the page.
 *
 * The preview is not a mock-up of the admin card — it is produced by calling
 * `consentedAccessView`, the one real read path, so it cannot drift from what a
 * lead actually sees.
 */

export type AccessDraft = {
  needs: AccessNeed[]
  generalNote: string
  followUpPreference: AccessFollowUpPreference
  scope: AccessScope
  appliesTo: AccessAppliesTo
}

export const draftFromProfile = (profile: AccessProfile): AccessDraft => ({
  needs: profile.needs.map((need) => ({ ...need })),
  generalNote: profile.generalNote,
  followUpPreference: profile.followUpPreference,
  // A withdrawn profile comes back as private, which is the honest starting
  // point: the member has to choose sharing again, deliberately.
  scope: profile.withdrawnAt ? 'private' : profile.scope,
  appliesTo: profile.appliesTo,
})

const PRIORITY_LABELS: Record<AccessPriority, string> = {
  required: "I can't attend without this",
  helpful: 'It makes it much better',
}

const FOLLOW_UP_CHOICES: { value: AccessFollowUpPreference; label: string; note: string }[] = [
  { value: 'email', label: 'Email me if there is a question', note: 'The default. Someone writes only when they need to.' },
  { value: 'before-event', label: 'Check with me before each event', note: 'A short message confirming the room before you arrive.' },
  { value: 'do-not-contact', label: 'Do not contact me about this', note: 'Use it when planning; no message either way.' },
]

/* ── The preview an admin would see ─────────────────────────────────── */

export type ConsentedAccessPreviewProps = {
  /** `null` renders "Not shared" — the literal words a lead reads. */
  view: ConsentedAccessView | null
  /** Adds the RSVP condition sentence when sharing is scoped to RSVPs. */
  rsvpOnly?: boolean
  headingLevel?: 3 | 4
}

export function ConsentedAccessPreview({ view, rsvpOnly, headingLevel = 4 }: ConsentedAccessPreviewProps) {
  const Heading = (headingLevel === 3 ? 'h3' : 'h4') as 'h4'

  if (!view) {
    return (
      <div className="member-preview" data-empty="true">
        <Heading className="member-preview__title">What a lead sees</Heading>
        <p className="member-preview__notshared">Not shared</p>
        <p className="member-preview__note">
          That is the whole card. No leads can open anything else, and nothing on their screen
          says whether you have needs or not.
        </p>
      </div>
    )
  }

  const followUp = FOLLOW_UP_CHOICES.find((choice) => choice.value === view.followUpPreference)

  return (
    <div className="member-preview">
      <Heading className="member-preview__title">What a lead sees</Heading>
      <p className="member-preview__name">{view.preferredName || 'You'}</p>

      {view.needs.length > 0 ? (
        <ul className="member-preview__needs">
          {view.needs.map((need) => (
            <li key={need.id}>
              <span className="member-preview__need">{accessNeedLabel(need.id)}</span>
              <span className="member-preview__priority">
                {need.priority === 'required' ? 'Required' : 'Helpful'}
              </span>
              {need.detail ? <span className="member-preview__detail">{need.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="member-preview__note">No specific items chosen yet.</p>
      )}

      {/* Labelled, so it can never read as a detail hanging off the last need. */}
      {view.generalNote ? (
        <div className="member-preview__generalblock">
          <p className="member-preview__generallabel">In their words</p>
          <p className="member-preview__general">{view.generalNote}</p>
        </div>
      ) : null}
      {followUp ? <p className="member-preview__note">{`Follow-up: ${followUp.label.toLowerCase()}.`}</p> : null}
      {rsvpOnly ? (
        <p className="member-preview__note">
          Visible only on events you have said you are going to. Everywhere else it reads “Not shared.”
        </p>
      ) : null}
    </div>
  )
}

/* ── The editor ─────────────────────────────────────────────────────── */

export type AccessNeedsEditorProps = {
  value: AccessDraft
  onChange: (next: AccessDraft) => void
  /** The name the preview shows. Falls back to nothing rather than inventing one. */
  previewName: string
  disabled?: boolean
}

export function AccessNeedsEditor({ value, onChange, previewName, disabled }: AccessNeedsEditorProps) {
  const now = useMemo(() => new Date().toISOString(), [])

  const leads = useMemo(() => ACCESS_LEAD_EMAILS.map((email) => ({
    email,
    name: adminAccountForEmail(email)?.name || email,
    title: adminAccountForEmail(email)?.title || '',
  })), [])

  /**
   * The real read path, run against the draft. If this returns null the member
   * is looking at exactly the card a lead would open: "Not shared."
   */
  const preview = useMemo(() => consentedAccessView({
    profile: {
      needs: value.needs,
      generalNote: value.generalNote,
      followUpPreference: value.followUpPreference,
      scope: value.scope,
      appliesTo: value.appliesTo,
      consentAt: now,
      consentText: ACCESS_CONSENT_TEXT,
      expiresAt: accessConsentExpiresAt(now),
      withdrawnAt: '',
      hasOpened: true,
      updatedAt: now,
    },
    preferredName: previewName,
    readerEmail: ACCESS_LEAD_EMAILS[0],
    now,
    // The preview always shows the best case for the current scope: an event the
    // member said they were going to. `rsvp-only` then adds the condition in words.
    hasGoingRsvpForEvent: true,
  }), [now, previewName, value])

  const needById = useMemo(() => new Map(value.needs.map((need) => [need.id, need])), [value.needs])

  const toggleNeed = (id: string, checked: boolean) => {
    onChange({
      ...value,
      needs: checked
        // Nothing is pre-checked and nothing is pre-graded: a new item starts at
        // "required" only because the member just said they need it, and the
        // radio directly underneath is right there to soften it.
        ? [...value.needs, { id, priority: 'required', detail: '' }]
        : value.needs.filter((need) => need.id !== id),
    })
  }

  const patchNeed = (id: string, patch: Partial<AccessNeed>) => {
    onChange({
      ...value,
      needs: value.needs.map((need) => (need.id === id ? { ...need, ...patch } : need)),
    })
  }

  return (
    <div className="member-access-editor">
      {ACCESS_CATEGORIES.map((category) => {
        const items = ACCESS_NEED_CATALOG.filter((need) => need.category === category.id)
        if (items.length === 0) return null

        return (
          <FieldGroup key={category.id} legend={category.label} className="member-access-editor__group">
            {items.map((item) => {
              const chosen = needById.get(item.id)
              return (
                <div className="member-need" key={item.id}>
                  <Choice
                    type="checkbox"
                    label={item.label}
                    checked={Boolean(chosen)}
                    disabled={disabled}
                    onChange={(event) => toggleNeed(item.id, event.currentTarget.checked)}
                  />
                  {chosen ? (
                    <div className="member-need__detail">
                      <FieldGroup legend={`How much do you need “${item.label}”?`} row>
                        {(['required', 'helpful'] as AccessPriority[]).map((priority) => (
                          <Choice
                            key={priority}
                            type="radio"
                            name={`priority-${item.id}`}
                            label={PRIORITY_LABELS[priority]}
                            value={priority}
                            checked={chosen.priority === priority}
                            disabled={disabled}
                            onChange={() => patchNeed(item.id, { priority })}
                          />
                        ))}
                      </FieldGroup>
                      <TextareaField
                        label={`Anything to add about “${item.label}”?`}
                        hint={`Optional. ${ACCESS_DETAIL_LIMIT} characters or fewer.`}
                        rows={2}
                        maxLength={ACCESS_DETAIL_LIMIT}
                        showCount
                        disabled={disabled}
                        value={chosen.detail}
                        onChange={(event) => patchNeed(item.id, { detail: event.currentTarget.value })}
                      />
                    </div>
                  ) : null}
                </div>
              )
            })}
          </FieldGroup>
        )
      })}

      <TextareaField
        label="Anything else that would help"
        hint={`Plain language is fine. ${ACCESS_GENERAL_NOTE_LIMIT} characters or fewer.`}
        rows={4}
        maxLength={ACCESS_GENERAL_NOTE_LIMIT}
        showCount
        disabled={disabled}
        value={value.generalNote}
        onChange={(event) => onChange({ ...value, generalNote: event.currentTarget.value })}
      />

      <FieldGroup legend="If someone has a question about this">
        {FOLLOW_UP_CHOICES.map((choice) => (
          <Choice
            key={choice.value}
            type="radio"
            name="access-follow-up"
            label={choice.label}
            note={choice.note}
            value={choice.value}
            checked={value.followUpPreference === choice.value}
            disabled={disabled}
            onChange={() => onChange({ ...value, followUpPreference: choice.value })}
          />
        ))}
      </FieldGroup>

      {/* ── Consent ────────────────────────────────────────────────── */}

      <section className="member-consent" aria-labelledby="member-consent-head">
        <h3 className="member-consent__title" id="member-consent-head">Who can see this</h3>

        {/*
          Order is the point. The warning and the four names come BEFORE the
          radio that acts on them — a consent warning that only appears after
          someone has chosen to share is not informed consent, it is a receipt.
          Rendered verbatim, and stored verbatim with the consent.
        */}
        <p className="member-consent__text">{ACCESS_CONSENT_TEXT}</p>

        <div className="member-consent__leads">
          <p className="member-consent__leadhead" id="member-consent-leads">
            The four people who could read it
          </p>
          <ul className="member-consent__leadlist" aria-labelledby="member-consent-leads">
            {leads.map((lead) => (
              <li key={lead.email}>
                <span className="member-consent__leadname">{lead.name}</span>
                {lead.title ? <span className="member-consent__leadtitle">{lead.title}</span> : null}
                <a className="p-link" href={`mailto:${lead.email}`}>{lead.email}</a>
              </li>
            ))}
          </ul>
          <p className="member-consent__note">
            Nobody else — being a super admin does not open this, and it is left out of every export.
          </p>
        </div>

        <FieldGroup legend="Sharing">
          <Choice
            type="radio"
            name="access-scope"
            label="Private"
            note="Only you. Nobody on the E-board can open it."
            value="private"
            checked={value.scope === 'private'}
            disabled={disabled}
            onChange={() => onChange({ ...value, scope: 'private' })}
          />
          <Choice
            type="radio"
            name="access-scope"
            label="Share with the four leads named above"
            note="They can read it when they are planning a room."
            value="shared-with-leads"
            checked={value.scope === 'shared-with-leads'}
            disabled={disabled}
            onChange={() => onChange({ ...value, scope: 'shared-with-leads' })}
          />
        </FieldGroup>

        {value.scope === 'shared-with-leads' ? (
          <FieldGroup legend="When it applies">
            <Choice
              type="radio"
              name="access-applies-to"
              label="Only events I RSVP to"
              value="rsvp-only"
              checked={value.appliesTo === 'rsvp-only'}
              disabled={disabled}
              onChange={() => onChange({ ...value, appliesTo: 'rsvp-only' })}
            />
            <Choice
              type="radio"
              name="access-applies-to"
              label="All events"
              value="all-events"
              checked={value.appliesTo === 'all-events'}
              disabled={disabled}
              onChange={() => onChange({ ...value, appliesTo: 'all-events' })}
            />
          </FieldGroup>
        ) : null}

        <ConsentedAccessPreview
          view={preview}
          rsvpOnly={value.scope === 'shared-with-leads' && value.appliesTo === 'rsvp-only'}
        />
      </section>
    </div>
  )
}

export default AccessNeedsEditor
