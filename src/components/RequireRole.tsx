import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useMemberAuth } from '../hooks/useMemberAuth'
import { usePortalDisplaySettings } from './portal/DisplaySettingsMenu'
import type { AdminScope, DashboardRole } from '../lib/dashboardAccess'
import '../styles/portal.css'

/**
 * The client-side route guard (spec §2, redirect matrix).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE LOADING ROW IS THE ONE THAT BREAKS EVERYTHING.
 *
 * `useMemberAuth` starts at `'loading'` and resolves asynchronously against
 * `/api/applicant-account`. If this component redirects while the status is
 * still `'loading'`, every admin who hard-refreshes `/dashboard/roster` is
 * bounced to `/members` before their session has even come back. So:
 * `status === 'loading'` renders a skeleton and returns. It never redirects.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * | Auth state   | /dashboard/*            | /members/*              |
 * |--------------|-------------------------|-------------------------|
 * | loading      | skeleton, no redirect   | skeleton, no redirect   |
 * | signed-out   | /signin?next=<path>     | /signin?next=<path>     |
 * | member       | → /members              | render                  |
 * | exec / super | render                  | render                  |
 *
 * This guard is UX, never authorization (spec §4.2). A member who types
 * `/dashboard/roster` is redirected here; a member who curls
 * `admin.member.upsert` is refused server-side with a 403. Both must be true,
 * and only the second one is security.
 */
export type RequireRoleProps = {
  /** Allowed roles. Omit for "any signed-in member", which is what `/members` wants. */
  roles?: DashboardRole[]
  /** Passes when the actor holds ANY of these. `super-admin` satisfies every scope. */
  anyScope?: AdminScope[]
  /** Where a signed-in actor who fails the check lands. Never used for signed-out. */
  redirectTo?: string
  children: ReactNode
}

/**
 * Shown while the session resolves. It is a real portal surface — same canvas,
 * same theme, same density — so the page does not flash white for a member who
 * chose dark, and it carries a polite status message rather than a bare spinner.
 */
export function PortalLoading({ label = 'Loading your portal.' }: { label?: string }) {
  const { settings } = usePortalDisplaySettings()

  return (
    <div className="portal" data-density={settings.density} data-motion={settings.motion}>
      <div className="p-page" aria-busy="true">
        <p className="p-visually-hidden" role="status">{label}</p>
        <div className="p-skeleton" style={{ height: 34, maxWidth: 280 }} aria-hidden="true" />
        <div className="p-panel">
          <div className="p-skeleton" style={{ height: 18, maxWidth: 200 }} aria-hidden="true" />
          <div className="p-skeleton" style={{ height: 120 }} aria-hidden="true" />
        </div>
        <div className="p-panel">
          <div className="p-skeleton" style={{ height: 18, maxWidth: 160 }} aria-hidden="true" />
          <div className="p-skeleton" style={{ height: 88 }} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

export function RequireRole({ roles, anyScope, redirectTo, children }: RequireRoleProps) {
  const location = useLocation()
  const { status, role, isSuperAdmin, hasScope } = useMemberAuth()

  if (status === 'loading') {
    return <PortalLoading />
  }

  if (status === 'signed-out') {
    const next = `${location.pathname}${location.search}`
    return <Navigate to={`/signin?next=${encodeURIComponent(next)}`} replace />
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to={redirectTo || '/members'} replace />
  }

  // `super-admin` satisfies every scope check, exactly as the server does.
  if (anyScope && anyScope.length > 0 && !isSuperAdmin && !anyScope.some((scope) => hasScope(scope))) {
    return <Navigate to={redirectTo || '/dashboard/overview'} replace />
  }

  return <>{children}</>
}

export default RequireRole
