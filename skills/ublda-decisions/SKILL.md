---
name: ublda-decisions
description: Create and optionally publish a private UBLDA board decision form through the scoped Decision Center API, then return the direct share link. Use when the user asks to make, draft, publish, or share a UBLDA vote, ballot, decision, yes/no/propose question, or group-chat decision link.
---

# UBLDA decisions

Create a decision with `scripts/create_decision.mjs`. Never edit the website or generate a new route for each question.

## Gather the decision

Require:

- a clear question-style title
- a short overview with the context voters need

Default to `yes_no_other` unless the user requests named choices, ranking, or free text. Never infer a quorum, minimum turnout, approval threshold, deadline, or tie rule. Add those only when the user states them.

For `single_choice` or `ranked_choice`, pass each option with a separate `--option` flag.

## Authentication

Read the personal token only from `UBLDA_DECISION_TOKEN`. Never ask the user to paste it into chat or place it in source control. The token needs `decisions:write` and, when publishing, `decisions:publish`.

If the token is missing, direct the user to `https://ublda.org/decisions/integrations` to create a personal key, then have them add it to their local secret environment. Do not fall back to an unverified name or a shared token.

## Create and publish

Use the production API by default:

```sh
node "$HOME/.codex/skills/ublda-decisions/scripts/create_decision.mjs" \
  --title "Should we change the weekly meeting format?" \
  --overview "Decide whether the next four meetings should use a shorter agenda." \
  --response-type yes_no_other
```

The script creates and publishes in one run. Add `--draft-only` only when the user explicitly wants review before publication. Use an absolute ISO 8601 deadline with a UTC offset when one is provided.

For a local or alternate deployment, set `UBLDA_DECISION_BASE_URL` or pass `--base-url`.

## Return the result

Return the script's `shareUrl` first so the user can paste it into the group chat. Also return `resultsUrl`; new decisions show live aggregate results there after each member submits. Briefly state whether the decision is `open` or `draft`. Do not expose the bearer token, gateway secret, member roster, or individual ballots.

If publication fails after draft creation, report the draft ID and the error. Do not create a second draft automatically; reuse the original draft and a stable idempotency key on retry.
