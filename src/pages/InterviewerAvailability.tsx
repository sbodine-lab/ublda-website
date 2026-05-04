import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  INTERVIEW_BLOCK_WITH_BUFFER_LABEL,
} from '../lib/interviews'
import { normalizeUniqname } from '../lib/application'
import { notifyDashboardDataChanged } from '../lib/dashboardData'
import AvailabilityPicker from '../components/AvailabilityPicker'
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

  const updateField =
    (field: keyof Omit<AvailabilityForm, 'availability'>) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = field === 'uniqname' ? normalizeUniqname(event.target.value) : event.target.value
      setForm((current) => ({ ...current, [field]: value }))
    }

  const updateAvailability = (availability: string[]) => {
    setForm((current) => ({ ...current, availability }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    if (form.availability.length === 0) {
      setSubmitting(false)
      setError('Please select every interview slot you can help cover.')
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
      notifyDashboardDataChanged()
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : ''
      setError(message || 'Something went wrong. Please try again or email sbodine@umich.edu.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main id="main-content" className="apply-page apply-page--interviewer apply-page--simple-form">
      <section className="interviewer-simple">
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
                  Thanks. Your slots are saved for interview matching.
                </p>
                <Link to="/dashboard" className="btn btn--ghost">
                  Back to Dashboard
                </Link>
              </div>
            </Reveal>
          ) : (
            <Reveal>
              <form className="apply-form" onSubmit={handleSubmit}>
                <div className="apply-form__header interviewer-simple__header">
                  <h2 className="apply-form__title">Your availability.</h2>
                  <p className="apply-form__subtitle">
                    May 7-10, 8 AM-10 PM ET. Each slot includes a {INTERVIEW_BLOCK_WITH_BUFFER_LABEL}.
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

                <AvailabilityPicker
                  legend="Availability"
                  selectedValues={form.availability}
                  onChange={updateAvailability}
                />

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
