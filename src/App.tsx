import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Nav from './components/Nav'
import Footer from './components/Footer'
import AnnouncementBanner from './components/AnnouncementBanner'
import Home from './pages/Home'
import About from './pages/About'
import Events from './pages/Events'
import Team from './pages/Team'
import Join from './pages/Join'
import Links from './pages/Links'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { pathname } = useLocation()
  const isStandalone = pathname === '/links'

  return (
    <>
      {!isStandalone && (
        <a href="#main-content" className="skip-nav">
          Skip to main content
        </a>
      )}
      {!isStandalone && <AnnouncementBanner />}
      {!isStandalone && <Nav />}
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/events" element={<Events />} />
        <Route path="/team" element={<Team />} />
        <Route path="/join" element={<Join />} />
        <Route path="/links" element={<Links />} />
      </Routes>
      {!isStandalone && <Footer />}
    </>
  )
}
