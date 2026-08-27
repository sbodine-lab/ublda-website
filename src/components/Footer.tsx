import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <p className="footer__intro">Where disability and business meet.</p>
            <p className="footer__tagline">
              Built by students at Michigan Ross.
            </p>
            <Link to="/join" className="footer__cta">
              Join UBLDA
              <ArrowRight aria-hidden="true" size={14} strokeWidth={1.5} />
            </Link>
          </div>

          <div className="footer__grid">
            <div className="footer__col">
              <h4 className="footer__heading">Navigate</h4>
              <Link to="/about" className="footer__link">About</Link>
              <Link to="/events" className="footer__link">Events</Link>
              <Link to="/team" className="footer__link">Team</Link>
              <Link to="/consulting" className="footer__link">Consulting</Link>
              <Link to="/join" className="footer__link">Join Us</Link>
            </div>

            <div className="footer__col">
              <h4 className="footer__heading">Connect</h4>
              <a href="mailto:sbodine@umich.edu,atchiang@umich.edu,cooperry@umich.edu" className="footer__link">Email us</a>
              <a href="https://www.instagram.com/michiganublda/" target="_blank" rel="noopener noreferrer" className="footer__link footer__link--social">
                Instagram
              </a>
              <a href="https://www.linkedin.com/company/ublda/" target="_blank" rel="noopener noreferrer" className="footer__link footer__link--social">
                LinkedIn
              </a>
            </div>
          </div>
        </div>

        <div className="footer__brand-mark" aria-hidden="true">
          <span>UBLDA</span>
        </div>

        <div className="footer__bottom">
          <p>&copy; {new Date().getFullYear()} UBLDA</p>
          <p className="footer__affiliation">
            University of Michigan &middot; Stephen M. Ross School of Business
          </p>
          <div className="footer__utility">
            <a href="mailto:sbodine@umich.edu,atchiang@umich.edu,cooperry@umich.edu" className="footer__a11y-link">Accessibility support</a>
            <Link to="/workspace" className="footer__leadership-link">
              Leadership login
              <ArrowRight aria-hidden="true" size={12} strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
