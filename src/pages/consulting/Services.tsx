import { useState } from 'react'
import { MeshGradient } from '@paper-design/shaders-react'
import { CONTACT_MAILTO } from './content'
import { all, buildDrawLine, buildReveals, buildWordmark, gsap, one, startMotion, type Builder, type MotionStarter } from './engine'
import { DotButton } from './parts'
import { ConsultingShell } from './Shell'
import { useConsultingUi } from './context'

const AREAS = [
  {
    title: 'Websites & apps',
    items: ['Screen reader walkthroughs', 'Keyboard and focus review', 'Color and contrast', 'Forms and checkout flows', 'Plain-language findings', 'Fix-first priorities'],
  },
  {
    title: 'Documents & communications',
    items: ['Accessible PDFs', 'Slide decks', 'Email and newsletters', 'Alt text and captions', 'Social media posts', 'Templates your team keeps'],
  },
  {
    title: 'Hiring & workplace',
    items: ['Job post language', 'Application flow review', 'Interview accommodations', 'Onboarding materials', 'Manager guidance', 'Disclosure and accommodation process'],
  },
  {
    title: 'Events & programs',
    items: ['Venue and route check', 'Accommodation planning', 'Registration forms', 'Presentation materials', 'Captioning and ASL logistics', 'Follow-up materials'],
  },
  {
    title: 'Strategy & business cases',
    items: ['Market sizing', 'Customer and segment research', 'Pricing', 'Go-to-market plan', 'Five-year model', 'Executive recommendation'],
  },
]

const JOURNEY = [
  { title: 'Scoping call', desc: 'Thirty minutes on what is stuck, who it affects, and what a useful answer would look like.' },
  { title: 'Written scope', desc: 'One page: the question, the deliverables, the timeline. Your sponsor signs off.' },
  { title: 'Kickoff', desc: 'The team meets your sponsor, agrees the check-in rhythm, and gets access to what it needs.' },
  { title: 'Weekly deliverables', desc: 'Something concrete every week, so nothing waits until the end to be wrong.' },
  { title: 'Midpoint review', desc: 'Early findings and a chance to redirect the second half of the semester.' },
  { title: 'Final presentation', desc: 'Findings, ranked fixes, and the business case, presented to your leadership.' },
  { title: 'Handoff', desc: 'Templates, checklists, and a walkthrough so your team can keep going without us.' },
]

const APPROACH = [
  { title: 'Findings', desc: 'Where people get stuck, shown rather than asserted, and ranked by how many people it blocks and how hard it is to fix.' },
  { title: 'Fixes', desc: 'Specific, practical changes your own team can make, written in plain language. Where a fix needs budget, we write the case for it.' },
  { title: 'Capability', desc: 'Training, templates, and checklists come with every engagement, so your team catches the next issue itself.' },
]

const FAQ = [
  { q: 'Is it really free?', a: 'Yes. We ask for a sponsor, a scoped brief, a kickoff call, and four to five hours of your time across the semester.' },
  { q: 'Who does the work?', a: 'Four to six undergraduate analysts and two co-project managers, selected by application and interview. Our consultants include disabled students, students who have worked on this for years, and students who arrived curious and learned it here.' },
  { q: 'Who reviews it?', a: 'Advisors from BLDA, our MBA counterpart at Michigan Ross, review deliverables before they reach you.' },
  { q: 'Do you certify ADA or WCAG compliance?', a: 'No. We find barriers, rank them, and help you fix them. Certification is a job for lawyers and specialist auditors.' },
  { q: 'How long is an engagement?', a: 'One semester. Fall 2026 kicks off the week of October 5 and closes with a final presentation at the end of the semester.' },
  { q: 'What kinds of organizations do you work with?', a: 'Nonprofits, community organizations, and companies that want to serve disabled customers and employees better. For organizations with a disability mission, we also do general business consulting.' },
  { q: 'How do we start?', a: 'Email Alex Forstner or Solomon DeYoung, or use the form on the connect page. We will set up a scoping call and follow up with a written scope within a week.' },
]

