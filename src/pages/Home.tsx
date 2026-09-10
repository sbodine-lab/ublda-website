import { Link } from 'react-router-dom'
import { APPLY_DEADLINE_AT_MS, APPLY_OPENS_AT_MS, APPLY_CLOSES_PROSE, APPLY_CLOSE_TIME_SHORT, applyWindow } from '../lib/applyForm'
import { useClock } from '../lib/useClock'
import './Home.css'

const RSVP = 'https://docs.google.com/forms/d/e/1FAIpQLScB4BYm2kkqSO5Q9n6j5BrV8Xxtb1k3MZi00plC3HnvRXMeiw/viewform'

export default function Home() {
  const applyState = applyWindow(useClock(APPLY_OPENS_AT_MS, APPLY_DEADLINE_AT_MS), APPLY_DEADLINE_AT_MS)
  return (
    <main id="main-content" className="home editorial-home">
      <section className="home-opening" aria-labelledby="home-title">
        <figure className="home-opening__figure">
          <img src="/ross-front-entrance.jpg" width="1333" height="1000" fetchPriority="high" alt="The glass and brick entrance to the Stephen M. Ross School of Business" />
          <figcaption>
            <h1 id="home-title">Undergraduate Business Leaders for Diverse Abilities</h1>
            <span>University of Michigan</span>
          </figcaption>
        </figure>
      </section>

      <section className="home-introduction home-width">
        <div className="home-margin-note">A student organization<br />at Michigan Ross</div>
        <div>
          <h2 className="mission__headline">Disability belongs in the conversation about how businesses operate. <em>We bring that conversation to Ross.</em></h2>
          <p>Through consulting projects and conversations with business leaders, UBLDA brings students together around disability inclusion. Membership is free and open to every U-M student.</p>
          <Link className="editorial-link" to="/about">About UBLDA <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="home-programs home-width" aria-labelledby="home-programs-title">
        <div className="home-section-heading"><h2 id="home-programs-title">This fall</h2><span>2026</span></div>
        <div className="home-programs__grid">
          <article className="home-program home-program--consulting">
            <Link to="/consulting" className="home-program__image home-program__image--arc" aria-label="Explore UBLDA Consulting">
              <img src="/partners-arc-thrift.png" alt="Arc Thrift Stores" loading="lazy" />
            </Link>
            <p className="home-program__meta">Consulting · Fall client</p>
            <h3><Link to="/consulting">Work with Arc Thrift Stores.</Link></h3>
            <p>Join our first analyst team and develop recommendations for a business built around disability inclusion. No previous consulting experience required.</p>
            {applyState === 'open' ? <><p className="home-program__deadline">Apply by {APPLY_CLOSES_PROSE} · {APPLY_CLOSE_TIME_SHORT}</p><Link className="editorial-link" to="/apply">Apply to the team <span aria-hidden="true">↗</span></Link></> : <Link className="editorial-link" to="/consulting">Explore consulting <span aria-hidden="true">↗</span></Link>}
          </article>
          <article className="home-program home-program--event">
            <Link to="/events" className="home-program__image home-program__image--microsoft" aria-label="Read about the Microsoft fireside">
              <span className="home-program__host">Hosted by UBLDA</span>
              <img src="/microsoft.png" alt="Microsoft" loading="lazy" />
              <span className="home-program__date">01 October</span>
            </Link>
            <p className="home-program__meta">Fireside conversation · October 1, 7–8 PM ET</p>
            <h3><Link to="/events">An evening with Alli Hirt.</Link></h3>
            <p>Hear from Michigan alum Alli Hirt, Director of Accessibility Engineering at Microsoft, about her career and accessibility in the products we use.</p>
            <p className="home-program__format">Students attend at Ross. Alli joins virtually from Seattle.</p>
            <a className="editorial-link" href={RSVP} target="_blank" rel="noopener noreferrer">RSVP for the conversation <span aria-hidden="true">↗</span></a>
          </article>
        </div>
      </section>

      <section className="home-network home-width">
        <div><p className="home-margin-note">Our community</p><h2>Connected at Ross.</h2></div>
        <div><p>We’re the undergraduate chapter of Business Leaders for Diverse Abilities, working alongside BLDA’s MBA community at Michigan Ross.</p><div className="home-network__logos"><img src="/partners-ross.png" alt="Michigan Ross" loading="lazy" /><img src="/partners-blda.webp" alt="Business Leaders for Diverse Abilities" loading="lazy" /></div><Link className="editorial-link" to="/team">Meet our executive board <span aria-hidden="true">↗</span></Link></div>
      </section>
    </main>
  )
}
