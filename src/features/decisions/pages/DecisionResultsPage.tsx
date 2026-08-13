import { useMemo, useState } from "react"
import { CheckCircle2, ClipboardCheck, Copy, Lock, RotateCcw, SearchX } from "lucide-react"
import { Link, useLocation, useParams } from "react-router-dom"
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
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Textarea } from "@/components/ui/textarea"
import { LeadershipPage, LeadershipSection } from "@/features/leadership/components/LeadershipPage"
import { useDecisionData } from "../decisionDataContext"
import { formatDateTime, initials } from "../format"
import { calculateDecisionResults, describeBallotAnswer } from "../results"

export function DecisionResultsPage() {
  const { slug } = useParams()
  const location = useLocation()
  const { adapter, snapshot, decisionBySlug, responseFor } = useDecisionData()
  const stateSlug = location.state && typeof location.state === "object" && "decisionSlug" in location.state
    ? String(location.state.decisionSlug)
    : undefined
  const decision = decisionBySlug(slug ?? stateSlug)
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined
  const [outcome, setOutcome] = useState("")
  const [finalizationNote, setFinalizationNote] = useState("")
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)

  const results = useMemo(() => decision ? calculateDecisionResults(decision, snapshot.responses) : undefined, [decision, snapshot.responses])

  if (!decision || !results) {
    return (
      <LeadershipPage className="dc-page">
        <Empty className="dc-empty-state">
          <EmptyHeader>
            <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
            <EmptyTitle>Question not found</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" asChild><Link to="/decisions">Back to questions</Link></Button>
          </EmptyContent>
        </Empty>
      </LeadershipPage>
    )
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
      <LeadershipPage className="dc-page">
        <Empty className="dc-empty-state">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Lock /></EmptyMedia>
            <EmptyTitle>
              {decision.rules.resultsVisibility === "admins-only"
                ? "Only admins can see these results."
                : decision.rules.resultsVisibility === "after-close"
                  ? "Results unlock after responses close."
                  : "Results unlock after you respond."}
            </EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" asChild><Link to={`/d/${decision.slug}`}>Open the question</Link></Button>
          </EmptyContent>
        </Empty>
      </LeadershipPage>
    )
  }

  const decisionResponses = snapshot.responses.filter((response) => response.decisionId === decision.id)
  const memberById = new Map(snapshot.members.map((member) => [member.id, member]))
  const missingMembers = results.missingMemberIds.map((memberId) => memberById.get(memberId)).filter(Boolean)
  const responseDetails = decisionResponses.map((response) => ({ response, member: memberById.get(response.memberId) }))
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
      setError("Write the outcome before finalizing.")
      return
    }
    if (finalizationNeedsNote && !finalizationNote.trim()) {
      setError("Add a note explaining the unmet rule.")
      return
    }
    const saved = await run(() => adapter.finalizeDecision(
      decision.id,
      outcome,
      finalizationNote,
    ))
    if (saved) setFinalizeOpen(false)
  }

  const tallyTitle = results.tallyUnit === "points"
    ? "Ranked points"
    : decision.ballotType === "ranked" ? "First choices" : "Results"

  return (
    <LeadershipPage
      className="dc-page"
      action={(
        <div className="dc-page-actions">
          <Button variant="outline" onClick={copyLink}><Copy data-icon="inline-start" /> {copied ? "Copied" : "Copy link"}</Button>
          <Button variant="outline" asChild><Link to={`/d/${decision.slug}`}>Open question</Link></Button>
        </div>
      )}
    >
      {decision.outcome && (
        <Alert><ClipboardCheck /><AlertTitle>Recorded outcome</AlertTitle><AlertDescription>{decision.outcome}</AlertDescription></Alert>
      )}

      <LeadershipSection title={tallyTitle} titleId="tally-title">
        <div
          className="dc-live-results-count"
          aria-live="polite"
          aria-label={`${results.responseCount} of ${results.eligibleCount} responses received`}
        >
          <strong>{results.responseCount}<span> of {results.eligibleCount}</span></strong>
          <span>responses</span>
        </div>
        <div className="dc-tally-list" aria-live="polite">
          {results.tally.map((row) => (
            <div className="dc-tally-row" key={row.id}>
              <div><span>{row.label}</span><strong>{row.count}</strong></div>
              <div className="dc-tally-track"><span style={{ width: `${row.percentage}%` }} /></div>
            </div>
          ))}
        </div>
      </LeadershipSection>

      {canManage && (
        <div className="dc-results-columns">
          <LeadershipSection title="Still waiting on" titleId="missing-title">
            {missingMembers.length === 0 ? (
              <p className="dc-all-in"><CheckCircle2 aria-hidden="true" /> Everyone who can respond has responded.</p>
            ) : (
              <ul className="dc-person-list">
                {missingMembers.map((member) => member && (
                  <li key={member.id}><Avatar><AvatarFallback>{initials(member.displayName)}</AvatarFallback></Avatar><span><b>{member.displayName}</b></span></li>
                ))}
              </ul>
            )}
          </LeadershipSection>

          <LeadershipSection title="Responses" titleId="comments-title">
            {responseDetails.length === 0 ? (
              <p className="dc-page-note">{results.responseCount === 0 ? "No responses yet." : "Individual responses are not available for this question."}</p>
            ) : (
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
          </LeadershipSection>
        </div>
      )}

      {canManage && (
        <LeadershipSection title="Close or finalize" titleId="controls-title">
          <div className="dc-decision-controls">
            <p className="dc-page-note">Closing stops responses. Finalizing records the outcome.</p>
            <div>
              {decision.status === "open" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="outline" disabled={working}>Close responses</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Close responses?</AlertDialogTitle><AlertDialogDescription>Members can no longer respond. You can reopen it later.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Keep open</AlertDialogCancel><AlertDialogAction onClick={() => void run(() => adapter.closeDecision(decision.id))}>Close responses</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {decision.status === "closed" && (
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="outline" disabled={working}><RotateCcw data-icon="inline-start" /> Reopen</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Reopen responses?</AlertDialogTitle><AlertDialogDescription>Members can respond again. The old deadline is cleared.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Keep closed</AlertDialogCancel><AlertDialogAction onClick={() => void run(() => adapter.reopenDecision(decision.id))}>Reopen responses</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {decision.status === "closed" && (
                <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
                  <DialogTrigger asChild><Button>Record outcome</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Record the outcome</DialogTitle><DialogDescription>Write the outcome in plain language.</DialogDescription></DialogHeader>
                    <label className="dc-field-block"><span>Outcome</span><Textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} rows={4} placeholder="The board decided to…" /></label>
                    <label className="dc-field-block"><span>Note <small>{finalizationNeedsNote ? "Required" : "Optional"}</small></span><Textarea value={finalizationNote} onChange={(event) => setFinalizationNote(event.target.value)} rows={3} /></label>
                    {error && <p className="dc-inline-error" role="alert">{error}</p>}
                    <DialogFooter><Button variant="outline" onClick={() => setFinalizeOpen(false)}>Cancel</Button><Button disabled={working} onClick={() => void finalize()}>{working ? "Saving…" : "Finalize"}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
          {error && !finalizeOpen && <p className="dc-inline-error" role="alert">{error}</p>}
        </LeadershipSection>
      )}
    </LeadershipPage>
  )
}
