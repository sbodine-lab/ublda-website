import { Fragment, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { FolderKanban, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { LeadershipPage, LeadershipSection } from "@/features/leadership/components/LeadershipPage"
import { useWorkspaceData } from "../workspaceDataContext"
import { formatDueDate, programAreaLabels, projectStatusLabels, taskStatusLabels } from "../format"
import type { ProjectLane, ProjectTask, TaskStatus } from "../types"

const NO_OWNER = "unassigned"

const programAreas: ProjectLane[] = ["community-career", "advisory", "catalyst", "operations"]

export function ProjectsPage() {
  const adapter = useWorkspaceData()
  const { projects, tasks, people } = adapter.getSnapshot()
  const { snapshot } = useDecisionData()
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined
  const isAdmin = viewer?.role === "admin"

  const [open, setOpen] = useState(false)
  // Trigger is portaled into the topbar, so Radix cannot restore focus itself.
  const newProjectTriggerRef = useRef<HTMLButtonElement>(null)
  const [programArea, setProgramArea] = useState<ProjectLane>("operations")
  const [ownerId, setOwnerId] = useState(NO_OWNER)
  const [addingTaskIn, setAddingTaskIn] = useState<string>()
  const taskSettled = useRef(false)

  function openDialog(next: boolean) {
    setOpen(next)
    if (!next) return
    setProgramArea("operations")
    setOwnerId(NO_OWNER)
  }

  async function createProject(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault()
    const form = new FormData(submitted.currentTarget)

    try {
      await adapter.createProject({
        name: String(form.get("name") ?? ""),
        lane: programArea,
        ownerMemberId: ownerId === NO_OWNER ? undefined : ownerId,
        status: "planned",
        dueDate: String(form.get("due") ?? "") || undefined,
      })
      toast.success("Project added")
      setOpen(false)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Project could not be added")
    }
  }

  function startTask(slot: string) {
    taskSettled.current = false
    setAddingTaskIn(slot)
  }

  function cancelTask() {
    taskSettled.current = true
    setAddingTaskIn(undefined)
  }

  async function commitTask(projectId: string, value: string) {
    if (taskSettled.current) return
    taskSettled.current = true
    setAddingTaskIn(undefined)

    const title = value.trim()
    if (!title) return

    try {
      await adapter.createTask({ projectId, title, status: "todo", priority: "medium" })
      toast.success("Task added")
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Task could not be added")
    }
  }

  function onTaskKeyDown(projectId: string, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault()
      void commitTask(projectId, event.currentTarget.value)
    }
    if (event.key === "Escape") {
      event.preventDefault()
      cancelTask()
    }
  }

  async function changeTaskStatus(taskId: string, status: TaskStatus) {
    try {
      await adapter.updateTaskStatus(taskId, status)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Task could not be updated")
    }
  }

  const personName = (id?: string) =>
    people.find((person) => person.memberId === id)?.displayName ?? "Unassigned"

  const canSetStatus = (task: ProjectTask) => isAdmin || task.ownerMemberId === viewer?.memberId

  const projectProgress = (projectId: string) => {
    const projectTasks = tasks.filter((task) => task.projectId === projectId)
    const done = projectTasks.filter((task) => task.status === "done").length
    return {
      tasks: projectTasks,
      percent: projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0,
    }
  }

  const statusSelect = (task: ProjectTask) => (
    <Select
      value={task.status}
      onValueChange={(value) => void changeTaskStatus(task.id, value as TaskStatus)}
      disabled={!canSetStatus(task)}
    >
      <SelectTrigger size="sm" className="ws-status-select" aria-label="Task status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(taskStatusLabels).map(([value, label]) => (
          <SelectItem value={value} key={value}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const addTaskCell = (projectId: string, slot: string) =>
    addingTaskIn === slot ? (
      <Input
        autoFocus
        className="ws-add-task-input"
        placeholder="Task title"
        aria-label="Task title"
        onBlur={(event) => void commitTask(projectId, event.currentTarget.value)}
        onKeyDown={(event) => onTaskKeyDown(projectId, event)}
      />
    ) : (
      <button type="button" onClick={() => startTask(slot)}>
        <Plus aria-hidden="true" /> Add task
      </button>
    )

  const newProjectAction = isAdmin ? (
    <Button ref={newProjectTriggerRef} onClick={() => openDialog(true)}>
      <Plus data-icon="inline-start" /> New project
    </Button>
  ) : null

  return (
    <LeadershipPage className="ws-projects-page" action={newProjectAction}>
      {projects.length ? null : (
        <Empty className="ws-empty">
          <EmptyHeader>
            <EmptyMedia variant="icon"><FolderKanban /></EmptyMedia>
            <EmptyTitle>No projects yet</EmptyTitle>
          </EmptyHeader>
          {isAdmin ? (
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => openDialog(true)}>
                New project
              </Button>
            </EmptyContent>
          ) : null}
        </Empty>
      )}

      {programAreas.map((area) => {
        const areaProjects = projects.filter((project) => project.lane === area)
        if (!areaProjects.length) return null

        return (
          <LeadershipSection
            className="ws-project-group"
            key={area}
            title={programAreaLabels[area]}
            action={<span className="leadership-section-count">{areaProjects.length}</span>}
            flush
          >
            <div className="ws-project-mobile">
              {areaProjects.map((project) => {
                const { tasks: projectTasks, percent } = projectProgress(project.id)

                return (
                  <article className="ws-project-mobile-card" key={project.id}>
                    <div className="ws-project-mobile-title">
                      <div>
                        <strong>{project.name}</strong>
                        {project.summary ? <small>{project.summary}</small> : null}
                      </div>
                      <span className={`ws-status ws-status-${project.status}`}>
                        {projectStatusLabels[project.status]}
                      </span>
                    </div>

                    <div className="ws-project-mobile-meta">
                      <span>{personName(project.ownerMemberId)}</span>
                      <span>{formatDueDate(project.dueDate)}</span>
                      <span>{percent}%</span>
                    </div>
                    <Progress value={percent} />

                    {projectTasks.map((task) => (
                      <div className="ws-project-mobile-task" key={task.id}>
                        <strong>{task.title}</strong>
                        <div>
                          <span>{personName(task.ownerMemberId)}</span>
                          {statusSelect(task)}
                        </div>
                      </div>
                    ))}

                    {isAdmin ? (
                      <div className="ws-project-mobile-add">
                        {addTaskCell(project.id, `mobile:${project.id}`)}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>

            <div className="ws-table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areaProjects.map((project) => {
                    const { tasks: projectTasks, percent } = projectProgress(project.id)

                    return (
                      <Fragment key={project.id}>
                        <TableRow className="ws-project-parent">
                          <TableCell>
                            <strong>{project.name}</strong>
                            {project.summary ? <small>{project.summary}</small> : null}
                          </TableCell>
                          <TableCell>{personName(project.ownerMemberId)}</TableCell>
                          <TableCell>
                            <span className={`ws-status ws-status-${project.status}`}>
                              {projectStatusLabels[project.status]}
                            </span>
                          </TableCell>
                          <TableCell>{formatDueDate(project.dueDate)}</TableCell>
                          <TableCell>
                            <div className="ws-table-progress">
                              <Progress value={percent} />
                              <span>{percent}%</span>
                            </div>
                          </TableCell>
                        </TableRow>

                        {projectTasks.map((task) => (
                          <TableRow className="ws-task-row" key={task.id}>
                            <TableCell>
                              <span className="ws-task-indent">
                                {task.title}
                                {task.completionSignal ? <small>{task.completionSignal}</small> : null}
                              </span>
                            </TableCell>
                            <TableCell>{personName(task.ownerMemberId)}</TableCell>
                            <TableCell>{statusSelect(task)}</TableCell>
                            <TableCell>{formatDueDate(task.dueDate)}</TableCell>
                            <TableCell>—</TableCell>
                          </TableRow>
                        ))}

                        {isAdmin ? (
                          <TableRow className="ws-add-task-row">
                            <TableCell colSpan={5}>
                              {addTaskCell(project.id, `table:${project.id}`)}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </LeadershipSection>
        )
      })}

      <Dialog open={open} onOpenChange={openDialog}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            newProjectTriggerRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>

          <form onSubmit={createProject}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="project-name">Project name</FieldLabel>
                <Input id="project-name" name="name" autoFocus required />
              </Field>

              <div className="ws-form-grid">
                <Field>
                  <FieldLabel htmlFor="project-program-area">Program area</FieldLabel>
                  <Select
                    value={programArea}
                    onValueChange={(value) => setProgramArea(value as ProjectLane)}
                  >
                    <SelectTrigger id="project-program-area" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {programAreas.map((value) => (
                        <SelectItem key={value} value={value}>{programAreaLabels[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="project-owner">Owner</FieldLabel>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger id="project-owner" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_OWNER}>Unassigned</SelectItem>
                      {people.map((person) => (
                        <SelectItem value={person.memberId} key={person.memberId}>
                          {person.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="project-due">Due date</FieldLabel>
                <Input id="project-due" name="due" type="date" />
              </Field>
            </FieldGroup>

            <DialogFooter>
              <Button type="submit">Create project</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </LeadershipPage>
  )
}
