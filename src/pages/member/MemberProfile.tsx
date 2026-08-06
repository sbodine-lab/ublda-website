import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormEvent } from 'react'
import { PortalPage } from '../../components/portal/PortalShell'
import { PanelHead } from '../../components/portal/PanelHead'
import { ErrorSummary } from '../../components/portal/ErrorSummary'
import type { ErrorSummaryEntry } from '../../components/portal/ErrorSummary'
import { Choice, Field, FieldGroup, SelectField, TextareaField } from '../../components/portal/Field'
import { usePortalAnnouncer } from '../../components/portal/PortalAnnouncer'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { adminAccountForEmail } from '../../lib/dashboardAccess'
import { callPortal } from '../../lib/portalClient'
import type { PortalBootstrap } from '../../lib/portalClient'
import {
  MEMBER_DIETARY_LIMIT,
  MEMBER_EDITABLE_FIELDS,
  MEMBER_INTERESTS,
  MEMBER_SCHOOLS,
  MEMBER_YEARS,
} from '../../lib/portalMembers'
import type { MemberInterest, MemberSchool, MemberSelfProfile, MemberYear } from '../../lib/portalMembers'
import './Member.css'

/**
 * `/members/profile` (spec §6 T4).
 *
 * Everything the club already knows is prefilled and everything it knows for
 * certain is shown, not asked again (SC 3.3.7). A signed-in member never retypes
 * their own name or email here.
 *
 * The payload is built by mapping `MEMBER_EDITABLE_FIELDS`, so this form cannot
 * quietly start sending a field the server would refuse — the allowlist is
 * literally the loop.
 *
 * `status` is deliberately absent from this screen. It is an operational,
 * admin-set field, and "inactive" is not a word the member face ever shows
 * someone about themselves.
 */

type ProfileDraft = Pick<MemberSelfProfile, (typeof MEMBER_EDITABLE_FIELDS)[number]>

const emptyDraft = (): ProfileDraft => ({
  preferredName: '', pronouns: '', year: '', school: '', major: '',
  gradYear: '', interests: [], linkedinUrl: '', phone: '', dietary: '',
})

const draftFromProfile = (profile: MemberSelfProfile): ProfileDraft => ({
  preferredName: profile.preferredName,
  pronouns: profile.pronouns,
  year: profile.year,
  school: profile.school,
  major: profile.major,
  gradYear: profile.gradYear,
  interests: [...profile.interests],
  linkedinUrl: profile.linkedinUrl,
  phone: profile.phone,
  dietary: profile.dietary,
})

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

const YEAR_OPTIONS = MEMBER_YEARS.map((year) => ({
  value: year, label: year || 'Not saying right now',
}))

const SCHOOL_OPTIONS = MEMBER_SCHOOLS.map((school) => ({
  value: school, label: school || 'Not saying right now',
}))

const gradYearPattern = /^(19|20)\d{2}$/

/** The person to email when a name or address on file is wrong. Real, from the roster. */
const OPS_LEAD = adminAccountForEmail('ylindsey@umich.edu')

