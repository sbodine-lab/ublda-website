/* These portal primitives deliberately export their helper constants and hooks
   alongside the component: splitting one small file into two to satisfy Fast
   Refresh would cost more than the dev-time reload it saves. Same call the
   codebase already makes in src/hooks/useMemberAuth.tsx. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import '../../styles/portal.css'

/**
 * The portal's two live regions (spec §7.1, §7.2).
 *
 *   role="status" aria-live="polite"    — every save, filter result, load,
 *                                         and route change.
 *   role="alert"  aria-live="assertive" — failures the member must know about
 *                                         right now.
 *
 * Both are mounted ONCE at the portal root and are never conditionally
 * rendered — a live region that appears at the same moment as its text is not
 * announced by most screen readers.
 *
 * The visual toast is a *duplicate* of the polite region. It carries
 * `aria-hidden="true"` and contains nothing focusable, so it can never
 * double-announce and can never become a keyboard trap.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * NEVER announce access-profile content through either region. Accommodation
 * needs are read aloud into whatever room the member is standing in. Announce
 * "Access preferences saved." — never what was saved.
 * ─────────────────────────────────────────────────────────────────────────
 */

export type PortalAnnouncerApi = {
  /** Polite. Use for saves, filter counts, load completion, route changes. */
  announce: (message: string) => void
  /** Assertive. Use only for errors and conflicts that block the member. */
  announceUrgent: (message: string) => void
  /** Clears both regions. Rarely needed; unmounting a page does not require it. */
  clearAnnouncements: () => void
}

const noop = () => {}

const PortalAnnouncerContext = createContext<PortalAnnouncerApi>({
  announce: noop,
  announceUrgent: noop,
  clearAnnouncements: noop,
})

/**
 * Read the announcer. Safe to call outside a provider — it becomes a no-op
 * rather than throwing, so a component can be unit-rendered in isolation.
 */
export function usePortalAnnouncer(): PortalAnnouncerApi {
  return useContext(PortalAnnouncerContext)
}

/**
 * Identical text set twice in a row is not re-announced, because the text node
 * did not change. Alternating an invisible zero-width space makes the second
 * announcement land without a timer and without a StrictMode double-fire.
 */
const ZERO_WIDTH_SPACE = '​'

function nextMessage(previous: string, message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return ''
  return previous === trimmed ? `${trimmed}${ZERO_WIDTH_SPACE}` : trimmed
}

const TOAST_MS = 6000

export type PortalAnnouncerProps = {
  children?: ReactNode
  /** Render the visual toast duplicate of the polite region. Default true. */
  toast?: boolean
}

/**
 * Provider + live regions. Mount once, at the portal root, wrapping the shell:
 *
 *   <PortalAnnouncer>
 *     <div className="portal"> … </div>
 *   </PortalAnnouncer>
 *
 * Rendering it with no children is also valid — it then contributes only the
 * two regions, but descendants will not see the context.
 */
export function PortalAnnouncer({ children, toast = true }: PortalAnnouncerProps) {
  const [polite, setPolite] = useState('')
  const [urgent, setUrgent] = useState('')
  const [toastText, setToastText] = useState('')
  const [toastUrgent, setToastUrgent] = useState(false)
  const timerRef = useRef<number | null>(null)

  const showToast = useCallback((message: string, isUrgent: boolean) => {
    const trimmed = message.trim()
    if (!trimmed) return
    setToastText(trimmed)
    setToastUrgent(isUrgent)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setToastText('')
      timerRef.current = null
    }, TOAST_MS)
  }, [])

  const announce = useCallback((message: string) => {
    setPolite((previous) => nextMessage(previous, message))
    showToast(message, false)
  }, [showToast])

  const announceUrgent = useCallback((message: string) => {
    setUrgent((previous) => nextMessage(previous, message))
    showToast(message, true)
  }, [showToast])

  const clearAnnouncements = useCallback(() => {
    setPolite('')
    setUrgent('')
    setToastText('')
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  const api = useMemo<PortalAnnouncerApi>(
    () => ({ announce, announceUrgent, clearAnnouncements }),
    [announce, announceUrgent, clearAnnouncements],
  )

  return (
    <PortalAnnouncerContext.Provider value={api}>
      {children}
      <div className="p-visually-hidden" role="status" aria-live="polite" aria-atomic="true">{polite}</div>
      <div className="p-visually-hidden" role="alert" aria-live="assertive" aria-atomic="true">{urgent}</div>
      {toast && toastText ? (
        <div className="p-toaststack" aria-hidden="true">
          <p className="p-toast" data-urgent={toastUrgent ? 'true' : undefined}>{toastText}</p>
        </div>
      ) : null}
    </PortalAnnouncerContext.Provider>
  )
}

/** Alias for shells that prefer the provider name. Identical component. */
export const PortalAnnouncerProvider = PortalAnnouncer

export default PortalAnnouncer
