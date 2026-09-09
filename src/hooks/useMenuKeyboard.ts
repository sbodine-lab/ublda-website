import { useEffect, type RefObject } from 'react'

/** Keep keyboard navigation inside an open menu and its close button. */
export function useMenuKeyboard(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  menuSelector: string,
  toggleSelector: string,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open) return
    const menu = rootRef.current?.querySelector<HTMLElement>(menuSelector)
    const toggle = rootRef.current?.querySelector<HTMLElement>(toggleSelector)
    if (!menu || !toggle) return
    const items = () => [
      ...menu.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'),
      toggle,
    ].filter((element) => element.getClientRects().length > 0 && !element.closest('[inert]'))
    const timer = window.setTimeout(() => items()[0]?.focus(), 50)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        toggle.focus()
      }
      if (event.key !== 'Tab') return
      const focusable = items()
      const current = focusable.indexOf(document.activeElement as HTMLElement)
      event.preventDefault()
      const next = current === -1
        ? (event.shiftKey ? focusable.length - 1 : 0)
        : (current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length
      focusable[next]?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, rootRef, menuSelector, toggleSelector, onClose])
}
