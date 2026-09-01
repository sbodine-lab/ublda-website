import { useState } from 'react'
import { Link } from 'react-router-dom'
import Reveal from '../components/Reveal'
import {
  APPLY_DEADLINE_LABEL,
  APPLY_ESSAY_WORD_TARGET,
  APPLY_LIMITS,
  APPLY_OPENS_LABEL,
  APPLY_ROLE_OPTIONS,
  APPLY_YEARS,
  applyWindow,
  countWords,
  resumeUrlOk,
  type ApplyRoleInterest,
  type ApplyWindow,
} from '../lib/applyForm'
import './Join.css'
import './Apply.css'

const steps = [
  { name: 'Apply', detail: 'Sept 9–22 · closes 11:59 PM ET' },
  { name: 'Interviews', detail: 'Sept 25–27 · behavioral + technical' },
  { name: 'Offers', detail: 'By Tuesday, Sept 29' },
  { name: 'Kickoff', detail: 'Week of Oct 5' },
]

/* ?preview=open|closed lets the team see the other states before the window
   flips; the API still enforces the real dates. */
const currentWindow = (): ApplyWindow => {
  const preview = new URLSearchParams(window.location.search).get('preview')
  if (preview === 'open' || preview === 'closed') return preview
  if (preview === 'before') return 'before'
  return applyWindow(Date.now())
}

