import { useEffect, useState } from "react"
import { ArrowRight, CalendarDays, CheckCircle2, CloudSun, FolderKanban, Moon, Sun } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Progress } from "@/components/ui/progress"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { useAvailabilityData } from "@/features/availability/availabilityDataContext"
import { LeadershipPage, LeadershipSection } from "@/features/leadership/components/LeadershipPage"
import { useWorkspaceData } from "../workspaceDataContext"
import { formatDueDate, formatEventDate, formatEventTime, programAreaLabels } from "../format"

type LocalWeather = {
  apparentTemperatureF: number
  condition: string
  isDay: boolean
  location: string
  temperatureF: number
}

function useLocalWeather() {
  const [weather, setWeather] = useState<LocalWeather>()

  useEffect(() => {
    const controller = new AbortController()

    void fetch("/api/weather", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Weather request failed with ${response.status}.`)
        return response.json() as Promise<LocalWeather>
      })
      .then(setWeather)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.info("Local weather is unavailable.")
        }
      })

    return () => controller.abort()
  }, [])

  return weather
}

export function WorkspaceOverviewPage() {
  const workspace = useWorkspaceData().getSnapshot()
  const decisions = useDecisionData().snapshot
  const availability = useAvailabilityData().snapshot
  const viewer = decisions.auth.status === "signed-in" ? decisions.auth.viewer : undefined
  const weather = useLocalWeather()

  const upcoming = workspace.events
    .filter((event) => event.status !== "cancelled")
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
    .slice(0, 5)

  const activeProjects = workspace.projects
    .filter((project) => project.status !== "complete")
    .slice(0, 5)

  const openQuestions = decisions.decisions.filter((question) =>
    question.status === "open"
    && question.isEligible
    && !decisions.responses.some((response) =>
      response.decisionId === question.id
      && response.memberId === viewer?.memberId
      && response.confirmedRevision === question.revision),
  )
  const openPolls = availability.polls.filter((poll) => poll.status === "open" && !poll.hasResponded)
  const openTasks = viewer
    ? workspace.tasks.filter((task) => task.ownerMemberId === viewer.memberId && task.status !== "done")
    : []

  const waiting = [
    ...openQuestions.map((question) => ({
      id: question.id, title: question.title, kind: "Question", to: `/d/${question.slug}`,
    })),
    ...openPolls.map((poll) => ({
      id: poll.id, title: poll.title, kind: "Scheduling", to: `/s/${poll.slug}`,
    })),
    ...openTasks.map((task) => ({
      id: task.id, title: task.title, kind: "Task", to: "/projects",
    })),
  ].slice(0, 6)

  const WeatherIcon = weather
    ? weather.condition === "Clear" ? (weather.isDay ? Sun : Moon) : CloudSun
    : CloudSun

  return (
    <LeadershipPage
      className="ws-overview-page"
      action={weather ? (
        <div
          className="ws-local-weather"
          aria-label={`${weather.temperatureF} degrees in ${weather.location}, feels like ${weather.apparentTemperatureF}`}
        >
          <WeatherIcon aria-hidden="true" />
          <strong>{weather.temperatureF}°</strong>
          <span>{weather.condition}</span>
          <span className="ws-local-weather__location">{weather.location}</span>
        </div>
      ) : null}
    >
      {workspace.error ? <p className="ws-error" role="alert">{workspace.error}</p> : null}

      <div className="ws-overview-grid leadership-overview-grid">
        <LeadershipSection
          title="Upcoming"
          titleId="agenda-title"
          flush
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/calendar">Calendar <ArrowRight data-icon="inline-end" /></Link>
            </Button>
          }
        >
          {upcoming.length ? (
            <div className="ws-agenda-list">
              {upcoming.map((event) => (
                <article className="ws-agenda-row" key={event.id}>
                  <time dateTime={event.startAt}>
                    <strong>{formatEventDate(event, { weekday: "short" })}</strong>
                  </time>
                  <span className="ws-agenda-marker" aria-hidden="true" />
                  <div>
                    <span>{formatEventTime(event)}</span>
                    <strong>{event.title}</strong>
                    {event.location ? <small>{event.location}</small> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <Empty className="ws-empty">
              <EmptyHeader>
                <EmptyMedia variant="icon"><CalendarDays /></EmptyMedia>
                <EmptyTitle>Nothing scheduled</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </LeadershipSection>

        <LeadershipSection
          title="Active work"
          titleId="active-work-title"
          flush
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects">Projects <ArrowRight data-icon="inline-end" /></Link>
            </Button>
          }
        >
          {activeProjects.length ? (
            <div className="ws-project-list">
              {activeProjects.map((project) => {
                const projectTasks = workspace.tasks.filter((task) => task.projectId === project.id)
                const done = projectTasks.filter((task) => task.status === "done").length
                const percent = projectTasks.length
                  ? Math.round((done / projectTasks.length) * 100)
                  : 0
                const nextTask = projectTasks.find((task) => task.status !== "done")

                return (
                  <article className="ws-project-row" key={project.id}>
                    <div>
                      <strong>{project.name}</strong>
                      <small>{programAreaLabels[project.lane]}</small>
                    </div>
                    <div>
                      <span>{nextTask?.title ?? "—"}</span>
                      <small>{formatDueDate(nextTask?.dueDate ?? project.dueDate)}</small>
                    </div>
                    <div className="ws-progress-cell">
                      <span>{percent}%</span>
                      <Progress value={percent} />
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <Empty className="ws-empty">
              <EmptyHeader>
                <EmptyMedia variant="icon"><FolderKanban /></EmptyMedia>
                <EmptyTitle>No active projects</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </LeadershipSection>
      </div>

      <LeadershipSection
        className="leadership-waiting-section"
        title="Waiting on you"
        titleId="waiting-title"
        flush
      >
        {waiting.map((item) => (
          <Link className="ws-waiting-row" to={item.to} key={`${item.kind}-${item.id}`}>
            <CheckCircle2 aria-hidden="true" />
            <strong>{item.title}</strong>
            <span>{item.kind}</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        ))}
        {waiting.length ? null : (
          <p className="ws-all-clear"><CheckCircle2 aria-hidden="true" /> All clear</p>
        )}
      </LeadershipSection>
    </LeadershipPage>
  )
}
