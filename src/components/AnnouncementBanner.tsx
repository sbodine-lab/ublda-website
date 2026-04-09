import { useState, useEffect, useRef } from 'react'
import './AnnouncementBanner.css'

const RSVP_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeOzfhOfoWDXJYMY_7H-r_tjrKrZfYBATXSoWnBhzMpcecwSw/viewform'
const EVENT_DATE = new Date('2026-04-16T18:00:00-04:00') // April 16, 2026 6 PM ET
const STORAGE_KEY = 'ublda-lloyd-lewis-rsvp-dismissed'

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
          <button onClick={handleDismiss} className="announcement__dismiss">
            I already RSVP'd
          </button>
        </div>
      </div>
    </div>
  )
}
