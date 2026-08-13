import { useMemo, useState, type FormEvent, type ReactNode } from "react"
import { Search, Users } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { initials } from "@/features/decisions/format"
import { LeadershipPage, LeadershipSurface } from "@/features/leadership/components/LeadershipPage"
import { mergeWorkspaceDirectory } from "../directoryData"
import { useWorkspaceData } from "../workspaceDataContext"
import type { DirectoryProfile } from "../types"

export function PeoplePage() {
  const adapter = useWorkspaceData()
  const { people: livePeople } = adapter.getSnapshot()
  const people = useMemo(() => mergeWorkspaceDirectory(livePeople), [livePeople])
  const editableMemberIds = useMemo(
    () => new Set(livePeople.map((person) => person.memberId)),
    [livePeople],
  )
  const { snapshot } = useDecisionData()
  const isAdmin = snapshot.auth.status === "signed-in" && snapshot.auth.viewer.role === "admin"

  const [tab, setTab] = useState("leadership")
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<DirectoryProfile | null>(null)

  const leadershipCount = useMemo(
    () => people.filter((person) => person.isLeadership).length,
    [people],
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return people
      .filter((person) => {
        if (tab !== "members" && !person.isLeadership) return false
        const haystack = [
          person.displayName,
          person.clubRole,
          person.team,
          person.schoolYear,
          person.major,
        ].filter(Boolean).join(" ").toLowerCase()
        return haystack.includes(needle)
      })
      .sort((a, b) => (tab === "leadership" ? 0 : a.displayName.localeCompare(b.displayName)))
  }, [people, query, tab])

  const context = (person: DirectoryProfile) =>
    person.isLeadership
      ? person.team
      : [person.major, person.schoolYear].filter(Boolean).join(" · ") || person.team

  async function save(submitted: FormEvent<HTMLFormElement>) {
    submitted.preventDefault()
    if (!editing) return
    const form = new FormData(submitted.currentTarget)

    try {
      await adapter.updateProfile({
        memberId: editing.memberId,
        clubRole: String(form.get("clubRole") ?? ""),
        team: String(form.get("team") ?? ""),
        schoolYear: String(form.get("schoolYear") ?? "") || undefined,
        major: String(form.get("major") ?? "") || undefined,
        linkedinUrl: String(form.get("linkedinUrl") ?? "") || undefined,
        isLeadership: form.get("isLeadership") === "on",
      })
      toast.success("Profile updated")
      setEditing(null)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Profile could not be updated")
    }
  }

  const personCells = (person: DirectoryProfile): ReactNode => (
    <>
      <Avatar>
        <AvatarImage src={person.avatarUrl} />
        <AvatarFallback>{initials(person.displayName)}</AvatarFallback>
      </Avatar>
      <div>
        <strong>{person.displayName}</strong>
        <span>{person.clubRole}</span>
      </div>
      <span className="ws-person-team">{context(person)}</span>
    </>
  )

  return (
    <LeadershipPage className="ws-people-page">
      <LeadershipSurface className="leadership-directory-surface" flush>
        <div className="ws-people-tools">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="leadership">
                Leadership <span className="ws-tab-count">{leadershipCount}</span>
              </TabsTrigger>
              <TabsTrigger value="members">
                All members <span className="ws-tab-count">{people.length}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <label className="ws-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search people</span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people"
            />
          </label>
        </div>

        {visible.length ? (
          <div className="ws-people-list">
            {visible.map((person) =>
              isAdmin && editableMemberIds.has(person.memberId) ? (
                <button
                  type="button"
                  className="ws-person-row"
                  onClick={() => setEditing(person)}
                  key={person.memberId}
                >
                  {personCells(person)}
                </button>
              ) : (
                <div className="ws-person-row" key={person.memberId}>
                  {personCells(person)}
                </div>
              ),
            )}
          </div>
        ) : (
          <Empty className="ws-empty">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Users /></EmptyMedia>
              <EmptyTitle>No people found</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </LeadershipSurface>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        {editing ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit profile</DialogTitle>
            </DialogHeader>

            <form onSubmit={save}>
              <FieldGroup>
                <div className="ws-form-grid">
                  <Field>
                    <FieldLabel htmlFor="profile-role">Club role</FieldLabel>
                    <Input id="profile-role" name="clubRole" defaultValue={editing.clubRole} required />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="profile-team">Team</FieldLabel>
                    <Input id="profile-team" name="team" defaultValue={editing.team} required />
                  </Field>
                </div>

                <div className="ws-form-grid">
                  <Field>
                    <FieldLabel htmlFor="profile-year">School year</FieldLabel>
                    <Input id="profile-year" name="schoolYear" defaultValue={editing.schoolYear} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="profile-major">Program</FieldLabel>
                    <Input id="profile-major" name="major" defaultValue={editing.major} />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="profile-linkedin">LinkedIn</FieldLabel>
                  <Input
                    id="profile-linkedin"
                    name="linkedinUrl"
                    type="url"
                    defaultValue={editing.linkedinUrl}
                  />
                </Field>

                <Field orientation="horizontal">
                  <FieldLabel htmlFor="profile-leadership">Show in leadership directory</FieldLabel>
                  <Switch
                    id="profile-leadership"
                    name="isLeadership"
                    defaultChecked={editing.isLeadership}
                  />
                </Field>
              </FieldGroup>

              <DialogFooter>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </LeadershipPage>
  )
}
