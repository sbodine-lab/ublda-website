import { useState } from 'react'
import './Links.css'

interface Event {
  date: string
  month: string
  day: string
  time?: string
  title: string
  description: string
  location: string
}

const pastEvents: Event[] = [
  {
    date: 'April 16, 2026',
    month: 'Apr',
    day: '16',
    time: '6:00 PM - 7:00 PM',
    title: 'Fireside Chat with Lloyd Lewis, CEO of Arc Thrift Stores',
    description:
      'Lloyd runs a 1,600-person, 24-store operation with $2.3B in total economic impact on Colorado and has funded $250M+ to nonprofits supporting people with IDD. Dinner catered.',
    location: 'Ross R1240, Ross School of Business',
  },
]

const years = ['Freshman', 'Sophomore', 'Junior', 'Senior']

export default function Links() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    major: '',
    year: '',
    email: '',
  })

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let val = e.target.value
    if (field === 'email') {
      val = val.replace(/@umich\.edu$/i, '').replace(/@.*$/, '')
    }
    setForm({ ...form, [field]: val })
  }

  const fullEmail = `${form.email.replace(/@umich\.edu$/i, '').replace(/@.*$/, '')}@umich.edu`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: fullEmail,
          major: form.major,
          year: form.year,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        alert('Something went wrong. Please try again or email us at sbodine@umich.edu.')
      }
    } catch {
      alert('Something went wrong. Please try again or email us at sbodine@umich.edu.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="links-page">
      <div className="links__inner">
        {/* Header */}
        <img src="/logo.png" alt="UBLDA" className="links__logo" />
        <h1 className="links__name">UBLDA</h1>
        <p className="links__bio">
          Undergraduate Business Leaders for Diverse Abilities at Michigan Ross
        </p>

        {/* Link buttons */}
        <div className="links__buttons">
          <a href="https://ublda.org" className="links__btn links__btn--primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            Our Website
          </a>
          <a href="https://www.instagram.com/michiganublda/" target="_blank" rel="noopener noreferrer" className="links__btn links__btn--secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            Instagram
          </a>
          <a href="https://www.linkedin.com/company/ublda/" target="_blank" rel="noopener noreferrer" className="links__btn links__btn--secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            LinkedIn
          </a>
          <a href="mailto:sbodine@umich.edu,atchiang@umich.edu,cooperry@umich.edu" className="links__btn links__btn--secondary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            Email Us
          </a>
        </div>

        {/* Past events */}
        <p className="links__section-label">Past Events</p>
        <div className="links__events">
          {pastEvents.length > 0 ? (
            pastEvents.map((event) => (
              <div key={event.title} className="links__event">
                <div className="links__event-date">
                  <span className="links__event-month">{event.month}</span>
                  <span className="links__event-day">{event.day}</span>
                </div>
                <div className="links__event-info">
                  <h3 className="links__event-title">{event.title}</h3>
                  <p className="links__event-meta">
                    {event.time && `${event.time} · `}{event.location}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="links__no-events">
              No past events yet.
            </div>
          )}
        </div>

        {/* Sign-up form */}
        <p className="links__section-label">Join UBLDA</p>
        <div className="links__form-section">
          {submitted ? (
            <div className="links__form-success">
              <div className="links__form-success-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h3 className="links__form-success-title">You're in!</h3>
              <p className="links__form-success-desc">
                Welcome to UBLDA. We'll be in touch soon.
              </p>
            </div>
          ) : (
            <form className="links__form" onSubmit={handleSubmit}>
              <div className="links__form-row">
                <div className="links__form-field">
                  <label className="links__form-label" htmlFor="links-firstName">First name</label>
                  <input
                    id="links-firstName"
                    type="text"
                    className="links__form-input"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={update('firstName')}
                    required
                  />
                </div>
                <div className="links__form-field">
                  <label className="links__form-label" htmlFor="links-lastName">Last name</label>
                  <input
                    id="links-lastName"
                    type="text"
                    className="links__form-input"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={update('lastName')}
                    required
                  />
                </div>
              </div>

              <div className="links__form-field">
                <label className="links__form-label" htmlFor="links-email">UMich uniqname</label>
                <div className="links__email-wrapper">
                  <input
                    id="links-email"
                    type="text"
                    className="links__form-input links__email-input"
                    placeholder="uniqname"
                    value={form.email}
                    onChange={update('email')}
                    required
                  />
                  <span className="links__email-suffix">@umich.edu</span>
                </div>
              </div>

              <div className="links__form-row">
                <div className="links__form-field">
                  <label className="links__form-label" htmlFor="links-major">College</label>
                  <input
                    id="links-major"
                    type="text"
                    className="links__form-input"
                    placeholder="e.g. Ross, LSA"
                    value={form.major}
                    onChange={update('major')}
                    required
                  />
                </div>
                <div className="links__form-field">
                  <label className="links__form-label" htmlFor="links-year">Year</label>
                  <select
                    id="links-year"
                    className="links__form-input links__form-select"
                    value={form.year}
                    onChange={update('year')}
                    required
                  >
                    <option value="" disabled>Select</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="links__form-submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Join UBLDA'}
                {!submitting && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="links__footer">
          <a href="https://ublda.org" className="links__footer-link">ublda.org</a>
        </div>
      </div>
    </main>
  )
}
