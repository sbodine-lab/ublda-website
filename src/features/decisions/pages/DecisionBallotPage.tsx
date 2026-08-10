import { useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  Pencil,
  ShieldCheck,
  Users,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { DecisionAuthGate } from "../components/DecisionAuthGate"
import { DecisionStatusBadge } from "../components/DecisionStatusBadge"
import { useDecisionData } from "../decisionDataContext"
import { ballotTypeLabels, formatDateTime } from "../format"
import { describeBallotAnswer } from "../results"
import type { BallotAnswer, DecisionRecord, DecisionResponse } from "../types"

function defaultAnswer(decision: DecisionRecord, response?: DecisionResponse): BallotAnswer {
  if (response) return response.answer
  if (decision.ballotType === "binary") return { type: "binary" }
  if (decision.ballotType === "single") return { type: "single" }
  if (decision.ballotType === "ranked") return { type: "ranked", ranking: decision.options.map((option) => option.id) }
  return { type: "input", text: "" }
}

function BallotChoices({
  decision,
  answer,
  onChange,
}: {
  decision: DecisionRecord
  answer: BallotAnswer
  onChange(answer: BallotAnswer): void
}) {
  if (answer.type === "binary") {
    const choices: Array<{ value: "yes" | "no" | "other"; label: string; description: string }> = [
      { value: "yes", label: "Yes", description: "Move forward with the proposal as written." },
      { value: "no", label: "No", description: "Do not move forward with this proposal." },
      ...(decision.allowOther ? [{ value: "other" as const, label: "Propose something else", description: "Suggest a specific change or alternative." }] : []),
    ]
    return (
      <div className="dc-choice-list" role="radiogroup" aria-label="Your response">
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={answer.choice === choice.value}
            className={cn("dc-choice-button", answer.choice === choice.value && "dc-choice-selected")}
            onClick={() => onChange({ type: "binary", choice: choice.value, otherText: choice.value === "other" ? answer.otherText : undefined })}
          >
            <span className="dc-choice-marker" aria-hidden="true">{answer.choice === choice.value && <Check />}</span>
            <span><b>{choice.label}</b><small>{choice.description}</small></span>
          </button>
        ))}
        {answer.choice === "other" && (
          <label className="dc-field-block dc-other-field">
            <span>What do you propose?</span>
            <Textarea
              value={answer.otherText ?? ""}
              onChange={(event) => onChange({ ...answer, otherText: event.target.value })}
              placeholder="Write the specific alternative the board should consider."
              rows={3}
              required
            />
          </label>
        )}
      </div>
    )
  }

  if (answer.type === "single") {
    return (
      <div className="dc-choice-list" role="radiogroup" aria-label="Choose one option">
        {decision.options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={answer.optionId === option.id && !answer.otherText}
            className={cn("dc-choice-button", answer.optionId === option.id && !answer.otherText && "dc-choice-selected")}
            onClick={() => onChange({ type: "single", optionId: option.id })}
          >
            <span className="dc-choice-marker" aria-hidden="true">{answer.optionId === option.id && !answer.otherText && <Check />}</span>
            <span><b>{option.label}</b>{option.description && <small>{option.description}</small>}</span>
          </button>
        ))}
        {decision.allowOther && (
          <>
            <button
              type="button"
              role="radio"
              aria-checked={answer.otherText !== undefined}
              className={cn("dc-choice-button", answer.otherText !== undefined && "dc-choice-selected")}
              onClick={() => onChange({ type: "single", otherText: answer.otherText ?? "" })}
            >
              <span className="dc-choice-marker" aria-hidden="true">{answer.otherText !== undefined && <Check />}</span>
              <span><b>Propose something else</b><small>Suggest a specific alternative.</small></span>
            </button>
            {answer.otherText !== undefined && (
              <label className="dc-field-block dc-other-field">
                <span>What do you propose?</span>
                <Textarea value={answer.otherText} onChange={(event) => onChange({ type: "single", otherText: event.target.value })} rows={3} />
              </label>
            )}
          </>
        )}
      </div>
    )
  }

  if (answer.type === "ranked") {
    const move = (index: number, direction: -1 | 1) => {
      const next = [...answer.ranking]
      const target = index + direction
      if (target < 0 || target >= next.length) return
      ;[next[index], next[target]] = [next[target], next[index]]
      onChange({ type: "ranked", ranking: next })
    }
    return (
      <ol className="dc-ranking-list" aria-label="Ranked choices">
        {answer.ranking.map((optionId, index) => {
          const option = decision.options.find((item) => item.id === optionId)
          if (!option) return null
          return (
            <li key={optionId}>
              <span className="dc-rank-number">{index + 1}</span>
              <span className="dc-rank-label"><b>{option.label}</b>{option.description && <small>{option.description}</small>}</span>
              <span className="dc-rank-actions">
                <Button type="button" variant="ghost" size="icon-lg" className="dc-touch" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${option.label} up`}><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon-lg" className="dc-touch" onClick={() => move(index, 1)} disabled={index === answer.ranking.length - 1} aria-label={`Move ${option.label} down`}><ArrowDown /></Button>
              </span>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <label className="dc-field-block">
      <span>Your input</span>
      <Textarea
        value={answer.text}
        onChange={(event) => onChange({ type: "input", text: event.target.value })}
        placeholder="Write the context, concern, or recommendation the board should consider."
        rows={6}
      />
    </label>
  )
}

function BallotForm({ decision, existing }: { decision: DecisionRecord; existing?: DecisionResponse }) {
  const { adapter } = useDecisionData()
  const [savedResponse, setSavedResponse] = useState(existing)
  const [editing, setEditing] = useState(!existing || existing.confirmedRevision !== decision.revision)
  const [answer, setAnswer] = useState<BallotAnswer>(() => defaultAnswer(decision, existing))
  const [rationale, setRationale] = useState(existing?.rationale ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)

  const validationError = useMemo(() => {
    if (answer.type === "binary" && !answer.choice) return "Choose yes, no, or propose something else."
    if (answer.type === "binary" && answer.choice === "other" && !answer.otherText?.trim()) return "Explain the alternative you are proposing."
    if (answer.type === "single" && !answer.optionId && !answer.otherText?.trim()) return "Choose an option or propose an alternative."
    if (answer.type === "single" && answer.otherText !== undefined && !answer.otherText.trim()) return "Explain the alternative you are proposing."
    if (answer.type === "ranked" && answer.ranking.length !== decision.options.length) return "Rank every option before submitting."
    if (answer.type === "input" && !answer.text.trim()) return "Write your input before submitting."
    return undefined
  }, [answer, decision.options.length])

  const submit = async () => {
    if (validationError) {
      setError(validationError)
      return
    }
    setSubmitting(true)
    setError(undefined)
    try {
      const saved = await adapter.submitResponse(decision.id, answer, rationale)
      setSavedResponse(saved)
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your response could not be saved.")
    } finally {
      setSubmitting(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  const receipt = savedResponse ?? existing

  if (!editing && receipt) {
    return (
      <section className="dc-confirmation" aria-live="polite">
        <div className="dc-confirmation-icon"><CheckCircle2 /></div>
        <p className="dc-eyebrow">Response saved</p>
        <h2>You’re all set.</h2>
        <p>Your response is tied to your board identity, so you will not be counted twice if you use another approved email.</p>
        <dl className="dc-response-receipt">
          <div><dt>Your response</dt><dd>{describeBallotAnswer(decision, receipt.answer)}</dd></div>
          {receipt.rationale && <div><dt>Context you added</dt><dd>{receipt.rationale}</dd></div>}
          <div><dt>Saved</dt><dd>{formatDateTime(receipt.revisedAt ?? receipt.submittedAt, decision.timezone)}</dd></div>
        </dl>
        <div className="dc-confirmation-actions">
          {decision.status === "open" && decision.rules.allowResponseEdits && (
            <Button variant="outline" className="dc-touch" onClick={() => setEditing(true)}><Pencil /> Edit response</Button>
          )}
          <Button variant="outline" className="dc-touch" onClick={copyLink}><Copy /> {copied ? "Copied" : "Copy link"}</Button>
          <Button asChild className="dc-touch"><Link to="/decisions">Back to decisions</Link></Button>
        </div>
        {decision.rules.resultsVisibility === "after-close" && decision.status === "open" && (
          <p className="dc-results-hold"><ShieldCheck /> Results stay hidden until responses close, so everyone can answer independently.</p>
        )}
      </section>
    )
  }

  return (
    <section className="dc-ballot-form" aria-labelledby="your-response-title">
      <div className="dc-section-heading">
        <p className="dc-eyebrow">{ballotTypeLabels[decision.ballotType]}</p>
        <h2 id="your-response-title">Your response</h2>
        {decision.ballotType === "ranked" && <p>Use the arrows to put your strongest choice first.</p>}
      </div>
      <BallotChoices
        decision={decision}
        answer={answer}
        onChange={(nextAnswer) => {
          setAnswer(nextAnswer)
          setError(undefined)
        }}
      />

      <label className="dc-field-block dc-rationale-field">
        <span>Why? <small>Optional</small></span>
        <Textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Add useful context for the decision owner." rows={3} />
      </label>

      {existing && existing.confirmedRevision !== decision.revision && (
        <Alert>
          <AlertTitle>This decision changed</AlertTitle>
          <AlertDescription>Review revision {decision.revision} and confirm your response again.</AlertDescription>
        </Alert>
      )}
      {error && <p className="dc-inline-error" role="alert">{error}</p>}
      <div className="dc-submit-bar">
        {existing && <Button type="button" variant="ghost" className="dc-touch" onClick={() => setEditing(false)}>Cancel</Button>}
        <Button type="button" size="lg" className="dc-touch" onClick={submit} disabled={submitting}>
          {submitting ? "Saving…" : existing ? "Update response" : "Submit response"}
        </Button>
      </div>
      <p className="dc-submit-note"><ShieldCheck /> One response per roster member, even if that member has multiple approved emails.</p>
    </section>
  )
}

function SignedInBallot() {
  const { slug } = useParams()
  const { snapshot, decisionBySlug, responseFor } = useDecisionData()
  const decision = decisionBySlug(slug)
  const viewer = snapshot.auth.status === "signed-in" ? snapshot.auth.viewer : undefined

  if (!decision) {
    return (
      <main id="main-content" className="dc-ballot-page">
        <div className="dc-public-topbar"><Link to="/decisions" className="dc-logo-lockup"><img src="/logo.png" alt="" /><span>UBLDA Decisions</span></Link></div>
        <section className="dc-not-found"><h1>Decision not found</h1><p>This link may be incomplete or the decision may have been removed.</p><Button asChild><Link to="/decisions">View decisions</Link></Button></section>
      </main>
    )
  }

  const existing = viewer ? responseFor(decision.id, viewer.memberId) : undefined
  const responseCount = decision.responseCount
    ?? snapshot.responses.filter((response) => response.decisionId === decision.id).length
  const eligibleCount = decision.eligibleCount ?? decision.electorateMemberIds.length
  const turnout = eligibleCount === 0 ? 0 : Math.round((responseCount / eligibleCount) * 100)
  const isEligible = Boolean(
    viewer && (decision.isEligible ?? decision.electorateMemberIds.includes(viewer.memberId)),
  )

  return (
    <main id="main-content" className="dc-ballot-page">
      <div className="dc-public-topbar">
        <Link to="/decisions" className="dc-logo-lockup"><img src="/logo.png" alt="" /><span>UBLDA Decisions</span></Link>
        <Button variant="ghost" asChild className="dc-touch"><Link to="/decisions"><ArrowLeft /> All decisions</Link></Button>
      </div>

      <article className="dc-ballot-document">
        <header className="dc-ballot-heading">
          <div className="dc-ballot-kicker"><DecisionStatusBadge status={decision.status} /><span>Revision {decision.revision}</span></div>
          <h1>{decision.title}</h1>
          <p>{decision.overview}</p>
          <div className="dc-ballot-meta">
            <span><Users /> {responseCount} of {eligibleCount} responded</span>
            <span><CalendarClock /> {decision.deadline ? `Due ${formatDateTime(decision.deadline, decision.timezone)}` : "No deadline"}</span>
          </div>
          <Progress value={turnout} aria-label={`${turnout}% participation`} />
        </header>

        {decision.contextPoints.length > 0 && (
          <section className="dc-context-section" aria-labelledby="context-heading">
            <h2 id="context-heading">What to know</h2>
            <ul>{decision.contextPoints.map((point) => <li key={point}>{point}</li>)}</ul>
          </section>
        )}

        {!isEligible ? (
          <Alert><AlertTitle>You can view this decision, but you are not in its electorate.</AlertTitle><AlertDescription>Ask a decision administrator if the roster snapshot is incorrect.</AlertDescription></Alert>
        ) : decision.status === "draft" ? (
          <Alert><AlertTitle>This decision is still a draft.</AlertTitle><AlertDescription>Options and rules may change before responses open.</AlertDescription></Alert>
        ) : decision.status !== "open" && !existing ? (
          <Alert><AlertTitle>Responses are closed.</AlertTitle><AlertDescription>This decision is no longer accepting responses.</AlertDescription></Alert>
        ) : (
          <BallotForm key={`${decision.id}-${existing?.id ?? "new"}`} decision={decision} existing={existing} />
        )}
      </article>
    </main>
  )
}

export function DecisionBallotPage() {
  return <DecisionAuthGate><SignedInBallot /></DecisionAuthGate>
}
