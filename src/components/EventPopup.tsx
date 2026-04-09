import { useEffect, useState } from 'react'
import './EventPopup.css'

const RSVP_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeOzfhOfoWDXJYMY_7H-r_tjrKrZfYBATXSoWnBhzMpcecwSw/viewform'
const EVENT_DATE = new Date('2026-04-16T18:00:00-04:00')
const STORAGE_KEY = 'ublda-lloyd-lewis-popup-seen'
const SHOW_DELAY_MS = 1400

export default function EventPopup() {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    // Respect past events
    if (Date.now() >= EVENT_DATE.getTime()) return

    // Respect prior dismissal
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') return
    } catch {
      // continue
    }

    const mountTimer = window.setTimeout(() => {
      setMounted(true)
      // Next frame → trigger transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    }, SHOW_DELAY_MS)

    return () => window.clearTimeout(mountTimer)
  }, [])

  // Esc to close
  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mounted])

  const handleClose = () => {
    setClosing(true)
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // continue
    }
    window.setTimeout(() => {
      setMounted(false)
      setClosing(false)
    }, 400)
  }

  const handleRsvp = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // continue
    }
  }

  if (!mounted) return null

  return (
    <div
      className={`event-popup ${visible ? 'event-popup--visible' : ''} ${closing ? 'event-popup--closing' : ''}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="event-popup-title"
    >
      <button
        className="event-popup__close"
        onClick={handleClose}
        aria-label="Dismiss event announcement"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <div className="event-popup__glow" aria-hidden="true" />

      <div className="event-popup__content">
        <div className="event-popup__eyebrow">
          <span className="event-popup__pulse" aria-hidden="true" />
          Next Event
        </div>

        <h3 id="event-popup-title" className="event-popup__title">
          Fireside Chat with <em>Lloyd Lewis</em>
        </h3>

        <p className="event-popup__subtitle">
          CEO of Arc Thrift Stores — a 1,600-person, $2.3B Colorado enterprise.
        </p>

        <div className="event-popup__meta">
          <div className="event-popup__meta-row">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M5 1.5v3M11 1.5v3M2 7h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span>Thursday, April 16 · 6:00 – 7:00 PM</span>
          </div>
          <div className="event-popup__meta-row">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5c0 3.5-4.5 8.5-4.5 8.5S3.5 9.5 3.5 6A4.5 4.5 0 0 1 8 1.5z" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
            <span>Ross R1240 · Dinner catered</span>
          </div>
        </div>

        <div className="event-popup__actions">
          <a
            href={RSVP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="event-popup__rsvp"
            onClick={handleRsvp}
          >
            RSVP Now
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <button className="event-popup__later" onClick={handleClose}>
            Maybe later
          </button>
        </div>
      </div>
    </div>
  )
}
