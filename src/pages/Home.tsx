import { MEMBERSHIP_FORM_URL } from '../lib/forms'
import { Link } from 'react-router-dom'
import Reveal, { RevealStagger, RevealChild } from '../components/Reveal'
import {
  APPLY_DEADLINE_AT_MS,
  APPLY_CLOSES_PROSE,
  APPLY_CLOSE_TIME_SHORT,
  APPLY_OPENS_AT_MS,
  APPLY_OPENS_PROSE,
  APPLY_WINDOW_PROSE,
  APPLY_WINDOW_SHORT,
  INTERVIEW_WINDOW_SHORT,
  applyWindow,
} from '../lib/applyForm'
import { useClock } from '../lib/useClock'
import './Home.css'

const pillars = [
  {
    title: 'Advocacy & Community',
    description:
      'Meet students who care about disability inclusion and help plan events that bring that conversation to campus.',
    icon: '01',
  },
  {
    title: 'Career Preparation',
    description:
      'Learn through client projects and workshops on business strategy and accessibility. UBLDA Consulting selects its analyst team through an application and interview.',
    icon: '02',
  },
  {
    title: 'Networking',
    description:
      'Talk with professionals working in disability-focused businesses and connect with MBA students through BLDA at Michigan Ross.',
    icon: '03',
  },
]

const benefits = [
  { label: 'Networking', icon: '→' },
  { label: 'Career Development', icon: '→' },
  { label: 'Speaker Sessions', icon: '→' },
  { label: 'Workshops', icon: '→' },
  { label: 'MBA Connections', icon: '→' },
  { label: 'Hands-on Consulting', icon: '→' },
  { label: 'Community Events', icon: '→' },
  { label: 'Education & Awareness', icon: '→' },
]

const upcoming = [
  {
    title: 'UBLDA Consulting',
    desc: `Our first client is Arc Thrift Stores of Colorado. Consulting applications run ${APPLY_WINDOW_PROSE}; no consulting experience is required.`,
  },
  {
    title: 'Education & Mentorship Plans',
    desc: 'We’re developing business workshops and a peer mentorship program with BLDA’s MBA students. We’ll share details with members as plans are confirmed.',
  },
  {
    title: 'Speaker Series',
    desc: 'Hear from business leaders about disability in their work. Past speakers include Lloyd Lewis of Arc Thrift Stores and Andrew Parker of Nestidd.',
  },
]

const exec = [
  { name: 'Sam Bodine', role: 'Co-President', initials: 'SB', desc: 'Coordinates club strategy and external partnerships.', linkedin: 'https://www.linkedin.com/in/samuelbodine/' },
  { name: 'Alexa Chiang', role: 'Co-President', initials: 'AC', desc: 'Coordinates club planning and relationships at Michigan Ross.', linkedin: 'https://www.linkedin.com/in/alexa-chiang/' },
  { name: 'Cooper Perry', role: 'Executive VP', initials: 'CP', desc: 'Coordinates the executive board and tracks project progress.', linkedin: 'https://www.linkedin.com/in/cooperry/' },
]

const vps = [
  { name: 'Lindsey Ye', role: 'VP of Operations', initials: 'LY', desc: 'Manages meeting logistics and member operations.', linkedin: 'https://www.linkedin.com/in/lindsey-ye/' },
  { name: 'Landon Miller', role: 'VP of Finance', initials: 'LM', desc: 'Manages the budget, funding requests, and reimbursements.', linkedin: 'https://www.linkedin.com/in/landon-miller-064a16258/' },
  { name: 'Alex Forstner', role: 'VP of Education', initials: 'AF', desc: 'Plans educational programming and consulting training.', linkedin: 'https://www.linkedin.com/in/alex-forstner/' },
  { name: 'Samantha Naber', role: 'VP Marketing and Communications', initials: 'SN', desc: 'Manages communications and promotes club events.', linkedin: 'https://www.linkedin.com/in/samanthanaber/' },
  { name: 'Solomon DeYoung', role: 'VP Outreach and Partnerships', initials: 'SD', desc: 'Builds relationships with speakers and prospective project partners.', linkedin: 'https://www.linkedin.com/in/solomon-deyoung/' },
  { name: 'Andrew Sackett', role: 'VP Events and Programming', initials: 'AS', desc: 'Organizes club events and coordinates program logistics.', linkedin: 'https://www.linkedin.com/in/andrew-sackett-a1a5662bb/' },
]

const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="person-card__linkedin-icon">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

