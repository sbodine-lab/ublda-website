import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode, RefObject } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { PortalAnnouncer, usePortalAnnouncer } from './PortalAnnouncer'
import { AccountMenu } from './AccountMenu'
import { DisplaySettingsMenu, usePortalDisplaySettings } from './DisplaySettingsMenu'
import { IconClose, IconMenu } from './Icons'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import { adminAccountForEmail } from '../../lib/dashboardAccess'
import '../../styles/portal.css'

/**
 * The chrome both faces of the portal share (spec §5, §7.1, §8.3).
 *
 * Landmarks, verbatim from §7.1:
 *   <div className="portal">            ← the root. NOT <main>.
 *     <a class="p-skip">×2              ← this shell's OWN skip links; the
 *                                         global one is suppressed on these
 *                                         routes because its `#main-content`
 *                                         target does not exist here.
 *     <header role="banner">            ← the topbar
 *     <nav id="portal-nav" aria-label>  ← the sidebar
 *     <main id="portal-main" tabIndex={-1}>
 *
 * Breakpoints (§8.3) are pure CSS; this component only supplies the markup each
 * one needs — the grid sidebar (≥1024), the off-canvas `<dialog>` drawer
 * (<1024), and the bottom tab bar (<768, member face, max 5 items).
 *
 * Route change does three things and nothing else: sets `document.title`, moves
 * focus to the new `<h1>`, and announces the page politely.
 */

export type PortalNavItem = {
  key: string
  label: string
  to: string
  /** Decorative. Already `aria-hidden` — the label span carries the name. */
  icon?: ReactNode
  /** Match this path exactly. Use it when a sibling route nests underneath. */
  end?: boolean
  /** A real count of real rows. Never a decorative badge. */
  count?: number
}

export type PortalNavGroup = {
  key: string
  /** '' renders no label — right for a single lead item like Overview. */
  label: string
  items: PortalNavItem[]
}

export type PortalAccountLink = {
  key: string
  label: string
  to: string
}

export type PortalShellProps = {
  /**
   * "UBLDA Admin" / "UBLDA Members". Plain text, not a link: the 1024–1279 rail
   * clips the word, and a clipped link is a 1px target. Home is a nav item.
   */
  brand: string
  /** Distinct per shell — "Admin sections", "Member sections" (SC 1.3.1). */
  navLabel: string
  /** Already filtered by the signed-in actor's scopes by the calling shell. */
  groups: PortalNavGroup[]
  /** The current page name. Drives `document.title` and the announcement. */
  title: string
  /** <768px bottom bar. Capped at 5 by `.p-tabbar` and by this component. */
  tabBar?: PortalNavItem[]
  /** Extra rows in the account menu. Rendered as buttons that route. */
  accountLinks?: PortalAccountLink[]
  /** Pinned to the bottom of the sidebar. Usually a link to the other face. */
  sidebarFoot?: ReactNode
  children?: ReactNode
}

const TAB_BAR_LIMIT = 5

/** True when the element is actually laid out — display:none returns 0 rects. */
const isVisible = (node: HTMLElement | null) => Boolean(node && node.getClientRects().length > 0)

function NavGroups({ groups, idPrefix, onNavigate }: {
  groups: PortalNavGroup[]
  idPrefix: string
  /** The drawer copy uses this to dismiss itself when a link is followed. */
  onNavigate?: () => void
}) {
  return (
    <>
      {groups.map((group) => {
        const labelId = `${idPrefix}-${group.key}-label`
        return (
          <div
            className="p-sidebar__group"
            key={group.key}
            role="group"
            aria-labelledby={group.label ? labelId : undefined}
          >
            {group.label ? (
              <p className="p-sidebar__group-label" id={labelId}>{group.label}</p>
            ) : null}
            {group.items.map((item) => (
              <NavLink key={item.key} to={item.to} end={item.end} className="p-navlink" onClick={onNavigate}>
                {item.icon ? <span className="p-navlink__icon" aria-hidden="true">{item.icon}</span> : null}
                {/* The label lives in this span because the 1024–1279 icon rail
                    clips it with clip-path — it stays in the accessibility tree,
                    so the link keeps its name. An aria-label here would be lost
                    the moment a track adds a count. */}
                <span className="p-navlink__label">{item.label}</span>
                {typeof item.count === 'number' ? (
                  <span className="p-navlink__count p-num">{item.count}</span>
                ) : null}
              </NavLink>
            ))}
          </div>
        )
      })}
    </>
  )
}

