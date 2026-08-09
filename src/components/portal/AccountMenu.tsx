import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { IconChevronDown, IconSignOut } from './Icons'
import '../../styles/portal.css'

/**
 * The topbar account menu.
 *
 * It is a DISCLOSURE, not `role="menu"` (spec §7.2). A 2–5 item popover
 * announced as "menu, 4 items" is worse than a labelled disclosure with a list,
 * and `role="menu"` would obligate the full APG keyboard contract for no gain.
 *
 * Contract this component honours:
 *  · Escape closes and returns focus to the trigger.
 *  · A pointer press outside closes it.
 *  · Focus leaving the menu closes it — so there is no keyboard trap, and Tab
 *    walks straight out into the page.
 *  · Focus is NOT forced into the panel on open; the panel follows the trigger
 *    in DOM order, so Tab reaches it naturally.
 */
export type AccountMenuItem = {
  key: string
  label: string
  /** Renders an `<a>`. Use for real navigation. */
  href?: string
  /** Renders a `<button>`. Use for actions. */
  onSelect?: () => void
  icon?: ReactNode
}

export type AccountMenuProps = {
  /** The member's preferred name. Shown on the trigger above 768px. */
  name: string
  email: string
  /** "Co-President", "Member". Plain words — never a role code. */
  roleLabel?: string
  items?: AccountMenuItem[]
  /** Rendered inside the panel under `items`. For router links. */
  children?: ReactNode
  onSignOut?: () => void
  signOutLabel?: string
  align?: 'left' | 'right'
  className?: string
}

function initialsFor(name: string, email: string): string {
  const source = name.trim() || email.trim()
  if (!source) return '·'
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? parts[1][0] : ''
  return `${first}${second}`.toUpperCase() || '·'
}

export function AccountMenu({
  name, email, roleLabel, items, children, onSignOut, signOutLabel = 'Sign out', align = 'right', className,
}: AccountMenuProps) {
  const baseId = useId()
  const panelId = `${baseId}-panel`
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const closeAndReturnFocus = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

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
        <span className="p-avatar" aria-hidden="true">{initialsFor(name, email)}</span>
        <span className="p-visually-hidden">Account for </span>
        {name || email}
        <IconChevronDown className="p-menu__caret" size={16} />
      </button>

      {open ? (
        <div className={align === 'left' ? 'p-menu__panel p-menu__panel--left' : 'p-menu__panel'} id={panelId}>
          <div className="p-menu__identity">
            <span className="p-menu__name">{name || email}</span>
            <span className="p-menu__email">{email}</span>
            {roleLabel ? <span className="p-menu__email">{roleLabel}</span> : null}
          </div>

          {items && items.length > 0 ? (
            <ul className="p-menu__list">
              {items.map((item) => (
                <li key={item.key}>
                  {item.href ? (
                    <a className="p-menu__item" href={item.href} onClick={() => setOpen(false)}>
                      {item.icon}{item.label}
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="p-menu__item"
                      onClick={() => { setOpen(false); item.onSelect?.() }}
                    >
                      {item.icon}{item.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {children ? <div className="p-menu__list">{children}</div> : null}

          {onSignOut ? (
            <div className="p-menu__foot">
              <button
                type="button"
                className="p-menu__item"
                onClick={() => { closeAndReturnFocus(); onSignOut() }}
              >
                <IconSignOut size={16} />{signOutLabel}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default AccountMenu
