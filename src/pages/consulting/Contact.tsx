import { useEffect, useState, type FormEvent } from 'react'
import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CONSULTING_FORM_URL, MEMBERSHIP_FORM_URL } from '../../lib/forms'
import { LEADERS, ROSS_ADDRESS, SOCIAL } from './content'
import { all, buildDrawLine, buildHeroExit, buildNavBlendFor, buildReveals, buildWordmark, gsap, one, startMotion, type Builder, type MotionStarter } from './engine'
import { DotButton, HeroLines, NewTab } from './parts'
import { ConsultingShell } from './Shell'

const HELP_OPTIONS = ['Websites & apps', 'Documents & communications', 'Hiring & workplace', 'Events & programs', 'Strategy & business case', 'Not sure yet']
const TIMING_OPTIONS = ['Winter 2027', 'Fall 2027', 'Just exploring']

const OPENINGS = [
  {
    title: 'Consulting analyst',
    term: 'Fall 2026',
    facts: ['Experience: none required', 'Location: Ann Arbor', 'Commitment: weekly, October through December'],
    about: 'You notice when something does not work for someone else, and you would rather fix it than explain it away.',
    doing: ['Walk through websites, documents, and processes with real users, including disabled students.', 'Turn what you find into ranked, plain-language findings.', 'Build the business case where the fix needs budget.', 'Present at the midpoint and the final review.'],
    requirements: ['University of Michigan undergraduate, any major and year.', 'Application by Tuesday, September 22 at 11:30 PM ET.', 'Two 30-minute interviews at Ross, September 25 to 27.', 'Offers by September 29, kickoff the week of October 5.'],
    cta: { href: CONSULTING_FORM_URL, label: 'Apply', external: true },
  },
  {
    title: 'General member',
    term: 'Rolling',
    facts: ['Experience: none', 'Location: Ann Arbor and online', 'Commitment: as much as you want'],
    about: 'Speaker events, workshops, and a community of students with and without disabilities. No application, just a form.',
    doing: ['Come to fireside chats with accessibility leaders.', 'Get first look at consulting recruiting each semester.', 'Meet the MBA students at BLDA.'],
    requirements: ['University of Michigan student.'],
    cta: { href: MEMBERSHIP_FORM_URL, label: 'Join', external: true },
  },
]

const buildContact: Builder = (root) => {
  const hero = one(root, '.pcc-hero')
  buildWordmark(root, hero)
  buildHeroExit(one(root, '.pcc-hero__over'), hero)
  gsap.to(one(root, '.pcc-clock__ticks'), { rotation: 360, duration: 90, ease: 'none', repeat: -1 })

  const connect = one(root, '.pcc-connect')
  buildDrawLine(one(connect, '.pcc-connect__line'), connect, 'top 80%', 'top 10%')
  gsap.fromTo(all(connect, '[data-stagger] > *'), { opacity: 0, y: 30 }, { opacity: 1, y: 0, stagger: 0.1, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: connect, start: 'top 60%' } })

  /* The connect block stays put while the light form slides up over it. */
  ScrollTrigger_pin(connect)
  const form = one(root, '.pcc-form')
  const cleanupBlend = buildNavBlendFor(root, [form])
  gsap.fromTo(all(form, '.pcc-field'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.06, duration: 0.8, scrollTrigger: { trigger: form, start: 'top 60%' } })

  buildReveals(root)
  return () => cleanupBlend()
}

function ScrollTrigger_pin(section: HTMLElement) {
  gsap.to(section, { scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', pin: true, pinSpacing: false } })
}

const startContact: MotionStarter = (root, onMode, reduce) => startMotion(root, onMode, buildContact, { reduce })

function useAnnArborTime() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Detroit' })
    const tick = () => setTime(fmt.format(new Date()))
    const id = window.setInterval(tick, 1000)
    tick()
    return () => window.clearInterval(id)
  }, [])
  return time
}

