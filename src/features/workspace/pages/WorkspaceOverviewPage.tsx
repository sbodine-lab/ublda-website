import { ArrowRight, CalendarDays, CheckCircle2 } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { useAvailabilityData } from "@/features/availability/availabilityDataContext"
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
    <div className="ws-page ws-overview-page">
      <header className="ws-page-header">
        <p className="ws-kicker">workspace</p>
        <h1>good morning, {firstName}</h1>
      </header>

      {workspace.error && <p className="ws-error" role="alert">{workspace.error}</p>}

      <div className="ws-overview-grid">
        <section className="ws-section" aria-labelledby="agenda-title">
          <div className="ws-section-heading">
            <h2 id="agenda-title">upcoming agenda</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/calendar">calendar <ArrowRight /></Link></Button>
          </div>
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
            <Empty className="ws-empty"><EmptyHeader><CalendarDays /><EmptyTitle>nothing scheduled</EmptyTitle><EmptyDescription>add the next board meeting or deadline.</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" asChild><Link to="/calendar">open calendar</Link></Button></EmptyContent></Empty>
          )}
        </section>

        <section className="ws-section" aria-labelledby="active-work-title">
          <div className="ws-section-heading">
            <h2 id="active-work-title">active work</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/projects">projects <ArrowRight /></Link></Button>
          </div>
          <div className="ws-project-list">
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
          </div>
        </section>
      </div>

      <section className="ws-section ws-waiting" aria-labelledby="waiting-title">
        <div className="ws-section-heading"><h2 id="waiting-title">waiting on you</h2></div>
        {[...waitingDecisions.map((decision) => ({ id: decision.id, label: decision.title, type: "decision", to: `/d/${decision.slug}` })),
          ...waitingPolls.map((poll) => ({ id: poll.id, label: poll.title, type: "scheduling", to: `/s/${poll.slug}` })),
          ...waitingTasks.map((task) => ({ id: task.id, label: task.title, type: "task", to: "/projects" }))]
          .slice(0, 6)
          .map((item) => <Link className="ws-waiting-row" to={item.to} key={`${item.type}-${item.id}`}><CheckCircle2 /><strong>{item.label}</strong><span>{item.type}</span><ArrowRight /></Link>)}
        {!waitingDecisions.length && !waitingPolls.length && !waitingTasks.length && <p className="ws-all-clear"><CheckCircle2 /> you’re caught up</p>}
      </section>
    </div>
  )
}
