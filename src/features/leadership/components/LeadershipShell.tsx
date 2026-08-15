import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { Ellipsis, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  leadershipAdminNavigation,
  leadershipHeaderForPath,
  leadershipMobileNavigation,
  leadershipMoreNavigation,
  leadershipNavigation,
  type LeadershipNavigationItem,
} from "../navigation"
import { LeadershipHeaderActionContext } from "../headerActionContext"
import { PageTransition } from "./PageTransition"
import "../leadership-shell.css"

interface LeadershipShellProps {
  children: ReactNode
  displayName?: string
  role?: "admin" | "member"
  onSignOut: () => void | Promise<void>
}

const roleLabels: Record<"admin" | "member", string> = {
  admin: "Admin",
  member: "Member",
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
  displayName = "Member",
  role = "member",
  onSignOut,
}: LeadershipShellProps) {
  const location = useLocation()
  const header = leadershipHeaderForPath(location.pathname)
  const [headerActionSlot, setHeaderActionSlot] = useState<HTMLElement | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  // A route change otherwise drops focus to <body> with nothing announced.
  // App.tsx already owns the scroll reset; the shell must not run a second one.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    titleRef.current?.focus({ preventScroll: true })
  }, [location.pathname])

  return (
    <div className="dc-app-shell ws-shell leadership-shell">
      <aside className="leadership-sidebar">
        <Link to="/workspace" className="leadership-brand" aria-label="UBLDA workspace">
          <img className="leadership-brand__logo" src="/logo-64.png" alt="" width="63" height="64" />
        </Link>

        <div className="leadership-sidebar__scroll">
          <nav className="leadership-suite-nav" aria-label="Workspace">
            <NavigationLinks items={leadershipNavigation} />
          </nav>

          {role === "admin" ? (
            <div className="leadership-sidebar__section">
              <span className="leadership-nav-label">Admin</span>
              <nav aria-label="Administration">
                <NavigationLinks items={leadershipAdminNavigation} />
              </nav>
            </div>
          ) : null}
        </div>

        <div className="leadership-sidebar__account">
          <div className="leadership-avatar" aria-hidden="true">
            {accountInitials(displayName)}
          </div>
          <div className="leadership-account-copy">
            <strong>{displayName}</strong>
            <span>{roleLabels[role]}</span>
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
        <header className="leadership-topbar" aria-live="polite">
          <Link to="/workspace" className="leadership-mobile-brand" aria-label="UBLDA workspace">
            <img className="leadership-brand__logo" src="/logo-64.png" alt="" width="63" height="64" />
          </Link>
          <h1 ref={titleRef} tabIndex={-1}>{header.title}</h1>
          {/* The live region announces the route title, not the action. */}
          <div className="leadership-topbar__action" aria-live="off" ref={setHeaderActionSlot} />
        </header>

        <main id="main-content" className="dc-workspace-main ws-main leadership-main">
          <LeadershipHeaderActionContext.Provider value={headerActionSlot}>
            <PageTransition routeKey={location.pathname}>{children}</PageTransition>
          </LeadershipHeaderActionContext.Provider>
        </main>
      </div>

      <nav className="leadership-suite-mobile-nav" aria-label="Workspace">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="leadership-suite-mobile-link">
              <Ellipsis aria-hidden="true" />
              <span>More</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            sideOffset={10}
            className="leadership-mobile-menu"
          >
            <DropdownMenuLabel>Go to</DropdownMenuLabel>
            {leadershipMoreNavigation.map(({ to, label, icon: Icon, end }) => (
              <DropdownMenuItem key={to} asChild className="leadership-mobile-menu-item">
                <NavLink to={to} end={end}>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              </DropdownMenuItem>
            ))}
            {role === "admin" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Admin</DropdownMenuLabel>
                {leadershipAdminNavigation.map(({ to, label, icon: Icon, end }) => (
                  <DropdownMenuItem key={to} asChild className="leadership-mobile-menu-item">
                    <NavLink to={to} end={end}>
                      <Icon aria-hidden="true" />
                      <span>{label}</span>
                    </NavLink>
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="leadership-mobile-menu-item"
              onSelect={() => void onSignOut()}
            >
              <LogOut aria-hidden="true" />
              <span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  )
}
