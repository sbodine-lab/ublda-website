import { ArrowUpRight } from 'lucide-react'
import { CONTACT_MAILTO, LEADERS } from './content'
import { all, buildHeroExit, buildParallax, buildReveals, buildWordmark, gsap, one, startMotion, type Builder, type MotionStarter } from './engine'
import { DotButton, HeroLines, HeroRings } from './parts'
import { ConsultingShell } from './Shell'

const FACTS = [
  {
    title: 'First of its kind at Ross',
    desc: 'UBLDA is the first disability-focused consulting club at Michigan Ross. The practice launched in Fall 2026 with one client, chosen by the whole board.',
  },
  {
    title: 'Pro bono, always',
    desc: 'Our work costs the client nothing. We ask for a sponsor, a scoped brief, a kickoff call, and four to five hours across the semester.',
  },
  {
    title: 'Partnered with BLDA',
    desc: 'Business Leaders for Diverse Abilities is our MBA counterpart at Ross. Its advisors review our work before it reaches a client.',
  },
]

const HOW = [
  { title: 'Scope', desc: 'A scoping call, then a written scope your sponsor signs off on.' },
  { title: 'Research', desc: 'Interviews, walkthroughs, and desk research, reported weekly.' },
  { title: 'Test', desc: 'Real people, including disabled students, trying the actual experience.' },
  { title: 'Recommend', desc: 'Findings ranked by impact, with the fix that matters most first.' },
  { title: 'Present', desc: 'A midpoint review and a final presentation to your leadership.' },
  { title: 'Enable', desc: 'Templates, checklists, and training so the fixes outlast us.' },
]

const VALUES = [
  { title: 'Nothing about us without us', desc: 'Our consultants include disabled students. That shapes what we notice and what we push on.' },
  { title: 'Honest about what we are', desc: 'Students whose work gets advisor review. We never certify anything as compliant, and we say so up front.' },
  { title: 'Fixes that outlast us', desc: 'We would rather teach your team to catch issues than be the only ones who can.' },
  { title: 'One project, done well', desc: 'One client a semester, chosen by the whole board, so the team has the capacity to do it right.' },
]

const BIOS: Record<string, string> = {
  'Alex Forstner': 'Runs UBLDA’s speaker series and education programming, and co-leads the Fall 2026 engagement.',
  'Solomon DeYoung': 'Brings consulting-project experience and the partner relationships behind our client pipeline.',
}

const VALUE_RING = 'ACCESS FIRST · HONEST WORK · FIXES THAT LAST · NOTHING ABOUT US WITHOUT US · '

const buildPractice: Builder = (root, { hover }) => {
  const hero = one(root, '.pcp-hero')
  buildWordmark(root, hero)
  const cleanupParallax = buildParallax(one(root, '.pcp-hero__art'), hero, hover)
  buildHeroExit(one(root, '.pcp-hero__over'), hero)

  const facts = one(root, '.pcp-facts')
  gsap.fromTo(
    all(facts, '.pcp-fact'),
    { opacity: 0, y: 60 },
    { opacity: 1, y: 0, stagger: 0.4, ease: 'none', scrollTrigger: { trigger: facts, start: 'top 65%', end: 'top 10%', scrub: 1 } },
  )
  gsap.fromTo(
    all(facts, '.pcp-fact__line'),
    { scaleX: 0 },
    { scaleX: 1, stagger: 0.4, ease: 'none', transformOrigin: 'left center', scrollTrigger: { trigger: facts, start: 'top 60%', end: 'top 5%', scrub: 1 } },
  )

  buildReveals(root)

  gsap.fromTo(
    all(root, '.pcp-box'),
    { y: 80, opacity: 0 },
    { y: 0, opacity: 1, stagger: 0.2, ease: 'none', scrollTrigger: { trigger: one(root, '.pcp-boxes'), start: 'top 80%', end: 'top 40%', scrub: 1 } },
  )

  const values = one(root, '.pcp-values')
  const ring = one(values, '.pcp-values__ring')
  gsap
    .timeline({ scrollTrigger: { trigger: values, start: 'top top', end: '+=150%', pin: true, scrub: 1 } })
    .fromTo(ring, { scale: 0.7, opacity: 0.35 }, { scale: 1, opacity: 1, duration: 1, ease: 'none' }, 0)
    .to(ring, { rotation: 200, duration: 3, ease: 'none' }, 0)

  return () => cleanupParallax()
}

const startPractice: MotionStarter = (root, onMode, reduce) => startMotion(root, onMode, buildPractice, { reduce })