const buildServices: Builder = (root, { vw, vh }) => {
  const hero = one(root, '.pcs-hero')
  buildWordmark(root, hero)
  gsap.to(one(root, '.pcs-hero__lockup'), { y: -80, opacity: 0, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8 } })

  const areas = one(root, '.pcs-areas')
  buildDrawLine(one(areas, '.pcs-areas__line'), areas)
  buildReveals(root)

  /* Winding path: the track slides left while a glowing dot rides the curve
     and each step lights up as the dot reaches it. */
  const journey = one(root, '.pcs-journey')
  const track = one(journey, '.pcs-journey__track')
  const svg = one<HTMLElement>(journey, '.pcs-journey__svg')
  const path = svg.querySelector('path') as SVGPathElement
  const dot = one(journey, '.pcs-journey__dot')
  const steps = all(journey, '.pcs-journey__step')
  const width = vw(300)
  const height = vh(100)
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  const n = steps.length
  const seg = width / n
  const top = height * 0.3
  const bottom = height * 0.72
  let d = `M 0 ${height / 2}`
  for (let i = 0; i < n; i++) {
    const x0 = i * seg
    const x1 = (i + 1) * seg
    const y = i % 2 === 0 ? top : bottom
    const yEnd = height / 2
    d += ` C ${x0 + seg * 0.25} ${y}, ${x0 + seg * 0.75} ${y}, ${x1} ${yEnd}`
  }
  path.setAttribute('d', d)
  const length = path.getTotalLength()
  gsap.set(path, { strokeDasharray: length, strokeDashoffset: length })
  steps.forEach((step, i) => {
    const x = (i + 0.5) * seg
    const y = i % 2 === 0 ? top : bottom
    step.style.left = `${x}px`
    step.style.top = `${y}px`
    step.classList.toggle('pcs-journey__step--crest', i % 2 === 0)
  })
  const state = { p: 0 }
  gsap
    .timeline({
      scrollTrigger: {
        trigger: journey,
        start: 'top top',
        end: '+=350%',
        scrub: 1,
        pin: true,
        onUpdate: (self) => {
          state.p = self.progress
          steps.forEach((step, i) => {
            const at = (i + 0.5) / n
            const dist = Math.abs(self.progress - at)
            const on = Math.max(0, 1 - dist / 0.09)
            step.style.opacity = String(0.4 + 0.6 * on)
          })
        },
      },
    })
    .to(dot, { motionPath: { path, align: path, alignOrigin: [0.5, 0.5] }, ease: 'none', duration: 1 }, 0)
    .to(path, { strokeDashoffset: 0, ease: 'none', duration: 1 }, 0)
    .to(track, { x: -(width - vw(100)), ease: 'none', duration: 1 }, 0)

  /* Three pinned steps with a loader bar between them. */
  const approach = one(root, '.pcs-approach')
  const blocks = all(approach, '.pcs-approach__block')
  const cirs = all(approach, '.pcs-approach__cir')
  const bar = one(approach, '.pcs-approach__bar-fill')
  gsap.set(blocks, { opacity: 0, y: 30 })
  gsap.set(bar, { scaleX: 0, transformOrigin: 'left center' })
  const tl = gsap.timeline({ scrollTrigger: { trigger: approach, start: 'top top', end: '+=300%', scrub: 1, pin: true } })
  blocks.forEach((block, i) => {
    const at = i * 1.2 + 0.15
    tl.to(block, { opacity: 1, y: 0, duration: 0.5 }, at)
      .to(cirs[i], { scale: 1.25, backgroundColor: '#2bbab0', duration: 0.3 }, at)
      .to(one(cirs[i], '.pcs-approach__cir-label'), { color: '#091e2a', duration: 0.3 }, at)
      .to(bar, { scaleX: (i + 1) / blocks.length, duration: 0.8, ease: 'none' }, at + 0.2)
    if (i < blocks.length - 1) {
      tl.to(block, { opacity: 0, y: -30, duration: 0.4 }, at + 0.9)
    }
  })
}

