import '../../styles/portal.css'

/**
 * A status pill. Colour is never the only cue (spec §7.1): every pill carries a
 * glyph *and* the word, so the state survives greyscale, colour-blindness and
 * forced-colors mode.
 *
 * Tone maps to an ink/wash pair from `portal.css`. The ink is always the dark
 * member of the pair — teal and gold never appear as text on a light surface.
 * `warn` is rationed to exactly one meaning: this needs attention.
 */
export type StatusTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'info'

const TONE_GLYPH: Record<StatusTone, string> = {
  neutral: '○',
  accent: '◆',
  success: '✓',
  warn: '▲',
  danger: '✕',
  info: 'ℹ',
}

export type StatusPillProps = {
  /** The word a reader sees and a screen reader announces. Never abbreviate. */
  label: string
  tone?: StatusTone
  /** Overrides the tone's default glyph. Decorative — always `aria-hidden`. */
  glyph?: string
  /** Extra context announced after the label, e.g. "needs a room request". */
  detail?: string
  /** Transparent fill with a currentColor border. For pills over a wash. */
  outline?: boolean
  className?: string
}

export function StatusPill({ label, tone = 'neutral', glyph, detail, outline, className }: StatusPillProps) {
  const classes = ['p-pill']
  if (outline) classes.push('p-pill--outline')
  if (className) classes.push(className)

  return (
    <span className={classes.join(' ')} data-tone={tone}>
      <span className="p-pill__glyph" aria-hidden="true">{glyph ?? TONE_GLYPH[tone]}</span>
      {label}
      {detail ? <span className="p-visually-hidden">{` — ${detail}`}</span> : null}
    </span>
  )
}

export default StatusPill
