import type { ReactNode } from 'react'
import '../../styles/portal.css'

/**
 * The KPI tile (spec §8.4 detail 1).
 *
 * The figure quotes the marketing site's signature: an Instrument Serif line
 * with one word in teal italic. Here the number is Instrument Serif with
 * `tabular-nums` and the qualifier is Instrument Serif *italic* in
 * `--p-accent-ink` — the ink form, because teal is never text on a light
 * surface. `16 orgs` renders as one line, unmistakably UBLDA's.
 *
 * Counts only. Never a ratio, a percentage, a streak or a denominator: for a
 * membership that includes people managing fatigue, flares and inaccessible
 * venues, a denominator is an accusation (spec §1.2).
 *
 * `tone="attention"` is the ONLY gold in the portal and means exactly one
 * thing: this needs someone to do something. Anything else in gold dilutes it.
 */
export type StatCardProps = {
  /** What is being counted. Sentence case, no colon. */
  label: string
  /** The figure. Pass a number; pass '—' when the value is genuinely unknown. */
  value: number | string
  /** The unit, set in serif italic beside the figure: "orgs", "events". */
  qualifier?: string
  /** One short line under the figure. Context, never a percentage. */
  hint?: string
  tone?: 'default' | 'attention'
  /** A single link or button into the screen that explains the figure. */
  action?: ReactNode
  className?: string
}

export function StatCard({ label, value, qualifier, hint, tone = 'default', action, className }: StatCardProps) {
  const classes = ['p-stat']
  if (tone === 'attention') classes.push('p-stat--attention')
  if (className) classes.push(className)

  return (
    <div className={classes.join(' ')}>
      <p className="p-stat__label">{label}</p>
      <p className="p-stat__figure">
        {value}
        {qualifier ? <em className="p-stat__qualifier">{` ${qualifier}`}</em> : null}
      </p>
      {hint ? <p className="p-stat__hint">{hint}</p> : null}
      {action ? <div className="p-stat__action">{action}</div> : null}
    </div>
  )
}

export default StatCard
