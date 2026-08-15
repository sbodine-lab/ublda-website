import { useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Pencil,
  SearchX,
} from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
      <ToggleGroup
        type="single"
        orientation="vertical"
        variant="outline"
        spacing={2}
        className="dc-choice-group"
        aria-label="Your response"
        value={answer.choice ?? ""}
        onValueChange={(value) => value && onChange({ type: "binary", choice: value as "yes" | "no" | "other", otherText: value === "other" ? answer.otherText : undefined })}
      >
        {choices.map((choice) => (
          <ToggleGroupItem
            key={choice.value}
            value={choice.value}
            className="dc-ballot-choice"
          >
            {answer.choice === choice.value && <Check data-icon="inline-start" aria-hidden="true" />}
            {choice.label}
          </ToggleGroupItem>
        ))}
        {answer.choice === "other" && (
          <Field className="dc-other-field">
            <FieldLabel htmlFor="binary-other">What do you propose?</FieldLabel>
            <Textarea
              id="binary-other"
              value={answer.otherText ?? ""}
              onChange={(event) => onChange({ ...answer, otherText: event.target.value })}
              rows={3}
              required
            />
          </Field>
        )}
      </ToggleGroup>
    )
  }

  if (answer.type === "single") {
    return (
      <ToggleGroup
        type="single"
        orientation="vertical"
        variant="outline"
        spacing={2}
        className="dc-choice-group"
        aria-label="Choose one option"
        value={answer.otherText !== undefined ? "other" : (answer.optionId ?? "")}
        onValueChange={(value) => {
          if (!value) return
          onChange(value === "other" ? { type: "single", otherText: answer.otherText ?? "" } : { type: "single", optionId: value })
        }}
      >
        {decision.options.map((option) => (
          <ToggleGroupItem
            key={option.id}
            value={option.id}
            className="dc-ballot-choice"
          >
            {answer.optionId === option.id && answer.otherText === undefined && <Check data-icon="inline-start" aria-hidden="true" />}
            {option.label}
          </ToggleGroupItem>
        ))}
        {decision.allowOther && (
          <>
            <ToggleGroupItem value="other" className="dc-ballot-choice">
              {answer.otherText !== undefined && <Check data-icon="inline-start" aria-hidden="true" />}
              Propose something else
            </ToggleGroupItem>
            {answer.otherText !== undefined && (
              <Field className="dc-other-field">
                <FieldLabel htmlFor="single-other">What do you propose?</FieldLabel>
                <Textarea id="single-other" value={answer.otherText} onChange={(event) => onChange({ type: "single", otherText: event.target.value })} rows={3} />
              </Field>
            )}
          </>
        )}
      </ToggleGroup>
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
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, -1)} disabled={index === 0} aria-label={`Move ${option.label} up`}><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => move(index, 1)} disabled={index === answer.ranking.length - 1} aria-label={`Move ${option.label} down`}><ArrowDown /></Button>
              </span>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <Field>
      <FieldLabel htmlFor="ballot-input">Your input</FieldLabel>
      <Textarea
        id="ballot-input"
        value={answer.text}
        onChange={(event) => onChange({ type: "input", text: event.target.value })}
        placeholder="Your answer"
        rows={6}
      />
    </Field>
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
      <section className="dc-confirmation" aria-live="polite">
        <div className={cn("dc-submit-check", justSubmitted && "dc-submit-check-animated")} aria-hidden="true"><Check /></div>
        <h2>Submitted</h2>
        <div className="dc-confirmation-actions">
          {decision.status === "open" && decision.rules.allowResponseEdits && (
            <Button variant="outline" onClick={() => {
              setJustSubmitted(false)
              setEditing(true)
            }}><Pencil data-icon="inline-start" /> Edit</Button>
          )}
          {decision.rules.resultsVisibility === "after-submit" && (
            <Button asChild><Link to="/results" state={{ decisionSlug: decision.slug }}>View results</Link></Button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="dc-ballot-form" aria-label="Your response">
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
          <AlertTitle>This question changed</AlertTitle>
          <AlertDescription>Review revision {decision.revision} and confirm your response again.</AlertDescription>
        </Alert>
      )}
      {error && <p className="dc-inline-error" role="alert">{error}</p>}
      <div className="dc-submit-bar">
        {existing && <Button type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}
        <Button type="button" onClick={submit} disabled={submitting}>
          {submitting ? "Submitting…" : "Submit"}
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
        <div className="dc-public-topbar">
          <Button variant="ghost" asChild><Link to="/decisions"><ArrowLeft data-icon="inline-start" /> Back to questions</Link></Button>
          <Link to="/decisions" className="dc-logo-lockup" aria-label="Questions"><img src="/logo-64.png" alt="" width="63" height="64" /></Link>
        </div>
        <div className="dc-ballot-document">
          <Empty className="dc-empty-state">
            <EmptyHeader>
              <EmptyMedia variant="icon"><SearchX /></EmptyMedia>
              <EmptyTitle>Question not found</EmptyTitle>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" asChild><Link to="/decisions">Back to questions</Link></Button>
            </EmptyContent>
          </Empty>
        </div>
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
        <Button variant="ghost" asChild><Link to="/decisions"><ArrowLeft data-icon="inline-start" /> Back to questions</Link></Button>
        <Link to="/decisions" className="dc-logo-lockup" aria-label="Questions"><img src="/logo-64.png" alt="" width="63" height="64" /></Link>
      </div>

      <article className="dc-ballot-document">
        <header className="dc-ballot-heading">
          <h1>{decision.title}</h1>
          <p>{decision.overview}</p>
        </header>

        {!isEligible ? (
          <Alert><AlertTitle>You cannot respond to this question</AlertTitle><AlertDescription>Ask an admin if that looks wrong.</AlertDescription></Alert>
        ) : decision.status === "draft" ? (
          <Alert><AlertTitle>This question is still a draft</AlertTitle><AlertDescription>Options may still change.</AlertDescription></Alert>
        ) : decision.status !== "open" && !existing ? (
          <Alert><AlertTitle>Responses are closed</AlertTitle></Alert>
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
