import { Bot, CalendarClock, CalendarDays, FolderKanban, Home, LogOut, MessageCircleQuestion, MicVocal, Settings, Users } from "lucide-react"
import { Link, NavLink, Outlet, useLocation } from "react-router-dom"
import { useEffect } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarRail, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useDecisionData } from "../decisionDataContext"
import { initials } from "../format"

const primaryLinks = [
  { to: "/workspace", label: "overview", icon: Home, end: true },
  { to: "/decisions", label: "questions", icon: MessageCircleQuestion, end: true },
  { to: "/scheduling", label: "scheduling", icon: CalendarClock },
  { to: "/leadership/speakers", label: "speaker ops", icon: MicVocal },
  { to: "/calendar", label: "calendar", icon: CalendarDays },
  { to: "/projects", label: "projects", icon: FolderKanban },
  { to: "/people", label: "people", icon: Users },
]

const mobileLinks = primaryLinks.filter((link) => ["/decisions", "/scheduling", "/leadership/speakers", "/calendar"].includes(link.to))

function WorkspaceNavigation({ pathname }: { pathname: string }) {
  const { setOpenMobile } = useSidebar()
  return <SidebarMenu>{primaryLinks.map(({ to, label, icon: Icon, end }) => <SidebarMenuItem key={to}><SidebarMenuButton asChild tooltip={label} isActive={end ? pathname === to : pathname.startsWith(to)}><NavLink to={to} end={end} onClick={() => setOpenMobile(false)}><Icon /><span>{label}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>
}

export function DecisionWorkspaceLayout() {
  const { adapter, snapshot } = useDecisionData()
  const location = useLocation()
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined
  useEffect(() => {
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }))
  }, [location.pathname])
  return (
    <TooltipProvider>
      <SidebarProvider className="dc-app-shell ws-shell">
        <Sidebar collapsible="icon" className="ws-sidebar">
          <SidebarHeader className="ws-sidebar-header">
            <Link to="/workspace" className="ws-brand" aria-label="UBLDA workspace">
              <img src="/logo.png" alt="" />
              <span>UBLDA</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup><SidebarGroupContent><WorkspaceNavigation pathname={location.pathname} /></SidebarGroupContent></SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="ws-sidebar-footer">
            {viewer?.role === "admin" && <SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild tooltip="members" isActive={location.pathname === "/decisions/settings"}><NavLink to="/decisions/settings"><Settings /><span>members + access</span></NavLink></SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton asChild tooltip="integrations" isActive={location.pathname === "/decisions/integrations"}><NavLink to="/decisions/integrations"><Bot /><span>integrations</span></NavLink></SidebarMenuButton></SidebarMenuItem></SidebarMenu>}
            <div className="ws-account-row"><Avatar><AvatarFallback>{initials(viewer?.displayName ?? "UBLDA")}</AvatarFallback></Avatar><div><strong>{viewer?.displayName ?? "UBLDA member"}</strong><span>{viewer?.role ?? "member"}</span></div><Button variant="ghost" size="icon-sm" onClick={() => void adapter.signOut()} aria-label="sign out"><LogOut /></Button></div>
          </SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset className="ws-inset">
          <header className="ws-app-header">
            <div className="ws-app-header-controls"><SidebarTrigger /></div>
            <Link to="/workspace" className="ws-corner-logo" aria-label="UBLDA workspace"><img src="/logo.png" alt="" /></Link>
          </header>
          <main id="main-content" className="dc-workspace-main ws-main" key={location.pathname}><Outlet /></main>
          <nav className="dc-mobile-nav ws-mobile-nav" aria-label="workspace">{mobileLinks.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("dc-mobile-nav-link", isActive && "dc-mobile-nav-link-active")}><Icon /><span>{label}</span></NavLink>)}</nav>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
