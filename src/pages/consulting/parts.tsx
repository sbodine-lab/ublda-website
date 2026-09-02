import { forwardRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Moon, Pause, Play, Sun } from 'lucide-react'
import { CONSULTING_FORM_URL } from '../../lib/forms'
import { CONTACT_MAILTO, LEADERS, PAGE_LINKS, SOCIAL } from './content'

export type Theme = 'dark' | 'light'

/* Screen-reader note for links that open a new tab. */
export const NewTab = () => <span className="sr-only"> (opens in a new tab)</span>

/* Dot-and-label button from the reference: a small dot that grows into an
   arrow chip on hover while the underline retracts. */
export function DotButton({
  children,
  href,
  to,
  external,
  className = '',
  onClick,
}: {
  children: ReactNode
  href?: string
  to?: string
  external?: boolean
  className?: string
  onClick?: () => void
}) {
  const inner = (
    <>
      <span className="pc-dotbtn__dot" aria-hidden="true">
        <ArrowRight size={10} strokeWidth={2.2} />
      </span>
      <span className="pc-dotbtn__label">
        {children}
        {external && <NewTab />}
      </span>
    </>
  )
  if (to) {
    return (
      <Link to={to} className={`pc-dotbtn ${className}`} onClick={onClick}>
        {inner}
      </Link>
    )
  }
  return (
    <a
      href={href}
      className={`pc-dotbtn ${className}`}
      onClick={onClick}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {inner}
    </a>
  )
}

/* Hero statements: one span per line so desktop keeps the line breaks and
   mobile reflows them with real spaces between. */
export function HeroLines({ lines }: { lines: string[] }) {
  return (
    <>
      {lines.map((line) => (
        <span className="pc-hl" key={line}>
          {line}{' '}
        </span>
      ))}
    </>
  )
}

/* Rotating torus of thin rings behind the hero, drawn procedurally so it
   inherits the theme colour. */
export function HeroRings() {
  const count = 44
  const cx = 560
  const cy = 910
  const orbit = 520
  const radius = 100
  const circles = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return <circle key={i} cx={(cx + orbit * Math.cos(a)).toFixed(2)} cy={(cy + orbit * Math.sin(a)).toFixed(2)} r={radius} />
  })
  return (
    <svg className="pc-hero__rings" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="0.5" transform="rotate(-12 500 500)">
        {circles}
      </g>
    </svg>
  )
}

interface NavProps {
  theme: Theme
  onToggleTheme: () => void
  motionOff: boolean
  onToggleMotion: () => void
  menuOpen: boolean
  onToggleMenu: () => void
  ghost?: boolean
}

/* The sub-brand nav. `ghost` renders a non-interactive copy inside the
   inverted disc so the wordmark reads correctly while the disc covers it. */
