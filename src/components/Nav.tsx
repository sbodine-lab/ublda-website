import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useMemberAuth } from '../hooks/useMemberAuth'
import './Nav.css'

const publicLinks = [
  { label: 'About', path: '/about' },
  { label: 'Events', path: '/events' },
  { label: 'Team', path: '/team' },
]

/**
 * The portal link has to match the signed-in person's face, or a member hits a
 * guard redirect on every click: `/dashboard` bounces them to `/members` (spec
 * §2). An exec goes to the admin shell; everyone else goes to the member shell.
 */
const linksFor = (signedIn: boolean, isAdmin: boolean) => (
  signedIn
    ? [...publicLinks, { label: 'Dashboard', path: isAdmin ? '/dashboard' : '/members' }]
    : publicLinks
)

function NavLetters({ text }: { text: string }) {
  return (
    <>
      {text.split('').map((char, i) => (
        <span
          key={i}
          className="nav__letter"
          style={{ '--i': i } as React.CSSProperties}
        >
          {char}
        </span>
      ))}
    </>
  )
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { status, isAdmin, signOut } = useMemberAuth()
  const signedIn = status === 'signed-in'
  const links = linksFor(signedIn, isAdmin)
  const isCurrent = (path: string) => (
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  )

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.classList.add('nav-open')
    } else {
      document.body.classList.remove('nav-open')
    }
    return () => document.body.classList.remove('nav-open')
  }, [mobileOpen])

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''}`}>
      <div className="nav__inner container">
        <Link to="/" className="nav__logo">
          <img src="/logo.png" alt="UBLDA" className="nav__logo-img" />
          <span className="nav__logo-text">
            <NavLetters text="UBLDA" />
          </span>
        </Link>

        <nav className="nav__links">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`nav__link ${isCurrent(link.path) ? 'nav__link--active' : ''}`}
              aria-current={isCurrent(link.path) ? 'page' : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <NavLetters text={link.label} />
            </Link>
          ))}
        </nav>

        {signedIn ? (
          <button type="button" className="nav__cta nav__cta--button" onClick={signOut}>
            Sign Out
          </button>
        ) : (
          <Link to="/signin" className="nav__cta">
            Sign In
          </Link>
        )}

        <button
          className={`nav__burger ${mobileOpen ? 'nav__burger--open' : ''}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <span />
          <span />
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="nav__mobile"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="nav__mobile-link"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {signedIn ? (
              <button
                type="button"
                className="nav__mobile-cta nav__mobile-cta--button"
                onClick={() => {
                  signOut()
                  setMobileOpen(false)
                }}
              >
                Sign Out
              </button>
            ) : (
              <Link to="/signin" className="nav__mobile-cta" onClick={() => setMobileOpen(false)}>
                Sign In
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
