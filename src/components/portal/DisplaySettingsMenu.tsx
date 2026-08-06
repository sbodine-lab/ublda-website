/* These portal primitives deliberately export their helper constants and hooks
   alongside the component: splitting one small file into two to satisfy Fast
   Refresh would cost more than the dev-time reload it saves. Same call the
   codebase already makes in src/hooks/useMemberAuth.tsx. */
/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { usePortalAnnouncer } from './PortalAnnouncer'
import { IconChevronDown, IconDisplay } from './Icons'
import '../../styles/portal.css'

/**
 * Theme, density and motion — the Display popover in the topbar
 * (spec §8.4 detail 4).
 *
 * For most products this is a settings-page afterthought. For a
 * disability-leadership club it is a statement of competence placed where a
 * visitor sees it in the first ten seconds, and it is load-bearing: photophobia,
 * migraine and low vision are common in exactly the population this club exists
 * for, and a cream canvas at 100% is the worst case for all three.
 *
 * Theme control is THREE-WAY (System / Light / Dark), not `prefers-color-scheme`
 * alone. The OS setting is a poor proxy for an individual's need, and someone
 * with a migraine at 2pm should not have to change their whole machine.
 *
 * All three are real radio groups inside labelled `<fieldset>`s. The popover is
 * a disclosure, not `role="menu"`.
 *
 * Where the settings land:
 *   <html data-theme="light|dark" data-theme-preference="system|light|dark"
 *         data-density="comfortable|compact" data-motion="system|reduced">
 * and the shell should ALSO mirror density and motion onto the `.portal` root
 * (`data-density`, `data-motion`). `portal.css` honours either location.
 */

export type PortalTheme = 'system' | 'light' | 'dark'
export type PortalDensity = 'comfortable' | 'compact'
export type PortalMotion = 'system' | 'reduced'

export type PortalDisplaySettings = {
  theme: PortalTheme
  density: PortalDensity
  motion: PortalMotion
}

export const PORTAL_DISPLAY_STORAGE_KEY = 'ublda-portal-display'

export const DEFAULT_DISPLAY_SETTINGS: PortalDisplaySettings = {
  theme: 'system',
  density: 'comfortable',
  motion: 'system',
}

const THEMES: PortalTheme[] = ['system', 'light', 'dark']
const DENSITIES: PortalDensity[] = ['comfortable', 'compact']
const MOTIONS: PortalMotion[] = ['system', 'reduced']

function coerce(raw: unknown): PortalDisplaySettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_DISPLAY_SETTINGS
  const value = raw as Record<string, unknown>
  const theme = THEMES.find((candidate) => candidate === value.theme) ?? DEFAULT_DISPLAY_SETTINGS.theme
  const density = DENSITIES.find((candidate) => candidate === value.density) ?? DEFAULT_DISPLAY_SETTINGS.density
  const motion = MOTIONS.find((candidate) => candidate === value.motion) ?? DEFAULT_DISPLAY_SETTINGS.motion
  return { theme, density, motion }
}

/** Reads the member's stored preferences. Never throws — Safari private mode. */
export function readDisplaySettings(): PortalDisplaySettings {
  if (typeof window === 'undefined') return DEFAULT_DISPLAY_SETTINGS
  try {
    const stored = window.localStorage.getItem(PORTAL_DISPLAY_STORAGE_KEY)
    return stored ? coerce(JSON.parse(stored) as unknown) : DEFAULT_DISPLAY_SETTINGS
  } catch {
    return DEFAULT_DISPLAY_SETTINGS
  }
}

function prefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Resolves `system` against the OS and writes the attributes onto `<html>`. */
export function applyDisplaySettings(settings: PortalDisplaySettings): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = settings.theme === 'system' ? (prefersDark() ? 'dark' : 'light') : settings.theme
  root.dataset.themePreference = settings.theme
  root.dataset.density = settings.density
  root.dataset.motion = settings.motion
}

/* ── The store. One instance per document, shared by every caller. ────── */

let snapshot: PortalDisplaySettings | null = null
const listeners = new Set<() => void>()
let systemThemeBound = false

function getSnapshot(): PortalDisplaySettings {
  if (!snapshot) snapshot = readDisplaySettings()
  return snapshot
}

function getServerSnapshot(): PortalDisplaySettings {
  return DEFAULT_DISPLAY_SETTINGS
}

function bindSystemTheme(): void {
  if (systemThemeBound) return
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
  systemThemeBound = true
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  query.addEventListener('change', () => {
    if (getSnapshot().theme !== 'system') return
    applyDisplaySettings(getSnapshot())
    listeners.forEach((listener) => listener())
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  bindSystemTheme()
  return () => { listeners.delete(listener) }
}

/** Merges a change, persists it, applies it, and notifies every subscriber. */
export function setPortalDisplaySettings(patch: Partial<PortalDisplaySettings>): PortalDisplaySettings {
  const next = coerce({ ...getSnapshot(), ...patch })
  snapshot = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PORTAL_DISPLAY_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // A member browsing with storage blocked still gets the setting for this
      // session; losing it on reload is better than throwing at them.
    }
  }
  applyDisplaySettings(next)
  listeners.forEach((listener) => listener())
  return next
}