export function ConsultingNav({ theme, onToggleTheme, motionOff, onToggleMotion, menuOpen, onToggleMenu, ghost = false }: NavProps) {
  const ThemeIcon = theme === 'dark' ? Sun : Moon
  const MotionIcon = motionOff ? Play : Pause
  const wordmark = (
    <span className="pc-word">
      <span className="pc-word__u">U</span>
      <span className="pc-word__rest">BLDA</span>
      <span className="pc-word__rest pc-word__sep" aria-hidden="true" />
      <span className="pc-word__c">C</span>
      <span className="pc-word__rest">onsulting</span>
      <span className="pc-word__dot" aria-hidden="true" />
    </span>
  )
  return (
    <header className={`pc-nav ${ghost ? 'pc-nav--ghost' : ''}`} aria-hidden={ghost || undefined}>
      <div className="pc-nav__left">
        {ghost ? (
          <>
            <span className="pc-nav__mode">
              <ThemeIcon size={18} strokeWidth={1.6} aria-hidden="true" />
            </span>
            <span className="pc-nav__mode">
              <MotionIcon size={16} strokeWidth={1.6} aria-hidden="true" />
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              className="pc-nav__mode"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={theme === 'light'}
            >
              <ThemeIcon size={18} strokeWidth={1.6} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="pc-nav__mode"
              onClick={onToggleMotion}
              aria-label={motionOff ? 'Turn animations on' : 'Reduce motion and pause animations'}
              aria-pressed={motionOff}
            >
              <MotionIcon size={16} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {ghost ? (
        <span className="pc-nav__logo">{wordmark}</span>
      ) : (
        <Link to="/" className="pc-nav__logo" aria-label="UBLDA Consulting. Back to the main UBLDA site.">
          {wordmark}
        </Link>
      )}
      <div className="pc-nav__right">
        {ghost ? (
          <span className="pc-nav__apply">
            Apply
            <ArrowUpRight size={12} strokeWidth={2.2} aria-hidden="true" />
          </span>
        ) : (
          <a href={CONSULTING_FORM_URL} target="_blank" rel="noopener noreferrer" className="pc-nav__apply">
            Apply
            <span className="sr-only"> for the Fall 2026 consulting team, closes September 22</span>
            <NewTab />
            <ArrowUpRight size={12} strokeWidth={2.2} aria-hidden="true" />
          </a>
        )}
        {ghost ? (
          <span className="pc-nav__menu">
            <span className="pc-nav__menu-ring" />
          </span>
        ) : (
          <button
            type="button"
            className={`pc-nav__menu ${menuOpen ? 'pc-nav__menu--open' : ''}`}
            onClick={onToggleMenu}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="pc-menu"
          >
            <span className="pc-nav__menu-ring" />
          </button>
        )}
      </div>
    </header>
  )
}

interface MenuProps {
  open: boolean
  onClose: () => void
}

export const ConsultingMenu = forwardRef<HTMLDivElement, MenuProps>(function ConsultingMenu({ open, onClose }, ref) {
  return (
    <div id="pc-menu" className="pc-menu" ref={ref} inert={!open} aria-hidden={!open} role="dialog" aria-label="Menu">
      <div className="pc-menu__top">
        <nav className="pc-menu__links" aria-label="Consulting pages">
          {PAGE_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="pc-menu__link" onClick={onClose}>
              {l.label}
              <span className="pc-menu__underline" aria-hidden="true" />
            </Link>
          ))}
          <Link to="/" className="pc-menu__link" onClick={onClose}>
            UBLDA home
            <span className="pc-menu__underline" aria-hidden="true" />
          </Link>
        </nav>
        <DotButton href={CONTACT_MAILTO} className="pc-menu__cta pc-dotbtn--big" onClick={onClose}>
          start a conversation
        </DotButton>
      </div>
      <div className="pc-menu__bottom">
        <div className="pc-menu__social">
          {SOCIAL.map((s) => (
            <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer" className="pc-line">
              {s.label}
              <NewTab />
            </a>
          ))}
        </div>
        <div className="pc-menu__btns">
          <DotButton href={CONSULTING_FORM_URL} external onClick={onClose}>
            Apply for Fall 2026
          </DotButton>
          <DotButton to="/join" onClick={onClose}>
            Join UBLDA
          </DotButton>
        </div>
      </div>
    </div>
  )
})

export function ConsultingFooter() {
  return (
    <footer className="pc-footer">
      <div className="pc-footer__top">
        <Link to="/" className="pc-footer__logo" aria-label="UBLDA home">
          <img src="/logo-mark.svg" alt="" width="40" height="40" />
        </Link>
        <div className="pc-footer__cols">
          <div className="pc-footer__col">
            {PAGE_LINKS.map((l) => (
              <Link key={l.to} to={l.to}>
                {l.label.toUpperCase()}
              </Link>
            ))}
            <Link to="/">UBLDA HOME</Link>
          </div>
          <div className="pc-footer__col pc-footer__col--social">
            {SOCIAL.map((s) => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer">
                {s.label.toUpperCase()}
                <NewTab />
              </a>
            ))}
            <Link to="/about">ABOUT</Link>
            <Link to="/events">EVENTS</Link>
            <Link to="/join">JOIN</Link>
          </div>
          <div className="pc-footer__col pc-footer__col--contact">
            <p className="pc-footer__big">Partner with us</p>
            {LEADERS.map((p) => (
              <p key={p.email} className="pc-footer__person">
                <span className="pc-footer__small">
                  {p.name} &middot; {p.role}
                </span>
                <a href={`mailto:${p.email}`} className="pc-footer__big pc-line">
                  {p.email}
                </a>
              </p>
            ))}
            <p className="pc-footer__person">
              <span className="pc-footer__small">Prefer a form?</span>
              <a href={CONSULTING_FORM_URL} target="_blank" rel="noopener noreferrer" className="pc-footer__big pc-line">
                ublda.org/apply
                <NewTab />
              </a>
            </p>
          </div>
        </div>
      </div>
      <div className="pc-footer__bottom">
        <div className="pc-footer__legal">
          <a href="mailto:cooperry@umich.edu?subject=Accessibility%20support" className="pc-footer__small">
            Accessibility support
          </a>
          <span className="pc-footer__small pc-footer__legal-mid">University of Michigan</span>
          <span className="pc-footer__small">Stephen M. Ross School of Business</span>
        </div>
        <span className="pc-footer__small">&copy; {new Date().getFullYear()} UBLDA Consulting</span>
      </div>
    </footer>
  )
}
