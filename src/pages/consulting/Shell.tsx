import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { ArrowUpRight } from 'lucide-react'
import { ConsultingContext } from './context'
import { useMenuKeyboard } from '../../hooks/useMenuKeyboard'
import type { MotionHandle, MotionMode, MotionStarter } from './engine'
import { ConsultingFooter, ConsultingMenu, ConsultingNav, type Theme } from './parts'
import '../Consulting.css'

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
  const theme: Theme = 'light'
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState<MotionMode>('full')
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

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
    html.classList.add('pc-root', 'pc-light')
    return () => {
      html.classList.remove('pc-root', 'pc-light')
    }
  }, [])

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
    /* iOS keeps scrolling the page under an open overlay whatever the
       html overflow says, so swipes outside the menu are swallowed. */
    const onTouch = (e: TouchEvent) => {
      const menu = menuRef.current
      if (menu && menu.contains(e.target as Node)) return
      if (e.cancelable) e.preventDefault()
    }
    document.addEventListener('touchmove', onTouch, { passive: false })
    return () => {
      document.documentElement.classList.remove('pc-menu-open')
      document.removeEventListener('touchmove', onTouch)
    }
  }, [menuOpen])

  const toggleMenu = useCallback(() => setMenuOpen((o) => !o), [])
  const closeMenu = useCallback(() => setMenuOpen(false), [])
  useMenuKeyboard(menuOpen, rootRef, '.pc-menu', '.pc-nav:not(.pc-nav--ghost) .pc-nav__menu', closeMenu)

  return (
    <ConsultingContext.Provider value={{ theme, mode, reducedMotion }}>
      <div className={`pc pc--${theme} ${mode === 'static' ? 'pc--static' : 'pc--motion'} ${reducedMotion ? 'pc--reduced' : ''}`} ref={rootRef}>
        {cursor && (
          <div className="pc-cursor" aria-hidden="true">
            {cursorLabel ?? <ArrowUpRight size={16} strokeWidth={2} />}
          </div>
        )}

        <ConsultingMenu ref={menuRef} open={menuOpen} onClose={closeMenu} />
        <ConsultingNav menuOpen={menuOpen} onToggleMenu={toggleMenu} />

        {disc && (
          <>
            <div className="pc-disc" aria-hidden="true" inert>
              <ConsultingNav menuOpen={menuOpen} onToggleMenu={toggleMenu} ghost />
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
