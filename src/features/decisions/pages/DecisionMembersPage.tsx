import { useState } from "react"
import { CheckCircle2, Mail, Pencil, Plus, ShieldCheck, UserRound } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useDecisionData } from "../decisionDataContext"
import { initials } from "../format"
import type { DecisionMember, MemberRole, UpsertMemberInput } from "../types"

function MemberDialog({ member, onSaved }: { member?: DecisionMember; onSaved?(): void }) {
  const { adapter } = useDecisionData()
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(member?.displayName ?? "")
  const [aliases, setAliases] = useState(member?.identityAliases.join("\n") ?? "")
  const [role, setRole] = useState<MemberRole>(member?.role ?? "member")
  const [active, setActive] = useState(member?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const save = async () => {
    const identityAliases = aliases.split(/\n|,/).map((alias) => alias.trim().toLowerCase()).filter(Boolean)
    if (!displayName.trim()) {
      setError("Add the member’s name.")
      return
    }
    if (identityAliases.length === 0 || identityAliases.some((alias) => !alias.includes("@"))) {
      setError("Add at least one valid email identity.")
      return
    }
    const input: UpsertMemberInput = { id: member?.id, displayName, identityAliases, role, active }
    setSaving(true)
    setError(undefined)
    try {
      await adapter.upsertMember(input)
      setOpen(false)
      onSaved?.()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The member could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {member ? (
          <Button variant="ghost" size="icon-lg" className="dc-touch" aria-label={`Edit ${member.displayName}`}><Pencil /></Button>
        ) : (
          <Button className="dc-touch"><Plus /> Add member</Button>
        )}
      </DialogTrigger>
      <DialogContent className="dc-member-dialog">
        <DialogHeader>
          <DialogTitle>{member ? "Edit roster member" : "Add roster member"}</DialogTitle>
          <DialogDescription>A person may have multiple approved email addresses, but always gets one ballot.</DialogDescription>
        </DialogHeader>
        <label className="dc-field-block"><span>Name</span><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Member name" /></label>
        <label className="dc-field-block"><span>Approved email addresses <small>One per line</small></span><Textarea value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder={"name@umich.edu\nname@gmail.com"} rows={4} autoCapitalize="none" autoCorrect="off" /></label>
        <div className="dc-field-block"><Label>Access level</Label><Select value={role} onValueChange={(value) => setRole(value as MemberRole)}><SelectTrigger className="dc-select-trigger"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="member">Member · respond to assigned decisions</SelectItem><SelectItem value="admin">Admin · create and manage decisions</SelectItem></SelectContent></Select></div>
        <div className="dc-switch-row"><div><Label htmlFor={`active-${member?.id ?? "new"}`}>Active roster member</Label><p>Inactive members remain in historical decision snapshots.</p></div><Switch id={`active-${member?.id ?? "new"}`} checked={active} onCheckedChange={setActive} /></div>
        {error && <p className="dc-inline-error" role="alert">{error}</p>}
        <DialogFooter><Button variant="outline" className="dc-touch" onClick={() => setOpen(false)}>Cancel</Button><Button className="dc-touch" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save member"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DecisionMembersPage() {
  const { snapshot } = useDecisionData()
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined
  const activeCount = snapshot.members.filter((member) => member.active).length

  if (viewer?.role !== "admin") {
    return <div className="dc-page"><Alert><ShieldCheck /><AlertTitle>Admin access required</AlertTitle><AlertDescription>Only Decision Center administrators can change the member roster.</AlertDescription></Alert></div>
  }

  return (
    <div className="dc-page dc-members-page">
      <header className="dc-page-heading dc-page-heading-actions">
        <div><p className="dc-eyebrow">Settings</p><h1>Members and identities</h1><p>{activeCount} active members. Electorates are selected per decision, so the system never assumes a fixed board size.</p></div>
        <MemberDialog />
      </header>

      <Alert className="dc-identity-alert"><CheckCircle2 /><AlertTitle>One person, one response</AlertTitle><AlertDescription>Approved email aliases resolve to the same roster member. A second email cannot create a second ballot.</AlertDescription></Alert>

      <section className="dc-roster-list" aria-label="Decision Center members">
        <div className="dc-roster-list-header"><span>Member</span><span>Approved identities</span><span>Access</span><span className="sr-only">Actions</span></div>
        {snapshot.members.map((member) => (
          <article className="dc-roster-row" key={member.id}>
            <div className="dc-roster-member"><Avatar><AvatarFallback>{initials(member.displayName)}</AvatarFallback></Avatar><span><b>{member.displayName}</b><small>{member.active ? "Active" : "Inactive"}</small></span></div>
            <div className="dc-identity-list">
              {member.identityAliases.map((alias) => <span key={alias}><Mail /> {alias}</span>)}
            </div>
            <div><Badge variant={member.role === "admin" ? "secondary" : "outline"}>{member.role === "admin" ? "Admin" : "Member"}</Badge></div>
            <MemberDialog member={member} />
          </article>
        ))}
      </section>

      <section className="dc-settings-note"><UserRound /><div><h2>Historical rosters stay intact</h2><p>Deactivating a member does not rewrite old decisions. Every decision keeps its own electorate snapshot and exact missing-responder list.</p></div></section>
    </div>
  )
}
