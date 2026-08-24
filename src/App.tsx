import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import Nav from './components/Nav'
import Footer from './components/Footer'
import Home from './pages/Home'
import { useTabEasterEgg } from './hooks/useTabEasterEgg'

const About = lazy(() => import('./pages/About'))
const Events = lazy(() => import('./pages/Events'))
const Team = lazy(() => import('./pages/Team'))
const Advisory = lazy(() => import('./pages/Advisory'))
const Join = lazy(() => import('./pages/Join'))
const Links = lazy(() => import('./pages/Links'))
const Brand = lazy(() => import('./pages/Brand'))
const HousingIntelligence = lazy(() => import('./pages/HousingIntelligence'))
const CraftNight = lazy(() => import('./pages/CraftNight'))

const DecisionCenterEntry = lazy(() => (
  import('./features/decisions/DecisionCenterEntry').then((module) => ({
    default: module.DecisionCenterEntry,
  }))
))

/** Pages that own their full-bleed chrome and skip the marketing nav and footer. */
const STANDALONE_PREFIXES = ['/links', '/housing-intelligence', '/housing', '/advisory', '/craft-night']
const DECISION_PREFIXES = ['/auth/callback', '/workspace', '/decision', '/decisions', '/d', '/results', '/schedule', '/scheduling', '/s', '/calendar', '/projects', '/people', '/leadership/speakers', '/speaker-ops', '/operations', '/signin', '/dashboard', '/members']

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

function PageFallback() {
  return (
    <main id="main-content" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <p>Opening page…</p>
    </main>
  )
}

export default function App() {
  const { pathname } = useLocation()
  useTabEasterEgg()
  const inStandalone = matchesPrefix(pathname, STANDALONE_PREFIXES)
  const inDecisionCenter = matchesPrefix(pathname, DECISION_PREFIXES)
  // `/links` has a <main> with no id; everywhere else the global link has a real
  // `#main-content` target, including `/housing-intelligence`.
  const hideGlobalSkipLink = pathname === '/links'
  if (inDecisionCenter) {
    return (
      <>
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
        <ScrollToTop enabled />
        <Suspense fallback={(
          <main id="main-content" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
            <p>Opening Decision Center…</p>
          </main>
        )}>
          <DecisionCenterEntry />
        </Suspense>
      </>
    )
  }

  return (
    <>
      {!hideGlobalSkipLink && (
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
      )}
      {!inStandalone && <Nav />}
      <ScrollToTop enabled={!inStandalone} />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/events" element={<Events />} />
          <Route path="/team" element={<Team />} />
          <Route path="/advisory" element={<Advisory />} />
          <Route path="/join" element={<Join />} />
          <Route path="/housing-intelligence" element={<HousingIntelligence />} />
          <Route path="/housing" element={<HousingIntelligence />} />
          <Route path="/links" element={<Links />} />
          <Route path="/craft-night" element={<CraftNight />} />
          <Route path="/brand" element={<Brand />} />
          {/* Unknown retired URLs and typos land on home rather than a blank page. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {!inStandalone && <Footer />}
    </>
  )
}
