import {
  Bot,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FolderKanban,
  Home,
  MessageCircleQuestion,
  MicVocal,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react"

export interface LeadershipNavigationItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export interface LeadershipRouteHeader {
  title: string
}

export const leadershipNavigation: LeadershipNavigationItem[] = [
  { to: "/workspace", label: "Dashboard", icon: Home, end: true },
  { to: "/decisions", label: "Questions", icon: MessageCircleQuestion, end: true },
  { to: "/scheduling", label: "Scheduling", icon: CalendarClock },
  { to: "/leadership/speakers", label: "Speakers", icon: MicVocal },
  { to: "/operations", label: "Operations", icon: ClipboardCheck },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/people", label: "People", icon: Users },
]

export const leadershipAdminNavigation: LeadershipNavigationItem[] = [
  { to: "/decisions/settings", label: "Members", icon: Settings, end: true },
  { to: "/decisions/integrations", label: "Integrations", icon: Bot, end: true },
]

/* The four destinations the exec board opens daily. The fifth bottom-bar slot
   is "More", which lists everything below and nothing that is already here. */
const bottomBarDestinations = new Set([
  "/workspace",
  "/decisions",
  "/calendar",
  "/projects",
])

export const leadershipMobileNavigation = leadershipNavigation.filter((item) => (
  bottomBarDestinations.has(item.to)
))

export const leadershipMoreNavigation = leadershipNavigation.filter((item) => (
  !bottomBarDestinations.has(item.to)
))

const routeHeaders: Array<{
  matches: (pathname: string) => boolean
  header: LeadershipRouteHeader
}> = [
  { matches: (pathname) => pathname === "/leadership/speakers", header: { title: "Speakers" } },
  { matches: (pathname) => pathname === "/operations", header: { title: "Operations" } },
  { matches: (pathname) => pathname === "/decisions/settings", header: { title: "Members" } },
  { matches: (pathname) => pathname === "/decisions/integrations", header: { title: "Integrations" } },
  { matches: (pathname) => pathname === "/decisions/new", header: { title: "New question" } },
  {
    matches: (pathname) => pathname.startsWith("/decisions/") && pathname.includes("/results"),
    header: { title: "Results" },
  },
  { matches: (pathname) => pathname === "/scheduling/new", header: { title: "New poll" } },
  {
    matches: (pathname) => pathname.startsWith("/scheduling/") && pathname.includes("/results"),
    header: { title: "Scheduling results" },
  },
  { matches: (pathname) => pathname === "/workspace", header: { title: "Dashboard" } },
  { matches: (pathname) => pathname === "/results", header: { title: "Results" } },
  { matches: (pathname) => pathname.startsWith("/decisions"), header: { title: "Questions" } },
  { matches: (pathname) => pathname.startsWith("/scheduling"), header: { title: "Scheduling" } },
  { matches: (pathname) => pathname === "/calendar", header: { title: "Calendar" } },
  { matches: (pathname) => pathname === "/projects", header: { title: "Projects" } },
  { matches: (pathname) => pathname === "/people", header: { title: "People" } },
]

const fallbackHeader: LeadershipRouteHeader = { title: "Workspace" }

export function leadershipHeaderForPath(pathname: string) {
  return routeHeaders.find(({ matches }) => matches(pathname))?.header ?? fallbackHeader
}
