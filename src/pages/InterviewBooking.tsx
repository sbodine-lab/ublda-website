import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { PublicInterviewSlot } from '../lib/interviewBooking'
import {
  MAX_RESUME_FILE_SIZE_BYTES,
  RESUME_MIME_TYPES,
  isResumeFileAllowed,
} from '../lib/application'
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

export default function InterviewBooking() {
  const [form, setForm] = useState(initialForm)
  const [slots, setSlots] = useState<PublicInterviewSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)

  const availableSlots = useMemo(() => slots.filter((slot) => slot.isAvailable), [slots])
  const visibleSlots = useMemo(() => slots.filter((slot) => slot.interviewerCount > 0 || slot.isBooked), [slots])
  const selectedSlot = useMemo(() => slots.find((slot) => slot.value === form.slotValue), [form.slotValue, slots])
  const dayGroups = useMemo(() => slotsByDay(visibleSlots).filter((day) => day.slots.length > 0), [visibleSlots])
  const selectedRolePreferences = useMemo(
    () => new Set(form.rolePreferences.filter(Boolean)),
    [form.rolePreferences],
  )

  const loadSlots = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/interview-booking?ts=${Date.now()}`, { cache: 'no-store' })
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

  const handleResumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setError('')
    setSuccessMessage('')

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
      if (!form.slotValue) {
        throw new Error('Choose an available interview slot.')
      }

      if (rankedFunctions.length < 1 || new Set(rankedFunctions).size !== rankedFunctions.length) {
        throw new Error('Please select your first-choice function.')
      }

      if (!resumeFile) {
        throw new Error('Please upload your resume.')
      }

      const resumeFilePayload = await fileToResumePayload(resumeFile)
      const response = await fetch('/api/interview-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          rolePreferences: rankedFunctions,
          resumeFile: resumeFilePayload,
        }),
      })
      const payload = await response.json().catch(() => null) as {
        error?: string
        slot?: { label?: string }
        interviewers?: string[]
        email?: { sent?: boolean }
      } | null

      if (!response.ok) {
        throw new Error(payload?.error || 'That slot could not be booked.')
      }

      const confirmation = payload?.email?.sent
        ? ' A confirmation email is on the way.'
        : ' Your resume and role preferences are saved.'
      setSuccessMessage(`You are booked for ${payload?.slot?.label || selectedSlot?.label}.${confirmation}`)
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
                <h1>Book your interview.</h1>
                <p>
                  Choose a covered Google Meet time, add your basics, and send your resume. A board member will follow up shortly with the interview link and details.
                </p>
              </div>
              <ol className="booking-steps" aria-label="Booking steps">
                <li><span>1</span> Pick a time</li>
                <li><span>2</span> Add details</li>
                <li><span>3</span> Confirm</li>
              </ol>
            </div>

            <div className="booking-layout">
              <section className="booking-board" aria-label="Available interview slots">
                <div className="booking-board__topline">
                  <div>
                    <span>Step 1</span>
                    <strong>{availableSlots.length} open slot{availableSlots.length === 1 ? '' : 's'}</strong>
                  </div>
                  <button type="button" onClick={() => void loadSlots()}>Refresh</button>
                </div>

                {loading ? (
                  <p className="booking-empty">Loading interview slots...</p>
                ) : availableSlots.length === 0 ? (
                  visibleSlots.length === 0 ? (
                    <div className="booking-empty">
                      <strong>No covered interview slots are open yet.</strong>
                      <p>Check back after e-board interviewers submit availability.</p>
                    </div>
                  ) : (
                    <div className="booking-board__notice" role="status">
                      All covered interview slots are currently occupied.
                    </div>
                  )
                ) : (
                  availableSlots.length < visibleSlots.length && (
                    <div className="booking-board__notice" role="status">
                      Occupied slots stay visible below so you can see what has already been taken.
                    </div>
                  )
                )}

                {!loading && visibleSlots.length > 0 && (
                  <div className="booking-days">
                    {dayGroups.map((day) => {
                      const openCount = day.slots.filter((slot) => slot.isAvailable).length
                      const occupiedCount = day.slots.filter((slot) => slot.isBooked).length
                      return (
                        <section className="booking-day" key={day.date}>
                          <header>
                            <strong>{day.shortLabel}</strong>
                            <span>{openCount} open{occupiedCount ? ` · ${occupiedCount} occupied` : ''}</span>
                          </header>
                          <div className="booking-slot-list">
                            {day.slots.map((slot) => {
                              const statusLabel = slot.isBooked ? 'Occupied' : slot.isAvailable ? 'Slot open' : 'No interviewer coverage'
                              return (
                                <button
                                  type="button"
                                  className={`booking-slot ${form.slotValue === slot.value ? 'booking-slot--selected' : ''} ${slot.isBooked ? 'booking-slot--occupied' : ''}`}
                                  key={slot.value}
                                  onClick={() => selectSlot(slot.value)}
                                  disabled={!slot.isAvailable}
                                  aria-label={`${slot.label}: ${statusLabel}`}
                                >
                                  <span>{slot.timeLabel}</span>
                                  <small>{statusLabel}</small>
                                </button>
                              )
                            })}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}
              </section>

              <form className="booking-card" onSubmit={handleSubmit}>
                <div className="booking-card__slot-summary">
                  <span>Selected slot</span>
                  <strong>{selectedSlot ? selectedSlot.label : 'Choose a time'}</strong>
                  <small>Eastern Time (ET, Ann Arbor)</small>
                </div>

                <div className="booking-card__section-heading">
                  <span>Step 2</span>
                  <strong>Your details</strong>
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
                  Resume
                  <span className="booking-card__file-control">
                    <span>{resumeFile ? 'Replace resume' : 'Upload resume'}</span>
                    <small>{resumeFile ? resumeFile.name : 'No file selected'}</small>
                  </span>
                  <input className="booking-card__file-input" type="file" accept={resumeAccept} onChange={handleResumeChange} required />
                  <span className="booking-card__helper">
                    PDF, DOC, or DOCX. Max {fileSizeLabel(MAX_RESUME_FILE_SIZE_BYTES)}.
                  </span>
                </label>
                <label>
                  Function preferences
                  <span className="booking-card__helper">
                    Pick the function you most want to discuss so we can center your interview around it. If you want to be considered for multiple roles, select a second or third choice and we will interview accordingly.
                  </span>
                </label>
                <div className="booking-card__rank-grid">
                  {['First choice', 'Second choice', 'Third choice'].map((label, index) => (
                    <label key={label}>
                      {index === 0 ? label : `${label} (optional)`}
                      <select
                        value={form.rolePreferences[index]}
                        onChange={(event) => updateRolePreference(index, event.target.value)}
                        required={index === 0}
                      >
                        <option value="" disabled={index === 0}>{index === 0 ? 'Select function' : 'No backup preference'}</option>
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

                <div className="booking-card__section-heading">
                  <span>Step 3</span>
                  <strong>Confirm booking</strong>
                </div>
                <button type="submit" className="btn btn--primary" disabled={submitting}>
                  {submitting ? 'Booking...' : 'Book interview slot'}
                </button>
                <p className="booking-card__fineprint">
                  One slot per email. If your plans change, email sbodine@umich.edu so we can reschedule.
                </p>
              </form>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
