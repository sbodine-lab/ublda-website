import { useState, type FormEvent } from "react"
import { ChevronDown, FolderKanban, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { LeadershipPage, LeadershipSection } from "@/features/leadership/components/LeadershipPage"
import { useWorkspaceData } from "../workspaceDataContext"
import { formatDueDate, laneLabels, projectStatusLabels, taskStatusLabels } from "../format"
import type { ProjectLane, TaskStatus } from "../types"

const lanes: ProjectLane[] = ["community-career", "advisory", "catalyst", "operations"]

export function ProjectsPage() {
  const adapter = useWorkspaceData()
  const { projects, tasks, people } = adapter.getSnapshot()
  const { snapshot } = useDecisionData()
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined
  const isAdmin = viewer?.role === "admin"
  const [open, setOpen] = useState(false)
  const [lane, setLane] = useState<ProjectLane>("operations")
  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    try { await adapter.createProject({ name: String(form.get("name") ?? ""), lane, ownerMemberId: String(form.get("owner") ?? "") || undefined, status: "planned", dueDate: String(form.get("due") ?? "") || undefined, summary: String(form.get("summary") ?? "") || undefined }); toast.success("project added"); setOpen(false) } catch (caught) { toast.error(caught instanceof Error ? caught.message : "project could not be added") }
  }
  async function createTask(projectId: string) {
    const title = window.prompt("task")?.trim(); if (!title) return
    try { await adapter.createTask({ projectId, title, status: "todo", priority: "medium" }); toast.success("task added") } catch (caught) { toast.error(caught instanceof Error ? caught.message : "task could not be added") }
  }
  async function changeTask(taskId: string, status: TaskStatus) {
    try { await adapter.updateTaskStatus(taskId, status) } catch (caught) { toast.error(caught instanceof Error ? caught.message : "task could not be updated") }
  }
  const personName = (id?: string) => people.find((person) => person.memberId === id)?.displayName ?? "unassigned"

  const newProjectDialog = isAdmin ? (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="ws-primary-action"><Plus data-icon="inline-start" /> new project</Button></DialogTrigger>
      <DialogContent className="ws-dialog">
        <DialogHeader><DialogTitle>new project</DialogTitle></DialogHeader>
        <form onSubmit={createProject}>
          <FieldGroup>
            <Field><FieldLabel htmlFor="project-name">name</FieldLabel><Input id="project-name" name="name" autoFocus required /></Field>
            <Field><FieldLabel htmlFor="project-summary">one-line outcome</FieldLabel><Input id="project-summary" name="summary" /></Field>
            <div className="ws-form-grid"><Field><FieldLabel>lane</FieldLabel><Select value={lane} onValueChange={(value) => setLane(value as ProjectLane)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{lanes.map((value) => <SelectItem key={value} value={value}>{laneLabels[value]}</SelectItem>)}</SelectContent></Select></Field><Field><FieldLabel htmlFor="project-owner">owner</FieldLabel><select id="project-owner" name="owner" className="ws-native-select"><option value="">unassigned</option>{people.map((person) => <option value={person.memberId} key={person.memberId}>{person.displayName}</option>)}</select></Field></div>
            <Field><FieldLabel htmlFor="project-due">due</FieldLabel><Input id="project-due" name="due" type="date" /></Field>
          </FieldGroup>
          <DialogFooter className="ws-dialog-footer"><Button type="submit">create project</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  ) : null

  return (
    <LeadershipPage className="ws-projects-page" action={newProjectDialog}>
      {!projects.length ? <Empty className="ws-empty ws-page-empty"><EmptyHeader><EmptyMedia variant="icon"><FolderKanban /></EmptyMedia><EmptyTitle>no projects yet</EmptyTitle></EmptyHeader></Empty> : null}
      {lanes.map((currentLane) => {
        const laneProjects = projects.filter((project) => project.lane === currentLane)
        if (!laneProjects.length) return null
        return <LeadershipSection
          className="ws-project-group"
          key={currentLane}
          title={<span className="leadership-section-title-row"><ChevronDown />{laneLabels[currentLane]}</span>}
          action={<span className="leadership-section-count">{laneProjects.length}</span>}
          flush
        ><div className="ws-project-mobile">{laneProjects.map((project) => {
          const projectTasks = tasks.filter((task) => task.projectId === project.id)
          const done = projectTasks.filter((task) => task.status === "done").length
          const progress = projectTasks.length ? Math.round(done / projectTasks.length * 100) : 0
          return <article className="ws-project-mobile-card" key={`${project.id}-mobile`}><div className="ws-project-mobile-title"><div><strong>{project.name}</strong>{project.summary && <small>{project.summary}</small>}</div><span className={`ws-status ws-status-${project.status}`}>{projectStatusLabels[project.status]}</span></div><div className="ws-project-mobile-meta"><span>{personName(project.ownerMemberId)}</span><span>{formatDueDate(project.dueDate)}</span><span>{progress}%</span></div><Progress value={progress} />{projectTasks.map((task) => <div className="ws-project-mobile-task" key={`${task.id}-mobile`}><strong>{task.title}</strong><div><span>{personName(task.ownerMemberId)}</span><Select value={task.status} onValueChange={(value) => void changeTask(task.id, value as TaskStatus)} disabled={!isAdmin && task.ownerMemberId !== viewer?.memberId}><SelectTrigger size="sm" className="ws-status-select"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(taskStatusLabels).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></div></div>)}{isAdmin && <button type="button" className="ws-project-mobile-add" onClick={() => void createTask(project.id)}><Plus /> add task</button>}</article>
        })}</div><div className="ws-table-wrap"><Table><TableHeader><TableRow><TableHead>item</TableHead><TableHead>owner</TableHead><TableHead>status</TableHead><TableHead>due</TableHead><TableHead>progress</TableHead></TableRow></TableHeader><TableBody>{laneProjects.flatMap((project) => {
          const projectTasks = tasks.filter((task) => task.projectId === project.id)
          const done = projectTasks.filter((task) => task.status === "done").length
          const progress = projectTasks.length ? Math.round(done / projectTasks.length * 100) : 0
          return [<TableRow className="ws-project-parent" key={project.id}><TableCell><strong>{project.name}</strong>{project.summary && <small>{project.summary}</small>}</TableCell><TableCell>{personName(project.ownerMemberId)}</TableCell><TableCell><span className={`ws-status ws-status-${project.status}`}>{projectStatusLabels[project.status]}</span></TableCell><TableCell>{formatDueDate(project.dueDate)}</TableCell><TableCell><div className="ws-table-progress"><Progress value={progress} /><span>{progress}%</span></div></TableCell></TableRow>, ...projectTasks.map((task) => <TableRow className="ws-task-row" key={task.id}><TableCell><span className="ws-task-indent">{task.title}</span></TableCell><TableCell>{personName(task.ownerMemberId)}</TableCell><TableCell><Select value={task.status} onValueChange={(value) => void changeTask(task.id, value as TaskStatus)} disabled={!isAdmin && task.ownerMemberId !== viewer?.memberId}><SelectTrigger size="sm" className="ws-status-select"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(taskStatusLabels).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></TableCell><TableCell>{formatDueDate(task.dueDate)}</TableCell><TableCell>{task.completionSignal ?? "—"}</TableCell></TableRow>), isAdmin ? <TableRow className="ws-add-task-row" key={`${project.id}-add`}><TableCell colSpan={5}><button type="button" onClick={() => void createTask(project.id)}><Plus /> add task</button></TableCell></TableRow> : null].filter(Boolean) as React.ReactElement[]
        })}</TableBody></Table></div></LeadershipSection>
      })}
    </LeadershipPage>
  )
}
