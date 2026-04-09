import { useState, useEffect, useRef } from 'react'
import './AnnouncementBanner.css'

const RSVP_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeOzfhOfoWDXJYMY_7H-r_tjrKrZfYBATXSoWnBhzMpcecwSw/viewform'
const EVENT_DATE = new Date('2026-04-16T18:00:00-04:00') // April 16, 2026 6 PM ET
const STORAGE_KEY = 'ublda-lloyd-lewis-rsvp-dismissed'

const GCAL_URL = (() => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Fireside Chat with Lloyd Lewis, CEO of Arc Thrift Stores — UBLDA',
    dates: '20260416T220000Z/20260416T230000Z', // 6–7 PM ET = 22:00–23:00 UTC
    details: 'Lloyd Lewis, CEO of Arc Thrift Stores of Colorado, joins us live from Colorado for a fireside chat on running a mission-driven enterprise. Dinner catered. UBLDA event at Ross School of Business.',
    location: 'Ross School of Business, Room R1240, Ann Arbor, MI 48109',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
})()

function getTimeLeft() {
  const now = new Date()
  const diff = EVENT_DATE.getTime() - now.getTime()
  if (diff <= 0) return null

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return { days, hours, minutes }
}

export default function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [timeLeft, setTimeLeft] = useState(getTimeLeft)
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft())
    }, 60_000)
    return () => clearInterval(timer)
  }, [])

  // Set CSS variable for banner height so the nav can offset itself
  useEffect(() => {
    if (dismissed || !timeLeft) {
      document.documentElement.style.removeProperty('--announcement-h')
      return
    }

    const update = () => {
      requestAnimationFrame(() => {
        if (bannerRef.current) {
          const h = bannerRef.current.offsetHeight
          document.documentElement.style.setProperty('--announcement-h', `${h}px`)
        }
      })
    }

    update()
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      document.documentElement.style.removeProperty('--announcement-h')
    }
  }, [dismissed, timeLeft])

  if (!timeLeft || dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // localStorage unavailable
    }
  }

  return (
    <div className="announcement" ref={bannerRef} role="banner">
      <div className="announcement__inner container">
        <div className="announcement__text">
          <span>Fireside Chat with Lloyd Lewis, CEO of Arc Thrift — Apr 16, 6 PM</span>
          <span className="announcement__countdown">
            <span className="announcement__countdown-unit">
              <span className="announcement__countdown-num">{timeLeft.days}</span>d
            </span>
            <span className="announcement__countdown-unit">
              <span className="announcement__countdown-num">{timeLeft.hours}</span>h
            </span>
            <span className="announcement__countdown-unit">
              <span className="announcement__countdown-num">{timeLeft.minutes}</span>m
            </span>
          </span>
        </div>
        <div className="announcement__actions">
          <a href={RSVP_URL} target="_blank" rel="noopener noreferrer" className="announcement__rsvp">
            RSVP Now
          </a>
          <a href={GCAL_URL} target="_blank" rel="noopener noreferrer" className="announcement__gcal" aria-label="Add to Google Calendar">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5 1.5v3M11 1.5v3M2 7h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            Add to calendar
          </a>
          <button onClick={handleDismiss} className="announcement__dismiss">
            I already RSVP'd
          </button>
        </div>
      </div>
    </div>
  )
}
