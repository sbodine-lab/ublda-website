export type TallyResponseType =
  | "yes_no_other"
  | "single_choice"
  | "ranked_choice"
  | "input_only";

export type TallyOption = { optionId: string };
export type TallyBallot = {
  selections: Array<{ optionId: string; rank?: number }>;
};

export function tallyOptions(
  responseType: TallyResponseType,
  options: TallyOption[],
  ballots: TallyBallot[],
): Array<{ optionId: string; count: number; score: number }> {
  const countById = new Map(options.map((option) => [option.optionId, 0]));
  const scoreById = new Map(options.map((option) => [option.optionId, 0]));
  for (const ballot of ballots) {
    for (const selection of ballot.selections) {
      if (!countById.has(selection.optionId)) continue;
      // On ranked ballots `count` is a first-choice count. Counting every
      // ranked selection would make every option look tied.
      if (
        responseType !== "ranked_choice" ||
        (selection.rank ?? options.length) === 1
      ) {
        countById.set(selection.optionId, (countById.get(selection.optionId) ?? 0) + 1);
      }
      if (responseType === "ranked_choice") {
        const rank = selection.rank ?? options.length;
        scoreById.set(
          selection.optionId,
          (scoreById.get(selection.optionId) ?? 0) + options.length - rank + 1,
        );
      }
    }
  }
  return options.map((option) => ({
    optionId: option.optionId,
    count: countById.get(option.optionId) ?? 0,
    score: scoreById.get(option.optionId) ?? 0,
  }));
}