function Clock() {
  const time = useAnnArborTime()
  const ticks = Array.from({ length: 72 }, (_, i) => i)
  return (
    <div className="pcc-clock" aria-label={`Ann Arbor, ${time}`}>
      <svg className="pcc-clock__ticks" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
        {ticks.map((i) => (
          <line
            key={i}
            x1="100"
            y1="8"
            x2="100"
            y2={i % 6 === 0 ? 34 : 26}
            stroke="currentColor"
            strokeWidth={i % 6 === 0 ? 2 : 1}
            opacity={i % 2 ? 0.45 : 0.9}
            transform={`rotate(${i * 5} 100 100)`}
          />
        ))}
      </svg>
      <div className="pcc-clock__label">
        <span>Ann Arbor</span>
        <span className="pcc-clock__time">{time || ' '}</span>
      </div>
    </div>
  )
}

function ContactForm() {
  const [values, setValues] = useState({ name: '', org: '', site: '', email: '', help: '', timing: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    setErrors((prev) => {
      if (!prev[k]) return prev
      const next = { ...prev }
      delete next[k]
      return next
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!values.name.trim()) next.name = 'Your name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'A valid email is required.'
    if (!values.message.trim()) next.message = 'Tell us a little about the problem.'
    setErrors(next)
    if (Object.keys(next).length) return
    const body = [
      `Name: ${values.name}`,
      values.org && `Organization: ${values.org}`,
      values.site && `Website: ${values.site}`,
      `Email: ${values.email}`,
      values.help && `Help with: ${values.help}`,
      values.timing && `Timing: ${values.timing}`,
      '',
      values.message,
    ]
      .filter(Boolean)
      .join('\n')
    const subject = `UBLDA Consulting inquiry from ${values.org || values.name}`
    window.location.href = `mailto:${LEADERS.map((l) => l.email).join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const field = (key: keyof typeof values, label: string, type = 'text', required = false) => (
    <div className={`pcc-field ${errors[key] ? 'pcc-field--error' : ''}`}>
      <input id={`pcc-${key}`} type={type} value={values[key]} onChange={set(key)} placeholder=" " aria-required={required} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `pcc-${key}-err` : undefined} />
      <label htmlFor={`pcc-${key}`}>
        {label}
        {required ? '*' : ''}
      </label>
      <span className="pcc-field__line" aria-hidden="true" />
      {errors[key] && (
        <p className="pcc-field__err" id={`pcc-${key}-err`}>
          {errors[key]}
        </p>
      )}
    </div>
  )

  const select = (key: 'help' | 'timing', label: string, options: string[]) => (
    <div className="pcc-field pcc-field--select">
      <select id={`pcc-${key}`} value={values[key]} onChange={set(key)}>
        <option value="">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <label htmlFor={`pcc-${key}`} className="sr-only">
        {label}
      </label>
      <ChevronDown size={16} strokeWidth={2} aria-hidden="true" className="pcc-field__chev" />
      <span className="pcc-field__line" aria-hidden="true" />
    </div>
  )

  return (
    <form className="pcc-form__grid" onSubmit={submit} noValidate>
      {field('name', 'Full name', 'text', true)}
      {field('org', 'Organization')}
      {field('site', 'Website', 'url')}
      {field('email', 'Email', 'email', true)}
      {select('help', 'How can we help?', HELP_OPTIONS)}
      {select('timing', 'When?', TIMING_OPTIONS)}
      <div className={`pcc-field pcc-field--area ${errors.message ? 'pcc-field--error' : ''}`}>
        <textarea id="pcc-message" value={values.message} onChange={set('message')} placeholder=" " rows={4} aria-required aria-invalid={!!errors.message} aria-describedby={errors.message ? 'pcc-message-err' : undefined} />
        <label htmlFor="pcc-message">Tell us where people get stuck*</label>
        <span className="pcc-field__line" aria-hidden="true" />
        {errors.message && (
          <p className="pcc-field__err" id="pcc-message-err">
            {errors.message}
          </p>
        )}
      </div>
      <div className="pcc-form__submit">
        <button type="submit" className="pc-dotbtn pc-dotbtn--big">
          <span className="pc-dotbtn__dot" aria-hidden="true">
            <ArrowUpRight size={10} strokeWidth={2.2} />
          </span>
          <span className="pc-dotbtn__label">send it</span>
        </button>
        <p className="pcc-form__note">
          Opens a message to Alex and Solomon in your email app. Or write to{' '}
          <a href={`mailto:${LEADERS[0].email}`} className="pc-line">
            {LEADERS[0].email}
          </a>
        </p>
      </div>
    </form>
  )
}

export default function ConsultingContact() {
  const [openJob, setOpenJob] = useState<number | null>(0)
  return (
    <ConsultingShell title="Connect · UBLDA Consulting" motion={startContact}>
      <section className="pcc-hero">
        <Clock />
        <div className="pcc-hero__over">
          <h1 className="pcc-hero__title">
            <HeroLines lines={['We think access is a business problem', 'worth solving well. If you do too,', 'let’s talk.']} />
          </h1>
          <DotButton href="#contact-form">Connect</DotButton>
        </div>
      </section>

      <section className="pcc-connect" aria-label="Contact details">
        <div className="pcc-connect__line" aria-hidden="true">
          <span />
        </div>
        <div className="pcc-connect__wrap" data-stagger>
          <h2 className="pcc-connect__eyebrow">Email</h2>
          {LEADERS.map((l) => (
            <a href={`mailto:${l.email}`} className="pcc-connect__mail pc-line" key={l.email}>
              {l.email}
            </a>
          ))}
          <div className="pcc-connect__cols">
            <div>
              <h3>Project managers</h3>
              {LEADERS.map((l) => (
                <p key={l.name}>
                  <a href={l.linkedin} target="_blank" rel="noopener noreferrer" className="pc-line">
                    {l.name}
                  </a>
                  <br />
                  <span className="pcc-connect__muted">{l.role}</span>
                </p>
              ))}
            </div>
            <div>
              <h3>Ann Arbor</h3>
              <p>
                {ROSS_ADDRESS.map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </p>
            </div>
            <div>
              <h3>Elsewhere</h3>
              <p>
                {SOCIAL.map((s) => (
                  <span key={s.href}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className="pc-line">
                      {s.label}
                    </a>
                    <br />
                  </span>
                ))}
                <Link to="/" className="pc-line">
                  ublda.org
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pcc-form" id="contact-form" aria-labelledby="pcc-form-title">
        <div className="pcc-form__wrap">
          <div className="pcc-form__left">
            <h2 id="pcc-form-title">Start a conversation</h2>
            <p>A paragraph is enough. We reply within a week.</p>
          </div>
          <div className="pcc-form__right">
            <ContactForm />
          </div>
        </div>
      </section>

      <section className="pcc-join" aria-labelledby="pcc-join-title">
        <div className="pcc-join__wrap" data-reveal>
          <h2 id="pcc-join-title">Join the team</h2>
          <p>All majors and years. Applying for the consulting team also makes you a UBLDA member.</p>
        </div>
        <div className="pcc-jobs">
          <h2 className="pcc-jobs__title" data-reveal>
            Current openings
          </h2>
          {OPENINGS.map((job, i) => {
            const isOpen = openJob === i
            return (
              <div className={`pcc-job ${isOpen ? 'pcc-job--open' : ''}`} key={job.title}>
                <button type="button" className="pcc-job__head" aria-expanded={isOpen} aria-controls={`pcc-job-${i}`} onClick={() => setOpenJob(isOpen ? null : i)}>
                  <span>{job.title}</span>
                  <span className="pc-acc__plus" aria-hidden="true" />
                </button>
                <div className="pcc-job__body" id={`pcc-job-${i}`}>
                  <div>
                    <p className="pcc-job__facts">
                      {job.facts.map((f) => (
                        <span key={f}>{f.toUpperCase()}</span>
                      ))}
                      <span>TERM: {job.term.toUpperCase()}</span>
                    </p>
                    <h3>About you</h3>
                    <p>{job.about}</p>
                    <h3>What you’ll do</h3>
                    <ul>
                      {job.doing.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                    <h3>Requirements</h3>
                    <ul>
                      {job.requirements.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                    <a href={job.cta.href} target="_blank" rel="noopener noreferrer" className="pc-arrowbtn">
                      <span className="pc-arrowbtn__arrow" aria-hidden="true">
                        <ArrowUpRight size={14} strokeWidth={2.2} />
                        <ArrowUpRight size={14} strokeWidth={2.2} />
                      </span>
                      <span className="pc-arrowbtn__label">
                        {job.cta.label}
                        <NewTab />
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </ConsultingShell>
  )
}
