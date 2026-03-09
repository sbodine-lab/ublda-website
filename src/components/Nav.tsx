import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import './Nav.css'

const links = [
  { label: 'About', path: '/about' },
  { label: 'Events', path: '/events' },
  { label: 'Team', path: '/team' },
]

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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location])

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
              className={`nav__link ${location.pathname === link.path ? 'nav__link--active' : ''}`}
            >
              <NavLetters text={link.label} />
            </Link>
          ))}
        </nav>

        <Link to="/join" className="nav__cta">
          Join Us
        </Link>

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
              >
                {link.label}
              </Link>
            ))}
            <Link to="/join" className="nav__mobile-cta">
              Join Us
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
