import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { PublicInterviewSlot } from '../lib/interviewBooking'
import { BOARD_POSITION_OPTIONS, INTERVIEW_WINDOW_DAYS } from '../lib/interviews'
import Reveal from '../components/Reveal'
import './Apply.css'

type BookingForm = {
  firstName: string
  lastName: string
  email: string
  slotValue: string
  rolePreferences: string[]
  conflicts: string
  website: string
}

const initialForm: BookingForm = {
  firstName: '',
  lastName: '',
  email: '',
  slotValue: '',
  rolePreferences: ['', '', ''],
  conflicts: '',
  website: '',
}

const slotsByDay = (slots: PublicInterviewSlot[]) => (
  INTERVIEW_WINDOW_DAYS.map((day) => ({
    ...day,
    slots: slots.filter((slot) => slot.dayLabel === day.label),
  }))
)

export default function InterviewBooking() {
  const [form, setForm] = useState(initialForm)
  const [slots, setSlots] = useState<PublicInterviewSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const availableSlots = useMemo(() => slots.filter((slot) => slot.isAvailable), [slots])
  const selectedSlot = useMemo(() => slots.find((slot) => slot.value === form.slotValue), [form.slotValue, slots])
  const dayGroups = useMemo(() => slotsByDay(slots), [slots])
  const selectedRolePreferences = useMemo(
    () => new Set(form.rolePreferences.filter(Boolean)),
    [form.rolePreferences],
  )

  const loadSlots = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/interview-booking')
      const payload = await response.json().catch(() => null) as { slots?: PublicInterviewSlot[]; error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error || 'Could not load interview slots.')
      }

      const nextSlots = payload?.slots || []
      setSlots(nextSlots)
      setForm((current) => (
        current.slotValue && nextSlots.some((slot) => slot.value === current.slotValue && slot.isAvailable)
          ? current
          : { ...current, slotValue: nextSlots.find((slot) => slot.isAvailable)?.value || '' }
      ))
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : ''
      setError(message || 'Could not load interview slots.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSlots()
  }, [])

  const updateField =
    (field: keyof BookingForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }))
    }

  const updateRolePreference = (index: number, value: string) => {
    setForm((current) => {
      const rolePreferences = [...current.rolePreferences]
      rolePreferences[index] = value
      return { ...current, rolePreferences }
    })
  }

  const selectSlot = (slotValue: string) => {
    setError('')
    setSuccessMessage('')
    setForm((current) => ({ ...current, slotValue }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccessMessage('')

    try {
      const rankedFunctions = form.rolePreferences.filter(Boolean)
      if (rankedFunctions.length < 3 || new Set(rankedFunctions).size !== rankedFunctions.length) {
        throw new Error('Please rank all three function preferences.')
      }

      const response = await fetch('/api/interview-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => null) as { error?: string; slot?: { label?: string }; interviewers?: string[] } | null

      if (!response.ok) {
        throw new Error(payload?.error || 'That slot could not be booked.')
      }

      setSuccessMessage(`You are booked for ${payload?.slot?.label || selectedSlot?.label}. We saved this in Eastern Time.`)
      await loadSlots()
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : ''
      setError(message || 'That slot could not be booked. Please pick another time.')
      await loadSlots()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main id="main-content" className="apply-page apply-page--booking">
      <section className="booking-page">
        <div className="container">
          <Reveal>
            <div className="booking-page__header">
              <div>
                <p className="section__label">UBLDA interviews</p>
                <h1>Choose your interview slot.</h1>
                <p>
                  All times are listed in Eastern Time (ET, Ann Arbor). Pick one available Google Meet slot that works for you.
                </p>
              </div>
              <Link to="/apply">Need the full candidate form?</Link>
            </div>

            <div className="booking-layout">
              <section className="booking-board" aria-label="Available interview slots">
                <div className="booking-board__topline">
                  <strong>{availableSlots.length} open slot{availableSlots.length === 1 ? '' : 's'}</strong>
                  <button type="button" onClick={() => void loadSlots()}>Refresh</button>
                </div>

                {loading ? (
                  <p className="booking-empty">Loading interview slots...</p>
                ) : availableSlots.length === 0 ? (
                  <div className="booking-empty">
                    <strong>All available interview slots are currently full.</strong>
                    <p>Email sbodine@umich.edu if you need help finding a time.</p>
                  </div>
                ) : (
                  <div className="booking-days">
                    {dayGroups.map((day) => {
                      const dayOpenSlots = day.slots.filter((slot) => slot.isAvailable)
                      return (
                        <section className="booking-day" key={day.date}>
                          <header>
                            <strong>{day.shortLabel}</strong>
                            <span>{dayOpenSlots.length} open</span>
                          </header>
                          <div className="booking-slot-list">
                            {day.slots.map((slot) => (
                              <button
                                type="button"
                                className={`booking-slot ${form.slotValue === slot.value ? 'booking-slot--selected' : ''}`}
                                key={slot.value}
                                onClick={() => selectSlot(slot.value)}
                                disabled={!slot.isAvailable}
                              >
                                <span>{slot.timeLabel}</span>
                                <small>
                                  {slot.isBooked
                                    ? 'Booked'
                                    : slot.interviewerCount > 0
                                      ? `${slot.interviewerCount} e-board available`
                                      : 'No e-board coverage'}
                                </small>
                              </button>
                            ))}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}
              </section>

              <form className="booking-card" onSubmit={handleSubmit}>
                <div>
                  <span>Selected slot</span>
                  <strong>{selectedSlot ? selectedSlot.label : 'Choose a time'}</strong>
                  <small>Eastern Time (ET, Ann Arbor)</small>
                </div>

                <label>
                  First name
                  <input value={form.firstName} onChange={updateField('firstName')} required maxLength={80} />
                </label>
                <label>
                  Last name
                  <input value={form.lastName} onChange={updateField('lastName')} required maxLength={80} />
                </label>
                <label>
                  Email
                  <input type="email" value={form.email} onChange={updateField('email')} required maxLength={160} placeholder="you@example.com" />
                </label>
                <label>
                  Function preferences
                  <span className="booking-card__helper">
                    We will focus on #1 in the interview and use #2-#3 as quick skill checks.
                  </span>
                </label>
                <div className="booking-card__rank-grid">
                  {['First choice', 'Second choice', 'Third choice'].map((label, index) => (
                    <label key={label}>
                      {label}
                      <select
                        value={form.rolePreferences[index]}
                        onChange={(event) => updateRolePreference(index, event.target.value)}
                        required
                      >
                        <option value="" disabled>Select function</option>
                        {BOARD_POSITION_OPTIONS.map((role) => (
                          <option
                            key={role}
                            value={role}
                            disabled={selectedRolePreferences.has(role) && form.rolePreferences[index] !== role}
                          >
                            {role}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label>
                  Conflicts or notes
                  <textarea value={form.conflicts} onChange={updateField('conflicts')} maxLength={1000} placeholder="Optional" />
                </label>

                <div className="apply-form__trap" aria-hidden="true">
                  <label htmlFor="bookingWebsite">Website</label>
                  <input id="bookingWebsite" value={form.website} onChange={updateField('website')} tabIndex={-1} autoComplete="off" />
                </div>

                {error && <p className="apply-form__error" role="alert">{error}</p>}
                {successMessage && <p className="booking-success" role="status">{successMessage}</p>}

                <button type="submit" className="btn btn--primary" disabled={submitting || !form.slotValue}>
                  {submitting ? 'Booking...' : 'Book interview slot'}
                </button>
                <p className="booking-card__fineprint">
                  One slot per email. If your plans change, email sbodine@umich.edu so we can reschedule cleanly.
                </p>
              </form>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
