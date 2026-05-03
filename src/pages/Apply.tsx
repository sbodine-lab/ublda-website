import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  COMMITMENT_OPTIONS,
  MAX_RESUME_FILE_SIZE_BYTES,
  NOTES_WORD_LIMIT,
  RESUME_MIME_TYPES,
  ROLE_OPTIONS,
  ROSS_STATUS_OPTIONS,
  YEARS,
  clampToWordLimit,
  countWords,
  isResumeFileAllowed,
  normalizeUniqname,
} from '../lib/application'
import type { ApplicationStatus } from '../lib/application'
import {
  INTERVIEW_DAY_RANGE_LABEL,
  INTERVIEW_SLOT_GROUPS,
} from '../lib/interviews'
import Reveal from '../components/Reveal'
import './Apply.css'

const processSteps = [
  'Upload resume',
  'Rank roles',
  'Select availability',
  'Get matched',
]

type ApplicationForm = {
  firstName: string
  lastName: string
  uniqname: string
  year: string
  expectedGraduation: string
  college: string
  rossStatus: string
  interestType: string
  rolePreferences: string[]
  availability: string[]
  weeklyCommitment: string
  notes: string
  website: string
}

const initialForm: ApplicationForm = {
  firstName: '',
  lastName: '',
  uniqname: '',
  year: '',
  expectedGraduation: '',
  college: '',
  rossStatus: '',
  interestType: 'leadership-interview',
  rolePreferences: ['', '', ''],
  availability: [],
  weeklyCommitment: '',
  notes: '',
  website: '',
}

const successMessage = (status: ApplicationStatus | '') => {
  if (status === 'Future role pool') {
    return 'Your resume and availability are saved for future project, committee, and leadership roles. Current e-board interviews are Ross-focused, but UBLDA still needs strong non-Ross collaborators as opportunities open.'
  }

  if (status === 'Needs review') {
    return 'Your resume, role interests, and availability are saved while we confirm eligibility and match realistic interview slots.'
  }

  return 'Your resume, role rankings, and availability are in. We will match candidates to realistic Google Meet slots after e-board availability is collected.'
}

const resumeAccept = RESUME_MIME_TYPES.join(',')

