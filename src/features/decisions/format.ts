import type { BallotType, DecisionOutcomeRule, DecisionStatus, ResultsVisibility, TieRule } from "./types"

export const statusLabels: Record<DecisionStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
  finalized: "Finalized",
}

export const ballotTypeLabels: Record<BallotType, string> = {
  binary: "Yes / No / Propose",
  single: "Choose one",
  ranked: "Rank options",
  input: "Written input",
}

export const resultsVisibilityLabels: Record<ResultsVisibility, string> = {
  "after-submit": "After you respond",
  "after-close": "After responses close",
  "admins-only": "Admins only",
}

export const tieRuleLabels: Record<TieRule, string> = {
  manual: "Discuss and resolve manually",
  runoff: "Hold a runoff",
  chair: "Chair decides",
}

export const outcomeRuleLabels: Record<DecisionOutcomeRule, string> = {
  advisory: "Advisory",
  plurality: "Most responses wins",
  majority: "More than half",
  "approval-threshold": "Approval threshold",
  borda: "Ranked points",
}

export function formatDateTime(value: string | undefined, timezone = "America/Detroit") {
  if (!value) return "No deadline"
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
      timeZoneName: "short",
    })
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    })
  }
  return formatter.format(new Date(value))
}


export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