export type UsePortalDisplaySettings = {
  settings: PortalDisplaySettings
  update: (patch: Partial<PortalDisplaySettings>) => void
}

/**
 * Read and write the display settings from anywhere in the portal. Applying is
 * idempotent, so calling this from both the shell and the menu is correct.
 */
export function usePortalDisplaySettings(): UsePortalDisplaySettings {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  useEffect(() => { applyDisplaySettings(settings) }, [settings])
  const update = useCallback((patch: Partial<PortalDisplaySettings>) => { setPortalDisplaySettings(patch) }, [])
  return { settings, update }
}

/* ── The popover ─────────────────────────────────────────────────────── */

const THEME_LABEL: Record<PortalTheme, string> = {
  system: 'Match my system',
  light: 'Light',
  dark: 'Dark',
}
const DENSITY_LABEL: Record<PortalDensity, string> = {
  comfortable: 'Comfortable',
  compact: 'Compact',
}
const MOTION_LABEL: Record<PortalMotion, string> = {
  system: 'Match my system',
  reduced: 'Reduce motion',
}

export type DisplaySettingsMenuProps = {
  /** Visible trigger text. Keep it a word, not an icon alone. */
  label?: string
  align?: 'left' | 'right'
  className?: string
}

export function DisplaySettingsMenu({ label = 'Display', align = 'right', className }: DisplaySettingsMenuProps) {
  const baseId = useId()
  const panelId = `${baseId}-panel`
  const { settings, update } = usePortalDisplaySettings()
  const { announce } = usePortalAnnouncer()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const isInside = (node: EventTarget | null) =>
      node instanceof Node && Boolean(containerRef.current?.contains(node))

    const onPointerDown = (event: PointerEvent) => { if (!isInside(event.target)) setOpen(false) }
    const onFocusIn = (event: FocusEvent) => { if (!isInside(event.target)) setOpen(false) }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  const choose = (patch: Partial<PortalDisplaySettings>, spoken: string) => {
    update(patch)
    announce(spoken)
  }

  return (
    <div className={className ? `p-menu ${className}` : 'p-menu'} ref={containerRef}>
      <button
        type="button"
        ref={triggerRef}
        className="p-btn p-btn--quiet p-menu__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <IconDisplay size={16} />
        {label}
        <IconChevronDown className="p-menu__caret" size={16} />
      </button>

      {open ? (
        <div className={align === 'left' ? 'p-menu__panel p-menu__panel--left' : 'p-menu__panel'} id={panelId}>
          <fieldset className="p-display__group">
            <legend className="p-display__legend">Theme</legend>
            <div className="p-display__options">
              {THEMES.map((theme) => (
                <label className="p-display__option" key={theme}>
                  <input
                    type="radio"
                    name={`${baseId}-theme`}
                    value={theme}
                    checked={settings.theme === theme}
                    onChange={() => choose({ theme }, `Theme set to ${THEME_LABEL[theme].toLowerCase()}.`)}
                  />
                  {THEME_LABEL[theme]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="p-display__group">
            <legend className="p-display__legend">Density</legend>
            <div className="p-display__options">
              {DENSITIES.map((density) => (
                <label className="p-display__option" key={density}>
                  <input
                    type="radio"
                    name={`${baseId}-density`}
                    value={density}
                    checked={settings.density === density}
                    onChange={() => choose({ density }, `Density set to ${DENSITY_LABEL[density].toLowerCase()}.`)}
                  />
                  {DENSITY_LABEL[density]}
                </label>
              ))}
            </div>
            <p className="p-display__note">Compact fits more rows on screen. Touch targets stay full size on a phone.</p>
          </fieldset>

          <fieldset className="p-display__group">
            <legend className="p-display__legend">Motion</legend>
            <div className="p-display__options">
              {MOTIONS.map((motion) => (
                <label className="p-display__option" key={motion}>
                  <input
                    type="radio"
                    name={`${baseId}-motion`}
                    value={motion}
                    checked={settings.motion === motion}
                    onChange={() => choose(
                      { motion },
                      motion === 'reduced' ? 'Motion reduced.' : 'Motion follows your system setting.',
                    )}
                  />
                  {MOTION_LABEL[motion]}
                </label>
              ))}
            </div>
            <p className="p-display__note">Reduce motion works here even when your device setting is off.</p>
          </fieldset>
        </div>
      ) : null}
    </div>
  )
}

export default DisplaySettingsMenu
