import { MEMBERSHIP_OPENS_AT_MS, MEMBERSHIP_OPENS_LABEL } from '../lib/applyForm'
import { MEMBERSHIP_FORM_URL } from '../lib/forms'
import Reveal from '../components/Reveal'
import './Join.css'

const reasons = [
  {
    title: 'Community',
    desc: 'Join a tight-knit group of students who genuinely care about disability inclusion, and have a great time doing it.',
  },
  {
    title: 'Impact',
    desc: 'Work on real consulting projects, host standout events, and actually change how Ross thinks about accessibility.',
  },
  {
    title: 'Growth',
    desc: 'Build leadership skills, tap into our MBA network through BLDA, and walk away with experience most undergrads don\'t get.',
  },
]

const faqs = [
  {
    question: 'Do I need to have a disability to join?',
    answer:
      "No. UBLDA is for students with disabilities, allies, and anyone who wants real impact as part of their business career. Headed into consulting, finance, product, or anywhere else? If impact matters to you, you belong here.",
  },
  {
    question: "What's the time commitment?",
    answer:
      'Totally flexible. Come to as many or as few events as you want. That said, we do track active attendance for future leadership openings and selective program opportunities launching in Fall 2026.',
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
  const joinOpen = Date.now() >= MEMBERSHIP_OPENS_AT_MS
  return (
    <main id="main-content" className="join-page">
      <section className="join-page__hero">
        <div className="container">
          <Reveal>
            <p className="section__label">Get Involved</p>
          </Reveal>
          <Reveal delay={0.1}>
            <h1 className="join-page__headline">
              Your seat at<br />
              <em>the table.</em>
            </h1>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="join-page__intro">
              If you care about disability inclusion in business, you belong here.
              Signing up takes 30 seconds.
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
              Drop your info below and you're in. We'll add you to our mailing list and keep you in the loop on everything UBLDA.
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
                <h3 className="join-form__success-title">Sign up in 30 seconds</h3>
                <p className="join-form__success-desc">
                  Membership is free and open to all U-M students. The form asks
                  for your name and your umich email. That is it.
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
              No pressure. Email Cooper Perry, our Executive VP, and they'll get back to you:{' '}
              <a href="mailto:cooperry@umich.edu?subject=Question%20for%20UBLDA" className="join-contact__email">cooperry@umich.edu</a>.{' '}
              Questions about consulting go to our project managers on the{' '}
              <a href="/consulting#consulting-leaders" className="join-contact__email">consulting page</a>.
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
