import { Link, Outlet, useLocation } from 'react-router-dom'
import { PortalShell } from '../../components/portal/PortalShell'
import type { PortalNavGroup, PortalNavItem } from '../../components/portal/PortalShell'
import {
  IconAccess,
  IconEvents,
  IconHome,
  IconOverview,
  IconProfile,
  IconResources,
} from '../../components/portal/Icons'
import { useMemberAuth } from '../../hooks/useMemberAuth'

/**
 * The member face of the portal: `/members/*` (spec §2).
 *
 * Every signed-in person reaches it, admins included — an exec is still a member.
 * There is no gate here and no "access is limited to UBLDA leads" notice; the
 * first authenticated screen of a disability-inclusion club must not be an
 * exclusion notice.
 */

const HOME: PortalNavItem = { key: 'home', label: 'Home', to: '/members/home', icon: <IconHome /> }
const EVENTS: PortalNavItem = { key: 'events', label: 'Events', to: '/members/events', icon: <IconEvents /> }
const RESOURCES: PortalNavItem = { key: 'resources', label: 'Resources', to: '/members/resources', icon: <IconResources /> }
const PROFILE: PortalNavItem = { key: 'profile', label: 'Profile', to: '/members/profile', icon: <IconProfile />, end: true }
const ACCESS: PortalNavItem = { key: 'access', label: 'Access', to: '/members/profile/access', icon: <IconAccess /> }

const MEMBER_GROUPS: PortalNavGroup[] = [
  { key: 'lead', label: '', items: [HOME] },
  { key: 'club', label: 'The club', items: [EVENTS, RESOURCES] },
  { key: 'you', label: 'You', items: [PROFILE, ACCESS] },
]

/** Exactly five, which is the cap `.p-tabbar` enforces below 768px (spec §8.3). */
const MEMBER_TAB_BAR: PortalNavItem[] = [HOME, EVENTS, RESOURCES, PROFILE, ACCESS]

const EVENT_DETAIL_PATH = /^\/members\/events\/[^/]+\/?$/

const TITLE_BY_PREFIX: { prefix: string; title: string }[] = [
  { prefix: '/members/profile/access', title: 'Access' },
  { prefix: '/members/profile', title: 'Profile' },
  { prefix: '/members/resources', title: 'Resources' },
  { prefix: '/members/events', title: 'Events' },
  { prefix: '/members/home', title: 'Home' },
]

function memberTitleForPath(pathname: string): string {
  if (EVENT_DETAIL_PATH.test(pathname)) return 'Event'
  const match = TITLE_BY_PREFIX.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  )
  return match?.title || 'Members'
}

export default function MemberShell() {
  const { pathname } = useLocation()
  const { isAdmin } = useMemberAuth()

  const accountLinks = [
    { key: 'profile', label: 'Your profile', to: '/members/profile' },
    { key: 'access', label: 'Access preferences', to: '/members/profile/access' },
    ...(isAdmin ? [{ key: 'dashboard', label: 'Admin dashboard', to: '/dashboard' }] : []),
  ]

  return (
    <PortalShell
      brand="UBLDA Members"
      navLabel="Member sections"
      groups={MEMBER_GROUPS}
      title={memberTitleForPath(pathname)}
      tabBar={MEMBER_TAB_BAR}
      accountLinks={accountLinks}
      sidebarFoot={isAdmin ? (
        <Link className="p-navlink" to="/dashboard">
          <span className="p-navlink__icon" aria-hidden="true"><IconOverview /></span>
          <span className="p-navlink__label">Admin dashboard</span>
        </Link>
      ) : undefined}
    >
      <Outlet />
    </PortalShell>
  )
}
