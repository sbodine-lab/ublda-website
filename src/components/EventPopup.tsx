import { useCallback, useEffect, useState } from 'react'
import './EventPopup.css'

const RSVP_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeOzfhOfoWDXJYMY_7H-r_tjrKrZfYBATXSoWnBhzMpcecwSw/viewform'
const EVENT_DATE = new Date('2026-04-16T18:00:00-04:00')
const POPUP_KEY = 'ublda-lloyd-lewis-popup-seen'
const VISITED_KEY = 'ublda-visited'
const SHOW_DELAY_MS = 1600

export default function EventPopup() {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  const close = useCallback(() => {
    setVisible(false)
    try { localStorage.setItem(POPUP_KEY, 'true') } catch { /* */ }
    window.setTimeout(() => setMounted(false), 380)
  }, [])

  useEffect(() => {
    if (Date.now() >= EVENT_DATE.getTime()) return

    let isReturning = false
    let alreadySeen = false
    try {
      isReturning = localStorage.getItem(VISITED_KEY) === 'true'
      alreadySeen = localStorage.getItem(POPUP_KEY) === 'true'
      // Mark this as a visit regardless
      localStorage.setItem(VISITED_KEY, 'true')
    } catch {
      // continue
    }

    if (isReturning || alreadySeen) return

    const t = window.setTimeout(() => {
      setMounted(true)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    }, SHOW_DELAY_MS)

    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mounted, close])

  if (!mounted) return null

  return (
    <div
      className={`evp ${visible ? 'evp--in' : 'evp--out'}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="evp-title"
    >
      <button className="evp__close" onClick={close} aria-label="Close">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      <p className="evp__label">Apr 16 · Ross R1240</p>
      <h3 id="evp-title" className="evp__title">Lloyd Lewis<br/>joins us Thursday.</h3>
      <p className="evp__body">
        CEO of Arc Thrift Stores — 1,600 employees, $2.3B Colorado impact, live from Denver. Dinner's catered.
      </p>

      <div className="evp__actions">
        <a
          href={RSVP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="evp__rsvp"
          onClick={close}
        >
          RSVP
        </a>
        <button className="evp__skip" onClick={close}>
          Close
        </button>
      </div>
    </div>
  )
}
