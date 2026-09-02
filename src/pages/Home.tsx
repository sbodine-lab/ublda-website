import { Link } from 'react-router-dom'
import Reveal, { RevealStagger, RevealChild } from '../components/Reveal'
import {
  APPLY_CLOSES_AT_MS,
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
      'Disabled students, allies, and anyone who thinks inclusion belongs in business. We show up for each other and push for a business world that includes all of us.',
    icon: '01',
  },
  {
    title: 'Career Preparation',
    description:
      'Programs built around disability-focused business: accessibility consulting, stock pitches, and entrepreneurship tracks that give members real work to point to.',
    icon: '02',
  },
  {
    title: 'Networking',
    description:
      'We connect members with employers, professionals, and students across Ross and the industry, so you\'re not building a career in this space on your own.',
    icon: '03',
  },
]

const benefits = [
  { label: 'Networking', icon: '→' },
  { label: 'Career Development', icon: '→' },
  { label: 'Speaker Sessions', icon: '→' },
  { label: 'Workshops', icon: '→' },
  { label: 'Mentorship', icon: '→' },
  { label: 'Hands-on Consulting', icon: '→' },
  { label: 'Community Events', icon: '→' },
  { label: 'Education & Awareness', icon: '→' },
]

const upcoming = [
  {
    title: 'Accessibility Consulting',
    desc: `Live now: a selective analyst team working with a real client on a real engagement this fall. No consulting experience needed. Applications run ${APPLY_WINDOW_PROSE}; the winter client is announced in October.`,
  },
  {
    title: 'Mentorship & Education',
    desc: 'One-on-one mentorship with senior business leaders plus an education track from Alex Forstner covering finance, consulting, and product.',
  },
  {
    title: 'Expanded Speaker Series',
    desc: 'Monthly fireside chats with disability advocates, startup founders, and industry executives who\'ve built inclusive organizations firsthand.',
  },
]

const exec = [
  { name: 'Sam Bodine', role: 'Co-President', initials: 'SB', desc: 'Leads speaker events and campus partnerships.', linkedin: 'https://www.linkedin.com/in/samuelbodine/' },
  { name: 'Alexa Chiang', role: 'Co-President', initials: 'AC', desc: 'Connects disability advocacy with Ross and keeps accessibility in the room.', linkedin: 'https://www.linkedin.com/in/alexa-chiang/' },
  { name: 'Cooper Perry', role: 'Executive VP', initials: 'CP', desc: 'Turns big ideas into real programming and keeps the team aligned on what matters.', linkedin: 'https://www.linkedin.com/in/cooperry/' },
]

const vps = [
  { name: 'Lindsey Ye', role: 'VP of Operations', initials: 'LY', desc: 'Owns logistics and coordination, the reason our events actually run on time.', linkedin: 'https://www.linkedin.com/in/lindsey-ye/' },
  { name: 'Landon Miller', role: 'VP of Finance', initials: 'LM', desc: 'Secures funding and manages our budget so we can keep programming ambitious.', linkedin: 'https://www.linkedin.com/in/landon-miller-064a16258/' },
  { name: 'Alex Forstner', role: 'VP of Education', initials: 'AF', desc: 'Designs workshops and resources that help Ross students actually understand disability and accessibility.', linkedin: 'https://www.linkedin.com/in/alex-forstner/' },
  { name: 'Samantha Naber', role: 'VP Marketing and Communications', initials: 'SN', desc: 'Leads the voice, visibility, and storytelling that help UBLDA reach more students across campus.', linkedin: 'https://www.linkedin.com/in/samanthanaber/' },
  { name: 'Solomon DeYoung', role: 'VP Outreach and Partnerships', initials: 'SD', desc: 'Builds relationships with campus partners, employers, and community organizations that move the mission forward.', linkedin: 'https://www.linkedin.com/in/solomon-deyoung/' },
  { name: 'Andrew Sackett', role: 'VP Events and Programming', initials: 'AS', desc: 'Creates thoughtful programming and event experiences that bring members together around disability inclusion.', linkedin: 'https://www.linkedin.com/in/andrew-sackett-a1a5662bb/' },
]

