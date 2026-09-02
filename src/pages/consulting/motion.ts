/* Scroll choreography for the Consulting home page.

   One "orb" travels the whole page: it starts as a full-screen disc behind
   the opening statement, shrinks to a dot, walks down the services list,
   parks in the centre of the horizontal scroller, and finally becomes the
   aperture through which the client section is revealed. */

import { all, buildCursor, buildWordmark, gsap, one, startMotion, ScrollTrigger, type Builder, type MotionStarter } from './engine'

export type { MotionHandle, MotionMode } from './engine'

export const buildHome: Builder = (root, { hover, vw }) => {
  const orb = one(root, '.pc-orb')
  const disc = one(root, '.pc-disc')
  const hero = one(root, '.pc-hero')
  const statement = one(root, '.pc-statement:not(.pc-statement--ghost)')
  const statementGhost = one(root, '.pc-statement--ghost')
  const services = one(root, '.pc-services')
  const journey = one(root, '.pc-journey')
  const client = one(root, '.pc-client')

  gsap.set(orb, { xPercent: -50, yPercent: -50, top: '88%', left: '50%', width: '1.5vw', height: '1.5vw', opacity: 0, '--pc-orb-fill': 1 })
  gsap.set(disc, { clipPath: 'circle(100vw at 50% 88%)', opacity: 0 })

  buildWordmark(root, hero)

  /* Statement: the disc fades in as the section arrives, words light up one
     by one while pinned, then the disc shrinks to a dot and hands over. */
  const ghostInner = one(disc, '.pc-disc__inner')
  const syncGhost = () => {
    const top = statement.getBoundingClientRect().top
    ghostInner.style.transform = `translate3d(0, ${top}px, 0)`
  }
  gsap.ticker.add(syncGhost)

  gsap
    .timeline({ scrollTrigger: { trigger: statement, start: 'top 20%', end: 'top 0%', scrub: 1 } })
    .to(disc, { opacity: 1, ease: 'power2.out', duration: 1 }, 'a')
    .to(one(root, '.pc-hero__fade'), { opacity: 0, ease: 'power2.out', duration: 0.1 }, 'a')

  const words = (scope: HTMLElement, n: 1 | 2) => all(scope, `.pc-statement__p${n} .pc-w`)
  gsap
    .timeline({
      scrollTrigger: { trigger: statement, start: 'top 0%', end: 'top -140%', scrub: 1, pin: true, anticipatePin: 1 },
    })
    .to(words(statement, 1), { opacity: 1, stagger: 0.2 }, 'w1')
    .to(words(statementGhost, 1), { opacity: 1, stagger: 0.2 }, 'w1')
    .to(words(statement, 2), { opacity: 1, stagger: 0.2 }, 'w2')
    .to(words(statementGhost, 2), { opacity: 1, stagger: 0.2 }, 'w2')
    .to(disc, { clipPath: 'circle(0.75vw at 50% 88%)', duration: 8, ease: 'none' }, 'shrink')
    .to(orb, { opacity: 1, duration: 0.05 }, 'hand')
    .to(disc, { opacity: 0, duration: 0.05 }, 'hand')

  /* Services: the orb glides to the first row, then steps down the list as
     each description opens under scroll. */
  const rows = all(root, '.pc-acc')
  const heads = rows.map((r) => one(r, '.pc-acc__head'))
  const decs = rows.map((r) => one(r, '.pc-acc__dec'))
  const cirs = rows.map((r) => one(r, '.pc-acc__cir'))
  const servicesRect = services.getBoundingClientRect()
  const firstRect = heads[0].getBoundingClientRect()
  const rowStep = rows.length > 1 ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top : 0
  const orbTop = firstRect.top - servicesRect.top + firstRect.height / 2
  const orbLeft = firstRect.left - vw(2.5)

  gsap.set(cirs, { scale: 0 })

  gsap
    .timeline({ scrollTrigger: { trigger: services, start: 'top 100%', end: 'top 5%', scrub: 1 } })
    .to(orb, { top: orbTop, left: orbLeft, duration: 3, overwrite: 'auto' })

  const tlServices = gsap.timeline({
    scrollTrigger: { trigger: services, start: 'top top', end: `+=${rows.length * 500}`, scrub: true, pin: true },
  })
  rows.forEach((_, i) => {
    const label = `row${i}`
    tlServices.to(decs[i], { height: '8vw', duration: 0.5 }, label).to(heads[i], { opacity: 1, duration: 0.5 }, label)
    if (i > 0) {
      tlServices
        .to(decs[i - 1], { height: 0, duration: 0.5 }, label)
        .to(heads[i - 1], { opacity: 0.5, duration: 0.5 }, label)
        .to(i === 1 ? orb : cirs[i - 1], { scale: 0, duration: 0.5 }, label)
        .to(cirs[i], { scale: 1, duration: 0.5 }, label)
    }
  })
  const last = rows.length - 1
  tlServices
    .to(orb, { top: orbTop + rowStep * last + 2, scale: 0, duration: 0.5, overwrite: 'auto' }, 'park')
    .to(cirs[last], { scale: 0, duration: 0.2 }, 'e')
    .to(orb, { scale: 1, duration: 0.1, overwrite: 'auto' }, 'e')
    .to(heads[last], { opacity: 0.5, duration: 0.1 }, 'e')

  /* Journey: the orb settles mid-screen as a thin ring while the cards slide
     past, then fills back in and waits to become the client reveal. */
  gsap
    .timeline({ scrollTrigger: { trigger: journey, start: 'top 100%', end: 'top 63%', scrub: true } })
    .to(orb, { top: '50%', left: '50%', scale: 1, duration: 2.3, overwrite: 'auto' }, 'oc')
    .to(orb, { width: '0.65vw', height: '0.65vw', '--pc-orb-fill': 0, duration: 0.6 })

  const track = one(root, '.pc-journey__track')
  const distance = Math.max(0, track.scrollWidth - window.innerWidth)
  gsap
    .timeline({ scrollTrigger: { trigger: journey, start: 'top top', end: 'top -180%', scrub: 1, pin: true } })
    .to(all(root, '.pc-card__art'), { x: -5, duration: 1.5, ease: 'power2.out' }, 'sl')
    .to(track, { x: -distance, duration: 1.5, ease: 'none' }, 'sl')
    .to(orb, { top: '50%', left: '50%', scale: 1, width: '2.5vw', height: '2.5vw', '--pc-orb-fill': 1, duration: 0.2 }, 's')
    .to(one(root, '.pc-journey__end'), { opacity: 0, duration: 0.2, delay: 0.1 })

  /* Client: a circular mask opens from the orb's position, the stage unclips
     upward, tilts in 3D while the fact chips drift past, and settles flat. */
  const stage = one(root, '.pc-client__stage')
  const over = one(root, '.pc-client__over')
  gsap.set(client, { '--pc-mask': '1.4%', opacity: 0 })
  gsap.set(stage, { xPercent: -50, yPercent: -50, clipPath: 'polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)' })
  gsap.set(over, { top: '100%' })

  const tlClient = gsap
    .timeline({ scrollTrigger: { trigger: client, start: 'top 0%', end: 'top -350%', scrub: true, pin: true } })
    .to(orb, { opacity: 0, duration: 0.15 }, 0)
    .to(client, { opacity: 1, duration: 0.6 }, 0)
    .to(client, { '--pc-mask': '280%', duration: 2.5 })
    .to(stage, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', duration: 0.6 })
    .to(stage, { scale: 0.6, rotateY: -20, rotateX: -2, duration: 1.5 })
    .to(stage, { scale: 0.5, rotateY: 20, rotateX: 2, duration: 1.5 })
    .to(over, { top: '-300%', duration: 4 })
    .to(stage, { scale: 0.6, rotateY: -20, rotateX: -2, duration: 1.5 })
    .to(stage, { scale: 1, rotateY: 0, rotateX: 0, duration: 1.5 })

  const nav = one(root, '.pc-nav:not(.pc-nav--ghost)')
  const clientPin = tlClient.scrollTrigger
  if (clientPin) {
    ScrollTrigger.create({
      start: () => clientPin.start + window.innerHeight * 0.3,
      end: () => clientPin.end + window.innerHeight,
      onToggle: (self) => nav.classList.toggle('pc-nav--blend', self.isActive),
    })
  }

  const cleanupCursor = buildCursor(root, client, hover)

  return () => {
    cleanupCursor()
    gsap.ticker.remove(syncGhost)
    ghostInner.style.transform = ''
    nav.classList.remove('pc-nav--blend')
  }
}

export const startConsultingMotion: MotionStarter = (root, onMode, reduce) => startMotion(root, onMode, buildHome, { reduce })
