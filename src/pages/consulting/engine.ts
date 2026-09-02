/* Shared motion engine for the Consulting sub-site.

   Every page runs the same loop: Lenis for the wheel, GSAP ScrollTrigger for
   scroll-driven timelines, one build function per page that only runs on
   desktop for people who have not asked for reduced motion. Below 768px or
   with reduced motion the page reports `static` and the CSS fallback takes
   over. */

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin)

export type MotionMode = 'full' | 'static'

export interface MotionHandle {
  lenis: Lenis | undefined
  stop: () => void
}

export interface BuildContext {
  hover: boolean
  vw: (n: number) => number
  vh: (n: number) => number
  lenis: Lenis | undefined
}

export type Builder = (root: HTMLElement, ctx: BuildContext) => (() => void) | void

export const all = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) =>
  Array.from(root.querySelectorAll<T>(sel))

export const one = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) => {
  const el = root.querySelector<T>(sel)
  if (!el) throw new Error(`Consulting motion: missing ${sel}`)
  return el
}

export const maybe = <T extends HTMLElement = HTMLElement>(root: ParentNode, sel: string) =>
  root.querySelector<T>(sel)

export interface StartOptions {
  /* Visitor asked for reduced motion through the on-page toggle. */
  reduce?: boolean
}

export type MotionStarter = (root: HTMLElement, onMode: (mode: MotionMode) => void, reduce: boolean) => MotionHandle

export function startMotion(root: HTMLElement, onMode: (mode: MotionMode) => void, build: Builder, opts: StartOptions = {}): MotionHandle {
  const reduce = Boolean(opts.reduce) || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let lenis: Lenis | undefined
  let tick: ((time: number) => void) | undefined

  if (!reduce) {
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      wheelMultiplier: 0.8,
      touchMultiplier: 1.2,
      anchors: true,
    })
    lenis.on('scroll', ScrollTrigger.update)
    tick = (time) => lenis?.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
  }

  let mm = gsap.matchMedia()

  const register = () => {
    mm.add(
      {
        /* `all` always matches. Without it GSAP skips the callback entirely
           when none of the three below match - a phone with Reduce Motion on -
           and the page never leaves motion mode, leaving the client section
           invisible and the service rows stuck shut. */
        all: 'all',
        desktop: '(min-width: 768px)',
        motion: '(prefers-reduced-motion: no-preference)',
        hover: '(hover: hover)',
      },
      (ctx) => {
        const c = ctx.conditions as { desktop: boolean; motion: boolean; hover: boolean }
        if (!c.desktop || !c.motion || reduce) {
          onMode('static')
          return
        }
        onMode('full')
        const cleanup = build(root, {
          hover: c.hover,
          vw: (n) => (window.innerWidth * n) / 100,
          vh: (n) => (window.innerHeight * n) / 100,
          lenis,
        })
        ScrollTrigger.refresh()
        return cleanup ?? undefined
      },
    )
  }

  // Layout-dependent numbers are measured at build time, so build once the
  // web fonts are in and rebuild when the width changes.
  let alive = true
  if (document.fonts && document.fonts.status !== 'loaded') {
    document.fonts.ready.then(() => {
      if (alive) register()
    })
  } else {
    register()
  }

  let lastWidth = window.innerWidth
  let resizeTimer = 0
  const rebuild = () => {
    mm.revert()
    mm = gsap.matchMedia()
    register()
  }
  const onResize = () => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth
        rebuild()
      } else {
        ScrollTrigger.refresh()
      }
    }, 200)
  }
  window.addEventListener('resize', onResize)
  const onLoad = () => ScrollTrigger.refresh()
  window.addEventListener('load', onLoad)

  return {
    lenis,
    stop: () => {
      alive = false
      window.removeEventListener('resize', onResize)
      window.removeEventListener('load', onLoad)
      window.clearTimeout(resizeTimer)
      mm.revert()
      if (tick) gsap.ticker.remove(tick)
      lenis?.destroy()
    },
  }
}

/* "UBLDA · Consulting" folds into a "U·C" monogram as the first screen
   leaves. Every `.pc-word` in the root (the real nav and any ghost copy)
   gets identical offsets. */
