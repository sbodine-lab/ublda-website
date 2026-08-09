import type { ReactNode } from 'react'
import '../../styles/portal.css'

/**
 * The zero state (spec §7.1, §8.4 detail 5).
 *
 * The portal is almost entirely empty for the next two months, so these are not
 * placeholders — they *are* the product. Three parts, no more: a heading, one
 * sentence in the club's voice, and at most one action.
 *
 * Write the sentence by hand. Confident, not aggressive; warm, not casual.
 * "You're the first. Fall recruiting opens at Festifall on September 2 — this
 * list fills fast." Never "No data", never a shrug emoji, and never invented
 * sample rows behind a "demo" flag.
 *
 * The dashed frame uses `--p-border-strong` (3.44:1), not `--p-hairline`: it is
 * the boundary of a region a reader has to find, not decorative separation.
 */
export type EmptyStateProps = {
  /** A short statement, not a label. */
  title: string
  /** One sentence. Say what will fill this and when. */
  body: string
  /** At most one. A button or link the reader can act on right now. */
  action?: ReactNode
  /** Decorative. Pass an icon from `Icons.tsx`; it is already `aria-hidden`. */
  icon?: ReactNode
  /** Match the surrounding outline so headings never skip a level. */
  headingLevel?: 2 | 3 | 4
  /** Left-align inside a panel that is already left-aligned. */
  align?: 'center' | 'left'
  className?: string
}

export function EmptyState({
  title, body, action, icon, headingLevel = 3, align = 'center', className,
}: EmptyStateProps) {
  const Heading = (headingLevel === 2 ? 'h2' : headingLevel === 4 ? 'h4' : 'h3') as 'h3'
  const classes = ['p-empty']
  if (align === 'left') classes.push('p-empty--left')
  if (className) classes.push(className)

  return (
    <div className={classes.join(' ')}>
      {icon ? <span className="p-empty__icon">{icon}</span> : null}
      <Heading className="p-empty__title">{title}</Heading>
      <p className="p-empty__body">{body}</p>
      {action ? <div className="p-empty__action">{action}</div> : null}
    </div>
  )
}

export default EmptyState
