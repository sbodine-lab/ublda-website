import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useReducedMotion } from 'framer-motion'
import { MeshGradient } from '@paper-design/shaders-react'
import Lenis from 'lenis'
import { Mail } from 'lucide-react'
import './Consulting.css'

const SHADER_COLORS = ['#0B1F2F', '#14374E', '#2BBAB0', '#091E2A']

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

const benefits = [
  {
    title: 'Grow your audience',
    desc: 'One in four American adults has a disability. Serve them well and you reach customers, donors, and members your competitors overlook.',
  },
  {
    title: 'Open up your digital front door',
    desc: 'Your website and apps are where most people meet you. We work with your team on the parts that shut disabled visitors out.',
  },
  {
    title: 'Reach every reader',
    desc: 'Your PDFs, decks, and newsletters should land the same way for a blind reader as a sighted one. We help you get them there.',
  },
  {
    title: 'Get ahead of the problem',
    desc: 'Barriers are cheaper to fix before someone has to complain about them. We help you find yours early.',
  },
  {
    title: 'Hire inclusively',
    desc: 'Job postings, interviews, and onboarding turn disabled candidates away in ways most teams never see. We help you spot yours.',
  },
  {
    title: 'Build lasting capability',
    desc: 'We would rather teach your team to catch issues than be the only ones who can. The fixes should outlast us.',
  },
]

const services = [
  {
    name: 'Websites & Apps',
    desc: 'A structured review of where your digital experience breaks down for disabled visitors.',
  },
  {
    name: 'Documents & Communications',
    desc: 'PDFs, presentations, and campaigns, reworked so they hold up for the people receiving them.',
  },
  {
    name: 'Events & Programs',
    desc: 'Venues, accommodation planning, and materials, thought through from the invitation onward.',
  },
  {
    name: 'Hiring & Workplace Practices',
    desc: 'A close look at recruiting and onboarding, and the barriers hiding inside them.',
  },
  {
    name: 'Training & Enablement',
    desc: 'Workshops that leave your staff able to build accessible work on their own.',
  },
]

const leaders = [
  {
    name: 'Sam Bodine',
    role: 'Co-President',
    location: 'Ann Arbor',
    initials: 'SB',
    linkedin: 'https://www.linkedin.com/in/samuelbodine/',
    email: 'sbodine@umich.edu',
  },
  {
    name: 'Alexa Chiang',
    role: 'Co-President',
    location: 'Ann Arbor',
    initials: 'AC',
    linkedin: 'https://www.linkedin.com/in/alexa-chiang/',
    email: 'atchiang@umich.edu',
  },
  {
    name: 'Cooper Perry',
    role: 'Executive VP',
    location: 'Ann Arbor',
    initials: 'CP',
    linkedin: 'https://www.linkedin.com/in/cooperry/',
    email: 'cooperry@umich.edu',
  },
  {
    name: 'Solomon DeYoung',
    role: 'VP Outreach & Partnerships',
    location: 'Ann Arbor',
    initials: 'SD',
    linkedin: 'https://www.linkedin.com/in/solomon-deyoung/',
    email: null,
  },
]

/* The Consulting sub-brand runs on its own chrome — separate nav and footer —
   so entering it reads as stepping into a standalone site. The wordmark is
   the way back to the parent site. */
function ConsultingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`adv-nav ${scrolled ? 'adv-nav--scrolled' : ''}`}>
      <div className="adv-nav__inner">
        <Link to="/" className="adv-nav__lockup" aria-label="UBLDA Consulting — return to the main UBLDA site">
          <span className="adv-nav__wordmark">
            <strong>UBLDA</strong>
            <span className="adv-nav__divider" aria-hidden="true" />
            Consulting
          </span>
        </Link>
        <nav className="adv-nav__links" aria-label="Consulting sections">
          <a href="#consulting-recruiting" className="adv-nav__link">Recruiting</a>
          <a href="#consulting-services" className="adv-nav__link">Services</a>
          <a href="#consulting-clients" className="adv-nav__link">Clients</a>
          <a href="#consulting-leaders" className="adv-nav__link">Leaders</a>
        </nav>
        <a
          href="mailto:sbodine@umich.edu?subject=UBLDA%20Consulting%20inquiry"
          className="adv-nav__cta"
        >
          <span className="adv-nav__cta-full">Start a conversation</span>
          <span className="adv-nav__cta-short">Contact</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </a>
      </div>
    </header>
  )
}

