import { Link } from 'react-router-dom'
import { PARTNERS } from './content'
import { all, buildHeroExit, buildParallax, buildReveals, buildWordmark, gsap, one, startMotion, type Builder, type MotionStarter } from './engine'
import { DotButton, HeroLines, HeroRings } from './parts'
import { ConsultingShell } from './Shell'

const STATS = [
  { value: '25%', label: 'of adults', desc: 'One in four adults in the US has a disability. Serve them well and you reach people your competitors overlook.' },
  { value: '1', label: 'client a semester', desc: 'Chosen by the whole board, so the team can do it well.' },
  { value: '6', label: 'analysts at most', desc: 'Four to six analysts and two co-project managers, with advisor review.' },
  { value: '$0', label: 'cost to you', desc: 'What our work costs the organizations we serve. Pro bono, always.' },
]

const STATEMENT = [
  'UBLDA Consulting works with the Ross community,',
  'University of Michigan offices, disability organizations,',
  'and companies that want to serve disabled customers',
  'and employees better than they do today.',
]

interface Tile {
  name: string
  kind: string
  src?: string
  to?: string
}

const TILES: Tile[] = [
  { name: 'Michigan Ross', kind: 'Home school', src: PARTNERS[0].src },
  { name: 'Community, Culture and Belonging', kind: 'University office', src: PARTNERS[1].src },
  { name: 'BLDA', kind: 'MBA partner chapter', src: PARTNERS[2].src },
  { name: 'Nestidd', kind: 'Inaugural fireside speaker', src: PARTNERS[3].src },
  { name: 'Arc Thrift Stores of Colorado', kind: 'Fall 2026 client' },
  { name: 'Wall Street Oasis', kind: 'Member resources' },
  { name: 'Nonprofits', kind: 'Who we work with' },
  { name: 'Community organizations', kind: 'Who we work with' },
  { name: 'Companies with a disability mission', kind: 'Who we work with' },
  { name: 'Your organization', kind: 'Start a conversation', to: '/consulting/contact' },
]

const INDEX = [
  { name: 'Arc Thrift Stores of Colorado', kind: 'Client', note: 'Arc University business case, Fall 2026' },
  { name: 'Business Leaders for Diverse Abilities', kind: 'MBA chapter', note: 'Advisors, mentors, and the origin of the model' },
  { name: 'Michigan Ross', kind: 'School', note: 'Where the club lives and where the team meets' },
  { name: 'Office of Community, Culture and Belonging', kind: 'University office', note: 'Funded the inaugural fireside chat, March 2026' },
  { name: 'Nestidd', kind: 'Speaker', note: 'CEO Andrew Parker spoke at the inaugural fireside, March 2026' },
  { name: 'Wall Street Oasis', kind: 'Resources', note: 'Member perks and materials since June 2026' },
]

