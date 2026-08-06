import type { ReactNode } from 'react'
import '../../styles/portal.css'

/**
 * Portal icon set.
 *
 * Every icon here is decorative by construction: `aria-hidden="true"` and
 * `focusable="false"` (spec §7.1). An icon NEVER carries meaning on its own —
 * if a control is icon-only, the control supplies a real label hidden with
 * `.p-visually-hidden`. There are no `<i>v</i>` chevrons and no `content: "v"`
 * anywhere in this file; a chevron is a stroked path.
 */
export type IconProps = {
  /** Edge length in px. Defaults to 18, the portal's inline icon size. */
  size?: number
  className?: string
  /** Stroke width. Defaults to 1.75. */
  strokeWidth?: number
}

function Glyph({ size = 18, className, strokeWidth = 1.75, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className ? `p-icon ${className}` : 'p-icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

/* ── Navigation ─────────────────────────────────────────────────────── */

export function IconOverview(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="4" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </Glyph>
  )
}

export function IconRoster(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.6" />
      <path d="M17.5 14.2A5.2 5.2 0 0 1 20.5 19" />
    </Glyph>
  )
}

export function IconEvents(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Glyph>
  )
}

export function IconCheckIn(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M8 12.5l2.6 2.6L16 9.7" />
    </Glyph>
  )
}

export function IconBroadcast(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 9v6h3l7 4V5L7 9H4z" />
      <path d="M17.5 8.5a5 5 0 0 1 0 7" />
    </Glyph>
  )
}

export function IconRecruiting(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1" />
      <path d="M9 11h6M9 15h4" />
    </Glyph>
  )
}

export function IconConsole(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="8" cy="17" r="2" />
    </Glyph>
  )
}

export function IconHome(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5z" />
      <path d="M10 21v-6h4v6" />
    </Glyph>
  )
}

export function IconResources(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5v-13z" />
    </Glyph>
  )
}

export function IconProfile(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Glyph>
  )
}

/** Access page. A person figure — never a wheelchair-only symbol. */
export function IconAccess(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="4.6" r="1.9" />
      <path d="M5.5 8.6h13" />
      <path d="M12 8.6v5.4" />
      <path d="M8.6 20.5 12 14h.1l3.3 6.5" />
    </Glyph>
  )
}

/* ── Controls ───────────────────────────────────────────────────────── */

export function IconChevronDown(props: IconProps) {
  return <Glyph {...props}><path d="M6 9.5 12 15.5 18 9.5" /></Glyph>
}

export function IconChevronUp(props: IconProps) {
  return <Glyph {...props}><path d="M6 14.5 12 8.5 18 14.5" /></Glyph>
}

export function IconChevronRight(props: IconProps) {
  return <Glyph {...props}><path d="M9.5 6 15.5 12 9.5 18" /></Glyph>
}

export function IconChevronLeft(props: IconProps) {
  return <Glyph {...props}><path d="M14.5 6 8.5 12 14.5 18" /></Glyph>
}

export function IconCheck(props: IconProps) {
  return <Glyph {...props}><path d="M5 12.6 9.6 17.2 19 7.8" /></Glyph>
}

export function IconClose(props: IconProps) {
  return <Glyph {...props}><path d="M6 6l12 12M18 6 6 18" /></Glyph>
}

export function IconPlus(props: IconProps) {
  return <Glyph {...props}><path d="M12 5v14M5 12h14" /></Glyph>
}

export function IconMinus(props: IconProps) {
  return <Glyph {...props}><path d="M5 12h14" /></Glyph>
}

export function IconArrowUp(props: IconProps) {
  return <Glyph {...props}><path d="M12 19V5M6 11l6-6 6 6" /></Glyph>
}

export function IconArrowDown(props: IconProps) {
  return <Glyph {...props}><path d="M12 5v14M6 13l6 6 6-6" /></Glyph>
}

export function IconSearch(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l4.5 4.5" />
    </Glyph>
  )
}

export function IconFilter(props: IconProps) {
  return <Glyph {...props}><path d="M4 6h16l-6 7v6l-4-2v-4L4 6z" /></Glyph>
}

export function IconMenu(props: IconProps) {
  return <Glyph {...props}><path d="M4 7h16M4 12h16M4 17h16" /></Glyph>
}

export function IconExternal(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
    </Glyph>
  )
}

export function IconDownload(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4v10" />
      <path d="M7.5 10 12 14.5 16.5 10" />
      <path d="M5 19h14" />
    </Glyph>
  )
}

export function IconWarning(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 4.5 21 19.5H3L12 4.5z" />
      <path d="M12 10v4M12 17h.01" />
    </Glyph>
  )
}

export function IconInfo(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11.5v5M12 8h.01" />
    </Glyph>
  )
}

export function IconClock(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Glyph>
  )
}

export function IconPlace(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 21s6.5-6 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.4" />
    </Glyph>
  )
}

export function IconMail(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </Glyph>
  )
}

export function IconSignOut(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M15 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H15" />
      <path d="M15.5 8.5 19 12l-3.5 3.5" />
      <path d="M19 12h-8" />
    </Glyph>
  )
}

/* ── Display settings ───────────────────────────────────────────────── */

export function IconDisplay(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M6 4v6M6 14v6M12 4v3M12 11v9M18 4v9M18 17v3" />
      <path d="M4 12h4M10 9h4M16 15h4" />
    </Glyph>
  )
}

export function IconSun(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </Glyph>
  )
}

export function IconMoon(props: IconProps) {
  return <Glyph {...props}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" /></Glyph>
}

export function IconSystem(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M9 21h6M12 17v4" />
    </Glyph>
  )
}