function ConsultingFooter() {
  return (
    <footer className="adv-footer">
      <div className="adv-body">
        <div className="adv-footer__grid">
          <div className="adv-footer__brand">
            <span className="adv-footer__wordmark">
              <strong>UBLDA</strong> Consulting
            </span>
            <p className="adv-footer__tagline">
              Accessibility consulting by the Undergraduate Business Leaders
              for Diverse Abilities at Michigan Ross.
            </p>
          </div>
          <div className="adv-footer__col">
            <h4 className="adv-footer__heading">Consulting</h4>
            <a href="#consulting-recruiting" className="adv-footer__link">Recruiting</a>
            <a href="#consulting-services" className="adv-footer__link">Services</a>
            <a href="#consulting-clients" className="adv-footer__link">Clients</a>
            <a href="#consulting-leaders" className="adv-footer__link">Leaders</a>
            <a href="mailto:sbodine@umich.edu?subject=UBLDA%20Consulting%20inquiry" className="adv-footer__link">Contact us</a>
          </div>
          <div className="adv-footer__col">
            <h4 className="adv-footer__heading">UBLDA</h4>
            <Link to="/" className="adv-footer__link">Main site</Link>
            <Link to="/about" className="adv-footer__link">About</Link>
            <Link to="/events" className="adv-footer__link">Events</Link>
            <Link to="/join" className="adv-footer__link">Join us</Link>
          </div>
        </div>
        <div className="adv-footer__bottom">
          <p>&copy; {new Date().getFullYear()} UBLDA Consulting &middot; Part of UBLDA, University of Michigan &middot; Stephen M. Ross School of Business</p>
        </div>
      </div>
    </footer>
  )
}

