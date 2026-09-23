import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import Nav from './components/Nav'
import AnnouncementBanner from './components/AnnouncementBanner'
import { REMOVAL_FORM_URL } from './lib/forms'
import Footer from './components/Footer'
const Home = lazy(() => import('./pages/Home'))
const EquatorSite = lazy(() => import('./features/equator/EquatorSite'))
const Table = lazy(() => import('./pages/Table'))
import { useTabEasterEgg } from './hooks/useTabEasterEgg'

const About = lazy(() => import('./pages/About'))
const Events = lazy(() => import('./pages/Events'))
const Team = lazy(() => import('./pages/Team'))
const ShaderStudy = import.meta.env.DEV ? lazy(() => import('./pages/consulting/ShaderStudy')) : null
const ConsultingApplications = lazy(() => import('./pages/consulting/Applications'))
const Consulting = lazy(() => import('./pages/Consulting'))
const ConsultingPractice = lazy(() => import('./pages/consulting/Practice'))
const ConsultingLeadership = lazy(() => import('./pages/consulting/Leadership'))
const ConsultingWork = lazy(() => import('./pages/consulting/Work'))
const ConsultingServices = lazy(() => import('./pages/consulting/Services'))
const ConsultingPartners = lazy(() => import('./pages/consulting/Partners'))
const ConsultingContact = lazy(() => import('./pages/consulting/Contact'))
const ConsultingInsights = lazy(() => import('./pages/consulting/StudioPages').then(m => ({ default: m.StudioInsights })))
const ConsultingInsight = lazy(() => import('./pages/consulting/StudioPages').then(m => ({ default: m.StudioInsight })))
const ConsultingServiceDetail = lazy(() => import('./pages/consulting/StudioPages').then(m => ({ default: m.StudioServiceDetail })))
const Join = lazy(() => import('./pages/Join'))
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
const STANDALONE_PREFIXES = ['/apply', '/links', '/table', '/table.html', '/housing-intelligence', '/housing', '/consulting', '/advisory', '/craft-night', '/mtc']
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
  // Public club and Consulting pages use local fonts. Fetch the older Google
  // font families only for routes that actually use them (workspace, table, etc.).
  const publicPage = ['/', '/about', '/events', '/team', '/join', '/brand', '/links'].includes(pathname)
  const consultingPage = matchesPrefix(pathname, ['/consulting', '/advisory'])
  useTabEasterEgg(!publicPage && !consultingPage)
  useEffect(() => {
    if (publicPage || consultingPage || document.getElementById('legacy-fonts')) return
    const stylesheet = document.createElement('link')
    stylesheet.id = 'legacy-fonts'
    stylesheet.rel = 'stylesheet'
    stylesheet.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@500;600&family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@300..700&display=swap'
    document.head.append(stylesheet)
  }, [publicPage, consultingPage])
  const inStandalone = matchesPrefix(pathname, STANDALONE_PREFIXES)
  const inDecisionCenter = matchesPrefix(pathname, DECISION_PREFIXES)
  // `/links` has a <main> with no id; everywhere else the global link has a real
  // `#main-content` target, including `/housing-intelligence`.
  const hideGlobalSkipLink = pathname === '/links'
  // The club design is scoped to public pages; Consulting and operations retain their own UI.
  if (pathname === '/unsubscribe') return <ExternalRedirect to={REMOVAL_FORM_URL} />
  if (publicPage) {
    return <Suspense fallback={<PageFallback />}><EquatorSite /></Suspense>
  }
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
      {!inStandalone && <AnnouncementBanner />}
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
          <Route path="/consulting/apply" element={<ConsultingApplications />} />
          <Route path="/consulting/practice" element={<ConsultingPractice />} />
          <Route path="/consulting/leadership" element={<ConsultingLeadership />} />
          <Route path="/consulting/work" element={<ConsultingWork />} />
          <Route path="/consulting/services" element={<ConsultingServices />} />
          <Route path="/consulting/services/:service" element={<ConsultingServiceDetail />} />
          <Route path="/consulting/insights" element={<ConsultingInsights />} />
          <Route path="/consulting/insights/:insight" element={<ConsultingInsight />} />
          <Route path="/consulting/partners" element={<ConsultingPartners />} />
          <Route path="/consulting/contact" element={<ConsultingContact />} />
          {/* The consulting arm used to live at /advisory; keep old links working. */}
          <Route path="/advisory" element={<Navigate to="/consulting" replace />} />
          <Route path="/join" element={<Join />} />
          <Route path="/apply" element={<Navigate to="/consulting/apply" replace />} />
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
