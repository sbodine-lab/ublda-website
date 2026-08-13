import { useMemo, useState, type FormEvent } from "react"
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
  const editableMemberIds = useMemo(() => new Set(livePeople.map((person) => person.memberId)), [livePeople])
  const { snapshot } = useDecisionData()
  const isAdmin = snapshot.auth.status === "signed-in" && snapshot.auth.viewer.role === "admin"
  const [tab, setTab] = useState("leadership")
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<DirectoryProfile | null>(null)
  const leadershipCount = useMemo(() => people.filter((person) => person.isLeadership).length, [people])
  const visible = useMemo(() => people
    .filter((person) => (tab === "members" || person.isLeadership) && `${person.displayName} ${person.clubRole} ${person.team} ${person.schoolYear ?? ""} ${person.major ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => tab === "leadership" ? 0 : a.displayName.localeCompare(b.displayName)), [people, query, tab])
  const context = (person: DirectoryProfile) => person.isLeadership
    ? person.team
    : [person.major, person.schoolYear].filter(Boolean).join(" · ") || person.team
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return
    const form = new FormData(event.currentTarget)
    try { await adapter.updateProfile({ memberId: editing.memberId, clubRole: String(form.get("clubRole") ?? ""), team: String(form.get("team") ?? ""), schoolYear: String(form.get("schoolYear") ?? "") || undefined, major: String(form.get("major") ?? "") || undefined, linkedinUrl: String(form.get("linkedinUrl") ?? "") || undefined, isLeadership: form.get("isLeadership") === "on" }); toast.success("profile updated"); setEditing(null) } catch (caught) { toast.error(caught instanceof Error ? caught.message : "profile could not be updated") }
  }
  return (
    <LeadershipPage className="ws-people-page">
      <LeadershipSurface className="leadership-directory-surface" flush>
        <div className="ws-people-tools"><Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="leadership">leadership <span>{leadershipCount}</span></TabsTrigger><TabsTrigger value="members">all members <span>{people.length}</span></TabsTrigger></TabsList></Tabs><label className="ws-search"><Search /><span className="sr-only">search people</span><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="search people" /></label></div>
        {visible.length ? <div className="ws-people-list">{visible.map((person) => {
          const editable = isAdmin && editableMemberIds.has(person.memberId)
          return <button type="button" className="ws-person-row" onClick={() => editable && setEditing(person)} aria-disabled={!editable} key={person.memberId}><Avatar><AvatarImage src={person.avatarUrl} /><AvatarFallback>{initials(person.displayName)}</AvatarFallback></Avatar><div><strong>{person.displayName}</strong><span>{person.clubRole}</span></div><span className="ws-person-team">{context(person)}</span></button>
        })}</div> : <Empty className="ws-empty ws-page-empty"><EmptyHeader><EmptyMedia variant="icon"><Users /></EmptyMedia><EmptyTitle>no people found</EmptyTitle></EmptyHeader></Empty>}
      </LeadershipSurface>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>{editing && <DialogContent className="ws-dialog"><DialogHeader><DialogTitle>edit {editing.displayName.toLowerCase()}</DialogTitle></DialogHeader><form onSubmit={save}><FieldGroup><div className="ws-form-grid"><Field><FieldLabel htmlFor="profile-role">club role</FieldLabel><Input id="profile-role" name="clubRole" defaultValue={editing.clubRole} required /></Field><Field><FieldLabel htmlFor="profile-team">team</FieldLabel><Input id="profile-team" name="team" defaultValue={editing.team} required /></Field></div><div className="ws-form-grid"><Field><FieldLabel htmlFor="profile-year">school year</FieldLabel><Input id="profile-year" name="schoolYear" defaultValue={editing.schoolYear} /></Field><Field><FieldLabel htmlFor="profile-major">program</FieldLabel><Input id="profile-major" name="major" defaultValue={editing.major} /></Field></div><Field><FieldLabel htmlFor="profile-linkedin">linkedin</FieldLabel><Input id="profile-linkedin" name="linkedinUrl" type="url" defaultValue={editing.linkedinUrl} /></Field><Field orientation="horizontal"><FieldLabel htmlFor="profile-leadership">leadership directory</FieldLabel><Switch id="profile-leadership" name="isLeadership" defaultChecked={editing.isLeadership} /></Field></FieldGroup><DialogFooter className="ws-dialog-footer"><Button type="submit">save profile</Button></DialogFooter></form></DialogContent>}</Dialog>
    </LeadershipPage>
  )
}
