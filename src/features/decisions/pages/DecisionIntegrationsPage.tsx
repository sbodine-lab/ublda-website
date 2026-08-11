import { useMemo, useState } from "react"
import { Bot, Check, Copy, KeyRound, Plus, ShieldCheck, Terminal, Trash2 } from "lucide-react"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { useDecisionData } from "../decisionDataContext"
import { formatDateTime } from "../format"
import { LeadershipPage } from "@/features/leadership/components/LeadershipPage"
import type { AgentScope, CreatedAgentKey } from "../types"

const scopeLabels: Record<AgentScope, { label: string; description: string }> = {
  "decisions:read": { label: "Read decisions", description: "List and inspect decision metadata." },
  "decisions:write": { label: "Write drafts", description: "Create and update unpublished decision drafts." },
  "decisions:publish": { label: "Publish decisions", description: "Open an approved draft for responses." },
  "decisions:manage": { label: "Manage decisions", description: "Check response status and close decisions." },
  "results:read": { label: "Read results", description: "Access participation and aggregate results." },
}

const allScopes = Object.keys(scopeLabels) as AgentScope[]

function CreateAgentKeyDialog({ onCreated }: { onCreated(key: CreatedAgentKey): void }) {
  const { adapter } = useDecisionData()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [scopes, setScopes] = useState<AgentScope[]>(["decisions:read", "decisions:write"])
  const [expiresAt, setExpiresAt] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  const create = async () => {
    if (!name.trim()) {
      setError("Name this key so the board knows what uses it.")
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
      <DialogTrigger asChild><Button className="dc-touch"><Plus /> Create agent key</Button></DialogTrigger>
      <DialogContent className="dc-agent-key-dialog">
        <DialogHeader><DialogTitle>Create an agent key</DialogTitle><DialogDescription>Give each tool its own key and only the permissions it needs.</DialogDescription></DialogHeader>
        <label className="dc-field-block"><span>Key name</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="My Codex setup" /></label>
        <fieldset className="dc-scope-list"><legend>Permissions</legend>{allScopes.map((scope) => <label key={scope}><Checkbox checked={scopes.includes(scope)} onCheckedChange={(checked) => setScopes((current) => checked === true ? [...new Set([...current, scope])] : current.filter((item) => item !== scope))} /><span><b>{scopeLabels[scope].label}</b><small>{scopeLabels[scope].description}</small></span></label>)}</fieldset>
        <label className="dc-field-block"><span>Expiration <small>Optional</small></span><Input type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
        {error && <p className="dc-inline-error" role="alert">{error}</p>}
        <DialogFooter><Button variant="outline" className="dc-touch" onClick={() => setOpen(false)}>Cancel</Button><Button className="dc-touch" disabled={saving} onClick={() => void create()}>{saving ? "Creating…" : "Create key"}</Button></DialogFooter>
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

  return (
    <LeadershipPage className="dc-page dc-integrations-page" action={<CreateAgentKeyDialog onCreated={setCreatedKey} />}>

      <Alert className="dc-integration-boundary"><ShieldCheck /><AlertTitle>Your key, your access</AlertTitle><AlertDescription>Keys belong to the member who created them and can reach only their selected Decision Center scopes. They do not expose owner-local strategy, transcripts, or other private Brain data.</AlertDescription></Alert>

      {createdKey && (
        <section className="dc-secret-reveal" aria-live="polite">
          <div><KeyRound /><span><p className="dc-eyebrow">Copy this now</p><h2>Your key will not be shown again.</h2></span></div>
          <code>{createdKey.secret}</code>
          <Button className="dc-touch" onClick={() => void copy(createdKey.secret, "secret")}><Copy /> {copied === "secret" ? "Copied" : "Copy key"}</Button>
          {adapter.mode === "demo" && <p>This is a non-working preview key. Live keys must be generated and hashed on the server.</p>}
        </section>
      )}

      <div className="dc-integration-grid">
        <section className="dc-integration-guide">
          <div className="dc-integration-icon"><Bot /></div>
          <p className="dc-eyebrow">MCP</p>
          <h2>Connect an agent</h2>
          <p>Add one remote MCP endpoint, keep the token in an environment variable, then ask your agent to draft or open a decision.</p>
          <div className="dc-code-block"><pre><code>{mcpConfig}</code></pre><Button variant="outline" size="sm" onClick={() => void copy(mcpConfig, "mcp")}><Copy /> {copied === "mcp" ? "Copied" : "Copy config"}</Button></div>
          <div className="dc-prompt-example"><span>Try saying</span><p>“Create a draft decision asking whether we should change the weekly meeting format. Include the three constraints below and use yes, no, or propose something else.”</p></div>
        </section>

        <section className="dc-integration-guide">
          <div className="dc-integration-icon"><Terminal /></div>
          <p className="dc-eyebrow">HTTP API</p>
          <h2>Use the same endpoint directly</h2>
          <p>Send scoped, idempotent requests from an approved script or internal tool. The server audits every mutation.</p>
          <div className="dc-endpoint-row"><code>{restEndpoint}</code><Button variant="ghost" size="icon-lg" className="dc-touch" onClick={() => void copy(restEndpoint, "endpoint")} aria-label="Copy endpoint"><Copy /></Button></div>
          <ul className="dc-api-capabilities"><li><Check /> Create a draft, then publish explicitly</li><li><Check /> List and inspect decisions</li><li><Check /> Check response status and aggregate results</li><li><Check /> Close with an explicit manage scope</li></ul>
        </section>
      </div>

      <section className="dc-key-section" aria-labelledby="keys-title">
        <div className="dc-results-section-heading"><div><p className="dc-eyebrow">Your access</p><h2 id="keys-title">Agent keys</h2></div><span>{snapshot.agentKeys.filter((key) => !key.revokedAt).length} active</span></div>
        {snapshot.agentKeys.length === 0 ? <div className="dc-key-empty"><KeyRound /><p>No keys yet. Create one when you are ready to connect an agent.</p></div> : (
          <div className="dc-key-list">
            {snapshot.agentKeys.map((key) => (
              <article key={key.id} className={key.revokedAt ? "dc-key-revoked" : undefined}>
                <div><KeyRound /><span><b>{key.name}</b><code>{key.prefix}…</code></span></div>
                <div className="dc-key-scopes">{key.scopes.map((scope) => <Badge variant="outline" key={scope}>{scopeLabels[scope].label}</Badge>)}</div>
                <div className="dc-key-dates"><span>Created {formatDateTime(key.createdAt)}</span><span>{key.revokedAt ? `Revoked ${formatDateTime(key.revokedAt)}` : key.expiresAt ? `Expires ${formatDateTime(key.expiresAt)}` : "No expiration"}</span></div>
                {!key.revokedAt && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon-lg" className="dc-touch" aria-label={`Revoke ${key.name}`}><Trash2 /></Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Revoke “{key.name}”?</AlertDialogTitle><AlertDialogDescription>The connected agent will immediately lose access. This cannot be undone; create a new key if access is needed later.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => void adapter.revokeAgentKey(key.id)}>Revoke key</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                  </AlertDialog>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </LeadershipPage>
  )
}
