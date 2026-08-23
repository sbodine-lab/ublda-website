import { Link } from 'react-router-dom'
import './Home.css'

const pillars = [
  {
    title: 'Advocacy & Community',
    description:
      'Students with disabilities, allies, and anyone who thinks inclusion belongs in business. We show up for each other and push for a business world that includes all of us.',
  },
  {
    title: 'Career Preparation',
    description:
      'Programs built around disability-focused business: accessibility consulting, stock pitches, and entrepreneurship tracks that give members real work to point to.',
  },
  {
    title: 'Networking',
    description:
      'We connect members with employers, professionals, and students across Ross and the industry, so you\'re not building a career in this space on your own.',
  },
]

const benefits = [
  'Networking',
  'Career Development',
  'Speaker Sessions',
  'Workshops',
  'Mentorship',
  'Hands-on Consulting',
  'Community Events',
  'Education & Awareness',
]

const upcoming = [
  {
    title: 'Accessibility Consulting',
    desc: 'A selective program pairing members with real businesses and campus orgs to audit and improve their accessibility practices.',
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

const partners = [
  { src: '/partners-ross.png', alt: 'Michigan Ross School of Business', height: 44 },
  { src: '/partners-occb.png', alt: 'Office of Community, Culture, and Belonging', height: 54 },
  { src: '/partners-blda.webp', alt: 'Business Leaders for Diverse Abilities', height: 50, className: 'community__logo--blda' },
  { src: '/partners-nestidd.png', alt: 'Nestidd', height: 38 },
  { src: '/partners-arc-thrift.png', alt: 'Arc Thrift Stores', height: 62 },
]

const exec = [
  { name: 'Sam Bodine', role: 'Co-President', initials: 'SB', linkedin: 'https://www.linkedin.com/in/samuelbodine/' },
  { name: 'Alexa Chiang', role: 'Co-President', initials: 'AC', linkedin: 'https://www.linkedin.com/in/alexa-chiang/' },
  { name: 'Cooper Perry', role: 'Executive VP', initials: 'CP', linkedin: 'https://www.linkedin.com/in/cooperry/' },
]

const vps = [
  { name: 'Lindsey Ye', role: 'VP of Operations', initials: 'LY', linkedin: 'https://www.linkedin.com/in/lindsey-ye/' },
  { name: 'Landon Miller', role: 'VP of Finance', initials: 'LM', linkedin: 'https://www.linkedin.com/in/landon-miller-064a16258/' },
  { name: 'Alex Forstner', role: 'VP of Education', initials: 'AF', linkedin: 'https://www.linkedin.com/in/alex-forstner/' },
  { name: 'Samantha Naber', role: 'VP Marketing and Communications', initials: 'SN', linkedin: 'https://www.linkedin.com/in/samanthanaber/' },
  { name: 'Solomon DeYoung', role: 'VP Outreach and Partnerships', initials: 'SD', linkedin: 'https://www.linkedin.com/in/solomon-deyoung/' },
  { name: 'Andrew Sackett', role: 'VP Events and Programming', initials: 'AS', linkedin: 'https://www.linkedin.com/in/andrew-sackett-a1a5662bb/' },
]

const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="person-card__linkedin-icon" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
)

export default function Home() {
  return (
    <main id="main-content" className="home">
      <section className="hero">
        <div className="container">
          <div className="hero__content">
            <h1 className="hero__headline hero__entrance hero__entrance--headline">
              Undergraduate Business Leaders for Diverse Abilities
            </h1>

            <p className="hero__sub hero__entrance hero__entrance--sub">
              Disability inclusion belongs in business. UBLDA brings Michigan Ross
              students together through client work, speaker events, workshops, and
              the BLDA community.
            </p>

            <div className="hero__actions hero__entrance hero__entrance--actions">
              <Link to="/join" className="btn btn--primary btn--lg">
                Join UBLDA
                <ArrowIcon />
              </Link>
              <Link to="/events" className="btn btn--ghost btn--lg">
                See upcoming events
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section mission">
        <div className="container">
          <h2 className="mission__headline">
            We think disability inclusion should be built into business, not bolted on.
            That starts here, at Ross.
          </h2>
        </div>
      </section>

      <section className="section pillars">
        <div className="container">
          <h2 className="pillars__headline">What we do</h2>
          <div className="pillars__grid">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="pillar">
                <h3 className="pillar__title">{pillar.title}</h3>
                <p className="pillar__desc">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section partnership">
        <div className="container">
          <div className="partnership__layout">
            <div className="partnership__info">
              <h2 className="partnership__headline">
                Partnered with BLDA at Ross
              </h2>
              <p className="partnership__desc">
                We're the undergraduate chapter of Business Leaders for Diverse Abilities (BLDA),
                Ross's MBA disability advocacy organization. Members tap into BLDA's MBA network,
                mentorship, and guidance that most Ross undergrads never touch.
              </p>
            </div>
            <div className="partnership__benefits">
              <h3 className="partnership__benefits-title">What members get</h3>
              <ul className="benefits__list">
                {benefits.map((label) => (
                  <li key={label} className="benefits__item">{label}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section community">
        <div className="container">
          <h2 className="community__headline">Who we work with</h2>
          <ul className="community__logos" aria-label="Partner organizations">
            {partners.map((p) => (
              <li key={p.src} className="community__logo-item">
                <img
                  src={p.src}
                  alt={p.alt}
                  className={p.className}
                  style={{ '--logo-h': `${p.height}px` } as React.CSSProperties}
                  loading="lazy"
                  decoding="async"
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section advisory-callout">
        <div className="container">
          <div className="advisory-callout__layout">
            <div className="advisory-callout__info">
              <h2 className="advisory-callout__headline">UBLDA Advisory</h2>
              <p className="advisory-callout__desc">
                Our consulting program. Small teams of members work with a real client on a
                scoped accessibility project over the semester, with weekly deliverables and a
                final presentation to the client.
              </p>
              <Link to="/advisory" className="link-arrow">
                Learn about Advisory
                <ArrowIcon />
              </Link>
            </div>
            <div className="advisory-callout__notice">
              <p className="advisory-callout__notice-title">Fall 2026 recruitment</p>
              <p className="advisory-callout__notice-desc">
                Application details and dates are coming soon. Members on the mailing list
                hear first.
              </p>
              <Link to="/join" className="advisory-callout__notice-link">
                Join the mailing list
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section upcoming-programs">
        <div className="container">
          <h2 className="upcoming__headline">Coming Fall 2026</h2>
          <div className="upcoming__list">
            {upcoming.map((item) => (
              <div key={item.title} className="upcoming-item">
                <h3 className="upcoming-item__title">{item.title}</h3>
                <p className="upcoming-item__desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section leadership">
        <div className="container">
          <div className="leadership__head">
            <h2 className="leadership__headline">The people behind the mission</h2>
            <Link to="/team" className="link-arrow">
              Meet the full team
              <ArrowIcon />
            </Link>
          </div>

          <ul className="leadership__grid">
            {[...exec, ...vps].map((person) => (
              <li key={person.name} className="person-card">
                <div className="person-card__avatar" aria-hidden="true">
                  {person.initials}
                </div>
                <div className="person-card__info">
                  <p className="person-card__name">{person.name}</p>
                  <p className="person-card__role">{person.role}</p>
                </div>
                <a href={person.linkedin} target="_blank" rel="noopener noreferrer" className="person-card__linkedin" aria-label={`${person.name} on LinkedIn`}>
                  <LinkedInIcon />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <div className="cta__layout">
            <div>
              <h2 className="cta__headline">
                Business gets better when more people are in the room.
                Come be in the room.
              </h2>
              <p className="cta__sub">
                Students with disabilities, allies, and future business leaders who
                want impact built into their careers. 30 seconds to sign up.
                Join 30+ Ross students already here.
              </p>
            </div>
            <div className="cta__actions">
              <Link to="/join" className="btn btn--primary btn--lg">
                Become a member
                <ArrowIcon />
              </Link>
              <a href="mailto:sbodine@umich.edu,atchiang@umich.edu,cooperry@umich.edu" className="btn btn--ghost btn--lg">
                Contact us
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