const fileSizeLabel = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`

const fileToResumePayload = (file: File) =>
  new Promise<{ name: string; mimeType: string; size: number; contentBase64: string }>((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error('Resume file could not be read. Please try uploading it again.'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const contentBase64 = result.includes(',') ? result.split(',')[1] : result

      if (!contentBase64) {
        reject(new Error('Resume file could not be read. Please try uploading it again.'))
        return
      }

      resolve({
        name: file.name,
        mimeType: file.type,
        size: file.size,
        contentBase64,
      })
    }

    reader.readAsDataURL(file)
  })

export default function Apply() {
  const [form, setForm] = useState<ApplicationForm>(initialForm)
  const [submitted, setSubmitted] = useState(false)
  const [submittedStatus, setSubmittedStatus] = useState<ApplicationStatus | ''>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)

  const selectedAvailability = useMemo(() => new Set(form.availability), [form.availability])
  const selectedRolePreferences = useMemo(
    () => new Set(form.rolePreferences.filter(Boolean)),
    [form.rolePreferences],
  )

  const updateField =
    (field: keyof Omit<ApplicationForm, 'rolePreferences' | 'availability'>) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      let value = event.target.value

      if (field === 'uniqname') {
        value = normalizeUniqname(value)
      }

      if (field === 'notes') {
        value = clampToWordLimit(value, NOTES_WORD_LIMIT)
      }

      setForm((current) => ({ ...current, [field]: value }))
    }

  const updateRolePreference = (index: number, value: string) => {
    setForm((current) => {
      const rolePreferences = [...current.rolePreferences]
      rolePreferences[index] = value
      return { ...current, rolePreferences }
    })
  }

  const toggleAvailability = (value: string) => {
    setForm((current) => {
      const availability = new Set(current.availability)

      if (availability.has(value)) {
        availability.delete(value)
      } else {
        availability.add(value)
      }

      return { ...current, availability: Array.from(availability) }
    })
  }

  const toggleDay = (values: string[]) => {
    setForm((current) => {
      const availability = new Set(current.availability)
      const allSelected = values.every((value) => availability.has(value))

      values.forEach((value) => {
        if (allSelected) {
          availability.delete(value)
        } else {
          availability.add(value)
        }
      })

      return { ...current, availability: Array.from(availability) }
    })
  }

  const handleResumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setError('')

    if (!file) {
      setResumeFile(null)
      return
    }

    if (!isResumeFileAllowed(file.name, file.type)) {
      event.target.value = ''
      setResumeFile(null)
      setError('Resume must be a PDF, DOC, or DOCX file.')
      return
    }

    if (file.size > MAX_RESUME_FILE_SIZE_BYTES) {
      event.target.value = ''
      setResumeFile(null)
      setError(`Resume file must be ${fileSizeLabel(MAX_RESUME_FILE_SIZE_BYTES)} or smaller.`)
      return
    }

    setResumeFile(file)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    const rankedRoles = form.rolePreferences.filter(Boolean)

    if (rankedRoles.length < 3 || new Set(rankedRoles).size !== rankedRoles.length) {
      setSubmitting(false)
      setError('Please rank three different board positions.')
      return
    }

    if (form.availability.length === 0) {
      setSubmitting(false)
      setError('Please select every interview block you are available for.')
      return
    }

    if (!resumeFile) {
      setSubmitting(false)
      setError('Please upload your resume.')
      return
    }

    try {
      const resumeFilePayload = await fileToResumePayload(resumeFile)
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          rolePreferences: rankedRoles,
          resumeFile: resumeFilePayload,
        }),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || 'Submission failed')
      }

      setSubmittedStatus(result?.status || '')
      setSubmitted(true)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : ''
      setError(message || 'Something went wrong. Please try again or email sbodine@umich.edu.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main id="main-content" className="apply-page">
      <section className="apply-page__hero">
        <div className="container container--narrow">
          <Reveal>
            <p className="section__label">E-Board Interviews</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="apply-page__headline">
              Resume, role ranking, and interview availability.
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="apply-page__intro">
              UBLDA is recruiting three new e-board members on a compressed timeline.
              This replaces the written application: upload your resume, rank the
              board roles you are most interested in, and select every Google Meet
              interview block you can make from {INTERVIEW_DAY_RANGE_LABEL}.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="apply-page__process" aria-label="Interview process">
              {processSteps.map((step) => (
                <div className="apply-page__process-step" key={step}>
                  <span className="apply-page__process-dot" aria-hidden="true" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section apply-form-section">
        <div className="container container--narrow">
          {submitted ? (
            <Reveal>
              <div className="apply-form__success" role="alert" aria-live="polite">
                <div className="apply-form__success-icon" aria-hidden="true">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h2 className="apply-form__success-title">Interview form received.</h2>
                <p className="apply-form__success-desc">
                  {successMessage(submittedStatus)}
                </p>
                <Link to="/join" className="btn btn--ghost">
                  Back to Join
                </Link>
              </div>
            </Reveal>
          ) : (
            <Reveal>
              <form className="apply-form" onSubmit={handleSubmit}>
                <div className="apply-form__header">
                  <p className="section__label">Candidate Form</p>
                  <h2 className="apply-form__title">One clean form. No login.</h2>
                  <p className="apply-form__subtitle">
                    Select all availability that works. We will assign one 20-minute slot after matching against e-board interviewer availability.
                  </p>
                </div>

                <div className="apply-form__notice">
                  <strong>Timeline</strong>
                  <span>
                    Monday: candidate form opens. Tuesday: rubric and structure. Wednesday: matching. Thursday-Sunday:
                    virtual interviews. Monday, May 11: decisions target.
                  </span>
                </div>

                <fieldset className="apply-form__group">
                  <legend>Basics</legend>
                  <div className="apply-form__row">
                    <div className="apply-form__field">
                      <label htmlFor="firstName">First name</label>
                      <input
                        id="firstName"
                        type="text"
                        value={form.firstName}
                        onChange={updateField('firstName')}
                        autoComplete="given-name"
                        required
                      />
                    </div>
                    <div className="apply-form__field">
                      <label htmlFor="lastName">Last name</label>
                      <input
                        id="lastName"
                        type="text"
                        value={form.lastName}
                        onChange={updateField('lastName')}
                        autoComplete="family-name"
                        required
                      />
                    </div>
                  </div>

                  <div className="apply-form__field">
                    <label htmlFor="uniqname">UMich uniqname</label>
                    <div className="apply-form__email-wrapper">
                      <input
                        id="uniqname"
                        type="text"
                        value={form.uniqname}
                        onChange={updateField('uniqname')}
                        autoCapitalize="none"
                        autoComplete="username"
                        spellCheck={false}
                        required
                      />
                      <span>@umich.edu</span>
                    </div>
                  </div>

                  <div className="apply-form__row">
                    <div className="apply-form__field">
                      <label htmlFor="year">Year</label>
                      <select id="year" value={form.year} onChange={updateField('year')} required>
                        <option value="" disabled>Select year</option>
                        {YEARS.map((year) => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>
                    <div className="apply-form__field">
                      <label htmlFor="expectedGraduation">Expected graduation</label>
                      <input
                        id="expectedGraduation"
                        type="text"
                        value={form.expectedGraduation}
                        onChange={updateField('expectedGraduation')}
                        placeholder="e.g. May 2028"
                        required
                      />
                    </div>
                  </div>

                  <div className="apply-form__row">
                    <div className="apply-form__field">
                      <label htmlFor="college">College / program</label>
                      <input
                        id="college"
                        type="text"
                        value={form.college}
                        onChange={updateField('college')}
                        placeholder="e.g. Ross BBA, LSA, Engineering"
                        required
                      />
                    </div>
                    <div className="apply-form__field">
                      <label htmlFor="rossStatus">Ross/BBA status</label>
                      <select id="rossStatus" value={form.rossStatus} onChange={updateField('rossStatus')} required>
                        <option value="" disabled>Select one</option>
                        {ROSS_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="apply-form__group">
                  <legend>Resume and role interests</legend>
                  <div className="apply-form__field">
                    <label htmlFor="resume">Resume</label>
                    <input
                      id="resume"
                      type="file"
                      accept={resumeAccept}
                      onChange={handleResumeChange}
                      required
                    />
                    <p className="apply-form__helper">PDF, DOC, or DOCX. Max {fileSizeLabel(MAX_RESUME_FILE_SIZE_BYTES)}.</p>
                    {resumeFile && <p className="apply-form__file-name">{resumeFile.name}</p>}
                  </div>

                  <div className="apply-form__rank-grid">
                    {['First choice', 'Second choice', 'Third choice'].map((label, index) => (
                      <div className="apply-form__field" key={label}>
                        <label htmlFor={`rolePreference${index}`}>{label}</label>
                        <select
                          id={`rolePreference${index}`}
                          value={form.rolePreferences[index]}
                          onChange={(event) => updateRolePreference(index, event.target.value)}
                          required
                        >
                          <option value="" disabled>Select role</option>
                          {ROLE_OPTIONS.map((role) => (
                            <option
                              key={role}
                              value={role}
                              disabled={selectedRolePreferences.has(role) && form.rolePreferences[index] !== role}
                            >
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="apply-form__row">
                    <div className="apply-form__field">
                      <label htmlFor="weeklyCommitment">Likely weekly commitment</label>
                      <select id="weeklyCommitment" value={form.weeklyCommitment} onChange={updateField('weeklyCommitment')}>
                        <option value="">Select one</option>
                        {COMMITMENT_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="apply-form__field">
                      <label htmlFor="notes">Optional context <span>({countWords(form.notes)}/{NOTES_WORD_LIMIT} words)</span></label>
                      <textarea
                        id="notes"
                        value={form.notes}
                        onChange={updateField('notes')}
                        placeholder="Accessibility needs, scheduling notes, or anything useful for interview matching."
                      />
                    </div>
                  </div>
                </fieldset>

                <fieldset className="apply-form__group">
                  <legend>Interview availability</legend>
                  <p className="apply-form__helper">
                    Select every 20-minute block you can make. Choosing more blocks makes Wednesday matching much easier.
                  </p>
                  <div className="availability-days">
                    {INTERVIEW_SLOT_GROUPS.map((group) => {
                      const values = group.slots.map((slot) => slot.value)
                      const selectedCount = values.filter((value) => selectedAvailability.has(value)).length

                      return (
                        <section className="availability-day" key={group.date}>
                          <div className="availability-day__header">
                            <div>
                              <h3>{group.label}</h3>
                              <p>{selectedCount} of {values.length} blocks selected</p>
                            </div>
                            <button type="button" onClick={() => toggleDay(values)}>
                              {selectedCount === values.length ? 'Clear day' : 'Select day'}
                            </button>
                          </div>
                          <div className="availability-grid">
                            {group.slots.map((slot) => (
                              <label className="apply-form__checkbox" key={slot.value}>
                                <input
                                  type="checkbox"
                                  checked={selectedAvailability.has(slot.value)}
                                  onChange={() => toggleAvailability(slot.value)}
                                />
                                <span>{slot.timeLabel}</span>
                              </label>
                            ))}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                </fieldset>

                <div className="apply-form__trap" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input
                    id="website"
                    type="text"
                    value={form.website}
                    onChange={updateField('website')}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                {error && (
                  <p className="apply-form__error" role="alert">
                    {error}
                  </p>
                )}

                <div className="apply-form__footer-actions">
                  <button type="submit" className="btn btn--primary btn--lg apply-form__submit" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit interview availability'}
                    {!submitting && (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <Link to="/interviewer-availability" className="apply-form__secondary-link">
                    E-board availability form
                  </Link>
                </div>
              </form>
            </Reveal>
          )}
        </div>
      </section>
    </main>
  )
}
