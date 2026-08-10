export type UpdatePolicyInput = {
  status: "draft" | "open" | "closed" | "finalized";
  hasBallots: boolean;
  hasContentChange: boolean;
  currentResponsePrivacy: "aggregate_only" | "admins_can_view_individual";
  nextResponsePrivacy?: "aggregate_only" | "admins_can_view_individual";
  currentResultsVisibility?: "after_submit" | "after_close" | "admins_only";
  nextResultsVisibility?: "after_submit" | "after_close" | "admins_only";
};

const resultsVisibilityRank = {
  after_submit: 0,
  after_close: 1,
  admins_only: 2,
} as const;

export function decisionUpdateViolation(input: UpdatePolicyInput): string | null {
  if (input.status === "closed" && input.hasContentChange) {
    return "Reopen the decision before making a material content edit.";
  }
  if (
    input.hasBallots &&
    input.currentResponsePrivacy === "aggregate_only" &&
    input.nextResponsePrivacy === "admins_can_view_individual"
  ) {
    return "An aggregate-only decision cannot expose named responses after voting begins.";
  }
  if (
    input.hasBallots &&
    input.currentResultsVisibility !== undefined &&
    input.nextResultsVisibility !== undefined &&
    resultsVisibilityRank[input.nextResultsVisibility] <
      resultsVisibilityRank[input.currentResultsVisibility]
  ) {
    return "A decision's promised results visibility cannot be loosened after voting begins.";
  }
  return null;
}
