import { useEffect, useId, useRef } from 'react'
import type { MouseEvent, ReactNode, RefObject } from 'react'
import { IconClose } from './Icons'
import '../../styles/portal.css'

/**
 * A modal built on the native `<dialog>` element and `showModal()` (spec §7.2).
 *
 * `showModal()` — not the `open` attribute — is what buys the focus trap, the
 * Escape handler, the inert background, the top layer (no z-index war with the
 * sticky topbar) and `::backdrop`. Focus returns to the invoking element
 * automatically when the dialog closes, including on Escape.
 *
 * The parent owns `open`. When the user closes the dialog (Escape, the close
 * button, or the backdrop) this component calls `onClose`; the parent must set
 * `open` to false in response.
 */
export type PortalDialogSize = 'narrow' | 'default' | 'wide'

export type PortalDialogProps = {
  open: boolean
  /** Called for Escape, the close button, and a backdrop click. */
  onClose: () => void
  /** Rendered as the dialog's `<h2>` and used as its accessible name. */
  title: string
  /** One sentence under the title. Wired to `aria-describedby`. */
  description?: string
  children: ReactNode
  /** Action row pinned to the bottom of the dialog. */
  footer?: ReactNode
  size?: PortalDialogSize
  /**
   * Focused when the dialog opens. Leave unset to accept the browser's own
   * choice, which is the first tabbable control — usually what you want.
   */
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Extends the close button's name: "Close" + this. Say what is closing. */
  closeLabel?: string
  /** Set false for destructive flows where an accidental click should not close. */
  closeOnBackdropClick?: boolean
  className?: string
}

const SIZE_CLASS: Record<PortalDialogSize, string> = {
  narrow: 'p-dialog p-dialog--narrow',
  default: 'p-dialog',
  wide: 'p-dialog p-dialog--wide',
}

export function PortalDialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'default',
  initialFocusRef,
  closeLabel,
  closeOnBackdropClick = true,
  className,
}: PortalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const baseId = useId()
  const titleId = `${baseId}-title`
  const descriptionId = `${baseId}-desc`

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  // Move focus to the caller's chosen control once the dialog is actually open.
  useEffect(() => {
    if (!open) return
    const target = initialFocusRef?.current
    if (target) target.focus()
  }, [open, initialFocusRef])

  // If the focused control unmounts while the dialog is still open — a row saves and
  // re-renders, a field disappears — focus falls to the inert <body> behind the modal and
  // the keyboard user is stranded with no way back in. Pull it back to the dialog.
  useEffect(() => {
    if (!open) return
    const d = dialogRef.current
    if (!d) return

    const handleFocusOut = () => {
      window.requestAnimationFrame(() => {
        if (!d.open) return
        const active = document.activeElement
        if (active && active !== document.body && d.contains(active)) return
        d.focus()
      })
    }

    d.addEventListener('focusout', handleFocusOut)
    return () => { d.removeEventListener('focusout', handleFocusOut) }
  }, [open])

  // The page behind a modal must not scroll. `inert` handles interaction; this
  // handles the scroll chain.
  useEffect(() => {
    if (!open) return
    document.body.classList.add('p-scroll-locked')
    return () => { document.body.classList.remove('p-scroll-locked') }
  }, [open])

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (!closeOnBackdropClick) return
    // A backdrop click targets the <dialog> itself; anything inside targets a child.
    if (event.target === dialogRef.current) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={className ? `${SIZE_CLASS[size]} ${className}` : SIZE_CLASS[size]}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Programmatically focusable so the focusout recovery above has somewhere to land.
      tabIndex={-1}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div className="p-dialog__inner">
        <div className="p-dialog__head">
          <div className="p-panelhead__text">
            <h2 className="p-dialog__title" id={titleId}>{title}</h2>
            {description ? (
              <p className="p-dialog__desc" id={descriptionId}>{description}</p>
            ) : null}
          </div>
          <button type="button" className="p-btn p-btn--quiet p-btn--icon p-dialog__close" onClick={onClose}>
            <IconClose />
            <span className="p-visually-hidden">
              {closeLabel ? `Close ${closeLabel}` : `Close ${title}`}
            </span>
          </button>
        </div>
        <div className="p-dialog__body">{children}</div>
        {footer ? <div className="p-dialog__foot">{footer}</div> : null}
      </div>
    </dialog>
  )
}

export default PortalDialog