export default function MemberProfile() {
  const { sessionToken, account } = useMemberAuth()
  const { announce, announceUrgent } = usePortalAnnouncer()

  const [profile, setProfile] = useState<MemberSelfProfile | null>(null)
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft)
  const [errors, setErrors] = useState<(string | ErrorSummaryEntry)[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    callPortal<PortalBootstrap>('portal.bootstrap', sessionToken)
      .then((data) => {
        if (cancelled) return
        setProfile(data.profile)
        setDraft(draftFromProfile(data.profile))
        setLoadError('')
      })
      .catch((error: Error) => {
        if (cancelled) return
        setLoadError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [sessionToken, reloadKey])

  /** Retrying is an event, not an effect — the skeleton comes back from here. */
  const retry = useCallback(() => {
    setLoading(true)
    setReloadKey((key) => key + 1)
  }, [])

  const patch = useCallback((next: Partial<ProfileDraft>) => {
    setDraft((previous) => ({ ...previous, ...next }))
  }, [])

  const toggleInterest = useCallback((interest: MemberInterest, checked: boolean) => {
    setDraft((previous) => ({
      ...previous,
      interests: checked
        ? [...previous.interests, interest]
        : previous.interests.filter((entry) => entry !== interest),
    }))
  }, [])

  const handleSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // Only fields the member actually filled in are checked here — no validation
    // on the blur of something they never touched.
    const found: ErrorSummaryEntry[] = []
    if (draft.gradYear && !gradYearPattern.test(draft.gradYear)) {
      found.push({ fieldId: 'profile-grad-year', message: 'Graduation year has to be a four-digit year, like 2029.' })
    }
    if (draft.linkedinUrl && !draft.linkedinUrl.startsWith('https://')) {
      found.push({ fieldId: 'profile-linkedin', message: 'The LinkedIn link has to start with https://.' })
    }
    if (found.length > 0) {
      setErrors(found)
      announceUrgent(found.length === 1 ? 'There is one thing to fix.' : `There are ${found.length} things to fix.`)
      return
    }

    setSaving(true)
    setErrors([])

    try {
      // The allowlist IS the loop: nothing outside MEMBER_EDITABLE_FIELDS can be sent.
      const payload = Object.fromEntries(
        MEMBER_EDITABLE_FIELDS.map((field) => [field, draft[field]]),
      ) as Record<string, unknown>

      const result = await callPortal<{ profile: MemberSelfProfile }>('member.saveProfile', sessionToken, payload)
      setProfile(result.profile)
      setDraft(draftFromProfile(result.profile))
      announce('Profile saved.')
    } catch (error) {
      const failure = error as Error & { errors?: string[] }
      const list = failure.errors && failure.errors.length > 0 ? failure.errors : [failure.message]
      setErrors(list)
      announceUrgent(list[0])
    } finally {
      setSaving(false)
    }
  }, [announce, announceUrgent, draft, sessionToken])

  if (loading && !profile) {
    return (
      <PortalPage title="Profile" lede="What the club knows about you, and what you would like it to.">
        <div className="member-loading" role="status">
          <span className="p-visually-hidden">Loading your profile.</span>
          <div className="p-skeleton member-loading__block" />
        </div>
      </PortalPage>
    )
  }

  const firstName = profile?.firstName || account?.firstName || ''
  const lastName = profile?.lastName || account?.lastName || ''
  const email = profile?.email || account?.email || ''
  const uniqname = profile?.uniqname || account?.uniqname || ''

  return (
    <PortalPage title="Profile" lede="What the club knows about you, and what you would like it to.">
      {loadError ? (
        <section className="p-panel member-error" aria-labelledby="member-profile-error">
          <h2 className="p-panelhead__title" id="member-profile-error">Your profile could not load</h2>
          <p>{loadError}</p>
          <p className="p-btnrow">
            <button type="button" className="p-btn p-btn--primary" onClick={retry}>
              Try again
            </button>
          </p>
        </section>
      ) : null}

      <section className="p-panel" aria-labelledby="member-known-head">
        <PanelHead
          id="member-known-head"
          title="What we already have"
          description="From your sign-in. You do not need to type any of it again."
        />
        <dl className="member-facts">
          <div className="member-facts__row">
            <dt>Name</dt>
            <dd>{[firstName, lastName].filter(Boolean).join(' ') || '—'}</dd>
          </div>
          <div className="member-facts__row">
            <dt>Email</dt>
            <dd>{email || '—'}</dd>
          </div>
          {uniqname ? (
            <div className="member-facts__row">
              <dt>Uniqname</dt>
              <dd>{uniqname}</dd>
            </div>
          ) : null}
        </dl>
        <p className="p-meta">
          {'Any of that wrong? Email '}
          <a className="p-link" href={`mailto:${OPS_LEAD?.email || 'ylindsey@umich.edu'}`}>
            {OPS_LEAD?.name || 'Lindsey Ye'}
          </a>
          {OPS_LEAD?.title ? `, ${OPS_LEAD.title}, and she will fix it on the roster.` : ' and it gets fixed on the roster.'}
        </p>
      </section>

      <form className="p-panel member-form" onSubmit={handleSubmit} aria-labelledby="member-form-head">
        <PanelHead
          id="member-form-head"
          title="About you"
          description="All optional. It shapes who gets asked to what, and nothing here is shown to other members."
        />

        <ErrorSummary errors={errors} />

        <Field
          id="profile-preferred-name"
          label="Preferred name"
          hint="What we should actually call you. Used everywhere in the portal ahead of your first name."
          autoComplete="nickname"
          maxLength={80}
          value={draft.preferredName}
          onChange={(event) => patch({ preferredName: event.currentTarget.value })}
        />

        <Field
          id="profile-pronouns"
          label="Pronouns"
          hint="Written on name tags at events, if you want them there."
          maxLength={40}
          value={draft.pronouns}
          onChange={(event) => patch({ pronouns: event.currentTarget.value })}
        />

        <div className="member-form__row">
          <SelectField
            id="profile-year"
            label="Year"
            options={YEAR_OPTIONS}
            value={draft.year}
            onChange={(event) => patch({ year: event.currentTarget.value as MemberYear })}
          />
          <SelectField
            id="profile-school"
            label="School"
            options={SCHOOL_OPTIONS}
            value={draft.school}
            onChange={(event) => patch({ school: event.currentTarget.value as MemberSchool })}
          />
        </div>

        <div className="member-form__row">
          <Field
            id="profile-major"
            label="Major"
            maxLength={120}
            value={draft.major}
            onChange={(event) => patch({ major: event.currentTarget.value })}
          />
          <Field
            id="profile-grad-year"
            label="Graduation year"
            hint="Four digits, like 2029."
            inputMode="numeric"
            maxLength={4}
            value={draft.gradYear}
            onChange={(event) => patch({ gradYear: event.currentTarget.value })}
          />
        </div>

        <FieldGroup
          legend="What you would like to be part of"
          hint="It decides who gets asked when a project, a speaker night, or a workshop needs people."
        >
          {MEMBER_INTERESTS.map((interest) => (
            <Choice
              key={interest}
              type="checkbox"
              label={titleCase(interest)}
              checked={draft.interests.includes(interest)}
              onChange={(event) => toggleInterest(interest, event.currentTarget.checked)}
            />
          ))}
        </FieldGroup>

        <Field
          id="profile-linkedin"
          label="LinkedIn"
          hint="Starts with https://. Only the E-board sees it."
          type="url"
          autoComplete="url"
          maxLength={300}
          value={draft.linkedinUrl}
          onChange={(event) => patch({ linkedinUrl: event.currentTarget.value })}
        />

        <Field
          id="profile-phone"
          label="Phone"
          hint="Used for day-of-event contact only — a room change, a delayed speaker."
          type="tel"
          autoComplete="tel"
          maxLength={40}
          value={draft.phone}
          onChange={(event) => patch({ phone: event.currentTarget.value })}
        />

        <TextareaField
          id="profile-dietary"
          label="Food preferences"
          hint="Preferences, not medical needs. Allergies belong on your access page, where they stay private and only the leads you name can read them."
          rows={2}
          maxLength={MEMBER_DIETARY_LIMIT}
          showCount
          value={draft.dietary}
          onChange={(event) => patch({ dietary: event.currentTarget.value })}
        />

        <div className="p-btnrow">
          <button type="submit" className="p-btn p-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      <section className="p-panel" aria-labelledby="member-access-link">
        <PanelHead
          id="member-access-link"
          title="Access preferences"
          description="How a room should be set up for you. Private by default, and separate from everything above on purpose."
        />
        <p>
          We ask what you need in a room. We never ask what is true about your body — there is no
          diagnosis question anywhere in this portal, and there will not be one.
        </p>
        <div className="p-btnrow">
          <Link className="p-btn" to="/members/profile/access">Open access preferences</Link>
        </div>
      </section>
    </PortalPage>
  )
}
