import { useEffect, useMemo, useState } from 'react'
import {
  BBA_MTC_EVENT,
  BBA_MTC_ROSTER,
  BBA_MTC_SHIFTS,
  type BbaMtcPollState,
} from '../lib/bbaMtcShifts'
import './CraftNight.css'
import './BbaMtcShifts.css'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export default function BbaMtcShifts() {
  const [poll, setPoll] = useState<BbaMtcPollState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/bba-mtc?ts=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((data) => {
        if (!cancelled && data?.poll) setPoll(data.poll as BbaMtcPollState)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const responses = useMemo(() => poll?.responses ?? [], [poll])
  const responseByEmail = useMemo(
    () => new Map(responses.map((response) => [response.email, response])),
    [responses],
  )

  const pickName = (email: string) => {
    setSelectedEmail(email)
    setSaveState('idle')
    setErrorMessage('')
    setSelected(new Set(responseByEmail.get(email)?.shifts ?? []))
  }

  const toggleShift = (shiftId: string) => {
    if (!selectedEmail) return
    setSaveState('idle')
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(shiftId)) next.delete(shiftId)
      else next.add(shiftId)
      return next
    })
  }

  const submit = async () => {
    if (!selectedEmail || saveState === 'saving') return
    if (selected.size === 0) {
      setSaveState('error')
      setErrorMessage('Pick at least one 30-minute shift.')
      return
    }
    setSaveState('saving')
    setErrorMessage('')
    try {
      const res = await fetch('/api/bba-mtc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond',
          email: selectedEmail,
          shifts: [...selected],
          website: '',
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setSaveState('error')
        setErrorMessage(data?.error || 'That did not save. Try again.')
        return
      }
      if (data?.poll) setPoll(data.poll as BbaMtcPollState)
      setSaveState('saved')
    } catch {
      setSaveState('error')
      setErrorMessage('That did not save. Try again.')
    }
  }

  return (
    <main id="main-content" className="craft-page shift-page">
      <div className="craft__inner">
        <header className="craft__header">
          <img src="/logo.png" alt="UBLDA" className="craft__logo" />
          <p className="shift__eyebrow">Shift signup</p>
          <h1 className="craft__title">{BBA_MTC_EVENT.title}</h1>
          <p className="craft__description">{BBA_MTC_EVENT.description}</p>
          <p className="craft__location">{BBA_MTC_EVENT.details}</p>
          <p className="shift__note">{BBA_MTC_EVENT.note}</p>
        </header>

        {loadError && (
          <div className="craft__banner" role="alert">Something went wrong. Refresh to try again.</div>
        )}

        {poll && (
          <>
            <section className="craft__section" aria-labelledby="shift-step-name">
              <h2 className="craft__label" id="shift-step-name">1. Pick your name</h2>
              <div className="craft__names" role="group" aria-label="Pick your name">
                {BBA_MTC_ROSTER.map((member) => {
                  const hasResponded = responseByEmail.has(member.email)
                  return (
                    <button
                      key={member.email}
                      type="button"
                      className={`craft__name${selectedEmail === member.email ? ' is-selected' : ''}`}
                      aria-pressed={selectedEmail === member.email}
                      onClick={() => pickName(member.email)}
                    >
                      {member.name}{hasResponded ? ' ✓' : ''}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className={`craft__section${selectedEmail ? '' : ' is-waiting'}`} aria-labelledby="shift-step-times">
              <h2 className="craft__label" id="shift-step-times">2. Pick your shifts</h2>
              <div className="craft__options">
                {BBA_MTC_SHIFTS.map((shift) => {
                  const isOn = selected.has(shift.id)
                  return (
                    <button
                      key={shift.id}
                      type="button"
                      className={`craft__option shift__option${isOn ? ' is-selected' : ''}`}
                      aria-pressed={isOn}
                      disabled={!selectedEmail}
                      onClick={() => toggleShift(shift.id)}
                    >
                      <span className="shift__time">{shift.time}</span>
                      <span className="shift__label">{shift.label}</span>
                      <span className="craft__option-check" aria-hidden="true">✓</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {selectedEmail && (
              <div className="craft__savebar">
                {errorMessage && <p className="craft__error" role="alert">{errorMessage}</p>}
                <button
                  type="button"
                  className={`craft__submit${saveState === 'saved' ? ' is-saved' : ''}`}
                  onClick={submit}
                  disabled={saveState === 'saving'}
                >
                  {saveState === 'saving' ? 'Saving' : saveState === 'saved' ? 'Saved ✓' : 'Save my shifts'}
                </button>
              </div>
            )}

            <section className="shift__coverage" aria-labelledby="shift-coverage-title">
              <div className="shift__coverage-heading">
                <h2 id="shift-coverage-title">Coverage</h2>
                <span>{responses.length} of {BBA_MTC_ROSTER.length} replied</span>
              </div>
              <div className="shift__coverage-list">
                {BBA_MTC_SHIFTS.map((shift) => {
                  const names = responses
                    .filter((response) => response.shifts.includes(shift.id))
                    .map((response) => response.name.split(' ')[0])
                  return (
                    <div className="shift__coverage-row" key={shift.id}>
                      <div>
                        <strong>{shift.time}</strong>
                        <span>{shift.label}</span>
                      </div>
                      <p className={names.length >= 2 ? 'is-covered' : ''}>
                        {names.length ? names.join(', ') : 'Nobody yet'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
