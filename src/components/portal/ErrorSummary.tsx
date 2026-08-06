import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import '../../styles/portal.css'

/**
 * The summary a failed submit renders (spec §7.1).
 *
 * It is a focusable `role="alert"` region that takes focus the moment errors
 * appear, and each entry links to the field that produced it. Clicking an entry
 * moves real focus to that control — an anchor alone only moves the sequential
 * navigation start point in some browsers.
 *
 * Render it above the form, and give every entry a `fieldId` where one exists.
 * Never render this component with an empty list: it returns null, which keeps
 * the announcement tied to the arrival of a real error.
 */
export type ErrorSummaryEntry = {
  /** `id` of the control this error belongs to. Omit for form-level errors. */
  fieldId?: string
  message: string
}

export type ErrorSummaryProps = {
  /** Strings are treated as form-level errors with no field to jump to. */
  errors: (string | ErrorSummaryEntry)[]
  /** Defaults to a count-aware sentence. */
  title?: string
  /** Set false when the caller manages focus itself. */
  autoFocus?: boolean
  /** Match the surrounding outline so headings never skip a level. */
  headingLevel?: 2 | 3 | 4
  className?: string
}

function normalize(entry: string | ErrorSummaryEntry): ErrorSummaryEntry {
  return typeof entry === 'string' ? { message: entry } : entry
}

export function ErrorSummary({ errors, title, autoFocus = true, headingLevel = 2, className }: ErrorSummaryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousCount = useRef(0)
  const count = errors.length

  useEffect(() => {
    if (!autoFocus) return
    // Focus only on the transition into an error state, so a re-render while
    // the member is fixing one field does not yank focus back out of it.
    if (count > 0 && previousCount.current === 0) containerRef.current?.focus()
    previousCount.current = count
  }, [count, autoFocus])

  if (count === 0) return null

  const entries = errors.map(normalize)
  const heading = title ?? (count === 1 ? 'There is one thing to fix.' : `There are ${count} things to fix.`)
  const Heading = (headingLevel === 3 ? 'h3' : headingLevel === 4 ? 'h4' : 'h2') as 'h2'

  const jumpTo = (fieldId: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(fieldId)
    if (!target) return
    event.preventDefault()
    target.focus()
    target.scrollIntoView({ block: 'center' })
  }

  return (
    <div
      ref={containerRef}
      className={className ? `p-errorsummary ${className}` : 'p-errorsummary'}
      role="alert"
      tabIndex={-1}
    >
      <Heading className="p-errorsummary__title">{heading}</Heading>
      <ul className="p-errorsummary__list">
        {entries.map((entry, index) => (
          <li key={`${entry.fieldId ?? 'form'}-${index}`}>
            {entry.fieldId ? (
              <a className="p-errorsummary__link" href={`#${entry.fieldId}`} onClick={jumpTo(entry.fieldId)}>
                {entry.message}
              </a>
            ) : (
              <span className="p-errorsummary__item">{entry.message}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ErrorSummary