export function buildWordmark(root: HTMLElement, trigger: Element) {
  const word = one(root, '.pc-nav:not(.pc-nav--ghost) .pc-word')
  const uEl = one(word, '.pc-word__u')
  const cEl = one(word, '.pc-word__c')
  const total = word.offsetWidth
  const gap = uEl.offsetWidth * 0.3
  const pair = uEl.offsetWidth + cEl.offsetWidth + gap
  const uDx = total / 2 - pair / 2 - uEl.offsetLeft
  const cDx = total / 2 + pair / 2 - cEl.offsetWidth - cEl.offsetLeft

  gsap
    .timeline({ scrollTrigger: { trigger, start: 'top top', end: 'top -5%', scrub: 1 } })
    .to(all(root, '.pc-word__rest'), { opacity: 0, x: 2, duration: 0.2, ease: 'power1.out' }, 'a')
    .to(all(root, '.pc-word__u'), { x: uDx, duration: 0.4, delay: 0.2 }, 'a')
    .to(all(root, '.pc-word__c'), { x: cDx, duration: 0.4, delay: 0.2 }, 'a')
    .to(all(root, '.pc-word__dot'), { opacity: 1, scale: 1, duration: 0.2, delay: -0.2 }, 's')
}

/* Elements marked data-reveal rise into place as they enter. A
   data-reveal-group reveals its children one after another. */
export function buildReveals(root: HTMLElement) {
  all(root, '[data-reveal]').forEach((el) => {
    const targets = el.hasAttribute('data-reveal-group') ? Array.from(el.children) : [el]
    gsap.fromTo(
      targets,
      { y: 48, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.1, ease: 'power3.out', stagger: 0.12, scrollTrigger: { trigger: el, start: 'top 85%' } },
    )
  })
}

/* Hero copy drifts up and fades as the first screen scrolls away. */
export function buildHeroExit(over: Element, trigger: Element) {
  gsap.to(over, { y: -120, opacity: 0, ease: 'none', scrollTrigger: { trigger, start: 'top top', end: 'top -100%', scrub: 0.8 } })
}

/* A vertical hairline that draws itself as the section arrives. */
export function buildDrawLine(line: Element, trigger: Element, start = 'top 30%', end = 'top -50%') {
  gsap.fromTo(
    line,
    { clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)' },
    { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', ease: 'none', scrollTrigger: { trigger, start, end, scrub: 1 } },
  )
}

/* Sections that paint in the foreground colour flip the nav into the
   difference blend while they sit under it. */
export function buildNavBlendFor(root: HTMLElement, sections: Element[]) {
  const nav = one(root, '.pc-nav:not(.pc-nav--ghost)')
  const flags = new Set<Element>()
  const sync = () => nav.classList.toggle('pc-nav--blend', flags.size > 0)
  sections.forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 60px',
      end: 'bottom 60px',
      onToggle: (self) => {
        if (self.isActive) flags.add(section)
        else flags.delete(section)
        sync()
      },
    })
  })
  return () => nav.classList.remove('pc-nav--blend')
}

/* Round pointer badge that follows the mouse over `target`. */
export function buildCursor(root: HTMLElement, target: Element, hover: boolean) {
  if (!hover) return () => {}
  const cursor = one(root, '.pc-cursor')
  gsap.set(cursor, { xPercent: -50, yPercent: -50, scale: 0 })
  const xTo = gsap.quickTo(cursor, 'left', { duration: 0.2, ease: 'power2.out' })
  const yTo = gsap.quickTo(cursor, 'top', { duration: 0.2, ease: 'power2.out' })
  const onMove = (e: MouseEvent) => {
    xTo(e.clientX)
    yTo(e.clientY)
  }
  const onEnter = () => gsap.to(cursor, { scale: 1, duration: 0.3, ease: 'power2.out' })
  const onLeave = () => gsap.to(cursor, { scale: 0, duration: 0.3, ease: 'power2.out' })
  window.addEventListener('mousemove', onMove, { passive: true })
  target.addEventListener('mouseenter', onEnter)
  target.addEventListener('mouseleave', onLeave)
  return () => {
    window.removeEventListener('mousemove', onMove)
    target.removeEventListener('mouseenter', onEnter)
    target.removeEventListener('mouseleave', onLeave)
  }
}

/* Gentle parallax of a hero graphic against the pointer. */
export function buildParallax(art: Element, area: Element, hover: boolean, amount = 24) {
  if (!hover) return () => {}
  const xTo = gsap.quickTo(art, 'x', { duration: 0.8, ease: 'power2.out' })
  const yTo = gsap.quickTo(art, 'y', { duration: 0.8, ease: 'power2.out' })
  const onMove = (e: Event) => {
    const m = e as MouseEvent
    const nx = m.clientX / window.innerWidth - 0.5
    const ny = m.clientY / window.innerHeight - 0.5
    xTo(nx * amount * -1)
    yTo(ny * amount * -1)
  }
  area.addEventListener('mousemove', onMove)
  return () => area.removeEventListener('mousemove', onMove)
}

export { gsap, ScrollTrigger }
