import { Link } from 'react-router-dom'
import Reveal, { RevealStagger, RevealChild } from '../components/Reveal'
import './Team.css'

interface Member {
  name: string
  role: string
  initials: string
  desc: string
  linkedin: string
}

const exec: Member[] = [
  { name: 'Sam Bodine', role: 'Co-President', initials: 'SB', desc: 'Runs the show and keeps UBLDA pointed in the right direction, from speaker events to campus-wide partnerships.', linkedin: 'https://www.linkedin.com/in/samuelbodine/' },
  { name: 'Alexa Chiang', role: 'Co-President', initials: 'AC', desc: 'Bridges disability advocacy and the broader Ross community. Makes sure no one gets left out of the conversation.', linkedin: 'https://www.linkedin.com/in/alexa-chiang/' },
  { name: 'Cooper Perry', role: 'Executive VP', initials: 'CP', desc: 'Turns big ideas into real programming and keeps the team aligned on what matters.', linkedin: 'https://www.linkedin.com/in/cooperry/' },
]

const vps: Member[] = [
  { name: 'Lindsey Ye', role: 'VP of Operations', initials: 'LY', desc: 'Owns logistics and coordination, the reason our events actually run on time.', linkedin: 'https://www.linkedin.com/in/lindsey-ye/' },
  { name: 'Landon Miller', role: 'VP of Finance', initials: 'LM', desc: 'Secures funding and manages our budget so we can keep programming ambitious.', linkedin: 'https://www.linkedin.com/in/landon-miller-064a16258/' },
  { name: 'Alex Forstner', role: 'VP of Education', initials: 'AF', desc: 'Designs workshops and resources that help Ross students actually understand disability and accessibility.', linkedin: 'https://www.linkedin.com/in/alex-forstner/' },
]

const LinkedInIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="team-card__linkedin-icon">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

export default function Team() {
  return (
    <main id="main-content" className="team-page">
      <section className="team-page__hero">
        <div className="container">
          <Reveal>
            <p className="section__label">Our Team</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="team-page__headline">
              Meet the people<br />
              <em>making it happen.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="team-page__intro">
              Six students building the disability inclusion movement
              at Michigan Ross through events, education, and real community.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section team-section">
        <div className="container">
          <Reveal>
            <div className="team-section__divider">Executive Leadership</div>
          </Reveal>
          <RevealStagger className="team-grid">
            {exec.map((m) => (
              <RevealChild key={m.name}>
                <TeamCard member={m} />
              </RevealChild>
            ))}
          </RevealStagger>

          <Reveal>
            <div className="team-section__divider">Vice Presidents</div>
          </Reveal>
          <RevealStagger className="team-grid">
            {vps.map((m) => (
              <RevealChild key={m.name}>
                <TeamCard member={m} />
              </RevealChild>
            ))}
          </RevealStagger>
        </div>
      </section>

      <section className="section team-contact">
        <div className="container container--narrow" style={{ textAlign: 'center' }}>
          <Reveal>
            <h2 className="team-contact__title">Work with us.</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="team-contact__desc">
              Whether you want to join the team, partner on a project, or just ask a question, we're always open. Reach out to any of our exec team:{' '}
              <a href="mailto:sbodine@umich.edu" className="team-contact__email">sbodine@umich.edu</a>,{' '}
              <a href="mailto:atchiang@umich.edu" className="team-contact__email">atchiang@umich.edu</a>,{' '}
              <a href="mailto:cooperry@umich.edu" className="team-contact__email">cooperry@umich.edu</a>
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="team-contact__actions">
              <Link to="/join" className="btn btn--primary btn--lg">
                Become a member
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  )
}

function TeamCard({ member }: { member: Member }) {
  return (
    <div className="team-card">
      <div className="team-card__avatar">
        {member.initials}
      </div>
      <div className="team-card__info">
        <h3 className="team-card__name">{member.name}</h3>
        <p className="team-card__role">{member.role}</p>
        <a href={member.linkedin} target="_blank" rel="noopener noreferrer" className="team-card__linkedin" aria-label={`${member.name} on LinkedIn`}>
          <LinkedInIcon />
        </a>
      </div>
    </div>
  )
}
