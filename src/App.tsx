import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useTabEasterEgg } from './hooks/useTabEasterEgg'
import Nav from './components/Nav'
import Footer from './components/Footer'
import RequireRole from './components/RequireRole'
import { MemberAuthProvider } from './hooks/useMemberAuth'
import Home from './pages/Home'
import About from './pages/About'
import Events from './pages/Events'
import Team from './pages/Team'
import Join from './pages/Join'
import Links from './pages/Links'
import Brand from './pages/Brand'
import InterviewerAvailability from './pages/InterviewerAvailability'
import InterviewBooking from './pages/InterviewBooking'
import SignIn from './pages/SignIn'
import ConsultingPrivate from './pages/ConsultingPrivate'
import HousingIntelligence from './pages/HousingIntelligence'
import AdminShell, { DashboardIndexRedirect } from './pages/admin/AdminShell'
import AdminOverview from './pages/admin/AdminOverview'
import AdminRecruiting from './pages/admin/AdminRecruiting'
import AdminRoster from './pages/admin/AdminRoster'
import AdminEvents from './pages/admin/AdminEvents'
import AdminCheckIn from './pages/admin/AdminCheckIn'
import AdminBroadcast from './pages/admin/AdminBroadcast'
import AdminConsole from './pages/admin/AdminConsole'
import MemberShell from './pages/member/MemberShell'
import MemberHome from './pages/member/MemberHome'
import MemberEvents from './pages/member/MemberEvents'
import MemberEventDetail from './pages/member/MemberEventDetail'
import MemberResources from './pages/member/MemberResources'
import MemberProfile from './pages/member/MemberProfile'
import MemberAccess from './pages/member/MemberAccess'

/**
 * Prefix-matched, because these surfaces now nest. Exact equality breaks the
 * moment a route has children: `/dashboard/recruiting` would render the
 * marketing nav on top of the admin shell (spec §2).
 */
const STANDALONE_PREFIXES = ['/links', '/dashboard', '/members', '/housing-intelligence', '/housing', '/private/consulting']

/** The two portal shells own their own chrome, including their own skip links. */
const PORTAL_PREFIXES = ['/dashboard', '/members']

const matchesPrefix = (pathname: string, prefixes: string[]) => (
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
)

const ADMIN_ROLES = ['exec', 'super-admin'] as const

/**
 * Inside the portal, focus management replaces scroll restoration (spec §7).
 * Left in place it would fire `window.scrollTo(0, 0)` on every tab switch and
 * fight the route-change focus move.
 */
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
  const hideMarketingChrome = inStandalone
  // `/links` has a <main> with no id, and the portal's <main> is `#portal-main`
  // with its own skip links above it. Everywhere else the global link has a
  // real `#main-content` target — including `/housing-intelligence` and
  // `/private/consulting`, which used to lose it (a 2.4.1 failure).
  const hideGlobalSkipLink = pathname === '/links' || matchesPrefix(pathname, PORTAL_PREFIXES)
  useTabEasterEgg()

  return (
    <MemberAuthProvider>
      {!hideGlobalSkipLink && (
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
      )}
      {!hideMarketingChrome && <Nav />}
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
        <Route path="/signin" element={<SignIn />} />

        <Route
          path="/dashboard"
          element={(
            <RequireRole roles={[...ADMIN_ROLES]} redirectTo="/members">
              <AdminShell />
            </RequireRole>
          )}
        >
          <Route index element={<DashboardIndexRedirect />} />
          <Route path="overview" element={<AdminOverview />} />
          <Route
            path="recruiting"
            element={(
              <RequireRole anyScope={['recruiting']} redirectTo="/dashboard/overview">
                <AdminRecruiting />
              </RequireRole>
            )}
          />
          <Route
            path="roster"
            element={(
              <RequireRole anyScope={['members']} redirectTo="/dashboard/overview">
                <AdminRoster />
              </RequireRole>
            )}
          />
          <Route
            path="events"
            element={(
              <RequireRole anyScope={['events']} redirectTo="/dashboard/overview">
                <AdminEvents />
              </RequireRole>
            )}
          />
          <Route
            path="events/:eventId/check-in"
            element={(
              <RequireRole anyScope={['events']} redirectTo="/dashboard/overview">
                <AdminCheckIn />
              </RequireRole>
            )}
          />
          <Route
            path="broadcast"
            element={(
              <RequireRole anyScope={['announcements', 'resources']} redirectTo="/dashboard/overview">
                <AdminBroadcast />
              </RequireRole>
            )}
          />
          <Route
            path="console"
            element={(
              <RequireRole roles={['super-admin']} redirectTo="/dashboard/overview">
                <AdminConsole />
              </RequireRole>
            )}
          />
          <Route path="*" element={<Navigate to="/dashboard/overview" replace />} />
        </Route>

        <Route
          path="/members"
          element={(
            <RequireRole>
              <MemberShell />
            </RequireRole>
          )}
        >
          <Route index element={<Navigate to="/members/home" replace />} />
          <Route path="home" element={<MemberHome />} />
          <Route path="events" element={<MemberEvents />} />
          <Route path="events/:eventId" element={<MemberEventDetail />} />
          <Route path="resources" element={<MemberResources />} />
          <Route path="profile" element={<MemberProfile />} />
          <Route path="profile/access" element={<MemberAccess />} />
          <Route path="*" element={<Navigate to="/members/home" replace />} />
        </Route>

        <Route path="/housing-intelligence" element={<HousingIntelligence />} />
        <Route path="/housing" element={<HousingIntelligence />} />
        <Route path="/links" element={<Links />} />
        <Route path="/brand" element={<Brand />} />
        <Route
          path="/private/consulting"
          element={(
            <RequireRole roles={[...ADMIN_ROLES]} redirectTo="/members">
              <ConsultingPrivate />
            </RequireRole>
          )}
        />
      </Routes>
      {!hideMarketingChrome && <Footer />}
    </MemberAuthProvider>
  )
}
