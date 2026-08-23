import { useEffect, useMemo, useState } from 'react'
import {
  CRAFT_NIGHT,
  CRAFT_NIGHT_GROUPS,
  CRAFT_NIGHT_ROSTER,
  type CraftNightPollState,
} from '../lib/craftNight'
import './CraftNight.css'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const optionById = new Map(
  CRAFT_NIGHT_GROUPS.flatMap((group) => group.options.map((option) => [option.id, option])),
)

export default function CraftNight() {
  const [poll, setPoll] = useState<CraftNightPollState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/craft-night?ts=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('load failed'))))
      .then((data) => {
        if (!cancelled && data?.poll) setPoll(data.poll as CraftNightPollState)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const responses = useMemo(() => poll?.responses ?? [], [poll])
  const closed = poll?.status === 'closed'
  const finalOption = poll?.finalOptionId ? optionById.get(poll.finalOptionId) : null

  const pickName = (email: string) => {
    setSelectedEmail(email)
    setSaveState('idle')
    setErrorMessage('')
    const existing = responses.find((response) => response.email === email)
    setSelected(new Set(existing?.available ?? []))
  }

  const toggleOption = (optionId: string) => {
    if (closed || !selectedEmail) return
    setSaveState('idle')
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return next
    })
  }

  const submit = async () => {
    if (!selectedEmail || saveState === 'saving') return
    setSaveState('saving')
    setErrorMessage('')
    try {
      const res = await fetch('/api/craft-night', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond',
          email: selectedEmail,
          available: [...selected],
          website: '',
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setSaveState('error')
        setErrorMessage(data?.error || 'That did not save. Try again.')
        return
      }
      if (data?.poll) setPoll(data.poll as CraftNightPollState)
      setSaveState('saved')
    } catch {
      setSaveState('error')
      setErrorMessage('That did not save. Try again.')
    }
  }

  return (
    <main id="main-content" className="craft-page">
      <div className="craft__inner">
        <header className="craft__header">
          <img src="/logo.png" alt="UBLDA" className="craft__logo" />
          <h1 className="craft__title">{CRAFT_NIGHT.title}</h1>
          <p className="craft__description">{CRAFT_NIGHT.description}</p>
        </header>

        {loadError && (
          <div className="craft__banner" role="alert">Something went wrong. Refresh to try again.</div>
        )}

        {finalOption && (
          <div className="craft__banner craft__banner--final" role="status">
            Locked in: {finalOption.weekday}, {finalOption.month} {finalOption.day}, {finalOption.time}
          </div>
        )}

        {closed && !finalOption && (
          <div className="craft__banner" role="status">This poll is closed.</div>
        )}

        {!closed && poll && (
          <>
            <section className="craft__section" aria-labelledby="craft-step-name">
              <h2 className="craft__label" id="craft-step-name">Your name</h2>
              <div className="craft__names" role="group" aria-label="Pick your name">
                {CRAFT_NIGHT_ROSTER.map((member) => (
                  <button
                    key={member.email}
                    type="button"
                    className={`craft__name${selectedEmail === member.email ? ' is-selected' : ''}`}
                    aria-pressed={selectedEmail === member.email}
                    onClick={() => pickName(member.email)}
                  >
                    {member.name}
                  </button>
                ))}
              </div>
            </section>

            <section
              className={`craft__section${selectedEmail ? '' : ' is-waiting'}`}
              aria-labelledby="craft-step-times"
            >
              <h2 className="craft__label" id="craft-step-times">Times you can make</h2>
              {CRAFT_NIGHT_GROUPS.map((group) => (
                <div className="craft__group" key={group.id}>
                  <h3 className="craft__group-label">{group.label}</h3>
                  <div className="craft__options">
                    {group.options.map((option) => {
                      const isOn = selected.has(option.id)
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`craft__option${isOn ? ' is-selected' : ''}`}
                          aria-label={`${option.weekday}, ${option.month} ${option.day}, ${option.time}`}
                          aria-pressed={isOn}
                          disabled={!selectedEmail}
                          onClick={() => toggleOption(option.id)}
                        >
                          <span className="craft__option-date" aria-hidden="true">
                            <span className="craft__option-month">{option.month}</span>
                            <span className="craft__option-day">{option.day}</span>
                          </span>
                          <span className="craft__option-body">
                            <span className="craft__option-weekday">{option.weekday}</span>
                            <span className="craft__option-time">{option.time}</span>
                            {option.tag && <span className="craft__option-tag">{option.tag}</span>}
                          </span>
                          <span className="craft__option-check" aria-hidden="true">✓</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
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
                  {saveState === 'saving' ? 'Saving' : saveState === 'saved' ? 'Saved ✓' : 'Save'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