type SidebarBodyProps = {
  brand: string
  navId: string
  navLabel: string
  groups: PortalNavGroup[]
  idPrefix: string
  navRef?: RefObject<HTMLElement | null>
  /** Present only in the drawer copy, where a close control is required. */
  onCloseDrawer?: () => void
  /**
   * Also drawer-only. Dismisses the drawer on link activation WITHOUT pulling
   * focus back to the toggle — the route change is about to move focus to the
   * new `<h1>`, and two focus moves in one commit is one too many.
   */
  onNavigate?: () => void
  sidebarFoot?: ReactNode
}

/**
 * Rendered twice — once as the grid sidebar, once inside the off-canvas drawer —
 * with different ids so the two navs never collide, and the same labels so the
 * experience does not change with the viewport.
 */
function SidebarBody({
  brand, navId, navLabel, groups, idPrefix, navRef, onCloseDrawer, onNavigate, sidebarFoot,
}: SidebarBodyProps) {
  return (
    // `.p-sidebar` is `align-self: start` with only a `max-height`, so as a grid
    // item it sizes to its content and the navy column stops halfway down the
    // page — which also disables the `margin-top: auto` that pins `__foot`.
    // Filed with T0c; this floor is the minimal fix and stays correct once the
    // stylesheet takes a height of its own.
    <div className="p-sidebar" style={{ minHeight: '100dvh' }}>
      <div className="p-sidebar__brand">
        <span className="p-sidebar__brand-word">{brand}</span>
        {onCloseDrawer ? (
          <button
            type="button"
            className="p-btn p-btn--quiet"
            style={{ marginLeft: 'auto', color: 'var(--p-on-dark)' }}
            onClick={onCloseDrawer}
          >
            <IconClose />
            <span className="p-visually-hidden">Close section navigation</span>
          </button>
        ) : null}
      </div>
      <nav className="p-sidebar__nav" id={navId} aria-label={navLabel} tabIndex={-1} ref={navRef}>
        <NavGroups groups={groups} idPrefix={idPrefix} onNavigate={onNavigate} />
      </nav>
      {sidebarFoot ? <div className="p-sidebar__foot">{sidebarFoot}</div> : null}
    </div>
  )
}

