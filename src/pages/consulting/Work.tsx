import { ArrowDown, ArrowUp, ArrowUpRight, List } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CLIENT } from './content'
import { all, buildWordmark, gsap, one, startMotion, type Builder, type MotionStarter } from './engine'
import { DotButton, NewTab } from './parts'
import { ConsultingShell } from './Shell'

interface Project {
  id: string
  title: [string, string]
  tag: string
  dec: string
  tone: 'teal' | 'navy' | 'gold'
  status: string
  details: string[]
  link: { href: string; label: string; external?: boolean }
}

const PROJECTS: Project[] = [
  {
    id: 'arc',
    title: ['Arc Thrift Stores', 'of Colorado'],
    tag: 'Fall 2026 · Business case',
    dec: 'Scaling Arc University, a post-secondary program for adults with intellectual and developmental disabilities.',
    tone: 'teal',
    status: 'In progress',
    details: ['Market sizing and target segments', 'Pricing and revenue model', 'Go-to-market plan', 'Five-year business case', 'Executive recommendation'],
    link: { href: CLIENT.url, label: 'arcthrift.com', external: true },
  },
  {
    id: 'winter',
    title: ['Winter 2027', 'engagement'],
    tag: 'Chosen in October',
    dec: 'Our board votes on the next client in October. Discovery calls are under way.',
    tone: 'navy',
    status: 'Scoping',
    details: ['Discovery calls with several organizations', 'A written scope from each candidate', 'A vote of the whole board', 'Kickoff in January'],
    link: { href: '/consulting/contact', label: 'Put your organization forward' },
  },
  {
    id: 'you',
    title: ['Your', 'organization'],
    tag: 'Open for scoping',
    dec: 'One project, one semester, no fee. Tell us where people get stuck.',
    tone: 'gold',
    status: 'Open',
    details: ['A sponsor who can make decisions', 'A problem you can describe in a paragraph', 'A kickoff call and four to five hours across the semester', 'Willingness to let us talk to real users'],
    link: { href: '/consulting/contact', label: 'Start a conversation' },
  },
]

const FULL = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)'
const TOP = 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)'
const BOTTOM = 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)'

/* Full-screen slideshow driven by the wheel, keys, swipes, or the arrows.
   The stage owns the wheel only while the page sits at the top and a slide
   remains in that direction; otherwise the event falls through to Lenis. */
