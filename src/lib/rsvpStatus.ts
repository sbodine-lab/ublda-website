import { useSyncExternalStore } from 'react'

/*
 * What this browser knows about a visitor's RSVP for each promoted event.
 *
 * The RSVP lives in a Google Form on another origin, so the site cannot see a
 * submission directly. It learns from three signals instead:
 *   1. The visitor says so ("I already RSVP'd", or "Yes" after opening the form).
 *   2. The form's confirmation page links back with `?rsvp=done`.
 *   3. The visitor opened the form from this site, so we ask once whether they finished.
 *
 * Everything is per event, so next semester's event starts fresh.
 */

export interface RsvpRecord {
  /** The visitor told us, or the form sent them back, so they are signed up. */
  going?: boolean
  /** The visitor closed the invitation popup. */
  popupDismissed?: boolean
  /** When the visitor last opened the RSVP form from this site. */
  formOpenedAt?: number
  /** The visitor answered the "did you finish?" question with "not yet". */
  notYet?: boolean
  /** The visitor hid the countdown banner. */
  bannerHidden?: boolean
  /** Page loads on which the invitation was shown without any response. */
  impressions?: number
}

export type RsvpState = Record<string, RsvpRecord>

/** Stop inviting after this many ignored page loads, even without a dismissal. */
export const MAX_IGNORED_IMPRESSIONS = 3

export type PopupMode = 'invite' | 'confirm' | null

/** Which popup, if any, a visitor should see for an event right now. */
export function popupMode(record: RsvpRecord | undefined, startsAt: number, now: number): PopupMode {
  if (now >= startsAt) return null
  const r = record || {}
  if (r.going) return null
  // They opened the form from here but never told us how it went: ask once.
  if (r.formOpenedAt && !r.notYet) return 'confirm'
  if (r.popupDismissed || r.notYet) return null
  if ((r.impressions || 0) >= MAX_IGNORED_IMPRESSIONS) return null
  return 'invite'
}

export function bannerVisible(record: RsvpRecord | undefined, endsAt: number, now: number): boolean {
  return now < endsAt && !record?.bannerHidden
}

/** Accepts `?rsvp=done`, `?rsvp=1`, `?rsvp=yes`, or `?rsvp=<event id>`. */
export function rsvpParamMatches(value: string | null, eventId: string): boolean {
  if (!value) return false
  const v = value.trim().toLowerCase()
  return v === eventId || v === 'done' || v === '1' || v === 'yes' || v === 'true'
}

// ---- Browser store -------------------------------------------------------

const STORAGE_KEY = 'ublda-rsvp-v1'
const listeners = new Set<() => void>()
let memory: RsvpState | null = null

function read(): RsvpState {
  if (memory) return memory
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    memory = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    // Private windows and blocked storage still get a working session.
    memory = {}
  }
  return memory!
}

function write(next: RsvpState) {
  memory = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* session only */ }
  listeners.forEach(listener => listener())
}

export function updateRsvp(eventId: string, patch: Partial<RsvpRecord> | ((r: RsvpRecord) => Partial<RsvpRecord>)) {
  const state = read()
  const current = state[eventId] || {}
  const changes = typeof patch === 'function' ? patch(current) : patch
  write({ ...state, [eventId]: { ...current, ...changes } })
}

export const markGoing = (eventId: string) => updateRsvp(eventId, { going: true, notYet: false })
export const markFormOpened = (eventId: string) =>
  updateRsvp(eventId, r => (r.going ? {} : { formOpenedAt: Date.now(), notYet: false }))

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Keep tabs in sync: RSVP'ing in one tab quiets the popup in the others.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    memory = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

const EMPTY: RsvpRecord = {}

export function useRsvpRecord(eventId: string | undefined): RsvpRecord {
  return useSyncExternalStore(
    subscribe,
    () => (eventId ? read()[eventId] || EMPTY : EMPTY),
    () => EMPTY,
  )
}
