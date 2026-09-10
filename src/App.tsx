import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import Nav from './components/Nav'
import AnnouncementBanner from './components/AnnouncementBanner'
import { CONSULTING_FORM_URL } from './lib/forms'
import Footer from './components/Footer'
import Home from './pages/Home'
import Table from './pages/Table'
import { useTabEasterEgg } from './hooks/useTabEasterEgg'

const About = lazy(() => import('./pages/About'))
const Events = lazy(() => import('./pages/Events'))
const Team = lazy(() => import('./pages/Team'))
const ShaderStudy = import.meta.env.DEV ? lazy(() => import('./pages/consulting/ShaderStudy')) : null
const Consulting = lazy(() => import('./pages/Consulting'))
const ConsultingPractice = lazy(() => import('./pages/consulting/Practice'))
const ConsultingLeadership = lazy(() => import('./pages/consulting/Leadership'))
const ConsultingWork = lazy(() => import('./pages/consulting/Work'))
const ConsultingServices = lazy(() => import('./pages/consulting/Services'))
const ConsultingPartners = lazy(() => import('./pages/consulting/Partners'))
const ConsultingContact = lazy(() => import('./pages/consulting/Contact'))
const Join = lazy(() => import('./pages/Join'))
const Unsubscribe = lazy(() => import('./pages/Unsubscribe'))
const Links = lazy(() => import('./pages/Links'))
const Brand = lazy(() => import('./pages/Brand'))
const HousingIntelligence = lazy(() => import('./pages/HousingIntelligence'))
const CraftNight = lazy(() => import('./pages/CraftNight'))
const BbaMtcShifts = lazy(() => import('./pages/BbaMtcShifts'))

const DecisionCenterEntry = lazy(() => (
  import('./features/decisions/DecisionCenterEntry').then((module) => ({
    default: module.DecisionCenterEntry,
  }))
))

/** Pages that own their full-bleed chrome and skip the marketing nav and footer. */
const STANDALONE_PREFIXES = ['/links', '/table', '/table.html', '/housing-intelligence', '/housing', '/consulting', '/advisory', '/craft-night', '/mtc']
const DECISION_PREFIXES = ['/auth/callback', '/workspace', '/decision', '/decisions', '/d', '/results', '/schedule', '/scheduling', '/s', '/calendar', '/projects', '/people', '/leadership/speakers', '/speaker-ops', '/operations', '/signin', '/dashboard', '/members']

const matchesPrefix = (pathname: string, prefixes: string[]) => (
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
)

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to)
  }, [to])
  return null
}

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
      {!inStandalone && pathname !== '/unsubscribe' && <AnnouncementBanner />}
      {!inStandalone && <Nav />}
      <ScrollToTop enabled={!inStandalone} />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/events" element={<Events />} />
          <Route path="/team" element={<Team />} />
          {ShaderStudy && <Route path="/consulting/shader-study" element={<ShaderStudy />} />}
          <Route path="/consulting" element={<Consulting />} />
          <Route path="/consulting/practice" element={<ConsultingPractice />} />
          <Route path="/consulting/leadership" element={<ConsultingLeadership />} />
          <Route path="/consulting/work" element={<ConsultingWork />} />
          <Route path="/consulting/services" element={<ConsultingServices />} />
          <Route path="/consulting/partners" element={<ConsultingPartners />} />
          <Route path="/consulting/contact" element={<ConsultingContact />} />
          {/* The consulting arm used to live at /advisory; keep old links working. */}
          <Route path="/advisory" element={<Navigate to="/consulting" replace />} />
          <Route path="/join" element={<Join />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/apply" element={<ExternalRedirect to={CONSULTING_FORM_URL} />} />
          <Route path="/housing-intelligence" element={<HousingIntelligence />} />
          <Route path="/housing" element={<HousingIntelligence />} />
          <Route path="/links" element={<Links />} />
          <Route path="/craft-night" element={<CraftNight />} />
          <Route path="/mtc" element={<BbaMtcShifts />} />
          <Route path="/brand" element={<Brand />} />
        {/* Self-serve screen for the laptop at recruiting tables. */}
        <Route path="/table" element={<Table />} />
        <Route path="/table.html" element={<Table />} />
          {/* Unknown retired URLs and typos land on home rather than a blank page. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      {!inStandalone && <Footer />}
    </>
  )
}
