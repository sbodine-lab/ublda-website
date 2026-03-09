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
        </div>
      </section>

      <section className="section about__timeline">
        <div className="container">
          <Reveal>
            <h2 className="about__timeline-headline">Our story so far.</h2>
          </Reveal>
          <div className="about__timeline-track">
            <Reveal>
              <div className="timeline-item">
                <div className="timeline-item__marker" />
                <div className="timeline-item__content">
                  <span className="timeline-item__date">Sep – Nov 2025</span>
                  <h3 className="timeline-item__title">The idea takes shape</h3>
                  <p className="timeline-item__desc">
                    Sam Bodine, Alexa Chiang, and Cooper Perry got to campus and started
                    building UBLDA from scratch. Planning, outreach, and laying the groundwork
                    for a new kind of org at Ross.
                  </p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="timeline-item">
                <div className="timeline-item__marker" />
                <div className="timeline-item__content">
                  <span className="timeline-item__date">Dec 2025</span>
                  <h3 className="timeline-item__title">Leadership team assembled</h3>
                  <p className="timeline-item__desc">
                    Recruited Lindsey Ye, Landon Miller, and Alex Forstner as VPs. Together,
                    the six of us became the inaugural e-board.
                  </p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="timeline-item">
                <div className="timeline-item__marker" />
                <div className="timeline-item__content">
                  <span className="timeline-item__date">Jan 2026</span>
                  <h3 className="timeline-item__title">BBA Meet the Clubs</h3>
                  <p className="timeline-item__desc">
                    Officially introduced UBLDA to the Ross community. Started signing up
                    members and building momentum.
                  </p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.3}>
              <div className="timeline-item">
                <div className="timeline-item__marker timeline-item__marker--active" />
                <div className="timeline-item__content">
                  <span className="timeline-item__date">Mar 2026</span>
                  <h3 className="timeline-item__title">First ever UBLDA event</h3>
                  <p className="timeline-item__desc">
                    Fireside Chat with Andrew Parker, CEO &amp; Co-Founder of Nestidd.
                    Our first solo event as an organization.
                  </p>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.4}>
              <div className="timeline-item">
                <div className="timeline-item__marker timeline-item__marker--future" />
                <div className="timeline-item__content">
                  <span className="timeline-item__date">Fall 2026 &amp; beyond</span>
                  <h3 className="timeline-item__title">More to come</h3>
                  <p className="timeline-item__desc">
                    Accessibility consulting, a mentorship program, expanded speaker series,
                    and new leadership opportunities. We're just getting started.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
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