const buildWork: Builder = (root, { lenis }) => {
  const stage = one(root, '.pcw')
  buildWordmark(root, stage)
  const slides = all(root, '.pcw-slide')
  const counter = one(root, '[data-current]')
  const list = one(root, '.pcw-list')
  let index = 0
  let busy = false

  const frame = (s: HTMLElement) => one(s, '.pcw-slide__frame')
  const art = (s: HTMLElement) => one(s, '.pcw-slide__art')
  const titles = (s: HTMLElement) => all(s, '.pcw-slide__line > span')
  const meta = (s: HTMLElement) => all(s, '.pcw-slide__tag, .pcw-slide__dec, .pcw-slide__cta')

  slides.forEach((s, i) => {
    gsap.set(s, { autoAlpha: i === 0 ? 1 : 0 })
    gsap.set(frame(s), { clipPath: i === 0 ? FULL : BOTTOM })
    s.setAttribute('aria-hidden', i === 0 ? 'false' : 'true')
  })
  gsap.fromTo(titles(slides[0]), { yPercent: 110, rotate: 5 }, { yPercent: 0, rotate: 0, duration: 1, ease: 'power3.out', stagger: 0.08, delay: 0.2 })
  gsap.fromTo(frame(slides[0]), { clipPath: BOTTOM }, { clipPath: FULL, duration: 1.2, ease: 'power3.inOut' })
  gsap.fromTo(meta(slides[0]), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.8, delay: 0.6 })

  const goTo = (next: number, dir: 1 | -1) => {
    if (busy || next === index || next < 0 || next >= slides.length) return
    busy = true
    const cur = slides[index]
    const nxt = slides[next]
    gsap.set(nxt, { autoAlpha: 1 })
    nxt.setAttribute('aria-hidden', 'false')
    gsap
      .timeline({
        onComplete: () => {
          busy = false
          gsap.set(cur, { autoAlpha: 0 })
          cur.setAttribute('aria-hidden', 'true')
        },
      })
      .to(frame(cur), { clipPath: dir > 0 ? TOP : BOTTOM, duration: 1, ease: 'power3.inOut' }, 0)
      .to(art(cur), { scale: 1.15, duration: 1, ease: 'power3.inOut' }, 0)
      .to(titles(cur), { yPercent: dir > 0 ? -110 : 110, rotate: dir > 0 ? -5 : 5, duration: 0.7, ease: 'power3.in', stagger: 0.05 }, 0)
      .to(meta(cur), { opacity: 0, y: dir * -16, duration: 0.5 }, 0)
      .to(one(cur, '.pcw-slide__bg'), { opacity: 0, duration: 1 }, 0)
      .fromTo(one(nxt, '.pcw-slide__bg'), { opacity: 0 }, { opacity: 1, duration: 1 }, 0)
      .fromTo(frame(nxt), { clipPath: dir > 0 ? BOTTOM : TOP }, { clipPath: FULL, duration: 1, ease: 'power3.inOut' }, 0.1)
      .fromTo(art(nxt), { scale: 1.2 }, { scale: 1, duration: 1.2, ease: 'power3.out' }, 0.1)
      .fromTo(titles(nxt), { yPercent: dir > 0 ? 110 : -110, rotate: dir > 0 ? 5 : -5 }, { yPercent: 0, rotate: 0, duration: 0.8, ease: 'power3.out', stagger: 0.06 }, 0.35)
      .fromTo(meta(nxt), { opacity: 0, y: dir * 16 }, { opacity: 1, y: 0, duration: 0.6 }, 0.5)
    index = next
    counter.textContent = String(next + 1).padStart(2, '0')
  }

  const atTop = () => window.scrollY <= 20
  const wants = (dir: 1 | -1) => atTop() && (dir > 0 ? index < slides.length - 1 : index > 0)

  let acc = 0
  const onWheel = (e: WheelEvent) => {
    const dir: 1 | -1 = e.deltaY > 0 ? 1 : -1
    if (!wants(dir)) return
    e.preventDefault()
    e.stopPropagation()
    if (busy) {
      acc = 0
      return
    }
    acc += e.deltaY
    if (Math.abs(acc) > 60) {
      goTo(index + dir, dir)
      acc = 0
    }
  }
  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null
    if (target && target.closest('input, textarea, select, button, a, [contenteditable]')) return
    const down = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' '
    const up = e.key === 'ArrowUp' || e.key === 'PageUp'
    if (!down && !up) return
    const dir: 1 | -1 = down ? 1 : -1
    if (!wants(dir)) return
    e.preventDefault()
    goTo(index + dir, dir)
  }
  /* Touch: the browser decides on the first touchmove whether a gesture
     scrolls, so that is where the stage claims it. While a slide remains in
     the swipe's direction the page holds still and the swipe changes the
     slide; otherwise the swipe scrolls the page as normal. */
  let touchY = 0
  let touchOwned = false
  let touchDone = false
  const onTouchStart = (e: TouchEvent) => {
    touchY = e.touches[0].clientY
    touchOwned = false
    touchDone = false
  }
  const onTouchMove = (e: TouchEvent) => {
    const dy = touchY - e.touches[0].clientY
    const dir: 1 | -1 = dy > 0 ? 1 : -1
    if (!touchOwned) {
      if (!wants(dir)) return
      touchOwned = true
    }
    if (e.cancelable) e.preventDefault()
    if (touchDone || busy || Math.abs(dy) < 40) return
    touchDone = true
    goTo(index + dir, dir)
  }
  const onPrev = () => goTo(index - 1, -1)
  const onNext = () => goTo(index + 1, 1)
  const onList = () => {
    if (lenis) lenis.scrollTo(list, { offset: 0 })
    else list.scrollIntoView({ behavior: 'smooth' })
  }

  window.addEventListener('wheel', onWheel, { passive: false, capture: true })
  window.addEventListener('keydown', onKey)
  stage.addEventListener('touchstart', onTouchStart, { passive: true })
  stage.addEventListener('touchmove', onTouchMove, { passive: false })
  const prev = one(root, '.pcw-ui__prev')
  const next = one(root, '.pcw-ui__next')
  const listBtn = one(root, '.pcw-ui__list')
  prev.addEventListener('click', onPrev)
  next.addEventListener('click', onNext)
  listBtn.addEventListener('click', onList)

  return () => {
    window.removeEventListener('wheel', onWheel, { capture: true })
    window.removeEventListener('keydown', onKey)
    stage.removeEventListener('touchstart', onTouchStart)
    stage.removeEventListener('touchmove', onTouchMove)
    prev.removeEventListener('click', onPrev)
    next.removeEventListener('click', onNext)
    listBtn.removeEventListener('click', onList)
  }
}

