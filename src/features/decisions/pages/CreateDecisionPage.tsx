import { useMemo, useState } from "react"
import { Check, ChevronDown, Copy, Plus, Send, Trash2, Users } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { LeadershipPage, LeadershipSurface } from "@/features/leadership/components/LeadershipPage"
import { useDecisionData } from "../decisionDataContext"
import { ballotTypeLabels, outcomeRuleLabels, resultsVisibilityLabels, tieRuleLabels } from "../format"
import type {
  BallotType,
  CreateDecisionInput,
  DecisionOutcomeRule,
  DecisionRules,
  ResultsVisibility,
  TieRule,
} from "../types"

interface EditableOption {
  id: string
  label: string
  description: string
}

const optionId = () => `draft-option-${Math.random().toString(36).slice(2)}`

function numberOrUndefined(value: string) {
  if (!value.trim()) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

export function CreateDecisionPage() {
  const { adapter, snapshot } = useDecisionData()
  const navigate = useNavigate()
  const activeMembers = snapshot.members.filter((member) => member.active)
  const [title, setTitle] = useState("")
  const [overview, setOverview] = useState("")
  const [context, setContext] = useState("")
  const [ballotType, setBallotType] = useState<BallotType>("binary")
  const [options, setOptions] = useState<EditableOption[]>([
    { id: optionId(), label: "", description: "" },
    { id: optionId(), label: "", description: "" },
  ])
  const [allowOther, setAllowOther] = useState(true)
  const [electorate, setElectorate] = useState<string[]>(() => activeMembers.map((member) => member.id))
  const [deadline, setDeadline] = useState("")
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Detroit", [])
  const [autoClose, setAutoClose] = useState(false)
  const [minimumTurnout, setMinimumTurnout] = useState("")
  const [approvalThreshold, setApprovalThreshold] = useState("")
  const [outcomeRule, setOutcomeRule] = useState<DecisionOutcomeRule>("advisory")
  const [tieRule, setTieRule] = useState<TieRule>("manual")
  const [resultsVisibility, setResultsVisibility] = useState<ResultsVisibility>("after-submit")
  const [allowResponseEdits, setAllowResponseEdits] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [saving, setSaving] = useState<"draft" | "open">()
  const [error, setError] = useState<string>()
  const [createdLink, setCreatedLink] = useState<string>()
  const [copied, setCopied] = useState(false)

  const contextPoints = useMemo(() => context.split("\n").map((point) => point.trim()).filter(Boolean), [context])
  const validOptions = options.map((option) => ({ label: option.label.trim(), description: option.description.trim() || undefined })).filter((option) => option.label)

  const validationError = useMemo(() => {
    if (!title.trim()) return "Give the question a clear title."
    if (!overview.trim()) return "Add a short overview so members know what is being decided."
    if (electorate.length === 0) return "Choose at least one eligible member."
    if ((ballotType === "single" || ballotType === "ranked") && validOptions.length < 2) return "Add at least two response options."
    if (minimumTurnout && (Number(minimumTurnout) < 1 || Number(minimumTurnout) > electorate.length)) return `Minimum turnout must be between 1 and ${electorate.length}.`
    if (outcomeRule === "approval-threshold" && !approvalThreshold) return "Set the approval percentage for this counting method."
    if (outcomeRule === "approval-threshold" && (Number(approvalThreshold) < 1 || Number(approvalThreshold) > 100)) return "Approval threshold must be between 1 and 100%."
    return undefined
  }, [approvalThreshold, ballotType, electorate.length, minimumTurnout, outcomeRule, overview, title, validOptions.length])

  const toggleMember = (memberId: string, checked: boolean) => {
    setElectorate((current) => checked
      ? [...new Set([...current, memberId])]
      : current.filter((id) => id !== memberId))
  }

  const updateOption = (id: string, field: "label" | "description", value: string) => {
    setOptions((current) => current.map((option) => option.id === id ? { ...option, [field]: value } : option))
  }

  // A deadline is what makes auto-close meaningful; clearing it clears both.
  const changeDeadline = (value: string) => {
    setDeadline(value)
    if (!value) setAutoClose(false)
  }

  const create = async (status: "draft" | "open") => {
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(status)
    setError(undefined)
    try {
      const rules: DecisionRules = {
        minimumTurnout: numberOrUndefined(minimumTurnout),
        approvalThreshold: outcomeRule === "approval-threshold" ? numberOrUndefined(approvalThreshold) : undefined,
        outcomeRule,
        tieRule,
        resultsVisibility,
        allowResponseEdits,
      }
      const input: CreateDecisionInput = {
        title: title.trim(),
        overview: overview.trim(),
        contextPoints,
        ballotType,
        options: ballotType === "single" || ballotType === "ranked" ? validOptions : [],
        allowOther: ballotType === "binary" || ballotType === "single" ? allowOther : false,
        electorateMemberIds: electorate,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        timezone,
        autoClose: Boolean(deadline && autoClose),
        rules,
        status,
      }
      const decision = await adapter.createDecision(input)
      if (status === "draft") {
        navigate("/decisions")
      } else {
        const link = `${window.location.origin}/d/${decision.slug}`
        setCreatedLink(link)
        try {
          await navigator.clipboard.writeText(link)
          setCopied(true)
        } catch {
          setCopied(false)
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The question could not be created.")
    } finally {
      setSaving(undefined)
    }
  }

  if (createdLink) {
    return (
      <LeadershipPage className="dc-page">
        <LeadershipSurface>
          <div className="dc-confirmation">
            <div className="dc-submit-check dc-submit-check-animated" aria-hidden="true"><Check /></div>
            <h2>Your link is ready</h2>
            <label className="dc-copy-field">
              <span>Link</span>
              <Input readOnly value={createdLink} onFocus={(event) => event.currentTarget.select()} />
            </label>
            <div className="dc-confirmation-actions">
              <Button variant="outline" onClick={() => navigate("/decisions")}>Done</Button>
              <Button onClick={async () => {
                await navigator.clipboard.writeText(createdLink)
                setCopied(true)
              }}><Copy data-icon="inline-start" /> {copied ? "Copied" : "Copy link"}</Button>
            </div>
          </div>
        </LeadershipSurface>
      </LeadershipPage>
    )
  }

  return (
    <LeadershipPage className="dc-page">
      <div className="dc-create-layout">
        <LeadershipSurface>
          <form className="dc-create-form" onSubmit={(event) => event.preventDefault()}>
            <section className="dc-form-section" aria-labelledby="question-section-title">
              <div className="dc-section-heading">
                <h2 id="question-section-title">The question</h2>
              </div>
              <label className="dc-field-block">
                <span>Title</span>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Should we…?" maxLength={140} />
                <small>{title.length}/140</small>
              </label>
              <label className="dc-field-block">
                <span>Overview</span>
                <Textarea value={overview} onChange={(event) => setOverview(event.target.value)} placeholder="What needs to be decided, and why now?" rows={4} maxLength={500} />
                <small>{overview.length}/500</small>
              </label>
              <label className="dc-field-block">
                <span>Context <small>Optional, one point per line</small></span>
                <Textarea value={context} onChange={(event) => setContext(event.target.value)} rows={4} />
              </label>
            </section>

            <section className="dc-form-section" aria-labelledby="response-section-title">
              <div className="dc-section-heading"><h2 id="response-section-title">Response format</h2></div>
              <ToggleGroup
                type="single"
                variant="outline"
                className="dc-type-group"
                value={ballotType}
                onValueChange={(value) => {
                  if (!value) return
                  setBallotType(value as BallotType)
                  setOutcomeRule("advisory")
                  setApprovalThreshold("")
                }}
                aria-label="Response format"
              >
                {(Object.entries(ballotTypeLabels) as Array<[BallotType, string]>).map(([value, label]) => (
                  <ToggleGroupItem key={value} value={value}>{label}</ToggleGroupItem>
                ))}
              </ToggleGroup>

              {(ballotType === "single" || ballotType === "ranked") && (
                <div className="dc-options-editor">
                  <Label>Options</Label>
                  {options.map((option, index) => (
                    <div className="dc-option-editor-row" key={option.id}>
                      <span>{index + 1}</span>
                      <div>
                        <Input aria-label={`Option ${index + 1}`} value={option.label} onChange={(event) => updateOption(option.id, "label", event.target.value)} placeholder={`Option ${index + 1}`} />
                        <Input aria-label={`Option ${index + 1} detail`} value={option.description} onChange={(event) => updateOption(option.id, "description", event.target.value)} placeholder="Detail (optional)" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setOptions((current) => current.filter((item) => item.id !== option.id))} disabled={options.length <= 2} aria-label={`Remove option ${index + 1}`}><Trash2 /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setOptions((current) => [...current, { id: optionId(), label: "", description: "" }])}><Plus data-icon="inline-start" /> Add option</Button>
                </div>
              )}

              {(ballotType === "binary" || ballotType === "single") && (
                <div className="dc-switch-row">
                  <div><Label htmlFor="allow-other">Allow “Propose something else”</Label></div>
                  <Switch id="allow-other" checked={allowOther} onCheckedChange={setAllowOther} />
                </div>
              )}
            </section>

            <section className="dc-form-section" aria-labelledby="electorate-section-title">
              <div className="dc-section-heading"><h2 id="electorate-section-title">Who can respond</h2></div>
              <div className="dc-electorate-toolbar">
                <span><Users aria-hidden="true" /> {electorate.length} selected</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setElectorate(electorate.length === activeMembers.length ? [] : activeMembers.map((member) => member.id))}>{electorate.length === activeMembers.length ? "Clear all" : "Select all"}</Button>
              </div>
              <div className="dc-member-checklist">
                {activeMembers.map((member) => (
                  <label key={member.id}>
                    <Checkbox checked={electorate.includes(member.id)} onCheckedChange={(checked) => toggleMember(member.id, checked === true)} />
                    <span><b>{member.displayName}</b></span>
                  </label>
                ))}
              </div>
            </section>

            <section className="dc-form-section" aria-labelledby="rules-section-title">
              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" className="dc-advanced-trigger">
                    <span id="rules-section-title">Deadline and rules</span>
                    <ChevronDown data-icon="inline-end" className={cn(advancedOpen && "dc-chevron-open")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="dc-advanced-fields">
                  <div className="dc-two-column-fields">
                    <label className="dc-field-block"><span>Deadline <small>Optional</small></span><Input type="datetime-local" value={deadline} onChange={(event) => changeDeadline(event.target.value)} /></label>
                    <label className="dc-field-block"><span>Timezone <small>From this device</small></span><Input value={timezone} readOnly /></label>
                  </div>
                  <div className="dc-switch-row" data-disabled={!deadline}>
                    <div><Label htmlFor="auto-close">Close responses automatically</Label></div>
                    <Switch id="auto-close" checked={autoClose} disabled={!deadline} onCheckedChange={setAutoClose} />
                  </div>
                  <div className="dc-two-column-fields">
                    <label className="dc-field-block"><span>Minimum turnout <small>People, optional</small></span><Input type="number" min="1" max={electorate.length} value={minimumTurnout} onChange={(event) => setMinimumTurnout(event.target.value)} placeholder="No minimum" /></label>
                    <div className="dc-field-block"><Label htmlFor="outcome-rule">How responses are counted</Label><Select value={outcomeRule} onValueChange={(value) => { setOutcomeRule(value as DecisionOutcomeRule); if (value !== "approval-threshold") setApprovalThreshold("") }}><SelectTrigger id="outcome-rule" aria-label="How responses are counted"><SelectValue /></SelectTrigger><SelectContent>
                      <SelectItem value="advisory">{outcomeRuleLabels.advisory}</SelectItem>
                      {ballotType === "binary" && <SelectItem value="majority">{outcomeRuleLabels.majority}</SelectItem>}
                      {ballotType === "binary" && <SelectItem value="approval-threshold">{outcomeRuleLabels["approval-threshold"]}</SelectItem>}
                      {(ballotType === "single" || ballotType === "ranked") && <SelectItem value="plurality">{outcomeRuleLabels.plurality}</SelectItem>}
                      {ballotType === "ranked" && <SelectItem value="borda">{outcomeRuleLabels.borda}</SelectItem>}
                    </SelectContent></Select></div>
                  </div>
                  {outcomeRule === "approval-threshold" && <label className="dc-field-block"><span>Approval threshold <small>Percent</small></span><Input type="number" min="1" max="100" value={approvalThreshold} onChange={(event) => setApprovalThreshold(event.target.value)} placeholder="60" /></label>}
                  <div className="dc-two-column-fields">
                    <div className="dc-field-block"><Label htmlFor="tie-rule">Tie handling</Label><Select value={tieRule} onValueChange={(value) => setTieRule(value as TieRule)}><SelectTrigger id="tie-rule" aria-label="Tie handling"><SelectValue /></SelectTrigger><SelectContent>{(Object.entries(tieRuleLabels) as Array<[TieRule, string]>).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="dc-field-block"><Label htmlFor="results-visibility">When members see results</Label><Select value={resultsVisibility} onValueChange={(value) => setResultsVisibility(value as ResultsVisibility)}><SelectTrigger id="results-visibility" aria-label="When members see results"><SelectValue /></SelectTrigger><SelectContent>{(Object.entries(resultsVisibilityLabels) as Array<[ResultsVisibility, string]>).map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div className="dc-switch-row">
                    <div><Label htmlFor="response-edits">Allow edits until responses close</Label></div>
                    <Switch id="response-edits" checked={allowResponseEdits} onCheckedChange={setAllowResponseEdits} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </section>

            {error && <p className="dc-inline-error" role="alert">{error}</p>}
            <div className="dc-create-actions">
              <Button type="button" variant="outline" disabled={Boolean(saving)} onClick={() => void create("draft")}>{saving === "draft" ? "Saving…" : "Save draft"}</Button>
              <Button type="button" disabled={Boolean(saving)} onClick={() => void create("open")}><Send data-icon="inline-start" /> {saving === "open" ? "Opening…" : "Open and copy link"}</Button>
            </div>
          </form>
        </LeadershipSurface>

        <aside className="dc-create-preview" aria-label="Preview">
          <h2>{title.trim() || "Your question title"}</h2>
          <p>{overview.trim() || "The overview appears here."}</p>
          {contextPoints.length > 0 && <ul>{contextPoints.slice(0, 3).map((point) => <li key={point}>{point}</li>)}</ul>}
          <div className="dc-preview-rule"><span>Response</span><b>{ballotTypeLabels[ballotType]}</b></div>
          <div className="dc-preview-rule"><span>Eligible</span><b>{electorate.length} members</b></div>
          <div className="dc-preview-rule"><span>Deadline</span><b>{deadline ? "Set" : "None"}</b></div>
          <div className="dc-preview-rule"><span>Auto-close</span><b>{autoClose && deadline ? "On" : "Off"}</b></div>
        </aside>
      </div>
    </LeadershipPage>
  )
}
