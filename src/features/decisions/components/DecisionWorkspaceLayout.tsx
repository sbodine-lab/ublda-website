import { Bot, CalendarDays, LogOut, Menu, Settings, Vote } from "lucide-react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { useDecisionData } from "../decisionDataContext"
import { initials } from "../format"

const desktopLinks = [
  { to: "/decisions", label: "decisions", icon: Vote, end: true },
  { to: "/scheduling", label: "scheduling", icon: CalendarDays },
]

export function DecisionWorkspaceLayout() {
  const { adapter, snapshot } = useDecisionData()
  const location = useLocation()
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined
  const mobileLinks = [
    { to: "/decisions", label: "decisions", icon: Vote, end: true },
    { to: "/scheduling", label: "scheduling", icon: CalendarDays },
  ]

  return (
    <div className="dc-app-shell">
      <header className="dc-topbar">
        <div className="dc-topbar-inner">
          <Link to="/decisions" className="dc-logo-lockup" aria-label="UBLDA workspace">
            <img src="/logo.png" alt="" />
            <span className="dc-logo-full"><strong>UBLDA</strong> <b>workspace</b></span>
          </Link>

          <nav className="dc-desktop-nav" aria-label="UBLDA workspace">
            {desktopLinks.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => cn("dc-nav-link", isActive && "dc-nav-link-active")}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="dc-topbar-actions">
            {adapter.mode === "demo" && <Badge variant="outline">local preview</Badge>}
            {viewer && (
              <Avatar className="dc-desktop-avatar">
                <AvatarFallback>{initials(viewer.displayName)}</AvatarFallback>
              </Avatar>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon-lg" className="dc-touch" aria-label="Open account menu">
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="dc-account-sheet">
                <SheetHeader>
                  <SheetTitle>UBLDA workspace</SheetTitle>
                  <SheetDescription>{viewer?.displayName ?? "UBLDA member"}</SheetDescription>
                </SheetHeader>
                <nav aria-label="Account and settings" className="dc-sheet-nav">
                  {desktopLinks.map(({ to, label, icon: Icon }) => (
                    <SheetClose asChild key={to}>
                      <Link to={to} className="dc-sheet-link"><Icon />{label}</Link>
                    </SheetClose>
                  ))}
                  <SheetClose asChild><Link to="/decisions/settings" className="dc-sheet-link"><Settings />members</Link></SheetClose>
                  <SheetClose asChild><Link to="/decisions/integrations" className="dc-sheet-link"><Bot />integrations</Link></SheetClose>
                </nav>
                <div className="dc-sheet-footer">
                  <Button variant="outline" className="dc-touch" onClick={() => void adapter.signOut()}>
                    <LogOut /> sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main id="main-content" className="dc-workspace-main" key={location.pathname}>
        <Outlet />
      </main>

      <nav className="dc-mobile-nav" aria-label="Decision Center">
        {mobileLinks.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={`${to}-${label}`}
            to={to}
            end={end}
            className={({ isActive }) => cn("dc-mobile-nav-link", isActive && "dc-mobile-nav-link-active")}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