const buildPartners: Builder = (root, { hover }) => {
  const hero = one(root, '.pcb-hero')
  buildWordmark(root, hero)
  const cleanupParallax = buildParallax(one(root, '.pcb-hero__art'), hero, hover)
  buildHeroExit(one(root, '.pcb-hero__over'), hero)

  /* Odometer digits roll from zero to their value as the counters arrive. */
  const counters = one(root, '.pcb-counters')
  all(counters, '.pcb-odo__col').forEach((col) => {
    const target = Number(col.dataset.target ?? 0)
    const h = col.firstElementChild ? (col.firstElementChild as HTMLElement).offsetHeight : 0
    gsap.fromTo(col, { y: 0 }, { y: -h * target, ease: 'none', scrollTrigger: { trigger: counters, start: 'top 70%', end: 'top 45%', scrub: 1 } })
  })
  gsap.fromTo(one(counters, '.pcb-line__fill'), { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', ease: 'none', scrollTrigger: { trigger: counters, start: 'top 50%', end: 'top 20%', scrub: 1 } })
  gsap.fromTo(all(counters, '.pcb-stat__desc'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, stagger: 0.15, scrollTrigger: { trigger: counters, start: 'top 40%' } })

  const lines = all(root, '.pcb-statement__line span')
  gsap.fromTo(lines, { yPercent: 110 }, { yPercent: 0, duration: 1, ease: 'power3.out', stagger: 0.12, scrollTrigger: { trigger: one(root, '.pcb-statement'), start: 'top 75%' } })

  const grid = one(root, '.pcb-grid')
  gsap.fromTo(all(grid, '.pcb-tile'), { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, stagger: { each: 0.06, from: 'start' }, duration: 0.8, ease: 'power2.out', scrollTrigger: { trigger: grid, start: 'top 75%' } })
  gsap.fromTo(all(root, '.pcb-index__row'), { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.08, scrollTrigger: { trigger: one(root, '.pcb-index'), start: 'top 75%' } })

  buildReveals(root)
  return () => cleanupParallax()
}

const startPartners: MotionStarter = (root, onMode, reduce) => startMotion(root, onMode, buildPartners, { reduce })

function Odometer({ value }: { value: string }) {
  return (
    <span className="pcb-odo" aria-hidden="true">
      {value.split('').map((ch, i) =>
        /\d/.test(ch) ? (
          <span className="pcb-odo__slot" key={i}>
            <span className="pcb-odo__col" data-target={ch} style={{ '--n': ch } as React.CSSProperties}>
              {Array.from({ length: 10 }, (_, d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span className="pcb-odo__static" key={i}>
            {ch}
          </span>
        ),
      )}
    </span>
  )
}

function TileInner({ t }: { t: Tile }) {
  return (
    <>
      <span className="pcb-tile__cover" aria-hidden="true">
        <span>{t.kind}</span>
      </span>
      <span className="pcb-tile__logo">
        {t.src ? <img src={t.src} alt={t.name} loading="lazy" decoding="async" /> : <span className="pcb-tile__name">{t.name}</span>}
      </span>
    </>
  )
}

export default function ConsultingPartners() {
  return (
    <ConsultingShell title="Partners · UBLDA Consulting" motion={startPartners}>
      <section className="pcb-hero">
        <div className="pcb-hero__art" aria-hidden="true">
          <HeroRings />
        </div>
        <div className="pcb-hero__over">
          <h1 className="pcb-hero__title">
            <HeroLines lines={['The organizations we work with', 'already put disabled people', 'at the center. We help them prove it.']} />
          </h1>
          <DotButton to="/consulting/services">Our services</DotButton>
        </div>
      </section>

      <section className="pcb-counters" aria-label="By the numbers">
        <div className="pcb-stats">
          {STATS.map((s) => (
            <div className="pcb-stat" key={s.label}>
              <span className="sr-only">{s.value}</span>
              <Odometer value={s.value} />
              <p className="pcb-stat__label">{s.label}</p>
            </div>
          ))}
        </div>
        <div className="pcb-line" aria-hidden="true">
          <span className="pcb-line__fill" />
        </div>
        <div className="pcb-stats pcb-stats--desc">
          {STATS.map((s) => (
            <p className="pcb-stat__desc" key={s.label}>
              {s.desc}
            </p>
          ))}
        </div>
      </section>

      <section className="pcb-statement" aria-label="Who we work with">
        <h2>
          {STATEMENT.map((line) => (
            <span className="pcb-statement__line" key={line}>
              <span>{line}</span>
            </span>
          ))}
        </h2>
      </section>

      <section className="pcb-selected" aria-labelledby="pcb-selected-title">
        <h2 id="pcb-selected-title" data-reveal>
          Selected partners
        </h2>
        <div className="pcb-grid">
          {TILES.map((t) =>
            t.to ? (
              <Link to={t.to} className="pcb-tile pcb-tile--link" key={t.name} aria-label={`${t.name}: ${t.kind}`}>
                <TileInner t={t} />
              </Link>
            ) : (
              <div className="pcb-tile" key={t.name} title={t.kind}>
                <TileInner t={t} />
              </div>
            ),
          )}
        </div>
      </section>

      <section className="pcb-index" aria-labelledby="pcb-index-title">
        <h2 id="pcb-index-title" data-reveal>
          Partner index <sup>({INDEX.length})</sup>
        </h2>
        <div className="pcb-index__head" aria-hidden="true">
          <span>Partner</span>
          <span>Kind</span>
          <span>Note</span>
        </div>
        <ul className="pcb-index__rows">
          {INDEX.map((r) => (
            <li className="pcb-index__row" key={r.name}>
              <span className="pcb-index__name">{r.name}</span>
              <span className="pcb-index__kind">{r.kind}</span>
              <span className="pcb-index__note">{r.note}</span>
            </li>
          ))}
        </ul>
        <div className="pcb-index__foot" data-reveal>
          <DotButton to="/consulting/contact" className="pc-dotbtn--big">
            become a partner
          </DotButton>
        </div>
      </section>
    </ConsultingShell>
  )
}