function PortalShellInner({
  brand, navLabel, groups, title, tabBar, accountLinks, sidebarFoot, children,
}: PortalShellProps) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { account, isAdmin, isSuperAdmin, signOut } = useMemberAuth()
  const { announce } = usePortalAnnouncer()

  const mainRef = useRef<HTMLElement>(null)
  const sidebarNavRef = useRef<HTMLElement>(null)
  const tabBarRef = useRef<HTMLElement>(null)
  const drawerRef = useRef<HTMLDialogElement>(null)
  const lastPathRef = useRef<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)

  /**
   * Leaving the portal for a marketing route must not leave "Roster · UBLDA
   * Portal" in the tab. Nothing outside the portal writes `document.title`, so
   * the shell restores what it found.
   */
  const documentTitleRef = useRef('')
  useEffect(() => {
    if (!documentTitleRef.current) documentTitleRef.current = document.title
    return () => { document.title = documentTitleRef.current }
  }, [])

  const closeDrawer = useCallback(() => { setDrawerOpen(false) }, [])

  /**
   * `showModal()` — never the `open` attribute — is what buys the focus trap,
   * Escape, the inert background and the top layer. `close()` hands focus back
   * to whatever opened the drawer, which is why nothing here calls `focus()`:
   * a manual restore would either be a no-op (the background is inert while the
   * dialog is modal) or a second focus move fighting the native one.
   *
   * The native restore lands on a later task than this effect, so following a
   * link inside the drawer would end with focus back on the menu button. The
   * route effect below re-asserts on the next frame for exactly that case.
   */
  useEffect(() => {
    const drawer = drawerRef.current
    if (!drawer) return
    if (drawerOpen && !drawer.open) drawer.showModal()
    if (!drawerOpen && drawer.open) drawer.close()
  }, [drawerOpen])

  /**
   * Escape and a backdrop dismissal close the dialog natively, without going
   * through any handler of ours. The state has to follow, or it stays `true`
   * after Escape and the drawer is permanently stuck: the scroll lock never
   * lifts, and the menu button cannot reopen it because `setDrawerOpen(true)`
   * is a no-op on a value that is already true.
   *
   * A plain DOM listener rather than React's `onClose` prop, because `close`
   * does not bubble and this leaves nothing to reason about.
   */
  useEffect(() => {
    const drawer = drawerRef.current
    if (!drawer) return
    const handleClose = () => { setDrawerOpen(false) }
    drawer.addEventListener('close', handleClose)
    return () => { drawer.removeEventListener('close', handleClose) }
  }, [])

  /**
   * Route change: title, focus, announcement (spec §7.2).
   *
   * Focus is deliberately NOT moved on the first paint. The skip links sit
   * before `<main>` in the DOM, so dropping focus onto the `<h1>` at load would
   * put them behind the user and make them unreachable with Tab — which is the
   * 2.4.1 failure this shell exists to fix. Guarding on the previous pathname
   * rather than a mounted flag also survives StrictMode's double effect, which
   * keeps refs.
   */
  useEffect(() => {
    document.title = `${title} · UBLDA Portal`

    const previous = lastPathRef.current
    lastPathRef.current = pathname
    if (previous === null || previous === pathname) return

    // Announce route CHANGES, not arrivals. On a fresh load the browser already
    // reads the document title, and the announcer's visual toast would pop a
    // "Home page." card over the page every single time it opens.
    announce(`${title} page.`)

    const target = mainRef.current?.querySelector<HTMLElement>('h1') ?? mainRef.current
    if (!target) return
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
    target.focus({ preventScroll: false })

    // Following a link inside the drawer closes a modal dialog in the same
    // commit, and the dialog restores focus to its invoker on a later task —
    // which would drop the reader back on the menu button they just left. Only
    // re-assert if something actually pulled focus out of <main>.
    const frame = window.requestAnimationFrame(() => {
      if (mainRef.current && !mainRef.current.contains(document.activeElement)) {
        target.focus({ preventScroll: true })
      }
    })
    return () => { window.cancelAnimationFrame(frame) }
  }, [announce, pathname, title])

  // Growing past the breakpoint closes the drawer too. Left open it would be an
  // open modal that CSS has hidden — a keyboard trap with no visible exit.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(min-width: 1024px)')
    const handleChange = () => { if (query.matches) setDrawerOpen(false) }
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    document.body.classList.add('p-scroll-locked')
    return () => { document.body.classList.remove('p-scroll-locked') }
  }, [drawerOpen])

  /**
   * "Skip to section navigation" has to land somewhere real at every breakpoint:
   * the sidebar above 1024, the bottom bar below 768, and the drawer in between
   * — where the nav does not exist until it is opened.
   */
  const handleSkipToNav = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (isVisible(sidebarNavRef.current)) {
      sidebarNavRef.current?.focus()
      return
    }
    if (isVisible(tabBarRef.current)) {
      tabBarRef.current?.querySelector<HTMLElement>('a')?.focus()
      return
    }
    setDrawerOpen(true)
  }, [])

  const handleSignOut = useCallback(() => {
    signOut()
    navigate('/signin', { replace: true })
  }, [navigate, signOut])

  const email = account?.email || ''
  const officer = adminAccountForEmail(email)
  // First name only on the trigger — it is what fits in a 320px topbar, and the
  // panel underneath still carries the email, which is the identifier that
  // actually disambiguates.
  const displayName = account?.firstName || email
  // Only claim an officer title once the role actually resolved to an admin —
  // anyone can self-register an officer's address with a password.
  const roleLabel = isSuperAdmin
    ? officer?.title || 'Super admin'
    : isAdmin
      ? officer?.title || 'E-board'
      : 'Member'

  return (
    <>
      <a className="p-skip" href="#portal-main">Skip to main content</a>
      <a className="p-skip" href="#portal-nav" onClick={handleSkipToNav}>Skip to section navigation</a>

      <div className="p-shell">
        <SidebarBody
          brand={brand}
          navId="portal-nav"
          navLabel={navLabel}
          groups={groups}
          idPrefix="portal-nav"
          navRef={sidebarNavRef}
          sidebarFoot={sidebarFoot}
        />

        {/* One grid child holds the topbar and main, so the two-column template
            places them together in the content column at every breakpoint. */}
        <div className="p-shell__column">
          {/* `wrap` keeps the bar off the horizontal scrollbar without touching
              the stylesheet: below ~340px the two menus drop to a second row
              rather than pushing the page sideways (SC 1.4.10). */}
          <header className="p-topbar" role="banner" style={{ flexWrap: 'wrap' }}>
            {/* The wrapper carries `p-topbar__toggle` rather than the button:
                `.p-btn { display: inline-flex }` is declared later in
                portal.css and would otherwise beat the base `display: none`. */}
            <div className="p-topbar__toggle">
              <button
                type="button"
                className="p-btn p-btn--quiet p-btn--icon"
                aria-expanded={drawerOpen}
                aria-controls="portal-drawer"
                onClick={() => setDrawerOpen(true)}
              >
                <IconMenu />
                <span className="p-visually-hidden">Open section navigation</span>
              </button>
            </div>

            {/* No page name here on purpose. It is already the <h1> directly
                below, `document.title`, the polite announcement, and the
                `aria-current` item in the nav that is visible at every
                breakpoint. A fourth copy earns its keep only until 375px, where
                it truncates to a single letter. */}

            <div className="p-topbar__actions">
              <DisplaySettingsMenu />
              <AccountMenu
                name={displayName}
                email={email}
                roleLabel={roleLabel}
                items={(accountLinks || []).map((link) => ({
                  key: link.key,
                  label: link.label,
                  onSelect: () => navigate(link.to),
                }))}
                onSignOut={handleSignOut}
              />
            </div>
          </header>

          <main className="p-main" id="portal-main" tabIndex={-1} ref={mainRef}>
            {children}
          </main>
        </div>
      </div>

      <dialog
        className="p-drawer"
        id="portal-drawer"
        ref={drawerRef}
        aria-label={`${navLabel} menu`}
        // The 768–1023 rule sets `display: block` on `.p-drawer`, which beats
        // the UA's `dialog:not([open]) { display: none }`. Restore it here so a
        // closed drawer stays closed instead of painting over the page.
        style={drawerOpen ? undefined : { display: 'none' }}
      >
        <SidebarBody
          brand={brand}
          navId="portal-drawer-nav"
          navLabel={navLabel}
          groups={groups}
          idPrefix="portal-drawer-nav"
          onCloseDrawer={closeDrawer}
          onNavigate={() => setDrawerOpen(false)}
          sidebarFoot={sidebarFoot}
        />
      </dialog>

      {tabBar && tabBar.length > 0 ? (
        <nav className="p-tabbar" aria-label={`${navLabel}, quick access`} ref={tabBarRef}>
          {tabBar.slice(0, TAB_BAR_LIMIT).map((item) => (
            <NavLink key={item.key} to={item.to} end={item.end} className="p-tabbar__item">
              {item.icon ? <span aria-hidden="true">{item.icon}</span> : null}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}
    </>
  )
}

/**
 * `PortalAnnouncer` is both the context provider and the two live regions, so it
 * has to wrap the shell — a component cannot consume a context it renders
 * itself. It sits INSIDE `.portal` rather than around it: the announcer also
 * renders the visual toast, and every token that styles the toast is scoped to
 * `.portal`. Mounted outside, the toast paints as unstyled text over whatever it
 * lands on.
 */
export function PortalShell(props: PortalShellProps) {
  const { settings } = usePortalDisplaySettings()

  return (
    <div className="portal" data-density={settings.density} data-motion={settings.motion}>
      <PortalAnnouncer>
        <PortalShellInner {...props} />
      </PortalAnnouncer>
    </div>
  )
}

export type PortalPageProps = {
  /** Rendered as the view's one and only `<h1>`. Matches the shell's `title`. */
  title: string
  /** One sentence under the heading. What this page is for. */
  lede?: string
  /** Page-level buttons. */
  actions?: ReactNode
  children: ReactNode
}

/**
 * The page frame every route leaf renders inside `<main>`. It exists so there is
 * exactly one `<h1>` per view and so the shell's route-change focus always has
 * something real to land on.
 */
export function PortalPage({ title, lede, actions, children }: PortalPageProps) {
  return (
    <div className="p-page">
      <div className="p-page__head">
        <div className="p-panelhead__text">
          <h1 className="p-page__title" tabIndex={-1}>{title}</h1>
          {lede ? <p className="p-page__lede">{lede}</p> : null}
        </div>
        {actions ? <div className="p-page__actions">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}

export default PortalShell