export default function Apply() {
  const [window_] = useState<ApplyWindow>(currentWindow)
  const [submitted, setSubmitted] = useState(false)
  const [resubmission, setResubmission] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    fullName: '',
    uniqname: '',
    year: '',
    schoolMajor: '',
    roleInterest: '' as '' | ApplyRoleInterest,
    whyJoin: '',
    experience: '',
    resumeUrl: '',
    availabilityConfirmed: false,
    accommodations: '',
    website: '', // honeypot — real people never see or fill this
  })

  const update = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    let val = e.target.value
    if (field === 'uniqname') {
      val = val.replace(/@umich\.edu$/i, '').replace(/@.*$/, '')
    }
    setForm({ ...form, [field]: val })
  }

  const email = `${form.uniqname.trim().toLowerCase()}@umich.edu`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.roleInterest) {
      setError('Choose a role option to continue.')
      return
    }
    if (form.resumeUrl.trim() && !resumeUrlOk(form.resumeUrl)) {
      setError('The resume link should be a full URL starting with http(s):// — a Google Drive share link works.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          email,
          year: form.year,
          schoolMajor: form.schoolMajor,
          roleInterest: form.roleInterest,
          whyJoin: form.whyJoin,
          experience: form.experience,
          resumeUrl: form.resumeUrl.trim() || undefined,
          availabilityConfirmed: form.availabilityConfirmed,
          accommodations: form.accommodations.trim() || undefined,
          website: form.website,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setResubmission(Boolean(data.resubmission))
        setSubmitted(true)
      } else {
        setError(data.error || 'Something went wrong. Try again, or email your application to sbodine@umich.edu.')
      }
    } catch {
      setError('Something went wrong. Try again, or email your application to sbodine@umich.edu.')
    } finally {
      setSubmitting(false)
    }
  }

  const whyWords = countWords(form.whyJoin)
  const experienceWords = countWords(form.experience)

  return (
    <main id="main-content" className="join-page apply-page">
      <section className="join-page__hero">
        <div className="container">
          <Reveal>
            <p className="section__label">Fall 2026 · UBLDA Consulting</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="join-page__headline">
              Join the fall<br />
              <em>consulting team.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="join-page__intro">
              This fall a UBLDA analyst team works directly with client leadership on a
              real engagement: strategy, research, and a final deliverable the client
              keeps. No consulting experience required, all majors and years welcome.
              The form takes about ten minutes, and applying also signs you up as a UBLDA member — no separate form needed.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="apply-deadline" role="note">
              {window_ === 'before' && <>Applications open {APPLY_OPENS_LABEL}.</>}
              {window_ === 'open' && <>Applications close {APPLY_DEADLINE_LABEL}.</>}
              {window_ === 'closed' && <>Fall 2026 applications closed September 22.</>}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section apply-steps-section" aria-label="How the process works">
        <div className="container container--narrow">
          <ol className="apply-steps">
            {steps.map((step) => (
              <li key={step.name} className="apply-step">
                <span className="apply-step__name">{step.name}</span>
                <span className="apply-step__detail">{step.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section join-form-section">
        <div className="container container--narrow">
          <Reveal>
            <h2 className="join-form__title">Fall 2026 Application</h2>
          </Reveal>

          {window_ !== 'open' ? (
            <Reveal>
              <div className="apply-notice">
                {window_ === 'before' ? (
                  <>
                    <h3 className="apply-notice__title">Opens {APPLY_OPENS_LABEL}</h3>
                    <p className="apply-notice__desc">
                      Come meet the team first: Festifall on Wednesday, Sept 2
                      (Table C43, the Diag) and BBA Meet the Clubs on Tuesday,
                      Sept 8. The application goes live here the next morning
                      and takes about ten minutes.
                    </p>
                    <p className="apply-notice__desc">
                      <Link to="/join" className="join-contact__email">Join the mailing list</Link>
                      {' '}and we'll email you the moment it opens.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="apply-notice__title">Applications closed September 22</h3>
                    <p className="apply-notice__desc">
                      Missed it? Email{' '}
                      <a href="mailto:sbodine@umich.edu" className="join-contact__email">sbodine@umich.edu</a>
                      {' '}— late applications are read if seats remain — or{' '}
                      <Link to="/join" className="join-contact__email">join the mailing list</Link>
                      {' '}for the winter cycle.
                    </p>
                  </>
                )}
              </div>
            </Reveal>
          ) : submitted ? (
            <Reveal>
              <div className="join-form__success" role="alert" aria-live="polite">
                <div className="join-form__success-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h3 className="join-form__success-title">Application received</h3>
                <p className="join-form__success-desc">
                  {resubmission
                    ? 'We already had an application from you; this newest one is the one we read. '
                    : ''}
                  You're also signed up as a UBLDA member — no separate form needed. Interview invites go out Wednesday, September 23. Questions before then:{' '}
                  <a href="mailto:sbodine@umich.edu" className="join-contact__email">sbodine@umich.edu</a>.
                </p>
              </div>
            </Reveal>
          ) : (
            <Reveal delay={0.15}>
              <form className="join-form" onSubmit={handleSubmit}>
                <div className="join-form__row">
                  <div className="join-form__field">
                    <label className="join-form__label" htmlFor="fullName">Full name</label>
                    <input
                      id="fullName"
                      type="text"
                      className="join-form__input"
                      placeholder="Full name"
                      value={form.fullName}
                      onChange={update('fullName')}
                      maxLength={APPLY_LIMITS.name}
                      required
                    />
                  </div>
                  <div className="join-form__field">
                    <label className="join-form__label" htmlFor="uniqname">UMich uniqname</label>
                    <div className="join-form__email-wrapper">
                      <input
                        id="uniqname"
                        type="text"
                        className="join-form__input join-form__input--email"
                        placeholder="uniqname"
                        value={form.uniqname}
                        onChange={update('uniqname')}
                        required
                      />
                      <span className="join-form__email-suffix">@umich.edu</span>
                    </div>
                  </div>
                </div>

                <div className="join-form__row">
                  <div className="join-form__field">
                    <label className="join-form__label" htmlFor="year">Year</label>
                    <select
                      id="year"
                      className="join-form__input join-form__select"
                      value={form.year}
                      onChange={update('year')}
                      required
                    >
                      <option value="" disabled>Select year</option>
                      {APPLY_YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="join-form__field">
                    <label className="join-form__label" htmlFor="schoolMajor">School + major</label>
                    <input
                      id="schoolMajor"
                      type="text"
                      className="join-form__input"
                      placeholder="e.g. Ross BBA, LSA Economics"
                      value={form.schoolMajor}
                      onChange={update('schoolMajor')}
                      maxLength={APPLY_LIMITS.schoolMajor}
                      required
                    />
                  </div>
                </div>

                <fieldset className="apply-roles">
                  <legend className="join-form__label">Role interest</legend>
                  {APPLY_ROLE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`apply-role${form.roleInterest === option.value ? ' apply-role--selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="roleInterest"
                        value={option.value}
                        checked={form.roleInterest === option.value}
                        onChange={() => setForm({ ...form, roleInterest: option.value })}
                        className="apply-role__input"
                        required
                      />
                      <span className="apply-role__text">
                        <span className="apply-role__label">{option.label}</span>
                        <span className="apply-role__detail">{option.detail}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>

                <div className="join-form__field">
                  <label className="join-form__label" htmlFor="whyJoin">
                    Why do you want to join the UBLDA consulting program?
                  </label>
                  <textarea
                    id="whyJoin"
                    className="join-form__input apply-textarea"
                    placeholder={`About ${APPLY_ESSAY_WORD_TARGET} words`}
                    value={form.whyJoin}
                    onChange={update('whyJoin')}
                    maxLength={APPLY_LIMITS.essay}
                    rows={5}
                    required
                  />
                  <span className="apply-wordcount" aria-live="polite">
                    {whyWords > 0 ? `${whyWords} words` : `~${APPLY_ESSAY_WORD_TARGET} words`}
                  </span>
                </div>

                <div className="join-form__field">
                  <label className="join-form__label" htmlFor="experience">
                    Relevant experience or skills. Classes, jobs, clubs, lived experience — all of it counts.
                  </label>
                  <textarea
                    id="experience"
                    className="join-form__input apply-textarea"
                    placeholder={`About ${APPLY_ESSAY_WORD_TARGET} words`}
                    value={form.experience}
                    onChange={update('experience')}
                    maxLength={APPLY_LIMITS.essay}
                    rows={5}
                    required
                  />
                  <span className="apply-wordcount" aria-live="polite">
                    {experienceWords > 0 ? `${experienceWords} words` : `~${APPLY_ESSAY_WORD_TARGET} words`}
                  </span>
                </div>

                <div className="join-form__field">
                  <label className="join-form__label" htmlFor="resumeUrl">
                    Resume link <span className="apply-optional">(optional)</span>
                  </label>
                  <input
                    id="resumeUrl"
                    type="url"
                    className="join-form__input"
                    placeholder="Google Drive, Dropbox, or personal-site link"
                    value={form.resumeUrl}
                    onChange={update('resumeUrl')}
                    maxLength={APPLY_LIMITS.resumeUrl}
                  />
                  <span className="apply-hint">
                    Set sharing to “anyone with the link can view.” No resume yet is fine.
                  </span>
                </div>

                <label className="apply-check">
                  <input
                    type="checkbox"
                    checked={form.availabilityConfirmed}
                    onChange={(e) => setForm({ ...form, availabilityConfirmed: e.target.checked })}
                    required
                  />
                  <span>
                    I can make two short interview rounds September 25–27 and roughly
                    4–5 hours a week for the fall project.
                  </span>
                </label>

                <div className="join-form__field">
                  <label className="join-form__label" htmlFor="accommodations">
                    Anything that would make the interview process work better for you?{' '}
                    <span className="apply-optional">(optional)</span>
                  </label>
                  <textarea
                    id="accommodations"
                    className="join-form__input apply-textarea"
                    placeholder="Accommodations, formats, timing — we'll make it happen."
                    value={form.accommodations}
                    onChange={update('accommodations')}
                    maxLength={APPLY_LIMITS.accommodations}
                    rows={2}
                  />
                </div>

                <div className="apply-honeypot" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={update('website')}
                  />
                </div>

                {error && (
                  <p className="apply-error" role="alert">{error}</p>
                )}

                <button type="submit" className="btn btn--primary btn--lg join-form__submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit application'}
                  {!submitting && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </form>
            </Reveal>
          )}
        </div>
      </section>

      {window_ !== 'closed' && (
      <section className="section join-contact">
        <div className="container container--narrow" style={{ textAlign: 'center' }}>
          <Reveal>
            <h2 className="join-contact__title">Not sure you should apply?</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="join-contact__desc">
              Apply anyway. We read every application, and the team is chosen on
              interest and follow-through, not a resume. Questions first:{' '}
              <a href="mailto:sbodine@umich.edu" className="join-contact__email">sbodine@umich.edu</a>.
            </p>
          </Reveal>
        </div>
      </section>
      )}
    </main>
  )
}
