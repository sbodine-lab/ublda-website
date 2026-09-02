import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { ArrowUpRight } from 'lucide-react'
import { ConsultingContext } from './context'
import type { MotionHandle, MotionMode, MotionStarter } from './engine'
import { ConsultingFooter, ConsultingMenu, ConsultingNav, type Theme } from './parts'
import '../Consulting.css'

const THEME_KEY = 'ublda-consulting-theme'
const MOTION_KEY = 'ublda-consulting-motion'

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

interface ShellProps {
  title: string
  motion: MotionStarter
  /* Home page only: inverted copy of the statement, clipped to the disc. */
  disc?: ReactNode
  /* Render the pointer badge (pages that call buildCursor). */
  cursor?: boolean
  cursorLabel?: ReactNode
  children: ReactNode
}

/* Chrome shared by every page of the sub-site: theme, nav, slide-in menu,
   custom cursor, footer, and the motion engine lifecycle. */
export function ConsultingShell({ title, motion, disc, cursor = false, cursorLabel, children }: ShellProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuTl = useRef<gsap.core.Timeline | null>(null)
  const motionRef = useRef<MotionHandle | null>(null)
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState<MotionMode>('full')
  const [prefersReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [motionOff, setMotionOff] = useState(() => {
    try {
      return localStorage.getItem(MOTION_KEY) === 'reduced'
    } catch {
      return false
    }
  })
  const reducedMotion = prefersReduced || motionOff

  useEffect(() => {
    window.scrollTo(0, 0)
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])

  useLayoutEffect(() => {
    const html = document.documentElement
    html.classList.add('pc-root')
    html.classList.toggle('pc-light', theme === 'light')
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* private mode */
    }
    return () => {
      html.classList.remove('pc-root', 'pc-light')
    }
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem(MOTION_KEY, motionOff ? 'reduced' : 'auto')
    } catch {
      /* private mode */
    }
  }, [motionOff])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const handle = motion(root, setMode, reducedMotion)
    motionRef.current = handle
    return () => {
      handle.stop()
      motionRef.current = null
    }
  }, [motion, reducedMotion])

  useEffect(() => {
    const menu = menuRef.current
    if (!menu) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ paused: true })
      tl.to(menu, { top: 0, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)', duration: 1.5, ease: 'power4.out' }).fromTo(
        menu.querySelectorAll('.pc-menu__link, .pc-menu__cta, .pc-menu__bottom'),
        { x: 50, opacity: 0 },
        { x: 0, opacity: 1, duration: 1.5, stagger: 0.1 },
        '<',
      )
      menuTl.current = tl
    }, menu)
    return () => {
      ctx.revert()
      menuTl.current = null
    }
  }, [])

  useEffect(() => {
    const tl = menuTl.current
    if (!tl) return
    if (menuOpen) {
      if (reducedMotion) tl.progress(1)
      else tl.timeScale(1).play()
      motionRef.current?.lenis?.stop()
      document.documentElement.classList.add('pc-menu-open')
      window.setTimeout(() => menuRef.current?.querySelector<HTMLElement>('.pc-menu__link')?.focus(), 50)
    } else {
      if (reducedMotion) tl.progress(0)
      else tl.timeScale(1.8).reverse()
      motionRef.current?.lenis?.start()
      document.documentElement.classList.remove('pc-menu-open')
      if (menuRef.current?.contains(document.activeElement)) {
        rootRef.current?.querySelector<HTMLElement>('.pc-nav:not(.pc-nav--ghost) .pc-nav__menu')?.focus()
      }
    }
  }, [menuOpen, reducedMotion])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const toggleMotion = useCallback(() => setMotionOff((m) => !m), [])
  const toggleMenu = useCallback(() => setMenuOpen((o) => !o), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <ConsultingContext.Provider value={{ theme, mode, reducedMotion }}>
      <div className={`pc pc--${theme} ${mode === 'static' ? 'pc--static' : 'pc--motion'} ${reducedMotion ? 'pc--reduced' : ''}`} ref={rootRef}>
        {cursor && (
          <div className="pc-cursor" aria-hidden="true">
            {cursorLabel ?? <ArrowUpRight size={16} strokeWidth={2} />}
          </div>
        )}

        <ConsultingMenu ref={menuRef} open={menuOpen} onClose={closeMenu} />
        <ConsultingNav theme={theme} onToggleTheme={toggleTheme} motionOff={motionOff} onToggleMotion={toggleMotion} menuOpen={menuOpen} onToggleMenu={toggleMenu} />

        {disc && (
          <>
            <div className="pc-disc" aria-hidden="true">
              <ConsultingNav theme={theme} onToggleTheme={toggleTheme} motionOff={motionOff} onToggleMotion={toggleMotion} menuOpen={menuOpen} onToggleMenu={toggleMenu} ghost />
              <div className="pc-disc__inner">{disc}</div>
            </div>
            <div className="pc-orb-track" aria-hidden="true">
              <div className="pc-orb" />
            </div>
          </>
        )}

        <main id="main-content" className="pc-main">
          {children}
        </main>

        <ConsultingFooter />
      </div>
    </ConsultingContext.Provider>
  )
}
