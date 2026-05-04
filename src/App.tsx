import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useTabEasterEgg } from './hooks/useTabEasterEgg'
import Nav from './components/Nav'
import Footer from './components/Footer'
import { MemberAuthProvider } from './hooks/useMemberAuth'
import Home from './pages/Home'
import About from './pages/About'
import Events from './pages/Events'
import Team from './pages/Team'
import Join from './pages/Join'
import Links from './pages/Links'
import Brand from './pages/Brand'
import Apply from './pages/Apply'
import InterviewerAvailability from './pages/InterviewerAvailability'
import SignIn from './pages/SignIn'
import Dashboard from './pages/Dashboard'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { pathname } = useLocation()
  const isStandalone = pathname === '/links' || pathname === '/dashboard' || pathname === '/members'
  useTabEasterEgg()

  return (
    <MemberAuthProvider>
      {!isStandalone && (
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
      )}
      {!isStandalone && <Nav />}
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/events" element={<Events />} />
        <Route path="/team" element={<Team />} />
        <Route path="/join" element={<Join />} />
        <Route path="/apply" element={<Apply />} />
        <Route path="/portal" element={<Apply />} />
        <Route path="/interviewer-availability" element={<InterviewerAvailability />} />
        <Route path="/eboard-availability" element={<InterviewerAvailability />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/members" element={<Dashboard />} />
        <Route path="/links" element={<Links />} />
        <Route path="/brand" element={<Brand />} />
      </Routes>
      {!isStandalone && <Footer />}
    </MemberAuthProvider>
  )
}
