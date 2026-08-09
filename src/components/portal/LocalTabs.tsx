import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import '../../styles/portal.css'

/**
 * The portal's only composite widget, and therefore the only place with roving
 * `tabindex` (spec §7.2).
 *
 * Top-level sections are ROUTES, not tabs — the URL stays shareable, the back
 * button works, and each navigation produces a real page announcement. Reach
 * for `LocalTabs` only for panels *inside* one route.
 *
 * Activation is MANUAL: Arrow keys move focus between tabs without switching
 * the panel; Enter or Space switches it. Home and End jump to the ends. Tab
 * leaves the tablist entirely and lands on the panel.
 *
 * Selection is controlled by the caller so it can be reflected in state the
 * rest of the screen reads.
 */
export type LocalTab = {
  id: string
  label: string
  /** A count rendered beside the label, e.g. "4". Announced with the tab. */
  badge?: string | number
}

export type LocalTabsProps = {
  /** Names the tablist. Required — a tablist with no name is unusable. */
  label: string
  tabs: LocalTab[]
  activeId: string
  onChange: (id: string) => void
  /** The active panel's content. Rendered inside the `tabpanel`. */
  children?: ReactNode
  className?: string
}

export function LocalTabs({ label, tabs, activeId, onChange, children, className }: LocalTabsProps) {
  const baseId = useId()
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === activeId))
  const [focusIndex, setFocusIndex] = useState(activeIndex)

  // Selection can change from outside the tablist; the roving stop follows it.
  useEffect(() => { setFocusIndex(activeIndex) }, [activeIndex])

  const moveFocus = useCallback((index: number) => {
    setFocusIndex(index)
    buttonsRef.current[index]?.focus()
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = tabs.length - 1
    if (last < 0) return
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        moveFocus(focusIndex >= last ? 0 : focusIndex + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        moveFocus(focusIndex <= 0 ? last : focusIndex - 1)
        break
      case 'Home':
        event.preventDefault()
        moveFocus(0)
        break
      case 'End':
        event.preventDefault()
        moveFocus(last)
        break
      default:
        break
    }
  }

  const tabId = (id: string) => `${baseId}-tab-${id}`
  const panelId = (id: string) => `${baseId}-panel-${id}`

  return (
    <div className={className ? `p-tabs ${className}` : 'p-tabs'}>
      {/* Focus lives on the tabs; the handler is here only to catch the bubble. */}
      <div className="p-tabs__list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              className="p-tabs__tab"
              aria-selected={selected}
              aria-controls={panelId(tab.id)}
              tabIndex={index === focusIndex ? 0 : -1}
              ref={(node) => { buttonsRef.current[index] = node }}
              onClick={() => { setFocusIndex(index); onChange(tab.id) }}
              onFocus={() => setFocusIndex(index)}
            >
              {tab.label}
              {tab.badge === undefined ? null : <span className="p-tabs__badge">{tab.badge}</span>}
            </button>
          )
        })}
      </div>
      <div
        className="p-tabs__panel"
        role="tabpanel"
        id={panelId(activeId)}
        aria-labelledby={tabId(activeId)}
        tabIndex={0}
      >
        {children}
      </div>
    </div>
  )
}

export default LocalTabs