export default function ConsultingPractice() {
  return (
    <ConsultingShell title="The practice · UBLDA Consulting" motion={startPractice}>
      <section className="pcp-hero">
        <div className="pcp-hero__art" aria-hidden="true">
          <HeroRings />
        </div>
        <div className="pcp-hero__over">
          <h1 className="pcp-hero__title">
            <HeroLines lines={['Student consultants with lived experience.', 'Business-school rigor behind them.', 'Work your team can carry forward.']} />
          </h1>
          <DotButton to="/consulting/work">Our work</DotButton>
        </div>
      </section>

      <section className="pcp-facts" aria-label="About the practice">
        <div className="pcp-facts__art" aria-hidden="true">
          <HeroRings />
        </div>
        <div className="pcp-facts__over">
          {FACTS.map((f) => (
            <div className="pcp-fact" key={f.title}>
              <h2 className="pcp-fact__title">{f.title}</h2>
              <span className="pcp-fact__line" aria-hidden="true" />
              <p className="pcp-fact__desc">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="pcp-facts__fade" aria-hidden="true" />
      </section>

      <section className="pcp-prose">
        <div data-reveal>
          <h2 className="pcp-h2">How we work</h2>
          <p>
            For most organizations the work is accessibility: where disabled customers, applicants, and employees get
            stuck, and what to fix first. For organizations with a disability mission, we do general business
            consulting.
          </p>
          <p>
            One scoped project per semester. Four to six analysts and two co-project managers meet your sponsor weekly,
            present at the midpoint, and close with a final presentation and handoff.
          </p>
          <a href={CONTACT_MAILTO} className="pc-arrowbtn">
            <span className="pc-arrowbtn__arrow" aria-hidden="true">
              <ArrowUpRight size={14} strokeWidth={2.2} />
              <ArrowUpRight size={14} strokeWidth={2.2} />
            </span>
            <span className="pc-arrowbtn__label">Let’s talk</span>
          </a>
        </div>
        <div className="pcp-prose__two" data-reveal>
          <h2 className="pcp-h2">Two project managers. One team.</h2>
          <p className="pcp-prose__lead">Alex and Solomon run the Fall 2026 engagement.</p>
        </div>
      </section>

      <section className="pcp-team" aria-label="Project managers">
        {LEADERS.map((p, i) => (
          <article className="pcp-member" key={p.name} data-reveal>
            <div className={`pcp-member__tile pcp-member__tile--${i % 2 ? 'gold' : 'teal'}`} aria-hidden="true">
              <span>
                {p.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </span>
              <span className="pcp-member__ring" />
            </div>
            <h3 className="pcp-member__name">{p.name}</h3>
            <p className="pcp-member__tag">{p.role}</p>
            <p className="pcp-member__desc">{BIOS[p.name]}</p>
            <a href={p.linkedin} target="_blank" rel="noopener noreferrer" className="pc-arrowbtn">
              <span className="pc-arrowbtn__arrow" aria-hidden="true">
                <ArrowUpRight size={14} strokeWidth={2.2} />
                <ArrowUpRight size={14} strokeWidth={2.2} />
              </span>
              <span className="pc-arrowbtn__label">Connect</span>
            </a>
          </article>
        ))}
      </section>

      <section className="pcp-how">
        <h2 className="pcp-how__title" data-reveal>
          How an engagement runs
        </h2>
        <div className="pcp-boxes">
          {HOW.map((h, i) => (
            <div className="pcp-box" key={h.title}>
              <span className={`pcp-box__icon pcp-box__icon--${i + 1}`} aria-hidden="true" />
              <h3>{h.title}</h3>
              <p>{h.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="pcp-values" aria-labelledby="pcp-values-title">
        <h2 id="pcp-values-title" className="pcp-values__title">
          Our
          <br />
          values
        </h2>
        <svg className="pcp-values__ring" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
          <defs>
            <path id="pcp-ring-path" d="M300,300 m-230,0 a230,230 0 1,1 460,0 a230,230 0 1,1 -460,0" />
          </defs>
          <circle cx="300" cy="300" r="290" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
          <circle cx="300" cy="300" r="170" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.35" />
          <text className="pcp-values__text">
            <textPath href="#pcp-ring-path" startOffset="0">
              {VALUE_RING}
              {VALUE_RING}
            </textPath>
          </text>
        </svg>
      </section>

      <section className="pcp-valueboxes" data-reveal data-reveal-group>
        {VALUES.map((v) => (
          <div className="pcp-valuebox" key={v.title}>
            <h3>{v.title}</h3>
            <p>{v.desc}</p>
          </div>
        ))}
      </section>
    </ConsultingShell>
  )
}
