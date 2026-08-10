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
  "after-submit": "After someone responds",
  "after-close": "After responses close",
  "admins-only": "Admins only",
}

export const tieRuleLabels: Record<TieRule, string> = {
  manual: "Discuss and resolve manually",
  runoff: "Hold a runoff",
  chair: "Chair decides",
}

export const outcomeRuleLabels: Record<DecisionOutcomeRule, string> = {
  advisory: "Advisory · record outcome manually",
  plurality: "Plurality · most responses wins",
  majority: "Majority · more than half",
  "approval-threshold": "Approval threshold · set a percent",
  borda: "Borda count · ranked points",
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

export function formatRelativeDate(value: string) {
  const date = new Date(value)
  const deltaMs = date.getTime() - Date.now()
  const deltaHours = Math.round(deltaMs / (1000 * 60 * 60))
  const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" })
  if (Math.abs(deltaHours) < 24) return formatter.format(deltaHours, "hour")
  return formatter.format(Math.round(deltaHours / 24), "day")
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}
