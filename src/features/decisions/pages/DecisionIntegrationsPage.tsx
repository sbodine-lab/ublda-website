import { useMemo, useState } from "react"
import { Copy, KeyRound, Plus, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDecisionData } from "../decisionDataContext"
import { formatDateTime } from "../format"
import { LeadershipPage, LeadershipSection } from "@/features/leadership/components/LeadershipPage"
import type { AgentScope, CreatedAgentKey } from "../types"

const scopeLabels: Record<AgentScope, string> = {
  "decisions:read": "Read questions",
  "decisions:write": "Write drafts",
  "decisions:publish": "Open questions",
  "decisions:manage": "Manage questions",
  "results:read": "Read results",
}

const allScopes = Object.keys(scopeLabels) as AgentScope[]

function CreateAgentKeyDialog({ compact = false, onCreated }: { compact?: boolean; onCreated(key: CreatedAgentKey): void }) {
  const { adapter } = useDecisionData()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<AgentScope[]>(["decisions:read", "decisions:write"])
  const [expiresAt, setExpiresAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const create = async () => {
    if (!name.trim()) {
      setError("Name this key.")
      return
    }
    if (scopes.length === 0) {
      setError("Choose at least one permission.")
      return
    }
    setSaving(true)
    setError(undefined)
    try {
      const key = await adapter.createAgentKey({ name, scopes, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined })
      setOpen(false)
      setName("")
      onCreated(key)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The key could not be created.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {compact
          ? <Button variant="outline" size="sm">New key</Button>
          : <Button><Plus data-icon="inline-start" /> New key</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New key</DialogTitle></DialogHeader>
        <label className="dc-field-block"><span>Name</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="My Codex setup" /></label>
        <fieldset className="dc-scope-list">
          <legend>Permissions</legend>
          {allScopes.map((scope) => (
            <label key={scope}>
              <Checkbox
                checked={scopes.includes(scope)}
                onCheckedChange={(checked) => setScopes((current) => checked === true
                  ? [...new Set([...current, scope])]
                  : current.filter((item) => item !== scope))}
              />
              <span><b>{scopeLabels[scope]}</b></span>
            </label>
          ))}
        </fieldset>
        <label className="dc-field-block"><span>Expires <small>Optional</small></span><Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
        {error && <p className="dc-inline-error" role="alert">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={() => void create()}>{saving ? "Creating…" : "Create key"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DecisionIntegrationsPage() {
  const { adapter, snapshot } = useDecisionData()
  const [createdKey, setCreatedKey] = useState<CreatedAgentKey>()
  const [copied, setCopied] = useState<string>()
  const origin = typeof window === "undefined" ? "https://your-domain.example" : window.location.origin
  const restEndpoint = `${origin}/api/decision-agent/v1`
  const mcpEndpoint = `${origin}/mcp`
  const mcpConfig = useMemo(() => `{
  "mcpServers": {
    "ublda-decisions": {
      "type": "http",
      "url": "${mcpEndpoint}",
      "headers": {
        "Authorization": "Bearer \${UBLDA_DECISIONS_TOKEN}"
      }
    }
  }
}`, [mcpEndpoint])

  const copy = async (value: string, id: string) => {
    await navigator.clipboard.writeText(value)
    setCopied(id)
    window.setTimeout(() => setCopied(undefined), 1800)
  }

  const activeKeys = snapshot.agentKeys.filter((key) => !key.revokedAt).length

  return (
    <LeadershipPage className="dc-page" action={<CreateAgentKeyDialog onCreated={setCreatedKey} />}>
      {createdKey && (
        <LeadershipSection title="Copy this key" titleId="new-key-title">
          <div className="dc-secret-reveal" aria-live="polite">
            <p className="dc-page-note">It will not be shown again.</p>
            <code>{createdKey.secret}</code>
            <div>
              <Button variant="outline" onClick={() => void copy(createdKey.secret, "secret")}>
                <Copy data-icon="inline-start" /> {copied === "secret" ? "Copied" : "Copy key"}
              </Button>
            </div>
            {adapter.mode === "demo" && <p>Preview key. Not usable.</p>}
          </div>
        </LeadershipSection>
      )}

      <LeadershipSection title="MCP" titleId="mcp-title">
        <div className="dc-code-block">
          <pre><code>{mcpConfig}</code></pre>
          <Button variant="outline" size="sm" onClick={() => void copy(mcpConfig, "mcp")}>
            <Copy data-icon="inline-start" /> {copied === "mcp" ? "Copied" : "Copy config"}
          </Button>
        </div>
      </LeadershipSection>

      <LeadershipSection title="API" titleId="api-title">
        <div className="dc-endpoint-row">
          <code>{restEndpoint}</code>
          <Button variant="ghost" size="icon-sm" onClick={() => void copy(restEndpoint, "endpoint")} aria-label="Copy endpoint"><Copy /></Button>
        </div>
      </LeadershipSection>

      <LeadershipSection
        title="Keys"
        titleId="keys-title"
        action={<span className="dc-question-meta">{activeKeys} active</span>}
        flush={snapshot.agentKeys.length > 0}
        className="dc-flush-table"
      >
        {snapshot.agentKeys.length === 0 ? (
          <Empty className="dc-empty-state">
            <EmptyHeader>
              <EmptyMedia variant="icon"><KeyRound /></EmptyMedia>
              <EmptyTitle>No keys yet</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <CreateAgentKeyDialog compact onCreated={setCreatedKey} />
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.agentKeys.map((key) => (
                <TableRow key={key.id} className={key.revokedAt ? "dc-key-revoked" : undefined}>
                  <TableCell>
                    <span className="dc-key-name"><b>{key.name}</b><code>{key.prefix}…</code></span>
                  </TableCell>
                  <TableCell>
                    <div className="dc-key-scopes">
                      {key.scopes.map((scope) => <Badge variant="outline" key={scope}>{scopeLabels[scope]}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="dc-question-meta">
                      {key.revokedAt
                        ? `Revoked ${formatDateTime(key.revokedAt)}`
                        : key.expiresAt ? formatDateTime(key.expiresAt) : "Never"}
                    </span>
                  </TableCell>
                  <TableCell className="dc-row-action">
                    {!key.revokedAt && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Revoke ${key.name}`}><Trash2 /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revoke “{key.name}”?</AlertDialogTitle>
                            <AlertDialogDescription>The connected tool loses access straight away. This cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => void adapter.revokeAgentKey(key.id)}>Revoke key</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </LeadershipSection>
    </LeadershipPage>
  )
}
