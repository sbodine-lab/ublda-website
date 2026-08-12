import { useEffect, type ReactNode } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { LogOut } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  leadershipAdminNavigation,
  leadershipHeaderForPath,
  leadershipMobileNavigation,
  leadershipNavigation,
  type LeadershipNavigationItem,
} from "../navigation"
import "../leadership-shell.css"

interface LeadershipShellProps {
  children: ReactNode
  displayName?: string
  role?: "admin" | "member"
  onSignOut: () => void | Promise<void>
}

function accountInitials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U"
}

function NavigationLinks({ items }: { items: LeadershipNavigationItem[] }) {
  return items.map(({ to, label, icon: Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) => cn(
        "leadership-suite-link",
        isActive && "leadership-suite-link--active",
      )}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  ))
}

export function LeadershipShell({
  children,
  displayName = "UBLDA member",
  role = "member",
  onSignOut,
}: LeadershipShellProps) {
  const location = useLocation()
  const header = leadershipHeaderForPath(location.pathname)

  useEffect(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    })
  }, [location.pathname])

  return (
    <div className="dc-app-shell ws-shell leadership-shell">
      <aside className="leadership-sidebar">
        <Link to="/workspace" className="leadership-brand" aria-label="UBLDA workspace">
          <img className="leadership-brand__logo" src="/logo.png" alt="" />
        </Link>

        <nav className="leadership-suite-nav" aria-label="Leadership workspace">
          <NavigationLinks items={leadershipNavigation} />
        </nav>

        {role === "admin" ? (
          <div className="leadership-sidebar__section">
            <span className="leadership-nav-label">Admin</span>
            <nav aria-label="Leadership administration">
              <NavigationLinks items={leadershipAdminNavigation} />
            </nav>
          </div>
        ) : null}

        <div className="leadership-sidebar__account">
          <div className="leadership-avatar" aria-hidden="true">
            {accountInitials(displayName)}
          </div>
          <div className="leadership-account-copy">
            <strong>{displayName}</strong>
            <span>{role}</span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void onSignOut()}
            aria-label="Sign out"
          >
            <LogOut />
          </Button>
        </div>
      </aside>

      <div className="leadership-workspace">
        <header className="leadership-topbar">
          <Link to="/workspace" className="leadership-mobile-brand" aria-label="UBLDA workspace">
            <img className="leadership-brand__logo" src="/logo.png" alt="" />
          </Link>
          <div className="leadership-topbar__copy">
            <div className="leadership-topbar__title">
              <h1>{header.title}</h1>
              <Badge variant="outline" className="leadership-term-badge">2026–27</Badge>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="dc-workspace-main ws-main leadership-main"
          key={location.pathname}
        >
          {children}
        </main>
      </div>

      <nav className="leadership-suite-mobile-nav" aria-label="Leadership workspace">
        {leadershipMobileNavigation.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn(
              "leadership-suite-mobile-link",
              isActive && "leadership-suite-mobile-link--active",
            )}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
