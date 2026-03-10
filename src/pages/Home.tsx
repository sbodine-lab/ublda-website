import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Reveal, { RevealStagger, RevealChild } from '../components/Reveal'
import './Home.css'

const pillars = [
  {
    title: 'Advocacy & Community',
    description:
      'Students with disabilities and allies, together. We show up for each other, learn from each other, and push for a business world that includes all of us.',
    icon: '01',
  },
  {
    title: 'Accessibility Consulting',
    description:
      'We work directly with faculty, student orgs, and local businesses to audit and improve their accessibility practices. Real clients, real impact.',
    icon: '02',
  },
  {
    title: 'Professional Development',
    description:
      'Speaker series, hands-on workshops, and skill-building that prepare members to make workplaces more inclusive from day one.',
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
    desc: 'A selective program pairing select members with real businesses and campus orgs to audit, advise, and improve their accessibility practices.',
  },
  {
    title: 'Mentorship & Education',
    desc: 'One-on-one mentorship with experienced leaders paired with an education track led by Alex Forstner covering finance, consulting, and more.',
  },
  {
    title: 'Expanded Speaker Series',
    desc: 'Monthly fireside chats with disability advocates, startup founders, and industry executives who\'ve actually built inclusive organizations.',
  },
]

const exec = [
  { name: 'Sam Bodine', role: 'Co-President', initials: 'SB', desc: 'Runs the show and keeps UBLDA pointed in the right direction, from speaker events to campus-wide partnerships.', linkedin: 'https://www.linkedin.com/in/samuelbodine/' },
  { name: 'Alexa Chiang', role: 'Co-President', initials: 'AC', desc: 'Bridges disability advocacy and the broader Ross community. Makes sure no one gets left out of the conversation.', linkedin: 'https://www.linkedin.com/in/alexa-chiang/' },
  { name: 'Cooper Perry', role: 'Executive VP', initials: 'CP', desc: 'Turns big ideas into real programming and keeps the team aligned on what matters.', linkedin: 'https://www.linkedin.com/in/cooperry/' },
]

const vps = [
  { name: 'Lindsey Ye', role: 'VP of Operations', initials: 'LY', desc: 'Owns logistics and coordination, the reason our events actually run on time.', linkedin: 'https://www.linkedin.com/in/lindsey-ye/' },
  { name: 'Landon Miller', role: 'VP of Finance', initials: 'LM', desc: 'Secures funding and manages our budget so we can keep programming ambitious.', linkedin: 'https://www.linkedin.com/in/landon-miller-064a16258/' },
  { name: 'Alex Forstner', role: 'VP of Education', initials: 'AF', desc: 'Designs workshops and resources that help Ross students actually understand disability and accessibility.', linkedin: 'https://www.linkedin.com/in/alex-forstner/' },
]

const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="person-card__linkedin-icon">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

export default function Home() {
  return (
    <main id="main-content" className="home">
      {/* ─── Hero ─── */}
      <section className="hero">
        <div className="container">
          <motion.div
            className="hero__content"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.12 } },
            }}
          >
            <motion.h1
              className="hero__headline"
              variants={{
                hidden: { opacity: 0, y: 40 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
              Undergraduate Business Leaders{' '}
              <em>for</em>{' '}
              Diverse Abilities
            </motion.h1>

            <motion.p
              className="hero__sub"
              variants={{
                hidden: { opacity: 0, y: 24 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
              Disability inclusion belongs in business. We're a student org
              at Michigan Ross building real community and advancing
              disability inclusion, on campus and beyond.
            </motion.p>

            <motion.div
              className="hero__actions"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
              }}
            >
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
              <Link to="/about" className="btn btn--ghost">
                Our story
              </Link>
            </motion.div>
          </motion.div>
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
                  Ross's MBA disability advocacy organization. Through this partnership,
                  our members gain access to a broader network, mentorship, and guidance
                  opportunities across the Ross community that you won't find anywhere else on campus.
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
                  <img src="/partners-ross.png" alt="Michigan Ross School of Business" />
                </div>
                <div className="community__logo-item">
                  <img src="/partners-occb.png" alt="Office of Community, Culture, and Belonging" />
                </div>
                <div className="community__logo-item">
                  <img src="/partners-blda.webp" alt="Business Leaders for Diverse Abilities" className="community__logo--blda" />
                </div>
                <div className="community__logo-item">
                  <img src="/partners-nestidd.png" alt="Nestidd" />
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

      {/* ─── Featured Event ─── */}
      <section className="section featured-event">
        <div className="container">
          <Reveal>
            <div className="event-card">
              <div className="event-card__date">
                <span className="event-card__month">Mar</span>
                <span className="event-card__day">11</span>
              </div>
              <div className="event-card__content">
                <p className="event-card__time">Wednesday, March 11 &middot; 7:00 &ndash; 8:00 PM</p>
                <h3 className="event-card__title">
                  Fireside Chat with Andrew Parker, CEO & Co-Founder of Nestidd
                </h3>
                <p className="event-card__desc">
                  Andrew Parker (Ross alum) built Nestidd into an 800+ property
                  housing platform for people with intellectual and developmental
                  disabilities. Hear how he did it and why mission-driven business wins.
                </p>
                <div className="event-card__meta">
                  <span className="event-card__location">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1.5a4.5 4.5 0 0 1 4.5 4.5c0 3.5-4.5 8.5-4.5 8.5S3.5 9.5 3.5 6A4.5 4.5 0 0 1 8 1.5z" stroke="currentColor" strokeWidth="1.2"/><circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/></svg>
                    Ross B0560
                  </span>
                  <a
                    href="https://docs.google.com/forms/d/e/1FAIpQLSe1Dw6kREajSYHL2S1BRbHQsloGn4VQVjWORwC2HrciCviu1Q/viewform?usp=header"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-card__gcal"
                  >
                    RSVP
                  </a>
                  <a
                    href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=Fireside+Chat+with+Andrew+Parker%2C+CEO+%26+Co-Founder+of+Nestidd&dates=20260311T190000/20260311T200000&details=Andrew+Parker+%28Ross+alum%29+built+Nestidd+into+an+800%2B+property+housing+platform+for+people+with+intellectual+and+developmental+disabilities.+Hear+how+he+did+it+and+why+mission-driven+business+wins.+Raising+Cane%27s+will+be+catered.&location=Ross+B0560%2C+Ross+School+of+Business"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="event-card__gcal"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 1.5v3M11 1.5v3M2 7h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    Add to Google Calendar
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="events__more">
              <Link to="/events" className="link-arrow">
                View all events
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
            </div>
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
                <h4 className="person-card__name">{person.name}</h4>
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
                <h4 className="person-card__name">{person.name}</h4>
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
                Students with disabilities, allies, future business leaders who
                believe inclusion is non-negotiable. It takes 30 seconds to sign
                up. Join 30+ Ross students already building this.
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
                <a href="mailto:sbodine@umich.edu,atchiang@umich.edu,cooperry@umich.edu" className="btn btn--ghost">
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