export default function Home() {
  const applyState = applyWindow(useClock(APPLY_OPENS_AT_MS, APPLY_DEADLINE_AT_MS), APPLY_DEADLINE_AT_MS)
  return (
    <main id="main-content" className="home">
      {/* ─── Hero ─── */}
      <section className="hero">
        <div className="container">
          <div className="hero__content">
            <h1 className="hero__headline hero__entrance hero__entrance--headline">
              Undergraduate Business Leaders for{' '}
              <em className="headline-accent">Diverse Abilities</em>
            </h1>

            <p className="hero__sub hero__entrance hero__entrance--sub">
              UBLDA is a student organization at Michigan Ross focused on disability
              inclusion in business. Join us for speaker events and workshops or
              apply for our pro bono consulting team. All U-M students are welcome.
            </p>

            <div className="hero__actions hero__entrance hero__entrance--actions">
              <a href={MEMBERSHIP_FORM_URL} className="btn-flip">
                <span className="btn-flip__inner">
                  <span className="btn-flip__front">
                    Join UBLDA
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <span className="btn-flip__back">
                    Join UBLDA
                  </span>
                </span>
              </a>
            </div>
          </div>
        </div>

        <div className="hero__gradient" aria-hidden="true" />
      </section>

      {/* ─── Mission ─── */}
      <section className="section mission">
        <div className="container">
          <Reveal>
            <h2 className="mission__headline">
              Disability belongs in the conversation about how businesses operate.{' '}
              <em>We bring that conversation to Ross.</em>
            </h2>
          </Reveal>
        </div>
      </section>

      {/* ─── Pillars ─── */}
      <section className="section pillars">
        <div className="container">
          <Reveal>
            <p className="section__label">What We Do</p>
          </Reveal>
          <RevealStagger className="pillars__grid">
            {pillars.map((pillar) => (
              <RevealChild key={pillar.title} className="pillar-card">
                <span className="pillar-card__number">{pillar.icon}</span>
                <h3 className="pillar-card__title">{pillar.title}</h3>
                <p className="pillar-card__desc">{pillar.description}</p>
              </RevealChild>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ─── Partnership + Benefits ─── */}
      <section className="section partnership">
        <div className="container">
          <div className="partnership__layout">
            <div className="partnership__info">
              <Reveal>
                <p className="section__label">Our Network</p>
              </Reveal>
              <Reveal delay={0.1}>
                <h2 className="partnership__headline">
                  Partnered with <em className="headline-accent">BLDA</em> at Ross
                </h2>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="partnership__desc">
                  We're the undergraduate chapter of Business Leaders for Diverse Abilities (BLDA),
                  the MBA disability advocacy organization at Michigan Ross. The connection
                  brings undergraduate and MBA students together around disability in business.
                </p>
              </Reveal>
            </div>
            <div className="partnership__benefits">
              <Reveal delay={0.15}>
                <p className="partnership__benefits-label">Ways to take part</p>
              </Reveal>
              <RevealStagger className="benefits__grid">
                {benefits.map((b) => (
                  <RevealChild key={b.label} className="benefit-tag">
                    {b.label}
                  </RevealChild>
                ))}
              </RevealStagger>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Our Community ─── */}
      <section className="section community">
        <div className="container">
          <Reveal delay={0.1}>
            <h2 className="community__headline">
              Who we work with
            </h2>
          </Reveal>
        </div>
        <div className="community__marquee" aria-label="Partner organizations">
          <div className="community__track">
            {[...Array(4)].map((_, setIndex) => (
              <div className="community__logo-set" key={setIndex} aria-hidden={setIndex > 0}>
                <div className="community__logo-item">
                  <img src="/partners-ross.png" alt="Michigan Ross School of Business" loading="lazy" decoding="async" />
                </div>
                <div className="community__logo-item">
                  <img src="/partners-occb.png" alt="Office of Community, Culture, and Belonging" loading="lazy" decoding="async" />
                </div>
                <div className="community__logo-item">
                  <img src="/partners-blda.webp" alt="Business Leaders for Diverse Abilities" className="community__logo--blda" loading="lazy" decoding="async" />
                </div>
                <div className="community__logo-item">
                  <img src="/partners-nestidd.png" alt="Nestidd" loading="lazy" decoding="async" />
                </div>
                <div className="community__logo-item">
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Fall 2026 ─── */}
      <section className="section upcoming-programs">
        <div className="container">
          <Reveal>
            <p className="section__label">Fall 2026</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="upcoming__headline">
              What we’re <em className="headline-accent">working on.</em>
            </h2>
          </Reveal>
          <RevealStagger className="upcoming__grid">
            {upcoming.map((item) => (
              <RevealChild key={item.title} className="upcoming-card">
                <h3 className="upcoming-card__title">{item.title}</h3>
                <p className="upcoming-card__desc">{item.desc}</p>
              </RevealChild>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ─── Fall Recruiting ─── */}
      <section className="section recruiting-events">
        <div className="container">
          <Reveal>
            <p className="section__label">Fall Recruiting</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="recruiting-events__headline">
              Get involved <em className="headline-accent">this fall.</em>
            </h2>
          </Reveal>
          <RevealStagger className="recruiting-events__grid">
            <RevealChild className="recruiting-event-card">
              <p className="recruiting-event-card__when">Past event &middot; September 2, 2026</p>
              <h3 className="recruiting-event-card__title">Festifall Central</h3>
              <p className="recruiting-event-card__where">The Diag &middot; Table C43</p>
            </RevealChild>
            <RevealChild className="recruiting-event-card">
              <p className="recruiting-event-card__when">Past event &middot; September 8, 2026</p>
              <h3 className="recruiting-event-card__title">BBA Meet the Clubs</h3>
              <p className="recruiting-event-card__where">Ross School of Business &middot; Winter Garden</p>
            </RevealChild>
          </RevealStagger>
          <Reveal delay={0.2}>
            <ol className="recruiting-steps">
              <li className="recruiting-step">
                <span className="recruiting-step__name">Application</span>
                <span className="recruiting-step__detail">{APPLY_WINDOW_SHORT} &middot; {APPLY_CLOSE_TIME_SHORT}</span>
              </li>
              <li className="recruiting-step">
                <span className="recruiting-step__name">Interviews</span>
                <span className="recruiting-step__detail">{INTERVIEW_WINDOW_SHORT} &middot; at Ross</span>
              </li>
            </ol>
          </Reveal>
          <Reveal delay={0.25}>
            <p className="recruiting-events__note">
              {applyState === 'before'
                ? `Applications for the Fall 2026 consulting team open ${APPLY_OPENS_PROSE}.`
                : applyState === 'open'
                  ? `Applications for the Fall 2026 consulting team are open through ${APPLY_CLOSES_PROSE}.`
                  : 'Applications for the Fall 2026 consulting team are closed.'}{' '}
              {/* /apply is a redirect straight out to the Google Form, so the
                  link has to say so rather than promise a details page. */}
              {applyState !== 'closed' && <Link to="/apply" className="recruiting-events__link">
                Open the application form
                <span className="sr-only"> (Google Form, leaves ublda.org)</span>
              </Link>}
              {applyState !== 'closed' && <> &middot; </>}
              <Link to="/consulting" className="recruiting-events__link">Learn about UBLDA Consulting</Link>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── Leadership ─── */}
      <section className="section leadership">
        <div className="container">
          <Reveal>
            <h2 className="leadership__headline">
              Meet our executive board.
            </h2>
          </Reveal>

          <RevealStagger className="leadership__grid">
            {exec.map((person) => (
              <RevealChild key={person.name} className="person-card">
                <div className="person-card__avatar">
                  {person.initials}
                </div>
                <h3 className="person-card__name">{person.name}</h3>
                <p className="person-card__role">{person.role}</p>
                <a href={person.linkedin} target="_blank" rel="noopener noreferrer" className="person-card__linkedin" aria-label={`${person.name} on LinkedIn`}>
                  <LinkedInIcon />
                </a>
              </RevealChild>
            ))}
          </RevealStagger>

          <RevealStagger className="leadership__grid">
            {vps.map((person) => (
              <RevealChild key={person.name} className="person-card">
                <div className="person-card__avatar">
                  {person.initials}
                </div>
                <h3 className="person-card__name">{person.name}</h3>
                <p className="person-card__role">{person.role}</p>
                <a href={person.linkedin} target="_blank" rel="noopener noreferrer" className="person-card__linkedin" aria-label={`${person.name} on LinkedIn`}>
                  <LinkedInIcon />
                </a>
              </RevealChild>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="section cta">
        <div className="container">
          <div className="cta__card">
            <Reveal>
              <h2 className="cta__headline">
                Get involved in<br />
                <em className="headline-accent">disability inclusion at Ross.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="cta__sub">
                Membership is free and open to all U-M students. Sign up for
                event updates and opportunities to get involved.
              </p>
            </Reveal>
            <Reveal delay={0.25}>
              <div className="cta__actions">
                <a
                  href={MEMBERSHIP_FORM_URL}
                  className="btn btn--primary btn--lg"
                >
                  Join UBLDA
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
                <a href="mailto:cooperry@umich.edu?subject=Question%20for%20UBLDA" className="btn btn--ghost">
                  Contact us
                </a>
              </div>
            </Reveal>
            <Reveal delay={0.3}>
              <p className="cta__contact">
                Questions? Cooper Perry, our Executive VP, answers them:{' '}
                <a href="mailto:cooperry@umich.edu?subject=Question%20for%20UBLDA">cooperry@umich.edu</a>
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  )
}
