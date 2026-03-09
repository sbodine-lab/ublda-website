import { Link } from 'react-router-dom'
import Reveal, { RevealStagger, RevealChild } from '../components/Reveal'
import './About.css'

const values = [
  {
    title: 'Inclusion First',
    desc: 'Disabled students, allies, and everyone in between. If you believe business should work for everyone, you belong here. That\'s the starting line.',
  },
  {
    title: 'Real-World Impact',
    desc: 'Awareness is step one. We go further, partnering with organizations, building strategy, and shipping work that actually changes how businesses think about accessibility.',
  },
  {
    title: 'Student Leadership',
    desc: 'The best time to lead on disability inclusion is before you graduate. We\'re building a generation of business leaders who take access seriously from day one.',
  },
  {
    title: 'Education & Advocacy',
    desc: 'We run the events and workshops that change how people think about disability in business. Then we push for the changes that make it permanent.',
  },
]

export default function About() {
  return (
    <main id="main-content" className="about">
      <section className="about__hero">
        <div className="container">
          <Reveal>
            <p className="section__label">About UBLDA</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="about__headline">
              Making business <em>accessible.</em> Starting at Ross.
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="about__intro">
              UBLDA is a student-led organization at Michigan Ross dedicated to
              disability inclusion in business. We bring together students, with and
              without disabilities, to advocate, educate, and build a professional
              world that doesn't leave anyone out.
            </p>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="about__intro">
              Founded in Winter 2026 by Sam Bodine, Alexa Chiang, and Cooper Perry,
              UBLDA is a new and fast-growing club. We're actively expanding our
              leadership team, building out new programming, and taking on more every
              semester. This is just the beginning.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="about__image-section">
        <div className="container">
          <Reveal>
            <img
              src="/ross-illustration.png"
              alt="Ross School of Business"
              className="about__image about__image--illustration"
              loading="eager"
              fetchPriority="high"
            />
          </Reveal>
        </div>
      </section>

      <section className="section about__values">
        <div className="container">
          <Reveal>
            <p className="section__label">Our Values</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="about__values-headline">
              The principles behind the work.
            </h2>
          </Reveal>
          <RevealStagger className="about__values-grid">
            {values.map((v) => (
              <RevealChild key={v.title} className="value-card">
                <h3 className="value-card__title">{v.title}</h3>
                <p className="value-card__desc">{v.desc}</p>
              </RevealChild>
            ))}
          </RevealStagger>
        </div>
      </section>

      <section className="section about__cta">
        <div className="container container--narrow" style={{ textAlign: 'center' }}>
          <Reveal>
            <h2 className="about__cta-headline">
              There's room for you here.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="about__cta-sub">
              Whether you want to lead consulting projects, host events, or simply
              show up and learn, there's a place for you. Join 30+ Ross students
              who are making disability inclusion the standard in business.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="about__cta-actions">
              <Link to="/join" className="btn btn--primary btn--lg">
                Become a member
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
              <Link to="/events" className="btn btn--ghost">
                See upcoming events
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