const startWork: MotionStarter = (root, onMode, reduce) => startMotion(root, onMode, buildWork, { reduce })

function ProjectLink({ link }: { link: Project['link'] }) {
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className="pc-line pcw-link">
        {link.label}
        <NewTab />
        <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
      </a>
    )
  }
  return (
    <Link to={link.href} className="pc-line pcw-link">
      {link.label}
      <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
    </Link>
  )
}

export default function ConsultingWork() {
  return (
    <ConsultingShell title="Work · UBLDA Consulting" motion={startWork}>
      <section className="pcw" aria-roledescription="carousel" aria-label="Engagements">
        <p className="sr-only">Use the previous and next buttons, or the arrow keys, to move between engagements. The same engagements are listed below.</p>
        {PROJECTS.map((p, i) => (
          <div className={`pcw-slide pcw-slide--${p.tone}`} key={p.id} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${PROJECTS.length}: ${p.title.join(' ')}`}>
            <div className="pcw-slide__bg" aria-hidden="true" />
            <div className="pcw-slide__text">
              <h2 className="pcw-slide__title">
                <span className="pcw-slide__line">
                  <span>{p.title[0]} </span>
                </span>
                <span className="pcw-slide__line">
                  <span>{p.title[1]}</span>
                </span>
              </h2>
              <p className="pcw-slide__tag">{p.tag}</p>
              <p className="pcw-slide__dec">{p.dec}</p>
              <p className="pcw-slide__cta">
                <ProjectLink link={p.link} />
              </p>
            </div>
            <div className="pcw-slide__frame">
              <div className="pcw-slide__art" aria-hidden="true">
                <span className="pcw-slide__num">{String(i + 1).padStart(2, '0')}</span>
                <span className="pc-card__ring" />
                <span className="pc-card__ring pc-card__ring--2" />
                <span className="pcw-slide__status">{p.status}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="pcw-ui">
          <button type="button" className="pcw-ui__list">
            <List size={14} strokeWidth={2} aria-hidden="true" />
            List view
          </button>
          <div className="pcw-ui__counter" aria-live="polite">
            <span data-current>01</span> / {String(PROJECTS.length).padStart(2, '0')}
          </div>
          <div className="pcw-ui__arrows">
            <button type="button" className="pcw-ui__prev" aria-label="Previous engagement">
              <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />
            </button>
            <button type="button" className="pcw-ui__next" aria-label="Next engagement">
              <ArrowDown size={16} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      <section className="pcw-list" id="work-list" aria-labelledby="pcw-list-title">
        <div className="pcw-list__head">
          <h2 id="pcw-list-title">
            Engagements <sup>({PROJECTS.length})</sup>
          </h2>
          <p>One client a semester, chosen by the whole board. Everything else is in the pipeline or waiting on you.</p>
        </div>
        <div className="pcw-list__rows">
          {PROJECTS.map((p, i) => (
            <article className={`pcw-row pcw-row--${p.tone}`} key={p.id}>
              <span className="pcw-row__num">{String(i + 1).padStart(2, '0')}</span>
              <div className="pcw-row__main">
                <h3>{p.title.join(' ')}</h3>
                <p className="pcw-row__tag">
                  {p.tag} &middot; {p.status}
                </p>
                <p className="pcw-row__dec">{p.dec}</p>
                <ul className="pcw-row__details">
                  {p.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                <ProjectLink link={p.link} />
              </div>
              <div className={`pcw-row__art pc-card--${p.tone}`} aria-hidden="true">
                <div className="pc-card__art">
                  <span className="pc-card__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="pc-card__ring" />
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="pcw-list__foot">
          <DotButton to="/consulting/services">What we work on</DotButton>
        </div>
      </section>
    </ConsultingShell>
  )
}
