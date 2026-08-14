import { useState } from "react"
import { Mail, Pencil, Plus, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useDecisionData } from "../decisionDataContext"
import { initials } from "../format"
import { LeadershipPage, LeadershipSurface } from "@/features/leadership/components/LeadershipPage"
import type { DecisionMember, MemberRole, UpsertMemberInput } from "../types"
import { canHoldAdminRole, isFixedAdminEmail } from "@/lib/adminPolicy"

function MemberDialog({ member, onSaved }: { member?: DecisionMember; onSaved?(): void }) {
  const { adapter } = useDecisionData()
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(member?.displayName ?? "")
  const [aliases, setAliases] = useState(member?.identityAliases.join("\n") ?? "")
  const [role, setRole] = useState<MemberRole>(member?.role ?? "member")
  const [active, setActive] = useState(member?.active ?? true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const parsedAliases = aliases.split(/\n|,/).map((alias) => alias.trim().toLowerCase()).filter(Boolean)
  const fixedAdmin = Boolean(member?.identityAliases.some(isFixedAdminEmail))
  const adminEligible = canHoldAdminRole(parsedAliases)

  // Every open starts from the stored member, so Cancel discards edits.
  const changeOpen = (next: boolean) => {
    if (next) {
      setDisplayName(member?.displayName ?? "")
      setAliases(member?.identityAliases.join("\n") ?? "")
      setRole(member?.role ?? "member")
      setActive(member?.active ?? true)
      setError(undefined)
    }
    setOpen(next)
  }

  const save = async () => {
    const identityAliases = parsedAliases
    if (!displayName.trim()) {
      setError("Add the member’s name.")
      return
    }
    if (identityAliases.length === 0 || identityAliases.some((alias) => !alias.includes("@"))) {
      setError("Add at least one valid email address.")
      return
    }
    if (role === "admin" && !canHoldAdminRole(identityAliases)) {
      setError("Only Sam, Alexa, or Cooper’s single fixed U-M email can hold admin access.")
      return
    }
    if (fixedAdmin && (role !== "admin" || !active)) {
      setError("Sam, Alexa, and Cooper must remain active admins.")
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
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        {member ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${member.displayName}`}><Pencil /></Button>
        ) : (
          <Button><Plus data-icon="inline-start" /> Add member</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{member ? "Edit member" : "Add member"}</DialogTitle>
        </DialogHeader>
        <label className="dc-field-block"><span>Name</span><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label className="dc-field-block"><span>Email addresses <small>One per line</small></span><Textarea value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder={"name@umich.edu\nname@gmail.com"} rows={4} autoCapitalize="none" autoCorrect="off" /></label>
        <div className="dc-field-block">
          <Label htmlFor={`role-${member?.id ?? "new"}`}>Access</Label>
          <Select value={role} disabled={fixedAdmin} onValueChange={(value) => setRole(value as MemberRole)}>
            <SelectTrigger id={`role-${member?.id ?? "new"}`} aria-label="Access"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin" disabled={!adminEligible && !fixedAdmin}>Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="dc-switch-row">
          <div>
            <Label htmlFor={`active-${member?.id ?? "new"}`}>Active</Label>
            <p>Past questions keep their original roster.</p>
          </div>
          <Switch id={`active-${member?.id ?? "new"}`} checked={active} disabled={fixedAdmin} onCheckedChange={setActive} />
        </div>
        {fixedAdmin ? <p className="dc-field-note">Fixed admin access cannot be demoted or deactivated.</p> : null}
        {error && <p className="dc-inline-error" role="alert">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => changeOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DecisionMembersPage() {
  const { snapshot } = useDecisionData()
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined
  const activeCount = snapshot.members.filter((member) => member.active).length

  if (viewer?.role !== "admin") {
    return (
      <LeadershipPage className="dc-page">
        <Alert>
          <ShieldCheck />
          <AlertTitle>Admin access required</AlertTitle>
          <AlertDescription>Only admins can change the roster.</AlertDescription>
        </Alert>
      </LeadershipPage>
    )
  }

  return (
    <LeadershipPage className="dc-page" action={<MemberDialog />}>
      <p className="dc-page-note">{activeCount} active members</p>

      <LeadershipSurface className="leadership-directory-surface dc-flush-table" flush>
        <Table aria-label="Members">
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Email addresses</TableHead>
              <TableHead>Access</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshot.members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="dc-roster-member">
                    <Avatar><AvatarFallback>{initials(member.displayName)}</AvatarFallback></Avatar>
                    <span>
                      <b>{member.displayName}</b>
                      <small>{member.active ? "Active" : "Inactive"}</small>
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="dc-identity-list">
                    {member.identityAliases.map((alias) => (
                      <span key={alias}><Mail aria-hidden="true" /> {alias}</span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={member.role === "admin" ? "secondary" : "outline"}>
                    {member.role === "admin" ? "Admin" : "Member"}
                  </Badge>
                </TableCell>
                <TableCell className="dc-row-action">
                  <MemberDialog member={member} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </LeadershipSurface>
    </LeadershipPage>
  )
}