export default function Consulting() {
  const reducedMotion = useReducedMotion()
  const speed = reducedMotion ? 0 : 0.2

  // Standalone pages skip the app-level ScrollToTop, so land at the hero.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Weighted smooth scrolling, sub-brand pages only. Wheel and touch go
  // through Lenis; keyboard, focus, and find-in-page scrolling stay native,
  // and users who prefer reduced motion keep native scrolling entirely
  // (WCAG 2.3.3).
  useEffect(() => {
    document.documentElement.classList.add('adv-scroll')
    let lenis: Lenis | undefined
    let raf = 0
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.9, anchors: true })
      const loop = (time: number) => {
        lenis?.raf(time)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }
    return () => {
      cancelAnimationFrame(raf)
      lenis?.destroy()
      document.documentElement.classList.remove('adv-scroll')
    }
  }, [])

  return (
    <div className="adv-site">
      <ConsultingNav />
      <main id="main-content" className="adv">
      {/* Full-bleed shader hero, title bottom-left */}
      <section className="adv-hero">
        <div className="adv-hero__media" aria-hidden="true">
          <MeshGradient
            colors={SHADER_COLORS}
            distortion={0.85}
            swirl={0.55}
            speed={speed}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        <div className="adv-hero__lockup">
          <h1 className="adv-hero__title">
            <span className="adv-hero__parent">UBLDA</span><br />
            <span className="adv-hero__sub">Consulting</span>
          </h1>
        </div>
      </section>

      {/* Centered statement band */}
      <section className="adv-statement">
        <div className="adv-statement__media" aria-hidden="true">
          <MeshGradient
            colors={SHADER_COLORS}
            distortion={1.1}
            swirl={0.8}
            speed={speed}
            style={{ width: '100%', height: '100%' }}
          />
        </div>
        <p className="adv-statement__text">We make access hold up in practice</p>
      </section>

      <div className="adv-body">
        {/* Mission */}
        <section className="adv-section">
          <h2 className="adv-h2 adv-h2--accent">
            Our mission,<br />your access
          </h2>
          <p className="adv-lead">
            UBLDA Consulting is the accessibility consulting arm of UBLDA
            at Michigan Ross. We work with organizations on the barriers that
            keep disabled people out of their websites, their documents, their
            events, and their hiring. Our consultants include disabled
            students, which shapes what we notice and what we push on.
          </p>
        </section>

        {/* Fall recruiting */}
        <section className="adv-section" id="consulting-recruiting">
          <h2 className="adv-h2 adv-h2--accent">
            Fall 2026<br />recruiting
          </h2>
          <p className="adv-lead">
            Applications for the Fall 2026 team open Wednesday, September 2
            at noon and close Sunday, September 20. Here is where to find us
            and how joining works.
          </p>

          <h3 className="adv-subhead">Meet us on campus</h3>
          <ul className="adv-events">
            <li className="adv-event">
              <span className="adv-event__when">Wed, Sep 2 &middot; 3&ndash;5 PM</span>
              <div>
                <h4 className="adv-event__name">Festifall Central</h4>
                <p className="adv-event__where">The Diag &middot; Table C43</p>
              </div>
            </li>
            <li className="adv-event">
              <span className="adv-event__when">Tue, Sep 8 &middot; 5:30&ndash;7:30 PM</span>
              <div>
                <h4 className="adv-event__name">BBA Meet the Clubs</h4>
                <p className="adv-event__where">Ross School of Business &middot; Winter Garden</p>
              </div>
            </li>
          </ul>

          <h3 className="adv-subhead">How joining works</h3>
          <ol className="adv-steps">
            <li className="adv-step">
              <span className="adv-step__num" aria-hidden="true">01</span>
              <div>
                <h4 className="adv-step__name">
                  Application
                  <span className="adv-step__tag">Sept 2&ndash;20</span>
                </h4>
                <p className="adv-step__note">
                  Opens Wednesday, September 2 at 12 PM ET at <Link to="/apply" className="adv-link">ublda.org/apply</Link>{' '}
                  and takes about ten minutes: two short answers, a resume link
                  if you have one, done. Closes Sunday, September 20 at 11:30 PM ET.
                  Applying also signs you up as a UBLDA member &mdash; one form
                  covers both.
                </p>
              </div>
            </li>
            <li className="adv-step">
              <span className="adv-step__num" aria-hidden="true">02</span>
              <div>
                <h4 className="adv-step__name">Interviews</h4>
                <p className="adv-step__note">
                  Two 30-minute conversations at Ross &mdash; one behavioral, one
                  technical &mdash; September 25&ndash;27. Offers go out by
                  September 29 and the team kicks off the week of October 5.
                </p>
              </div>
            </li>
          </ol>

          <Link to="/apply" className="adv-pill adv-pill--wide">
            Apply for Fall 2026
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        </section>

        {/* Benefits */}
        <section className="adv-section">
          <h2 className="adv-h2 adv-h2--accent">
            Achieve more with<br />an accessible business
          </h2>
          <div className="adv-benefits" role="list">
            {benefits.map((b, i) => (
              <div className="adv-benefit" role="listitem" key={b.title}>
                <span className="adv-benefit__num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="adv-benefit__title">{b.title}</h3>
                  <p className="adv-benefit__desc">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Services */}
        <section className="adv-section" id="consulting-services">
          <h2 className="adv-h2 adv-h2--accent">
            For every barrier,<br />a practical fix
          </h2>
          <p className="adv-lead">
            We shape each engagement around where your organization stands,
            and around what your team can realistically carry forward.
          </p>
          <ul className="adv-services">
            {services.map((s) => (
              <li className="adv-service" key={s.name}>
                <h3 className="adv-service__name">{s.name}</h3>
                <p className="adv-service__desc">{s.desc}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Clients — dark full-width band */}
      <section className="adv-dark" id="consulting-clients">
        <div className="adv-body">
          <h2 className="adv-h2 adv-h2--light">
            Consulting services<br />in action
          </h2>
          <div className="adv-clients">
            <article className="adv-client">
              <div className="adv-client__media" aria-hidden="true">
                <MeshGradient
                  colors={['#14374E', '#2BBAB0', '#0B1F2F', '#D4A034']}
                  distortion={0.8}
                  swirl={0.5}
                  speed={speed}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div className="adv-client__top">
                <h3 className="adv-client__name">The Arc of Colorado</h3>
                <span className="adv-client__tag">First F26 Client</span>
              </div>
              <p className="adv-client__note">
                The Arc of Colorado advocates statewide for people with
                intellectual and developmental disabilities. They are the
                first client of our Fall 2026 cohort.
              </p>
              <a
                href="https://thearcofco.org"
                target="_blank"
                rel="noopener noreferrer"
                className="adv-pill adv-client__pill"
              >
                Learn more<span className="sr-only"> about The Arc of Colorado</span>
              </a>
            </article>
            <article className="adv-client adv-client--open">
              <div className="adv-client__top">
                <h3 className="adv-client__name">Your organization</h3>
              </div>
              <p className="adv-client__note">
                We are taking on a small number of engagements for Fall 2026.
                If you run a nonprofit or community organization, we want to
                hear from you.
              </p>
              <a
                href="mailto:sbodine@umich.edu?subject=UBLDA%20Consulting%20inquiry"
                className="adv-pill adv-client__pill"
              >
                Get in touch
              </a>
            </article>
          </div>
        </div>
      </section>

      <div className="adv-body">
        {/* Leaders */}
        <section className="adv-section" id="consulting-leaders">
          <h2 className="adv-h2 adv-h2--accent">
            Get in touch with<br />our leaders today
          </h2>
          <div className="adv-people">
            {leaders.map((p) => (
              <div className="adv-person" key={p.name}>
                <span className="adv-person__avatar" aria-hidden="true">{p.initials}</span>
                <h3 className="adv-person__name">{p.name}</h3>
                <p className="adv-person__role">{p.role}</p>
                <p className="adv-person__location">{p.location}</p>
                <div className="adv-person__links">
                  <a
                    href={p.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="adv-person__link"
                    aria-label={`${p.name} on LinkedIn`}
                  >
                    <LinkedInIcon />
                  </a>
                  {p.email && (
                    <a
                      href={`mailto:${p.email}`}
                      className="adv-person__link"
                      aria-label={`Email ${p.name}`}
                    >
                      <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Manifesto + facts, in the spirit of boutique studios like MetaLab:
            one confident statement, three concrete numbers, one door in. */}
        <section className="adv-section adv-manifesto">
          <p className="adv-manifesto__text">
            We started UBLDA Consulting because accessibility kept landing last
            on every roadmap. Our consultants live with the consequences.
            We put it first.
          </p>
          <dl className="adv-facts">
            <div className="adv-fact">
              <dt className="adv-fact__label">Who this serves</dt>
              <dd className="adv-fact__value">1 in 4 American adults lives with a disability</dd>
            </div>
            <div className="adv-fact">
              <dt className="adv-fact__label">Who we are</dt>
              <dd className="adv-fact__value">A student-led practice at Michigan Ross</dd>
            </div>
            <div className="adv-fact">
              <dt className="adv-fact__label">Right now</dt>
              <dd className="adv-fact__value">Our Fall 2026 cohort has begun with The Arc of Colorado</dd>
            </div>
          </dl>
          <Link to="/join" className="adv-pill adv-pill--wide">
            Join the consulting team
          </Link>
        </section>
      </div>
      </main>
      <ConsultingFooter />
    </div>
  )
}
