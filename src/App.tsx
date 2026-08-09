import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useTabEasterEgg } from './hooks/useTabEasterEgg'
import Nav from './components/Nav'
import Footer from './components/Footer'
import Home from './pages/Home'
import About from './pages/About'
import Events from './pages/Events'
import Team from './pages/Team'
import Join from './pages/Join'
import Links from './pages/Links'
import Brand from './pages/Brand'
import InterviewerAvailability from './pages/InterviewerAvailability'
import InterviewBooking from './pages/InterviewBooking'
import HousingIntelligence from './pages/HousingIntelligence'

/** Pages that own their full-bleed chrome and skip the marketing nav and footer. */
const STANDALONE_PREFIXES = ['/links', '/housing-intelligence', '/housing']

const matchesPrefix = (pathname: string, prefixes: string[]) => (
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
)

function ScrollToTop({ enabled }: { enabled: boolean }) {
  const { pathname } = useLocation()
  useEffect(() => {
    if (!enabled) return
    window.scrollTo(0, 0)
  }, [enabled, pathname])
  return null
}

export default function App() {
  const { pathname } = useLocation()
  const inStandalone = matchesPrefix(pathname, STANDALONE_PREFIXES)
  // `/links` has a <main> with no id; everywhere else the global link has a real
  // `#main-content` target, including `/housing-intelligence`.
  const hideGlobalSkipLink = pathname === '/links'
  useTabEasterEgg()

  return (
    <>
      {!hideGlobalSkipLink && (
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
      )}
      {!inStandalone && <Nav />}
      <ScrollToTop enabled={!inStandalone} />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/events" element={<Events />} />
        <Route path="/team" element={<Team />} />
        <Route path="/join" element={<Join />} />
        <Route path="/apply" element={<InterviewBooking />} />
        <Route path="/portal" element={<InterviewBooking />} />
        <Route path="/interview-signup" element={<InterviewBooking />} />
        <Route path="/interview-booking" element={<InterviewBooking />} />
        <Route path="/interviewer-availability" element={<InterviewerAvailability />} />
        <Route path="/eboard-availability" element={<InterviewerAvailability />} />
        <Route path="/housing-intelligence" element={<HousingIntelligence />} />
        <Route path="/housing" element={<HousingIntelligence />} />
        <Route path="/links" element={<Links />} />
        <Route path="/brand" element={<Brand />} />
        {/* Retired portal URLs (/dashboard, /members, /signin) and typos land on home
            rather than a blank page. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!inStandalone && <Footer />}
    </>
  )
}
