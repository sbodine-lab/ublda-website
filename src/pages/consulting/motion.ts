/* Scroll choreography for the Consulting home page.

   One "orb" travels the whole page: it starts as a full-screen disc behind
   the opening statement, shrinks to a dot, walks down the services list,
   parks in the centre of the horizontal scroller, and finally becomes the
   aperture through which the client section is revealed. */

import { all, buildWordmark, gsap, one, startMotion, ScrollTrigger, type Builder, type MotionStarter } from './engine'

export type { MotionHandle, MotionMode } from './engine'

export const buildHome: Builder = (root, { mobile, vw }) => {
  const orb = one(root, '.pc-orb')
  const disc = one(root, '.pc-disc')
  const hero = one(root, '.pc-hero')
  const statement = one(root, '.pc-statement:not(.pc-statement--ghost)')
  const statementGhost = one(root, '.pc-statement--ghost')
  const services = one(root, '.pc-services')
  const journey = one(root, '.pc-journey')
  const client = one(root, '.pc-client')

  /* The orb is drawn in vw so it scales with the page; a phone is a third
     the width of a laptop, so its orb is three times the vw to stay the
     same physical size. The disc's opening radius is 100vmax so it covers a
     portrait screen too. */
  const k = mobile ? 3 : 1
  const size = (n: number) => `${n * k}vw`

  gsap.set(orb, { xPercent: -50, yPercent: -50, top: '88%', left: '50%', width: size(1.5), height: size(1.5), opacity: 0, '--pc-orb-fill': 1 })
  gsap.set(disc, { clipPath: 'circle(100vmax at 50% 88%)', opacity: 0 })

  buildWordmark(root, hero)

  /* Let the shader drift through the section boundary before the disc
     takes over. Both directions use scroll progress so reversing stays smooth. */
  gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8 } })
    .to(one(root, '.pc-hero-backdrop__shader'), { scale: 1.12, yPercent: -5, ease: 'none', duration: 1 }, 0)
    .to(one(root, '.pc-hero-backdrop'), { opacity: 0, ease: 'power1.inOut', duration: 0.6 }, 0.4)

  /* Statement: the disc fades in as the section arrives, words light up one
     by one while pinned, then the disc shrinks to a dot and hands over. */
  const ghostInner = one(disc, '.pc-disc__inner')
  const syncGhost = () => {
    const top = statement.getBoundingClientRect().top
    ghostInner.style.transform = `translate3d(0, ${top}px, 0)`
  }
  gsap.ticker.add(syncGhost)

  gsap
    .timeline({ scrollTrigger: { trigger: statement, start: 'top 65%', end: 'top 0%', scrub: 0.8 } })
    .to(disc, { opacity: 1, ease: 'power2.out', duration: 1 }, 'a')

  const words = (scope: HTMLElement, n: 1 | 2) => all(scope, `.pc-statement__p${n} .pc-w`)
  gsap
    .timeline({
      scrollTrigger: { trigger: statement, start: 'top 0%', end: 'top -140%', scrub: 1, pin: true, anticipatePin: 1 },
    })
    .to(words(statement, 1), { opacity: 1, stagger: 0.2 }, 'w1')
    .to(words(statementGhost, 1), { opacity: 1, stagger: 0.2 }, 'w1')
    .to(words(statement, 2), { opacity: 1, stagger: 0.2 }, 'w2')
    .to(words(statementGhost, 2), { opacity: 1, stagger: 0.2 }, 'w2')
    .to(disc, { clipPath: `circle(${size(0.75)} at 50% 88%)`, duration: 8, ease: 'none' }, 'shrink')
    .to(orb, { opacity: 1, duration: 0.05 }, 'hand')
    .to(disc, { opacity: 0, duration: 0.05 }, 'hand')

  /* Services: the orb glides to the first row, then steps down the list as
     each description opens under scroll. Desktop opens each row to a fixed
     8vw; a phone measures the paragraph so nothing is cut off. Touch
     scrolling covers ground faster than a wheel, so the pin is shorter. */
  const rows = all(root, '.pc-acc')
  const heads = rows.map((r) => one(r, '.pc-acc__head'))
  const decs = rows.map((r) => one(r, '.pc-acc__dec'))
  const cirs = rows.map((r) => one(r, '.pc-acc__cir'))
  const servicesRect = services.getBoundingClientRect()
  const firstRect = heads[0].getBoundingClientRect()
  const rowStep = rows.length > 1 ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top : 0
  const orbTop = firstRect.top - servicesRect.top + firstRect.height / 2
  const orbLeft = firstRect.left - vw(mobile ? 5.25 : 2.5)
  const openHeight = (i: number) => (mobile ? (decs[i].firstElementChild as HTMLElement).offsetHeight + 16 : '8vw')

  gsap.set(cirs, { scale: 0 })

  gsap
    .timeline({ scrollTrigger: { trigger: services, start: 'top 100%', end: 'top 5%', scrub: 1 } })
    .to(orb, { top: orbTop, left: orbLeft, duration: 3, overwrite: 'auto' })

  const tlServices = gsap.timeline({
    scrollTrigger: { trigger: services, start: 'top top', end: `+=${rows.length * (mobile ? 320 : 500)}`, scrub: true, pin: true },
  })
  rows.forEach((_, i) => {
    const label = `row${i}`
    tlServices.to(decs[i], { height: openHeight(i), duration: 0.5 }, label).to(heads[i], { opacity: 1, duration: 0.5 }, label)
    if (i > 0) {
      tlServices
        .to(decs[i - 1], { height: 0, duration: 0.5 }, label)
        .to(heads[i - 1], { opacity: 0.72, duration: 0.5 }, label)
        .to(i === 1 ? orb : cirs[i - 1], { scale: 0, duration: 0.5 }, label)
        .to(cirs[i], { scale: 1, duration: 0.5 }, label)
    }
  })
  const last = rows.length - 1
  tlServices
    .to(orb, { top: orbTop + rowStep * last + 2, scale: 0, duration: 0.5, overwrite: 'auto' }, 'park')
    .to(cirs[last], { scale: 0, duration: 0.2 }, 'e')
    .to(orb, { scale: 1, duration: 0.1, overwrite: 'auto' }, 'e')
    .to(heads[last], { opacity: 0.72, duration: 0.1 }, 'e')

  /* Journey: the orb settles mid-screen as a thin ring while the cards slide
     past, then fills back in and waits to become the client reveal. */
  gsap
    .timeline({ scrollTrigger: { trigger: journey, start: 'top 100%', end: 'top 63%', scrub: true } })
    .to(orb, { top: '50%', left: '50%', scale: 1, duration: 2.3, overwrite: 'auto' }, 'oc')
    .to(orb, { width: size(0.65), height: size(0.65), '--pc-orb-fill': 0, duration: 0.6 })

  const track = one(root, '.pc-journey__track')
  const distance = Math.max(0, track.scrollWidth - window.innerWidth)
  /* The track is much longer than the screen on a phone, so the pin length
     follows the distance instead of a fixed number of screens. */
  const journeyEnd = mobile ? `+=${Math.round(distance * 0.8)}` : 'top -180%'
  gsap
    .timeline({ scrollTrigger: { trigger: journey, start: 'top top', end: journeyEnd, scrub: 1, pin: true } })
    .to(all(root, '.pc-card__art'), { x: -5, duration: 1.5, ease: 'power2.out' }, 'sl')
    .to(track, { x: -distance, duration: 1.5, ease: 'none' }, 'sl')
    .to(orb, { top: '50%', left: '50%', scale: 1, width: size(2.5), height: size(2.5), '--pc-orb-fill': 1, duration: 0.2 }, 's')
    .to(one(root, '.pc-journey__end'), { opacity: 0, duration: 0.2, delay: 0.1 })

  /* Client: a circular mask opens from the orb's position to reveal the
     full-bleed shader, the lockup rises into place, and the section holds
     for a beat before it releases. The mask grows to 300% of the width to
     cover a tall portrait screen. */
  const lockup = one(root, '.pc-client__lockup')
  gsap.set(client, { '--pc-mask': mobile ? '300%' : '1.4%', opacity: mobile ? 1 : 0 })
  gsap.set(lockup, { y: mobile ? 24 : 40, opacity: 0 })

  /* The orb's fade is scrubbed, but the opening statement's smoothed scrub
     can still re-render its "show orb" tween a moment later when the visitor
     jumps here (menu link, keyboard). The class makes the hide stick from
     the first pixel of progress until the section is left backwards, and
     onUpdate (not onToggle) so a jump from past the end to before the start
     also clears it. */
  const tlClient = gsap
    .timeline({
      scrollTrigger: {
        trigger: client,
        start: mobile ? 'top 85%' : 'top 0%',
        end: mobile ? 'top 35%' : 'top -100%',
        scrub: true,
        // The richer client content scrolls naturally on phones so every
        // figure remains reachable without waiting through a pinned screen.
        pin: !mobile,
        onUpdate: (self) => orb.classList.toggle('pc-orb--done', self.progress > 0),
      },
    })

  tlClient.to(orb, { opacity: 0, duration: 0.15 }, 0)
  if (mobile) {
    tlClient.to(lockup, { y: 0, opacity: 1, duration: 1, ease: 'power2.out' }, 0)
  } else {
    tlClient
      .to(client, { opacity: 1, duration: 0.6 }, 0)
      .to(client, { '--pc-mask': '280%', duration: 2.5 })
      .to(lockup, { y: 0, opacity: 1, duration: 1.4, ease: 'power2.out' }, 1.2)
      .to({}, { duration: 1.2 })
  }

  const nav = one(root, '.pc-nav:not(.pc-nav--ghost)')
  const clientPin = tlClient.scrollTrigger
  if (clientPin) {
    ScrollTrigger.create({
      start: () => clientPin.start + window.innerHeight * 0.3,
      end: () => clientPin.end + window.innerHeight,
      onToggle: (self) => nav.classList.toggle('pc-nav--blend', self.isActive),
    })
  }

  return () => {
    gsap.ticker.remove(syncGhost)
    ghostInner.style.transform = ''
    nav.classList.remove('pc-nav--blend')
  }
}

export const startConsultingMotion: MotionStarter = (root, onMode, reduce) => startMotion(root, onMode, buildHome, { reduce })