const startServices: MotionStarter = (root, onMode, reduce) => startMotion(root, onMode, buildServices, { reduce })

const SHADER_DARK = ['#0B1F2F', '#14374E', '#2BBAB0', '#D4A034']
const SHADER_LIGHT = ['#FAF9F6', '#E8F6F4', '#2BBAB0', '#D4A034']

function ServicesBody() {
  const { theme, reducedMotion } = useConsultingUi()
  const [open, setOpen] = useState<number | null>(null)
  return (
    <>
      <section className="pcs-hero" aria-label="Services">
        <div className="pcs-hero__media" aria-hidden="true">
          <MeshGradient colors={theme === 'dark' ? SHADER_DARK : SHADER_LIGHT} distortion={0.9} swirl={0.6} speed={reducedMotion ? 0 : 0.25} style={{ width: '100%', height: '100%' }} />
        </div>
        <div className="pcs-hero__lockup">
          <p className="pcs-hero__eyebrow">Services</p>
          <h1 className="pcs-hero__title">Five ways we work with organizations.</h1>
        </div>
      </section>

      <section className="pcs-areas">
        <div className="pcs-areas__line" aria-hidden="true">
          <span />
        </div>
        <div className="pcs-areas__wrap">
          <div className="pcs-areas__left">
            <h2 data-reveal>Areas of work</h2>
          </div>
          <div className="pcs-areas__grid">
            {AREAS.map((a) => (
              <div className="pcs-service" key={a.title} data-reveal>
                <h3>{a.title}</h3>
                <ul>
                  {a.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
                <DotButton href={CONTACT_MAILTO}>Scope this</DotButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pcs-journey" aria-labelledby="pcs-journey-title">
        <h2 id="pcs-journey-title" className="pcs-journey__heading">
          How a project runs
        </h2>
        <div className="pcs-journey__track">
          <svg className="pcs-journey__svg" viewBox="0 0 3000 900" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d="M 0 450 L 3000 450" fill="none" stroke="currentColor" strokeWidth="26" strokeLinecap="round" />
          </svg>
          <span className="pcs-journey__dot" aria-hidden="true" />
          <ol className="pcs-journey__steps">
            {JOURNEY.map((s, i) => (
              <li className="pcs-journey__step" key={s.title}>
                <span className="pcs-journey__index">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="pcs-approach" aria-labelledby="pcs-approach-title">
        <h2 id="pcs-approach-title" className="pcs-approach__title">
          What you get
        </h2>
        <div className="pcs-approach__wrap">
          <div className="pcs-approach__steps" aria-hidden="true">
            {APPROACH.map((a, i) => (
              <span className="pcs-approach__cir" key={a.title}>
                <span className="pcs-approach__cir-label">{String(i + 1).padStart(2, '0')}</span>
              </span>
            ))}
            <span className="pcs-approach__bar">
              <span className="pcs-approach__bar-fill" />
            </span>
          </div>
          <div className="pcs-approach__content">
            {APPROACH.map((a) => (
              <div className="pcs-approach__block" key={a.title}>
                <h3>{a.title}</h3>
                <p>{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pcs-faq" aria-labelledby="pcs-faq-title">
        <h2 id="pcs-faq-title">FAQs</h2>
        <div className="pcs-faq__list">
          {FAQ.map((f, i) => {
            const isOpen = open === i
            return (
              <div className={`pcs-faq__item ${isOpen ? 'pcs-faq__item--open' : ''}`} key={f.q}>
                <button type="button" className="pcs-faq__q" aria-expanded={isOpen} aria-controls={`pcs-faq-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                  <span>{f.q}</span>
                  <span className="pc-acc__plus" aria-hidden="true" />
                </button>
                <div className="pcs-faq__a" id={`pcs-faq-${i}`}>
                  <p>{f.a}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

export default function ConsultingServices() {
  return (
    <ConsultingShell title="Services · UBLDA Consulting" motion={startServices}>
      <ServicesBody />
    </ConsultingShell>
  )
}
