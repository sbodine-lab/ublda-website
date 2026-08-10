import { useMemo, useState, type FormEvent } from "react"
import { Search } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDecisionData } from "@/features/decisions/decisionDataContext"
import { initials } from "@/features/decisions/format"
import { useWorkspaceData } from "../workspaceDataContext"
import type { DirectoryProfile } from "../types"

export function PeoplePage() {
  const adapter = useWorkspaceData()
  const { people } = adapter.getSnapshot()
  const { snapshot } = useDecisionData()
  const isAdmin = snapshot.auth.status === "signed-in" && snapshot.auth.viewer.role === "admin"
  const [tab, setTab] = useState("leadership")
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<DirectoryProfile | null>(null)
  const visible = useMemo(() => people.filter((person) => (tab === "members" || person.isLeadership) && `${person.displayName} ${person.clubRole} ${person.team}`.toLowerCase().includes(query.toLowerCase())), [people, query, tab])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return
    const form = new FormData(event.currentTarget)
    try { await adapter.updateProfile({ memberId: editing.memberId, clubRole: String(form.get("clubRole") ?? ""), team: String(form.get("team") ?? ""), schoolYear: String(form.get("schoolYear") ?? "") || undefined, major: String(form.get("major") ?? "") || undefined, linkedinUrl: String(form.get("linkedinUrl") ?? "") || undefined, isLeadership: form.get("isLeadership") === "on" }); toast.success("profile updated"); setEditing(null) } catch (caught) { toast.error(caught instanceof Error ? caught.message : "profile could not be updated") }
  }
  return (
    <div className="ws-page ws-people-page">
      <header className="ws-page-header"><p className="ws-kicker">directory</p><h1>people</h1></header>
      <div className="ws-people-tools"><Tabs value={tab} onValueChange={setTab}><TabsList><TabsTrigger value="leadership">leadership</TabsTrigger><TabsTrigger value="members">members</TabsTrigger></TabsList></Tabs><label className="ws-search"><Search /><span className="sr-only">search people</span><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="search" /></label></div>
      <div className="ws-people-list">{visible.map((person) => <button type="button" className="ws-person-row" onClick={() => isAdmin && setEditing(person)} key={person.memberId}><Avatar><AvatarImage src={person.avatarUrl} /><AvatarFallback>{initials(person.displayName)}</AvatarFallback></Avatar><div><strong>{person.displayName}</strong><span>{person.clubRole}</span></div><span className="ws-person-team">{person.team}</span></button>)}</div>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>{editing && <DialogContent className="ws-dialog"><DialogHeader><DialogTitle>edit {editing.displayName.toLowerCase()}</DialogTitle></DialogHeader><form onSubmit={save}><FieldGroup><div className="ws-form-grid"><Field><FieldLabel htmlFor="profile-role">club role</FieldLabel><Input id="profile-role" name="clubRole" defaultValue={editing.clubRole} required /></Field><Field><FieldLabel htmlFor="profile-team">team</FieldLabel><Input id="profile-team" name="team" defaultValue={editing.team} required /></Field></div><div className="ws-form-grid"><Field><FieldLabel htmlFor="profile-year">school year</FieldLabel><Input id="profile-year" name="schoolYear" defaultValue={editing.schoolYear} /></Field><Field><FieldLabel htmlFor="profile-major">major</FieldLabel><Input id="profile-major" name="major" defaultValue={editing.major} /></Field></div><Field><FieldLabel htmlFor="profile-linkedin">linkedin</FieldLabel><Input id="profile-linkedin" name="linkedinUrl" type="url" defaultValue={editing.linkedinUrl} /></Field><Field orientation="horizontal"><FieldLabel htmlFor="profile-leadership">leadership directory</FieldLabel><Switch id="profile-leadership" name="isLeadership" defaultChecked={editing.isLeadership} /></Field></FieldGroup><DialogFooter className="ws-dialog-footer"><Button type="submit">save profile</Button></DialogFooter></form></DialogContent>}</Dialog>
    </div>
  )
}
