import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { PortalShell } from '../../components/portal/PortalShell'
import type { PortalNavGroup } from '../../components/portal/PortalShell'
import {
  IconBroadcast,
  IconConsole,
  IconEvents,
  IconOverview,
  IconProfile,
  IconRecruiting,
  IconRoster,
} from '../../components/portal/Icons'
import { useMemberAuth } from '../../hooks/useMemberAuth'
import type { AdminScope } from '../../lib/dashboardAccess'

/**
 * The admin face of the portal: `/dashboard/*` (spec §2).
 *
 * Sidebar items are filtered by the signed-in officer's scopes, so an exec never
 * sees a section they would be 403'd from. Landon has `members` and `events`; he
 * should not be shown a Recruiting tab that refuses him on arrival.
 */

type AdminNavConfig = {
  key: string
  label: string
  to: string
  icon: ReactNode
  /** Any one of these is enough. Empty means every admin sees it. */
  scopes?: AdminScope[]
  superAdminOnly?: boolean
}

const ADMIN_NAV: { key: string; label: string; items: AdminNavConfig[] }[] = [
  {
    key: 'lead',
    label: '',
    items: [
      { key: 'overview', label: 'Overview', to: '/dashboard/overview', icon: <IconOverview /> },
    ],
  },
  {
    key: 'club',
    label: 'Club',
    items: [
      { key: 'roster', label: 'Roster', to: '/dashboard/roster', icon: <IconRoster />, scopes: ['members'] },
      { key: 'events', label: 'Events', to: '/dashboard/events', icon: <IconEvents />, scopes: ['events'] },
      {
        key: 'broadcast',
        label: 'Broadcast',
        to: '/dashboard/broadcast',
        icon: <IconBroadcast />,
        scopes: ['announcements', 'resources'],
      },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    items: [
      { key: 'recruiting', label: 'Recruiting', to: '/dashboard/recruiting', icon: <IconRecruiting />, scopes: ['recruiting'] },
      { key: 'console', label: 'Console', to: '/dashboard/console', icon: <IconConsole />, superAdminOnly: true },
    ],
  },
]

const CHECK_IN_PATH = /^\/dashboard\/events\/[^/]+\/check-in\/?$/

const TITLE_BY_PREFIX: { prefix: string; title: string }[] = [
  { prefix: '/dashboard/overview', title: 'Overview' },
  { prefix: '/dashboard/recruiting', title: 'Recruiting' },
  { prefix: '/dashboard/roster', title: 'Roster' },
  { prefix: '/dashboard/events', title: 'Events' },
  { prefix: '/dashboard/broadcast', title: 'Broadcast' },
  { prefix: '/dashboard/console', title: 'Console' },
]

function adminTitleForPath(pathname: string): string {
  if (CHECK_IN_PATH.test(pathname)) return 'Check-in'
  const match = TITLE_BY_PREFIX.find(
    (entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`),
  )
  return match?.title || 'Dashboard'
}

/**
 * `/dashboard` used to be one screen with `?tab=Overview` / `?tab=Recruiting`
 * and a `#recruiting` anchor. Those links are in the group chat and in people's
 * bookmarks, so they keep working — once. This reads the legacy value, redirects
 * to the matching child, and the query is gone. Navigation never writes `?tab=`
 * again (spec §2).
 */
const LEGACY_TARGETS = ['overview', 'recruiting', 'roster', 'events', 'broadcast', 'console']

export function DashboardIndexRedirect() {
  const { search, hash } = useLocation()
  const requested = new URLSearchParams(search).get('tab') || ''
  const slug = requested.trim().toLowerCase().replace(/\s+/g, '-')
  const fromHash = hash === '#recruiting' ? 'recruiting' : ''
  const target = LEGACY_TARGETS.includes(slug) ? slug : LEGACY_TARGETS.includes(fromHash) ? fromHash : 'overview'

  return <Navigate to={`/dashboard/${target}`} replace />
}

export default function AdminShell() {
  const { pathname } = useLocation()
  const { hasScope, isSuperAdmin } = useMemberAuth()

  const groups: PortalNavGroup[] = ADMIN_NAV.map((group) => ({
    key: group.key,
    label: group.label,
    items: group.items
      .filter((item) => {
        if (item.superAdminOnly) return isSuperAdmin
        if (!item.scopes) return true
        return item.scopes.some((scope) => hasScope(scope))
      })
      .map((item) => ({ key: item.key, label: item.label, to: item.to, icon: item.icon })),
  })).filter((group) => group.items.length > 0)

  return (
    <PortalShell
      brand="UBLDA Admin"
      navLabel="Admin sections"
      groups={groups}
      title={adminTitleForPath(pathname)}
      accountLinks={[
        { key: 'member-view', label: 'Member view', to: '/members/home' },
        { key: 'profile', label: 'Your profile', to: '/members/profile' },
      ]}
      sidebarFoot={
        <Link className="p-navlink" to="/members/home">
          <span className="p-navlink__icon" aria-hidden="true"><IconProfile /></span>
          <span className="p-navlink__label">Member view</span>
        </Link>
      }
    >
      <Outlet />
    </PortalShell>
  )
}