const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="person-card__linkedin-icon">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

export default function Home() {
  const applyState = applyWindow(useClock(APPLY_OPENS_AT_MS, APPLY_CLOSES_AT_MS))
  return (
    <main id="main-content" className="home">
      {/* ─── Hero ─── */}
      <section className="hero">
        <div className="container">
          <div className="hero__content">
            <h1 className="hero__headline hero__entrance hero__entrance--headline">
              Undergraduate Business Leaders{' '}
              <em>for</em>{' '}
              Diverse Abilities
            </h1>

            <p className="hero__sub hero__entrance hero__entrance--sub">
              Disability inclusion belongs in business. UBLDA brings Michigan Ross
              students together through client work, speaker events, workshops, and
              the BLDA community.
            </p>

            <div className="hero__actions hero__entrance hero__entrance--actions">
              <Link to="/join" className="btn-flip">
                <span className="btn-flip__inner">
                  <span className="btn-flip__front">
                    Join UBLDA
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <span className="btn-flip__back">
                    Let's build this together
                  </span>
                </span>
              </Link>
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
              We think disability inclusion should be built into business, not bolted on.{' '}
              <em>That starts here, at Ross.</em>
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
                  Partnered with <em>BLDA</em> at Ross
                </h2>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="partnership__desc">
                  We're the undergraduate chapter of Business Leaders for Diverse Abilities (BLDA),
                  Ross's MBA disability advocacy organization. Members tap into BLDA's MBA network,
                  mentorship, and guidance that most Ross undergrads never touch.
                </p>
              </Reveal>
            </div>
            <div className="partnership__benefits">
              <Reveal delay={0.15}>
                <p className="partnership__benefits-label">What members get</p>
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

      {/* ─── Coming Fall 2026 ─── */}
      <section className="section upcoming-programs">
        <div className="container">
          <Reveal>
            <p className="section__label">Coming Fall 2026</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="upcoming__headline">
              New programs, <em>new momentum.</em>
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
              Come find us <em>on campus.</em>
            </h2>
          </Reveal>
          <RevealStagger className="recruiting-events__grid">
            <RevealChild className="recruiting-event-card">
              <p className="recruiting-event-card__when">Wednesday, September 2 &middot; 3&ndash;5 PM</p>
              <h3 className="recruiting-event-card__title">Festifall Central</h3>
              <p className="recruiting-event-card__where">The Diag &middot; Table C43</p>
            </RevealChild>
            <RevealChild className="recruiting-event-card">
              <p className="recruiting-event-card__when">Tuesday, September 8 &middot; 5:30&ndash;7:30 PM</p>
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
                  : 'Applications for the Fall 2026 consulting team are closed for the fall.'}{' '}
              {/* /apply is a redirect straight out to the Google Form, so the
                  link has to say so rather than promise a details page. */}
              <Link to="/apply" className="recruiting-events__link">
                Open the application form
                <span className="sr-only"> (Google Form, leaves ublda.org)</span>
              </Link>
              {' '}&middot;{' '}
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
              The people behind the mission.
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
                Business gets better when more people are in the room.<br />
                <em>Come be in the room.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.15}>
              <p className="cta__sub">
                Disabled students, allies, and future business leaders who
                want impact built into their careers. 30 seconds to sign up.
                Join 30+ Ross students already here.
              </p>
            </Reveal>
            <Reveal delay={0.25}>
              <div className="cta__actions">
                <Link
                  to="/join"
                  className="btn btn--primary btn--lg"
                >
                  Become a member
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </Link>
                <a href="mailto:cooperry@umich.edu?subject=Question%20for%20UBLDA" className="btn btn--ghost">
                  Contact us
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </main>
  )
}
