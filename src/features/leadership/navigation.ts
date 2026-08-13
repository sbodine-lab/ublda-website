import {
  Bot,
  CalendarClock,
  CalendarDays,
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
  description: string
}

export const leadershipNavigation: LeadershipNavigationItem[] = [
  { to: "/workspace", label: "Dashboard", icon: Home, end: true },
  { to: "/decisions", label: "Questions", icon: MessageCircleQuestion, end: true },
  { to: "/scheduling", label: "Scheduling", icon: CalendarClock },
  { to: "/leadership/speakers", label: "Speaker Ops", icon: MicVocal },
  { to: "/calendar", label: "Club calendar", icon: CalendarDays },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/people", label: "People", icon: Users },
]

export const leadershipAdminNavigation: LeadershipNavigationItem[] = [
  { to: "/decisions/settings", label: "Members + access", icon: Settings, end: true },
  { to: "/decisions/integrations", label: "Integrations", icon: Bot, end: true },
]

const mobileDestinations = new Set([
  "/decisions",
  "/scheduling",
  "/leadership/speakers",
  "/calendar",
])

export const leadershipMobileNavigation = leadershipNavigation.filter((item) => (
  mobileDestinations.has(item.to)
))

const routeHeaders: Array<{
  matches: (pathname: string) => boolean
  header: LeadershipRouteHeader
}> = [
  {
    matches: (pathname) => pathname === "/leadership/speakers",
    header: {
      title: "Speaker Ops",
      description: "Plan one or two firesides. Do not offer a date until Ross confirms a room.",
    },
  },
  {
    matches: (pathname) => pathname === "/decisions/settings",
    header: {
      title: "Members + access",
      description: "Manage the leadership roster and workspace permissions.",
    },
  },
  {
    matches: (pathname) => pathname === "/decisions/integrations",
    header: {
      title: "Integrations",
      description: "Connect approved tools to leadership decisions and workflows.",
    },
  },
  {
    matches: (pathname) => pathname === "/decisions/new",
    header: {
      title: "New question",
      description: "Frame the decision, set the rules, and invite the right people.",
    },
  },
  {
    matches: (pathname) => pathname.includes("/results") && pathname.startsWith("/decisions/"),
    header: {
      title: "Question results",
      description: "Review participation, responses, and the recorded outcome.",
    },
  },
  {
    matches: (pathname) => pathname === "/scheduling/new",
    header: {
      title: "New scheduling poll",
      description: "Offer working windows and find the time that fits the group.",
    },
  },
  {
    matches: (pathname) => pathname.includes("/results") && pathname.startsWith("/scheduling/"),
    header: {
      title: "Scheduling results",
      description: "Compare availability and choose the strongest working window.",
    },
  },
  {
    matches: (pathname) => pathname === "/workspace",
    header: {
      title: "Dashboard",
      description: "Upcoming events, active work, and what needs your attention.",
    },
  },
  {
    matches: (pathname) => pathname === "/results",
    header: {
      title: "Results",
      description: "Review participation, responses, and recorded decisions.",
    },
  },
  {
    matches: (pathname) => pathname === "/decisions" || pathname.startsWith("/decisions/"),
    header: {
      title: "Questions",
      description: "Make decisions with context, clear deadlines, and recorded responses.",
    },
  },
  {
    matches: (pathname) => pathname === "/scheduling" || pathname.startsWith("/scheduling/"),
    header: {
      title: "Scheduling",
      description: "Find time for leadership meetings and working sessions.",
    },
  },
  {
    matches: (pathname) => pathname === "/calendar",
    header: {
      title: "Club calendar",
      description: "Keep meetings, deadlines, and events in one shared timeline.",
    },
  },
  {
    matches: (pathname) => pathname === "/projects",
    header: {
      title: "Projects",
      description: "Track owners, next actions, deadlines, and progress.",
    },
  },
  {
    matches: (pathname) => pathname === "/people",
    header: {
      title: "People",
      description: "Find leadership members, roles, teams, and contact context.",
    },
  },
]

const fallbackHeader: LeadershipRouteHeader = {
  title: "Leadership Workspace",
  description: "Questions, scheduling, events, projects, and member coordination.",
}

export function leadershipHeaderForPath(pathname: string) {
  return routeHeaders.find(({ matches }) => matches(pathname))?.header ?? fallbackHeader
}
