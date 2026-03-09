import { useState } from 'react'
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
      'No. UBLDA is for students with disabilities, allies, and anyone interested in disability inclusion in business.',
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

const years = ['Freshman', 'Sophomore', 'Junior', 'Senior']

export default function Join() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    major: '',
    year: '',
    email: '',
  })

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let val = e.target.value
    if (field === 'email') {
      val = val.replace(/@umich\.edu$/i, '').replace(/@.*$/, '')
    }
    setForm({ ...form, [field]: val })
  }

  const fullEmail = `${form.email.replace(/@umich\.edu$/i, '').replace(/@.*$/, '')}@umich.edu`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: fullEmail,
          major: form.major,
          year: form.year,
        }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        alert('Something went wrong. Please try again or email us at sbodine@umich.edu, atchiang@umich.edu, or cooperry@umich.edu.')
      }
    } catch {
      alert('Something went wrong. Please try again or email us at sbodine@umich.edu, atchiang@umich.edu, or cooperry@umich.edu.')
    } finally {
      setSubmitting(false)
    }
  }

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

          {submitted ? (
            <Reveal>
              <div className="join-form__success" role="alert" aria-live="polite">
                <div className="join-form__success-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h3 className="join-form__success-title">You're in!</h3>
                <p className="join-form__success-desc">
                  Welcome to UBLDA. We'll be in touch soon with next steps and upcoming events. Excited to have you.
                </p>
              </div>
            </Reveal>
          ) : (
            <Reveal delay={0.2}>
              <form className="join-form" onSubmit={handleSubmit}>
                <div className="join-form__row">
                  <div className="join-form__field">
                    <label className="join-form__label" htmlFor="firstName">
                      First name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      className="join-form__input"
                      placeholder="First name"
                      value={form.firstName}
                      onChange={update('firstName')}
                      required
                    />
                  </div>
                  <div className="join-form__field">
                    <label className="join-form__label" htmlFor="lastName">
                      Last name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      className="join-form__input"
                      placeholder="Last name"
                      value={form.lastName}
                      onChange={update('lastName')}
                      required
                    />
                  </div>
                </div>

                <div className="join-form__field">
                  <label className="join-form__label" htmlFor="email">
                    UMich uniqname
                  </label>
                  <div className="join-form__email-wrapper">
                    <input
                      id="email"
                      type="text"
                      className="join-form__input join-form__input--email"
                      placeholder="uniqname"
                      value={form.email}
                      onChange={update('email')}
                      required
                    />
                    <span className="join-form__email-suffix">@umich.edu</span>
                  </div>
                </div>

                <div className="join-form__row">
                  <div className="join-form__field">
                    <label className="join-form__label" htmlFor="major">
                      College
                    </label>
                    <input
                      id="major"
                      type="text"
                      className="join-form__input"
                      placeholder="e.g. Ross, LSA, Engineering"
                      value={form.major}
                      onChange={update('major')}
                      required
                    />
                  </div>
                  <div className="join-form__field">
                    <label className="join-form__label" htmlFor="year">
                      Year
                    </label>
                    <select
                      id="year"
                      className="join-form__input join-form__select"
                      value={form.year}
                      onChange={update('year')}
                      required
                    >
                      <option value="" disabled>
                        Select year
                      </option>
                      {years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn--primary btn--lg join-form__submit" disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Join UBLDA'}
                  {!submitting && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </form>
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
              No pressure. Reach out to any of our exec team and we'll get back to you:{' '}
              <a href="mailto:sbodine@umich.edu" className="join-contact__email">sbodine@umich.edu</a>,{' '}
              <a href="mailto:atchiang@umich.edu" className="join-contact__email">atchiang@umich.edu</a>,{' '}
              <a href="mailto:cooperry@umich.edu" className="join-contact__email">cooperry@umich.edu</a>.{' '}
              Feel free to also reach out to any additional members on our e-board!
            </p>
          </Reveal>
        </div>
      </section>
    </main>
  )
}
