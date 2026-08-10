import type {
  BallotAnswer,
  DecisionRecord,
  DecisionResponse,
  DecisionResults,
} from "./types"

function responseLabel(decision: DecisionRecord, answer: BallotAnswer) {
  if (answer.type === "binary") {
    if (answer.choice === "yes") return "Yes"
    if (answer.choice === "no") return "No"
    if (answer.choice === "other") return "Proposed something else"
    return "No selection"
  }

  if (answer.type === "single") {
    if (answer.otherText) return "Proposed something else"
    return decision.options.find((option) => option.id === answer.optionId)?.label ?? "Unknown option"
  }

  if (answer.type === "ranked") {
    const firstChoice = answer.ranking[0]
    return decision.options.find((option) => option.id === firstChoice)?.label ?? "No first choice"
  }

  return "Written response"
}

export function calculateDecisionResults(
  decision: DecisionRecord,
  responses: DecisionResponse[],
): DecisionResults {
  if (decision.resultSummary) return decision.resultSummary

  const decisionResponses = responses.filter((response) => response.decisionId === decision.id)
  const counts = new Map<string, number>()

  const useBorda = decision.ballotType === "ranked" && decision.rules.outcomeRule === "borda"

  for (const response of decisionResponses) {
    if (useBorda && response.answer.type === "ranked") {
      response.answer.ranking.forEach((optionId, index) => {
        const label = decision.options.find((option) => option.id === optionId)?.label ?? "Unknown option"
        const points = Math.max(decision.options.length - index, 0)
        counts.set(label, (counts.get(label) ?? 0) + points)
      })
      continue
    }
    const label = responseLabel(decision, response.answer)
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  const orderedLabels = decision.ballotType === "binary"
    ? ["Yes", "No", "Proposed something else"]
    : decision.ballotType === "input"
      ? ["Written response"]
      : [
          ...decision.options.map((option) => option.label),
          ...(decision.allowOther ? ["Proposed something else"] : []),
        ]

  const uniqueLabels = [...new Set([...orderedLabels, ...counts.keys()])]
  const responseCount = decision.responseCount ?? decisionResponses.length
  const eligibleCount = decision.eligibleCount ?? decision.electorateMemberIds.length
  const tallyTotal = [...counts.values()].reduce((sum, count) => sum + count, 0)

  return {
    eligibleCount,
    responseCount,
    turnoutPercentage: eligibleCount === 0 ? 0 : Math.round((responseCount / eligibleCount) * 100),
    tally: uniqueLabels.map((label) => {
      const count = counts.get(label) ?? 0
      return {
        id: label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
        label,
        count,
        percentage: (useBorda ? tallyTotal : responseCount) === 0
          ? 0
          : Math.round((count / (useBorda ? tallyTotal : responseCount)) * 100),
      }
    }),
    tallyUnit: useBorda ? "points" : "responses",
    missingMemberIds: decision.electorateMemberIds.filter(
      (memberId) => !decisionResponses.some((response) => response.memberId === memberId),
    ),
  }
}

export function describeBallotAnswer(decision: DecisionRecord, answer: BallotAnswer) {
  if (answer.type === "binary") {
    if (answer.choice === "yes") return "Yes"
    if (answer.choice === "no") return "No"
    if (answer.choice === "other") return answer.otherText ? `Proposed: ${answer.otherText}` : "Proposed something else"
    return "No selection"
  }

  if (answer.type === "single") {
    if (answer.otherText) return `Proposed: ${answer.otherText}`
    return decision.options.find((option) => option.id === answer.optionId)?.label ?? "No selection"
  }

  if (answer.type === "ranked") {
    return answer.ranking
      .map((optionId, index) => {
        const label = decision.options.find((option) => option.id === optionId)?.label ?? "Unknown option"
        return `${index + 1}. ${label}`
      })
      .join(" · ")
  }

  return answer.text
}
