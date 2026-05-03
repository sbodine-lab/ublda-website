import { useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  INTERVIEW_DAY_RANGE_LABEL,
  INTERVIEW_SLOT_GROUPS,
} from '../lib/interviews'
import { normalizeUniqname } from '../lib/application'
import Reveal from '../components/Reveal'
import './Apply.css'

type AvailabilityForm = {
  firstName: string
  lastName: string
  uniqname: string
  availability: string[]
  maxInterviews: string
  notes: string
  website: string
}

const initialForm: AvailabilityForm = {
  firstName: '',
  lastName: '',
  uniqname: '',
  availability: [],
  maxInterviews: '',
  notes: '',
  website: '',
}

export default function InterviewerAvailability() {
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const selectedAvailability = useMemo(() => new Set(form.availability), [form.availability])

  const updateField =
    (field: keyof Omit<AvailabilityForm, 'availability'>) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = field === 'uniqname' ? normalizeUniqname(event.target.value) : event.target.value
      setForm((current) => ({ ...current, [field]: value }))
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    if (form.availability.length === 0) {
      setSubmitting(false)
      setError('Please select every interview block you can help cover.')
      return
    }

    try {
      const response = await fetch('/api/interviewer-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(result?.error || 'Availability submission failed')
      }

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
            <p className="section__label">E-Board Availability</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="apply-page__headline">Help cover the interview window.</h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="apply-page__intro">
              Submit all times you can help interview between {INTERVIEW_DAY_RANGE_LABEL}.
              Candidate matching will happen Wednesday, so Sunday night availability helps
              keep the compressed timeline realistic.
            </p>
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
                <h2 className="apply-form__success-title">Availability saved.</h2>
                <p className="apply-form__success-desc">
                  Thanks. Admins can now compare your free blocks against candidate availability while assigning Google Meet interviews.
                </p>
                <Link to="/dashboard" className="btn btn--ghost">
                  Back to Dashboard
                </Link>
              </div>
            </Reveal>
          ) : (
            <Reveal>
              <form className="apply-form" onSubmit={handleSubmit}>
                <div className="apply-form__header">
                  <p className="section__label">Interviewer Form</p>
                  <h2 className="apply-form__title">Quick availability pass.</h2>
                  <p className="apply-form__subtitle">
                    Select every block you can help cover. The default interview block is 20 minutes.
                  </p>
                </div>

                <fieldset className="apply-form__group">
                  <legend>Your info</legend>
                  <div className="apply-form__row">
                    <div className="apply-form__field">
                      <label htmlFor="firstName">First name</label>
                      <input id="firstName" type="text" value={form.firstName} onChange={updateField('firstName')} required />
                    </div>
                    <div className="apply-form__field">
                      <label htmlFor="lastName">Last name</label>
                      <input id="lastName" type="text" value={form.lastName} onChange={updateField('lastName')} required />
                    </div>
                  </div>
                  <div className="apply-form__row">
                    <div className="apply-form__field">
                      <label htmlFor="uniqname">UMich uniqname</label>
                      <div className="apply-form__email-wrapper">
                        <input id="uniqname" type="text" value={form.uniqname} onChange={updateField('uniqname')} autoCapitalize="none" required />
                        <span>@umich.edu</span>
                      </div>
                    </div>
                    <div className="apply-form__field">
                      <label htmlFor="maxInterviews">Max interviews you can cover</label>
                      <select id="maxInterviews" value={form.maxInterviews} onChange={updateField('maxInterviews')}>
                        <option value="">As needed</option>
                        <option value="1">1 interview</option>
                        <option value="2">2 interviews</option>
                        <option value="3">3 interviews</option>
                        <option value="4">4 interviews</option>
                        <option value="5+">5+ interviews</option>
                      </select>
                    </div>
                  </div>
                  <div className="apply-form__field">
                    <label htmlFor="notes">Optional notes</label>
                    <textarea
                      id="notes"
                      value={form.notes}
                      onChange={updateField('notes')}
                      maxLength={800}
                      placeholder="Pairing preferences, conflicts, or days you can only do if absolutely needed."
                    />
                  </div>
                </fieldset>

                <fieldset className="apply-form__group">
                  <legend>Availability</legend>
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
                  <input id="website" type="text" value={form.website} onChange={updateField('website')} tabIndex={-1} autoComplete="off" />
                </div>

                {error && <p className="apply-form__error" role="alert">{error}</p>}

                <div className="apply-form__footer-actions">
                  <button type="submit" className="btn btn--primary btn--lg apply-form__submit" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit e-board availability'}
                  </button>
                  <Link to="/apply" className="apply-form__secondary-link">
                    Candidate form
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
