import { Link } from 'react-router-dom'
import { MEMBERSHIP_OPENS_AT_MS, MEMBERSHIP_OPENS_LABEL } from '../lib/applyForm'
import { MEMBERSHIP_FORM_URL } from '../lib/forms'
import { useClock } from '../lib/useClock'
import Reveal from '../components/Reveal'
import './Join.css'

const reasons = [
  {
    title: 'Community',
    desc: 'Meet disabled and non-disabled students interested in how business affects people’s lives.',
  },
  {
    title: 'Getting Involved',
    desc: 'Help run events or take part in workshops. For client work, apply to UBLDA Consulting through its separate selection process.',
  },
  {
    title: 'Career Experience',
    desc: 'Learn from business leaders and connect with BLDA’s MBA students as you explore your career interests.',
  },
]

const faqs = [
  {
    question: 'Do I need to have a disability to join?',
    answer:
      "No. Disabled and non-disabled students are welcome. You don’t need experience in disability advocacy to join.",
  },
  {
    question: 'Do I need consulting experience to apply for the consulting team?',
    answer:
      "No. We welcome applicants without consulting or accessibility experience. The application asks for three short answers; selected analysts learn research and business analysis through the project.",
  },
  {
    question: "What's the time commitment?",
    answer:
      'General members choose which events to attend. Consulting analysts commit to weekly project work throughout the semester.',
  },
  {
    question: 'Is there a membership fee?',
    answer: 'No. UBLDA is free to join.',
  },
  {
    question: "I'm not in Ross. Can I still join?",
    answer:
      "Yes. We're officially affiliated with the Ross School of Business, but we're open to all University of Michigan students regardless of college.",
  },
  {
    question: 'What happens after I sign up?',
    answer:
      "We'll add you to our mailing list and send you details about upcoming events and ways to get involved.",
  },
]

export default function Join() {
  const joinOpen = useClock(MEMBERSHIP_OPENS_AT_MS) >= MEMBERSHIP_OPENS_AT_MS
  return (
    <main id="main-content" className="join-page">
      <section className="join-page__hero">
        <div className="container">
          <Reveal>
            <p className="section__label">Get Involved</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="join-page__headline">
              Join<br />
              <em className="headline-accent">UBLDA.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="join-page__intro">
              Membership is free and open to all U-M students interested in
              disability inclusion in business.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── Membership Form ─── */}
      <section className="section join-form-section">
        <div className="container container--narrow">
          <Reveal>
            <h2 className="join-form__title">Membership Sign-Up</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="join-form__subtitle">
              Sign up for event updates and opportunities to get involved.
            </p>
          </Reveal>

          {!joinOpen ? (
            <Reveal>
              <div className="join-form__success" role="note">
                <h3 className="join-form__success-title">Sign-up opens {MEMBERSHIP_OPENS_LABEL}</h3>
                <p className="join-form__success-desc">
                  Membership is free and open to all U-M students. Come find us
                  at Festifall that afternoon (Table C43, the Diag) or sign up
                  right here once the form opens.
                </p>
              </div>
            </Reveal>
          ) : (
            <Reveal delay={0.2}>
              <div className="join-form__success">
                <h3 className="join-form__success-title">Become a member</h3>
                <p className="join-form__success-desc">
                  The form asks for your name, year, U-M email, and majors or minors.
                </p>
                <a
                  className="join-form__submit"
                  href={MEMBERSHIP_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open the sign-up form
                </a>
              </div>
            </Reveal>
          )}
        </div>
      </section>

      <section className="section join-reasons">
        <div className="container">
          <Reveal>
            <h2 className="join-reasons__title">Why UBLDA?</h2>
          </Reveal>
          <div className="join-reasons__grid">
            {reasons.map((r, i) => (
              <Reveal key={r.title} delay={i * 0.1}>
                <div className="reason-card">
                  <h3 className="reason-card__title">{r.title}</h3>
                  <p className="reason-card__desc">{r.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section join-faq">
        <div className="container container--narrow">
          <Reveal>
            <h2 className="join-faq__title">Frequently Asked Questions</h2>
          </Reveal>
          <div className="join-faq__list">
            {faqs.map((faq, i) => (
              <Reveal key={faq.question} delay={i * 0.05}>
                <div className="join-faq__item">
                  <h3 className="join-faq__question">{faq.question}</h3>
                  <p className="join-faq__answer">{faq.answer}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section join-contact">
        <div className="container container--narrow" style={{ textAlign: 'center' }}>
          <Reveal>
            <h2 className="join-contact__title">Have questions first?</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="join-contact__desc">
              For general membership questions, email Cooper Perry, our Executive VP, at{' '}
              <a href="mailto:cooperry@umich.edu?subject=Question%20for%20UBLDA" className="join-contact__email">cooperry@umich.edu</a>.{' '}
              Questions about consulting go to our project managers on the{' '}
              <Link to="/consulting/contact" className="join-contact__email">consulting contact page</Link>.
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
