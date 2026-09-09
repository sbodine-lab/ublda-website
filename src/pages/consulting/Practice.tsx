import { ArrowUpRight } from 'lucide-react'
import { CONTACT_MAILTO, LEADERS } from './content'
import { all, buildHeroExit, buildParallax, buildReveals, buildWordmark, gsap, one, startMotion, type Builder, type MotionStarter } from './engine'
import { DotButton, HeroLines, HeroRings } from './parts'
import { ConsultingShell } from './Shell'

const FACTS = [
  {
    title: 'Launching Fall 2026',
    desc: 'Our first client is Arc Thrift Stores of Colorado, the nonprofit thrift chain that funds Colorado’s Arc chapters.',
  },
  {
    title: 'Pro bono projects',
    desc: 'We don’t charge clients. Each project needs a point of contact, an agreed scope, and time for check-ins and feedback.',
  },
  {
    title: 'Partnered with BLDA',
    desc: 'Business Leaders for Diverse Abilities is our MBA counterpart at Michigan Ross. We’re developing opportunities for its members to support our student consultants.',
  },
]

const HOW = [
  { title: 'Scope', desc: 'Agree on the business question and deliverables with the client.' },
  { title: 'Research', desc: 'Gather evidence through interviews and research suited to the project.' },
  { title: 'Analyze', desc: 'Compare options and test the assumptions behind the recommendations.' },
  { title: 'Recommend', desc: 'Explain what the client should do and the evidence behind it.' },
  { title: 'Present', desc: 'Share early findings at a midpoint review and present the final recommendations.' },
  { title: 'Hand over', desc: 'Give the client the research and materials needed to use the recommendations.' },
]

const VALUES = [
  { title: 'Nothing about us without us', desc: 'Disabled students help shape our work. For accessibility projects, we seek input from people who use the product or service.' },
  { title: 'Clear limits', desc: 'We provide student research and recommendations. We don’t offer legal advice or compliance certification.' },
  { title: 'Useful recommendations', desc: 'We explain our findings and assumptions so the client can decide what to do next.' },
  { title: 'Focused scope', desc: 'We agree on a question the team can address within a semester.' },
]

const BIOS: Record<string, string> = {
  'Alex Forstner': 'Leads UBLDA’s education programming and co-manages the Fall 2026 project.',
  'Solomon DeYoung': 'Leads outreach and partnerships and co-manages the Fall 2026 project.',
}

const VALUE_RING = 'DISABILITY INCLUSION · STUDENT RESEARCH · BUSINESS STRATEGY · '

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
            <HeroLines lines={['Michigan students working on', 'business strategy and accessibility', 'through semester-long client projects.']} />
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
            We provide business consulting for disability-focused organizations and accessibility consulting for
            teams within companies. The client’s question determines the research and recommendations.
          </p>
          <p>
            Four to six analysts work with two project managers on weekly deliverables. The client reviews
            early findings at the midpoint and receives a final presentation at the end of the semester.
          </p>
          <a href={CONTACT_MAILTO} className="pc-arrowbtn">
            <span className="pc-arrowbtn__arrow" aria-hidden="true">
              <ArrowUpRight size={14} strokeWidth={2.2} />
              <ArrowUpRight size={14} strokeWidth={2.2} />
            </span>
            <span className="pc-arrowbtn__label">Discuss a project</span>
          </a>
        </div>
        <div className="pcp-prose__two" data-reveal>
          <h2 className="pcp-h2">Meet the project managers.</h2>
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
              <span className="pc-arrowbtn__label">Email</span>
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
