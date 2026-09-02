import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import './AnnouncementBanner.css'

import { APPLY_CLOSES_AT_MS, APPLY_OPENS_AT_MS } from '../lib/applyForm'
import { MEMBERSHIP_FORM_URL } from '../lib/forms'

const CONSULTING_PAGE = '/consulting'
const STORAGE_KEY = 'ublda-fall-2026-consulting-banner-dismissed'

function getTimeLeft() {
  const now = Date.now()
  if (now < APPLY_OPENS_AT_MS) return null
  const diff = APPLY_CLOSES_AT_MS - now
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
    <div className="announcement" ref={bannerRef} role="region" aria-label="Fall 2026 sign-up">
      <div className="announcement__inner container">
        <div className="announcement__text">
          <span>Fall 2026 membership sign-up is open. Consulting applications close Sept 22.</span>
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
          <a href={MEMBERSHIP_FORM_URL} target="_blank" rel="noopener noreferrer" className="announcement__rsvp">
            Join UBLDA
            <span className="sr-only"> (interest form, opens in a new tab)</span>
          </a>
          <Link to={CONSULTING_PAGE} className="announcement__gcal">
            UBLDA Consulting
          </Link>
          <button onClick={handleDismiss} className="announcement__dismiss">
            Hide
          </button>
        </div>
      </div>
    </div>
  )
}
