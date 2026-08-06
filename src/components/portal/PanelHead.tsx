/* These portal primitives deliberately export their helper constants and hooks
   alongside the component: splitting one small file into two to satisfy Fast
   Refresh would cost more than the dev-time reload it saves. Same call the
   codebase already makes in src/hooks/useMemberAuth.tsx. */
/* eslint-disable react-refresh/only-export-components */
import { Fragment } from 'react'
import type { ReactNode } from 'react'
import '../../styles/portal.css'

/**
 * Every panel carries a human owner and a freshness stamp (spec §8.4 detail 3).
 *
 *   Roster
 *   Owned by Cooper Perry · 4 need a next step · updated 12 min ago
 *
 * This is what takes the portal from a CRUD app to the club's operating system,
 * and it is what makes staleness visible — the failure mode of every student-org
 * tool. Pass a real person's name or pass nothing; never "System".
 *
 * The timestamp is rendered once, at render time, inside a `<time dateTime>`
 * carrying the machine-readable ISO value. It does NOT tick: an auto-updating
 * counter is motion nobody asked for (spec §7.1).
 */
export type PanelHeadProps = {
  title: string
  /** Panels sit under the page `<h1>`, so 2 is right for a top-level panel. */
  headingLevel?: 2 | 3 | 4
  /** Put this on the heading and point the panel's `aria-labelledby` at it. */
  id?: string
  /** One sentence explaining what the panel is for. */
  description?: string
  /** A real person: "Cooper Perry". Rendered as "Owned by Cooper Perry". */
  owner?: string
  /** Neutral facts for the meta line: "18 members", "3 drafts". */
  meta?: string[]
  /** Rendered in the warn ink. Reserve it for "needs someone to act". */
  attention?: string
  /** ISO timestamp of the most recent write this panel reflects. */
  updatedAt?: string
  /** Buttons for the panel as a whole. */
  actions?: ReactNode
  className?: string
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * "12 min ago" / "3 hr ago" / "yesterday" / "Oct 1". Returns '' for anything
 * that is not a real date, so a missing timestamp renders nothing rather than
 * "Invalid Date".
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const ms = then.getTime()
  if (!iso || Number.isNaN(ms)) return ''
  const delta = now.getTime() - ms
  if (delta < MINUTE) return 'just now'
  const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto', style: 'short' })
  if (delta < HOUR) return relative.format(-Math.round(delta / MINUTE), 'minute')
  if (delta < DAY) return relative.format(-Math.round(delta / HOUR), 'hour')
  if (delta < 7 * DAY) return relative.format(-Math.round(delta / DAY), 'day')
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function PanelHead({
  title, headingLevel = 2, id, description, owner, meta, attention, updatedAt, actions, className,
}: PanelHeadProps) {
  const Heading = (headingLevel === 3 ? 'h3' : headingLevel === 4 ? 'h4' : 'h2') as 'h2'
  const stamp = updatedAt ? formatRelativeTime(updatedAt) : ''
  const facts: ReactNode[] = []

  if (owner) facts.push(<span>{`Owned by ${owner}`}</span>)
  meta?.forEach((fact) => { facts.push(<span>{fact}</span>) })
  if (attention) facts.push(<span data-attention="true">{attention}</span>)
  if (stamp) {
    facts.push(
      <span>
        {'updated '}
        <time dateTime={updatedAt}>{stamp}</time>
      </span>,
    )
  }

  return (
    <div className={className ? `p-panelhead ${className}` : 'p-panelhead'}>
      <div className="p-panelhead__text">
        <Heading className="p-panelhead__title" id={id}>{title}</Heading>
        {description ? <p className="p-panelhead__desc">{description}</p> : null}
        {facts.length > 0 ? (
          <p className="p-panelhead__meta">
            {facts.map((fact, index) => (
              <Fragment key={index}>
                {index > 0 ? <span className="p-panelhead__sep" aria-hidden="true">·</span> : null}
                {fact}
              </Fragment>
            ))}
          </p>
        ) : null}
      </div>
      {actions ? <div className="p-panelhead__actions">{actions}</div> : null}
    </div>
  )
}

export default PanelHead
