import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './AnnouncementBanner.css'

/**
 * One-line site notice. Edit the three constants to change it; the bar hides
 * itself after `EXPIRES` and stays hidden for anyone who closes it.
 */
const STORAGE_KEY = 'ublda-notice-fall-2026-fairs'
const EXPIRES = new Date('2026-09-09T19:30:00-04:00') // end of BBA Meet the Clubs, day 2
const MESSAGE = 'Find us at Festifall Central on Sept 2 and BBA Meet the Clubs on Sept 8–9.'

export default function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [active] = useState(() => Date.now() < EXPIRES.getTime())
  const bannerRef = useRef<HTMLDivElement>(null)

  // Publish the bar's height so the fixed nav can sit underneath it.
  useEffect(() => {
    if (dismissed || !active) {
      document.documentElement.style.removeProperty('--announcement-h')
      return
    }

    const update = () => {
      requestAnimationFrame(() => {
        if (bannerRef.current) {
          document.documentElement.style.setProperty('--announcement-h', `${bannerRef.current.offsetHeight}px`)
        }
      })
    }

    update()
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      document.documentElement.style.removeProperty('--announcement-h')
    }
  }, [dismissed, active])

  if (!active || dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // localStorage unavailable
    }
  }

  return (
    <div className="announcement" ref={bannerRef}>
      <div className="announcement__inner container">
        <p className="announcement__text">
          {MESSAGE}{' '}
          <Link to="/events" className="announcement__link">Event details</Link>
        </p>
        <button type="button" onClick={handleDismiss} className="announcement__dismiss" aria-label="Dismiss notice">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
