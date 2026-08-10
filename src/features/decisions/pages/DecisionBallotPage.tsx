import { useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Pencil,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { DecisionAuthGate } from "../components/DecisionAuthGate"
import { useDecisionData } from "../decisionDataContext"
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
    const choices: Array<{ value: "yes" | "no" | "other"; label: string }> = [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      ...(decision.allowOther ? [{ value: "other" as const, label: "Propose something else" }] : []),
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
            <span><b>{choice.label}</b></span>
          </button>
        ))}
        {answer.choice === "other" && (
          <label className="dc-field-block dc-other-field">
            <span>What do you propose?</span>
            <Textarea
              value={answer.otherText ?? ""}
              onChange={(event) => onChange({ ...answer, otherText: event.target.value })}
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
            <span><b>{option.label}</b></span>
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
              <span><b>Propose something else</b></span>
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
              <span className="dc-rank-label"><b>{option.label}</b></span>
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const [justSubmitted, setJustSubmitted] = useState(false)

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
      const saved = await adapter.submitResponse(decision.id, answer)
      setSavedResponse(saved)
      setJustSubmitted(true)
      setEditing(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your response could not be saved.")
    } finally {
      setSubmitting(false)
    }
  }

  const receipt = savedResponse ?? existing

  if (!editing && receipt) {
    return (
      <section className="dc-confirmation dc-submit-confirmation" aria-live="polite">
        <div className={cn("dc-submit-check", justSubmitted && "dc-submit-check-animated")} aria-hidden="true"><Check /></div>
        <h2>submitted</h2>
        {decision.rules.resultsVisibility === "after-submit" && (
          <Button asChild className="dc-touch dc-live-results-button"><Link to="/results" state={{ decisionSlug: decision.slug }}>view live results</Link></Button>
        )}
        {decision.status === "open" && decision.rules.allowResponseEdits && (
          <Button variant="outline" className="dc-touch dc-confirmation-edit" onClick={() => {
            setJustSubmitted(false)
            setEditing(true)
          }}><Pencil /> edit</Button>
        )}
      </section>
    )
  }

  return (
    <section className="dc-ballot-form" aria-label="your response">
      {decision.ballotType === "ranked" && <p className="dc-ranking-instruction">Use the arrows to put your strongest choice first.</p>}
      <BallotChoices
        decision={decision}
        answer={answer}
        onChange={(nextAnswer) => {
          setAnswer(nextAnswer)
          setError(undefined)
        }}
      />

      {existing && existing.confirmedRevision !== decision.revision && (
        <Alert>
          <AlertTitle>This decision changed</AlertTitle>
          <AlertDescription>Review revision {decision.revision} and confirm your response again.</AlertDescription>
        </Alert>
      )}
      {error && <p className="dc-inline-error" role="alert">{error}</p>}
      <div className="dc-submit-bar">
        {existing && <Button type="button" variant="ghost" className="dc-touch" onClick={() => setEditing(false)}>Cancel</Button>}
        <Button type="button" size="lg" className="dc-touch dc-submit-button" onClick={submit} disabled={submitting}>
          {submitting ? "submitting…" : "submit"}
        </Button>
      </div>
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
          <h1>{decision.title}</h1>
          <p>{decision.overview}</p>
        </header>

        {!isEligible ? (
          <Alert><AlertTitle>You can view this decision, but you are not in its electorate.</AlertTitle><AlertDescription>Ask a decision administrator if the roster snapshot is incorrect.</AlertDescription></Alert>
        ) : decision.status === "draft" ? (
          <Alert><AlertTitle>This decision is still a draft.</AlertTitle><AlertDescription>Options and rules may change before responses open.</AlertDescription></Alert>
        ) : decision.status !== "open" && !existing ? (
          <Alert><AlertTitle>Responses are closed.</AlertTitle><AlertDescription>This decision is no longer accepting responses.</AlertDescription></Alert>
        ) : (
          <BallotForm key={`${decision.id}-${decision.revision}`} decision={decision} existing={existing} />
        )}
      </article>
    </main>
  )
}

export function DecisionBallotPage() {
  return <DecisionAuthGate><SignedInBallot /></DecisionAuthGate>
}
