import { ArrowRight, CalendarDays, CheckCircle2, FolderKanban } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { useAvailabilityData } from "@/features/availability/availabilityDataContext"
import { LeadershipPage, LeadershipSection } from "@/features/leadership/components/LeadershipPage"
import { useWorkspaceData } from "../workspaceDataContext"
import { formatDueDate, formatEventDate, formatEventTime, laneLabels } from "../format"

export function WorkspaceOverviewPage() {
  const workspace = useWorkspaceData().getSnapshot()
  const decisions = useDecisionData().snapshot
  const availability = useAvailabilityData().snapshot
  const viewer = decisions.auth.status === "signed-in" ? decisions.auth.viewer : undefined
  const upcoming = workspace.events
    .filter((event) => event.status !== "cancelled")
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 5)
  const activeProjects = workspace.projects.filter((project) => project.status !== "complete").slice(0, 5)
  const waitingDecisions = decisions.decisions.filter((decision) => decision.status === "open" && decision.isEligible && !decisions.responses.some((response) => response.decisionId === decision.id && response.memberId === viewer?.memberId && response.confirmedRevision === decision.revision))
  const waitingPolls = availability.polls.filter((poll) => poll.status === "open" && !poll.hasResponded)
  const waitingTasks = viewer ? workspace.tasks.filter((task) => task.ownerMemberId === viewer.memberId && task.status !== "done") : []
  const firstName = viewer?.displayName.split(/\s+/)[0]?.toLowerCase() ?? "there"

  return (
    <LeadershipPage className="ws-overview-page" eyebrow="workspace" title={`good morning, ${firstName}`}>

      {workspace.error && <p className="ws-error" role="alert">{workspace.error}</p>}

      <div className="ws-overview-grid leadership-overview-grid">
        <LeadershipSection
          title="upcoming agenda"
          titleId="agenda-title"
          flush
          action={<Button variant="ghost" size="sm" asChild><Link to="/calendar">calendar <ArrowRight data-icon="inline-end" /></Link></Button>}
        >
          {upcoming.length ? (
            <div className="ws-agenda-list">
              {upcoming.map((event) => (
                <article className="ws-agenda-row" key={event.id}>
                  <time dateTime={event.startAt}><strong>{formatEventDate(event, { weekday: "short" })}</strong></time>
                  <span className="ws-agenda-marker" aria-hidden="true" />
                  <div><span>{formatEventTime(event)}</span><strong>{event.title}</strong>{event.location && <small>{event.location}</small>}</div>
                </article>
              ))}
            </div>
          ) : (
            <Empty className="ws-empty"><EmptyHeader><EmptyMedia variant="icon"><CalendarDays /></EmptyMedia><EmptyTitle>nothing scheduled</EmptyTitle><EmptyDescription>add the next board meeting or deadline.</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" asChild><Link to="/calendar">open calendar</Link></Button></EmptyContent></Empty>
          )}
        </LeadershipSection>

        <LeadershipSection
          title="active work"
          titleId="active-work-title"
          flush
          action={<Button variant="ghost" size="sm" asChild><Link to="/projects">projects <ArrowRight data-icon="inline-end" /></Link></Button>}
        >
          {activeProjects.length ? <div className="ws-project-list">
            {activeProjects.map((project) => {
              const projectTasks = workspace.tasks.filter((task) => task.projectId === project.id)
              const done = projectTasks.filter((task) => task.status === "done").length
              const progress = projectTasks.length ? Math.round(done / projectTasks.length * 100) : 0
              const nextTask = projectTasks.find((task) => task.status !== "done")
              return (
                <article className="ws-project-row" key={project.id}>
                  <div><strong>{project.name}</strong><small>{laneLabels[project.lane]}</small></div>
                  <div><span>{nextTask?.title ?? "no open tasks"}</span><small>{formatDueDate(nextTask?.dueDate ?? project.dueDate)}</small></div>
                  <div className="ws-progress-cell"><span>{progress}%</span><Progress value={progress} /></div>
                </article>
              )
            })}
          </div> : <Empty className="ws-empty"><EmptyHeader><EmptyMedia variant="icon"><FolderKanban /></EmptyMedia><EmptyTitle>no active projects</EmptyTitle><EmptyDescription>New work will appear here once a project is started.</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" asChild><Link to="/projects">open projects</Link></Button></EmptyContent></Empty>}
        </LeadershipSection>
      </div>

      <LeadershipSection className="leadership-waiting-section" title="waiting on you" titleId="waiting-title" flush>
        {[...waitingDecisions.map((decision) => ({ id: decision.id, label: decision.title, type: "decision", to: `/d/${decision.slug}` })),
          ...waitingPolls.map((poll) => ({ id: poll.id, label: poll.title, type: "scheduling", to: `/s/${poll.slug}` })),
          ...waitingTasks.map((task) => ({ id: task.id, label: task.title, type: "task", to: "/projects" }))]
          .slice(0, 6)
          .map((item) => <Link className="ws-waiting-row" to={item.to} key={`${item.type}-${item.id}`}><CheckCircle2 /><strong>{item.label}</strong><span>{item.type}</span><ArrowRight /></Link>)}
        {!waitingDecisions.length && !waitingPolls.length && !waitingTasks.length && <p className="ws-all-clear"><CheckCircle2 /> you’re caught up</p>}
      </LeadershipSection>
    </LeadershipPage>
  )
}
