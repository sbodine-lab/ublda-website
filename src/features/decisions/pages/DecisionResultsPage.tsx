import { useMemo, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  Lock,
  MessageSquareText,
  RotateCcw,
  Users,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { DecisionStatusBadge } from "../components/DecisionStatusBadge"
import { useDecisionData } from "../decisionDataContext"
import { formatDateTime, formatRelativeDate, initials, outcomeRuleLabels, tieRuleLabels } from "../format"
import { calculateDecisionResults, describeBallotAnswer } from "../results"

export function DecisionResultsPage() {
  const { slug } = useParams()
  const { adapter, snapshot, decisionBySlug, responseFor } = useDecisionData()
  const decision = decisionBySlug(slug)
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined
  const [outcome, setOutcome] = useState("")
  const [finalizationNote, setFinalizationNote] = useState("")
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)

  const results = useMemo(() => decision ? calculateDecisionResults(decision, snapshot.responses) : undefined, [decision, snapshot.responses])

  if (!decision || !results) {
    return <div className="dc-page dc-not-found"><h1>Results not found</h1><p>This decision may no longer exist.</p><Button asChild><Link to="/decisions">Back to decisions</Link></Button></div>
  }

  const isAdmin = viewer?.role === "admin"
  const canManage = decision.canManage
    ?? Boolean(viewer && (isAdmin || viewer.memberId === decision.creatorMemberId))
  const viewerResponse = viewer ? responseFor(decision.id, viewer.memberId) : undefined
  const canView = Boolean(
    canManage
    || decision.rules.resultsVisibility === "after-submit" && viewerResponse
    || decision.rules.resultsVisibility === "after-close" && decision.status !== "open" && decision.status !== "draft",
  )

  if (!canView) {
    return (
      <div className="dc-page dc-results-locked">
        <Lock />
        <p className="dc-eyebrow">Results are private</p>
        <h1>Everyone gets space to answer independently.</h1>
        <p>{decision.rules.resultsVisibility === "admins-only" ? "Only decision administrators can see these results." : "Results will appear after responses close."}</p>
        <Button asChild className="dc-touch"><Link to={`/d/${decision.slug}`}>Back to the decision</Link></Button>
      </div>
    )
  }

  const decisionResponses = snapshot.responses.filter((response) => response.decisionId === decision.id)
  const memberById = new Map(snapshot.members.map((member) => [member.id, member]))
  const missingMembers = results.missingMemberIds.map((memberId) => memberById.get(memberId)).filter(Boolean)
  const responseDetails = decisionResponses.map((response) => ({ response, member: memberById.get(response.memberId) }))
  const activity = snapshot.activity.filter((item) => item.decisionId === decision.id).sort((a, b) => b.at.localeCompare(a.at))
  const turnoutReady = decision.rules.minimumTurnout === undefined || results.responseCount >= decision.rules.minimumTurnout
  const yesCount = results.tally.find((row) => row.label === "Yes")?.count ?? 0
  const yesPercentage = results.responseCount === 0 ? 0 : Math.round((yesCount / results.responseCount) * 100)
  const thresholdReady = decision.rules.outcomeRule !== "approval-threshold"
    || decision.rules.approvalThreshold !== undefined && decision.ballotType === "binary" && yesPercentage >= decision.rules.approvalThreshold
  const highestTally = Math.max(0, ...results.tally.map((row) => row.count))
  const hasTopTie = highestTally > 0
    && results.tally.filter((row) => row.count === highestTally).length > 1
  const finalizationNeedsNote = !turnoutReady || !thresholdReady || hasTopTie

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/d/${decision.slug}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const run = async (action: () => Promise<void>) => {
    setWorking(true)
    setError(undefined)
    try {
      await action()
      return true
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That action could not be completed.")
      return false
    } finally {
      setWorking(false)
    }
  }

  const finalize = async () => {
    if (!outcome.trim()) {
      setError("Record the final board outcome before finalizing.")
      return
    }
    if (finalizationNeedsNote && !finalizationNote.trim()) {
      setError("Explain why the board is finalizing with an unresolved or unmet saved rule.")
      return
    }
    const saved = await run(() => adapter.finalizeDecision(
      decision.id,
      outcome,
      finalizationNote,
    ))
    if (saved) setFinalizeOpen(false)
  }

  return (
    <div className="dc-page dc-results-page">
      <header className="dc-results-header">
        <div>
          <div className="dc-ballot-kicker"><DecisionStatusBadge status={decision.status} /><span>Results</span></div>
          <h1>{decision.title}</h1>
          <p>Exact response counts from the decision’s saved electorate.</p>
        </div>
        <div className="dc-results-header-actions">
          <Button variant="outline" className="dc-touch" onClick={copyLink}><Copy /> {copied ? "Copied" : "Copy voting link"}</Button>
          <Button variant="outline" className="dc-touch" asChild><Link to={`/d/${decision.slug}`}>View ballot</Link></Button>
        </div>
      </header>

      {decision.outcome && (
        <Alert className="dc-outcome-alert"><ClipboardCheck /><AlertTitle>Recorded outcome</AlertTitle><AlertDescription>{decision.outcome}</AlertDescription></Alert>
      )}

      <section className="dc-results-summary" aria-labelledby="participation-title">
        <div className="dc-turnout-figure">
          <p className="dc-eyebrow">Participation</p>
          <strong>{results.responseCount}<span> / {results.eligibleCount}</span></strong>
          <h2 id="participation-title">members responded</h2>
          <Progress value={results.turnoutPercentage} aria-label={`${results.turnoutPercentage}% participation`} />
          <p>{results.turnoutPercentage}% turnout</p>
        </div>
        <div className="dc-readiness-list">
          <div>
            <span className={turnoutReady ? "dc-rule-met" : "dc-rule-waiting"}>{turnoutReady ? <CheckCircle2 /> : <Clock3 />}</span>
            <span><b>{decision.rules.minimumTurnout ? `Minimum turnout: ${decision.rules.minimumTurnout}` : "No minimum turnout set"}</b><small>{decision.rules.minimumTurnout ? `${results.responseCount} received` : "Participation is advisory"}</small></span>
          </div>
          <div>
            <span className={thresholdReady ? "dc-rule-met" : "dc-rule-waiting"}>{thresholdReady ? <CheckCircle2 /> : <AlertCircle />}</span>
            <span><b>{outcomeRuleLabels[decision.rules.outcomeRule]}</b><small>{decision.rules.outcomeRule === "approval-threshold" ? `${yesPercentage}% yes · ${decision.rules.approvalThreshold}% required` : "The counting method was saved before responses opened"}</small></span>
          </div>
          <div>
            <span className="dc-rule-neutral"><Users /></span>
            <span><b>Ties: {tieRuleLabels[decision.rules.tieRule]}</b><small>No tie action is run automatically.</small></span>
          </div>
        </div>
      </section>

      <section className="dc-results-section" aria-labelledby="tally-title">
        <div className="dc-results-section-heading">
          <div><p className="dc-eyebrow">Counted responses</p><h2 id="tally-title">{results.tallyUnit === "points" ? "Borda point totals" : decision.ballotType === "ranked" ? "First-choice totals" : "Response totals"}</h2></div>
          <span>{results.responseCount} submitted</span>
        </div>
        {decision.ballotType === "ranked" && <p className="dc-section-disclosure">{results.tallyUnit === "points" ? `Borda awards ${decision.options.length} points for first place through 1 point for last place.` : "These bars show exact first choices."} Full rankings are listed below for administrators; the board still records the outcome manually.</p>}
        <div className="dc-tally-list">
          {results.tally.map((row) => (
            <div className="dc-tally-row" key={row.id}>
              <div><span>{row.label}</span><strong>{row.count}</strong></div>
              <div className="dc-tally-track"><span style={{ width: `${row.percentage}%` }} /></div>
              <small>{row.percentage}% of awarded {results.tallyUnit === "points" ? "points" : "responses"}</small>
            </div>
          ))}
        </div>
      </section>

      {canManage && <div className="dc-results-columns">
        <section className="dc-results-section" aria-labelledby="missing-title">
          <div className="dc-results-section-heading"><div><p className="dc-eyebrow">Follow-up</p><h2 id="missing-title">Still waiting on</h2></div><span>{missingMembers.length}</span></div>
          {missingMembers.length === 0 ? (
            <p className="dc-all-in"><CheckCircle2 /> Everyone in this electorate responded.</p>
          ) : (
            <ul className="dc-person-list">
              {missingMembers.map((member) => member && (
                <li key={member.id}><Avatar><AvatarFallback>{initials(member.displayName)}</AvatarFallback></Avatar><span><b>{member.displayName}</b><small>Not submitted</small></span></li>
              ))}
            </ul>
          )}
        </section>

        <section className="dc-results-section" aria-labelledby="comments-title">
          <div className="dc-results-section-heading"><div><p className="dc-eyebrow">Admin detail</p><h2 id="comments-title">Responses and context</h2></div><MessageSquareText /></div>
          {responseDetails.length === 0 ? <p>{results.responseCount === 0 ? "No responses yet." : "Individual response detail is not available for this decision."}</p> : (
            <ul className="dc-response-detail-list">
              {responseDetails.map(({ response, member }) => (
                <li key={response.id}>
                  <div><Avatar><AvatarFallback>{initials(member?.displayName ?? "Member")}</AvatarFallback></Avatar><span><b>{member?.displayName ?? "Roster member"}</b><small>{formatDateTime(response.revisedAt ?? response.submittedAt, decision.timezone)}</small></span></div>
                  <strong>{describeBallotAnswer(decision, response.answer)}</strong>
                  {response.rationale && <p>{response.rationale}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>}

      <section className="dc-results-section dc-activity-section" aria-labelledby="activity-title">
        <div className="dc-results-section-heading"><div><p className="dc-eyebrow">Audit trail</p><h2 id="activity-title">Activity</h2></div><Clock3 /></div>
        <ol className="dc-activity-list">
          {activity.map((item) => (
            <li key={item.id}><span className="dc-activity-dot" /><div><b>{item.detail}</b><small>{item.actorDisplayName ?? memberById.get(item.actorMemberId)?.displayName ?? "System"} · {formatRelativeDate(item.at)}</small></div></li>
          ))}
        </ol>
      </section>

      {canManage && (
        <section className="dc-decision-controls" aria-labelledby="controls-title">
          <div><p className="dc-eyebrow">Decision owner controls</p><h2 id="controls-title">Close and record the outcome</h2><p>Closing stops responses. Finalizing records what the board actually decided; it does not infer an outcome from the bars above.</p></div>
          <div>
            {decision.status === "open" && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline" className="dc-touch" disabled={working}>Close responses</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Close responses?</AlertDialogTitle><AlertDialogDescription>Members will no longer be able to submit or edit. You can reopen this decision later, and the action will be logged.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Keep open</AlertDialogCancel><AlertDialogAction onClick={() => void run(() => adapter.closeDecision(decision.id))}>Close responses</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {decision.status === "closed" && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline" className="dc-touch" disabled={working}><RotateCcw /> Reopen</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Reopen responses?</AlertDialogTitle><AlertDialogDescription>Members will be able to submit or edit again. The previous deadline will be cleared, and the action will be logged.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Keep closed</AlertDialogCancel><AlertDialogAction onClick={() => void run(() => adapter.reopenDecision(decision.id))}>Reopen responses</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {decision.status === "closed" && (
              <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
                <DialogTrigger asChild><Button className="dc-touch">Record final outcome</Button></DialogTrigger>
                <DialogContent className="dc-finalize-dialog">
                  <DialogHeader><DialogTitle>Record the board’s outcome</DialogTitle><DialogDescription>Write the actual decision in plain language. This is intentionally a manual step.</DialogDescription></DialogHeader>
                  <label className="dc-field-block"><span>Final outcome</span><Textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} rows={4} placeholder="The board decided to…" /></label>
                  <label className="dc-field-block"><span>Finalization note <small>{finalizationNeedsNote ? "Required for an unmet or unresolved rule" : "Optional"}</small></span><Textarea value={finalizationNote} onChange={(event) => setFinalizationNote(event.target.value)} rows={3} placeholder="Explain any tie, turnout gap, or manual judgment the board resolved." /></label>
                  {error && <p className="dc-inline-error" role="alert">{error}</p>}
                  <DialogFooter><Button variant="outline" className="dc-touch" onClick={() => setFinalizeOpen(false)}>Cancel</Button><Button className="dc-touch" disabled={working} onClick={() => void finalize()}>{working ? "Saving…" : "Finalize decision"}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          {error && !finalizeOpen && <p className="dc-inline-error" role="alert">{error}</p>}
        </section>
      )}
    </div>
  )
}
