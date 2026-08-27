import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './Nav.css'

const publicLinks = [
  { label: 'About', path: '/about' },
  { label: 'Events', path: '/events' },
  { label: 'Team', path: '/team' },
  { label: 'Consulting', path: '/consulting' },
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
  const links = publicLinks
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
          <img src="/logo-64.png" alt="UBLDA" className="nav__logo-img" width="63" height="64" />
          <span className="nav__logo-text">
            <NavLetters text="UBLDA" />
          </span>
        </Link>

        <nav className="nav__links">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`nav__link ${link.path === '/consulting' ? 'nav__link--advisory' : ''} ${isCurrent(link.path) ? 'nav__link--active' : ''}`}
              aria-current={isCurrent(link.path) ? 'page' : undefined}
              onClick={() => setMobileOpen(false)}
            >
              <NavLetters text={link.label} />
            </Link>
          ))}
        </nav>

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

      {mobileOpen && (
          <div className="nav__mobile">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`nav__mobile-link ${link.path === '/consulting' ? 'nav__mobile-link--advisory' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
                {link.path === '/consulting' && <span aria-hidden="true"> ↗</span>}
              </Link>
            ))}
          </div>
      )}
    </header>
  )
}
