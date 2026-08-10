# UBLDA workspace backend

This folder is the Convex backend for UBLDA's private decision workspace. It is
designed for Convex Free and Clerk's free authentication tier. No Convex or
Clerk deployment is created by this code.

The same authenticated roster also powers private scheduling polls. Scheduling
polls use opaque links, a fixed 15-minute source grid, one replaceable response
per member, live aggregate counts, duration-aware ranked windows, and an
admin-recorded final time. Aggregate participant results contain counts only;
named nonresponders remain admin-only.

## Identity and first-run setup

Configure these as server-side Convex environment variables:

- `CLERK_JWT_ISSUER_DOMAIN`: the Clerk issuer for the `convex` JWT template.
- `BOOTSTRAP_ADMIN_EMAILS`: comma-separated, verified email addresses allowed
  to initialize a completely empty workspace.
- `DECISION_AGENT_GATEWAY_SECRET`: a high-entropy server-to-server secret
  shared only with the Vercel decision-agent gateway; use 32-512 visible ASCII
  characters with no surrounding whitespace.

Enable Google sign-in and, if needed, Clerk's verified email-code fallback. The
JWT template must include the verified email claim. The first allowlisted person calls
`members.bootstrapCurrentIdentity`; later members are created by an admin with
one or more approved email aliases and bind an alias by calling
`members.claimApprovedIdentity` after signing in. A ballot is unique by
`(decisionId, memberId)`, so two approved email aliases cannot vote twice.

The owner-local UBLDA Brain is intentionally not imported or exposed. This is a
separate team-safe data path.

## Governance behavior

- Draft electorate rows are editable selections. If no explicit roster was
  supplied, publication re-resolves the active roster; otherwise it refreshes
  the selected members' names/roles. `decisions.publish` then atomically turns
  those rows into the immutable electorate snapshot. Roster edits after
  publication do not change that decision.
- Options, electorate, and counting rules lock after the first ballot. A
  material context edit then requires `requireReconfirmation: true`, increments
  the decision revision, and makes previous ballots stale until resubmitted.
- Deadlines are reminders while `autoClose` is false. The decision remains open
  and accepts late responses until a manager closes it. With `autoClose` true,
  a five-minute cron closes due decisions and ballot submission rejects during
  any scheduling lag.
- Lifecycle is Draft -> Open -> Closed -> Finalized. Closed decisions may be
  reopened with an audited reason. Finalized decisions are immutable; revisiting
  one requires a new decision.
- No turnout, approval, or tie rule is inferred. Defaults are advisory outcome,
  no minimum turnout, and manual tie handling. Finalization always requires an
  explicitly submitted outcome.
- Aggregate tallies never disclose voters. Individual ballots/comments default
  to creator/admin visibility and can be changed to aggregate-only. Interim
  results obey `after_submit`, `after_close`, or `admins_only` visibility.
  Once voting starts, this promise can stay the same or become more restrictive,
  but cannot be loosened retroactively.
- Response edits default on. When disabled, a current ballot cannot be replaced;
  a stale ballot can still be reconfirmed after a required content revision.
- Decision time zones default to `America/Detroit` and must be canonical IANA
  identifiers of at most 80 characters. Legacy aliases, case variants, and
  misspellings are rejected before persistence.

## Browser function surface

All public functions use the centralized Clerk-to-member authorization helpers.

- `viewer.current({})`
- `workspace.workspaceSnapshot({})`
- `clubWorkspace.snapshot({})` — authenticated events, projects, tasks, and directory profiles
- `clubWorkspace.createEvent({ input })` — administrator-only internal calendar event
- `clubWorkspace.createProject({ input })` — administrator-only project creation
- `clubWorkspace.createTask({ input })` — administrator-only task creation
- `clubWorkspace.updateTaskStatus({ taskId, status })` — administrator or assigned owner
- `clubWorkspace.updateProfile({ input })` — administrator-only directory profile update
- `members.list({ includeInactive? })` (admin), `members.eligible({})`,
  `members.upsertMember({ memberId?, displayName, role, status?, approvedEmails? })`
- `decisions.list({ status? })`, `decisions.getBySlug({ slug })`,
  `decisions.activity({ decisionId, limit? })` (creator/admin)
- `decisions.create({ input })`, `decisions.update({...})`,
  `decisions.publish({ decisionId })`, `decisions.close({ decisionId, reason? })`,
  `decisions.reopen({ decisionId, reason, deadlineAt?, clearDeadline? })`,
  `decisions.finalize({ decisionId, outcomeOptionId?, outcomeText?, note? })`
- `ballots.myResponse({ decisionId?, slug? })`,
  `ballots.submit({ decisionId, input: { selections, otherText?, responseText?, reasoning? } })`
- `results.get({ decisionId?, slug? })`
- `availability.list({})`, `availability.getBySlug({ slug })`
- `availability.create({ input: { title, note?, dateKeys, startMinutes, endMinutes, durationMinutes, timezone, deadline?, resultsVisibility, electorateMemberIds? } })` (admin)
- `availability.saveResponse({ pollId, availableSlotKeys })`
- `availability.finalize({ pollId, dateKey, startMinutes })` (admin)
- `agentKeys.createAgentKey({ name, scopes, expiresAt?, rateLimitPerMinute? })`,
  `agentKeys.list({})`, `agentKeys.revokeAgentKey({ agentKeyId })`

New decision links use opaque `d_<Convex document ID>` slugs generated inside
the create transaction. Draft creation never accepts a caller-selected slug and
never derives the public URL from a title or other private decision content.
Existing stored slugs remain readable through `getBySlug`.

`agentKeys.createAgentKey` returns the plaintext personal token exactly once.
Only its prefix and SHA-256 hash are persisted. The list is always limited to
the current member's keys. Admins may revoke a known key for incident response,
but do not receive a cross-member token inventory through the member UI query.

When supplied to `members.upsertMember`, `approvedEmails` is the complete
desired alias set: missing aliases are added as pending, included disabled
aliases return to pending, and omitted aliases are disabled with provider
linkage cleared. Omitting the field leaves aliases unchanged. The current
member cannot remove their last already-verified identity.

## Agent HTTP contract

`http.ts` exposes these POST HTTP Actions for the single Vercel REST/MCP gateway:

- `/decision-agent/authorize`
- `/decision-agent/create-draft`
- `/decision-agent/publish`
- `/decision-agent/list`
- `/decision-agent/get`
- `/decision-agent/response-status`
- `/decision-agent/aggregate-results`
- `/decision-agent/close`

Exact scopes are `decisions:read`, `decisions:write`, `decisions:publish`,
`decisions:manage`, and `results:read`; scopes do not imply one another.
Authorization discovery validates without using the rate window. Each operation
then rechecks revocation/expiry/scope, consumes one rate-limit slot, and writes
one sanitized audit event. Create/publish require `Idempotency-Key`; close
supports it. Request payloads are hashed before idempotency records are stored.
Every route first requires `X-UBLDA-Gateway-Secret` to match
`DECISION_AGENT_GATEWAY_SECRET` using a timing-safe digest comparison. A missing
or weak server configuration and an absent/invalid header both fail closed
before PAT hashing, token-prefix lookup, or any database call. Never expose this
header or environment value to browser code.

The create-draft HTTP mapping accepts the small gateway shape documented in
`server/decisionAgent/README.md`. In particular, `approvalThreshold` is a ratio
in `(0, 1]` and is stored as a percentage, and `after_response` maps to
`after_submit`. List returns `{ items, nextCursor }`.

## Local checks and connection

The checked-in `lib/server.ts` shim types functions directly from `schema.ts`,
so this folder can be checked before a hosted project exists:

```sh
npx tsc -p convex/tsconfig.json
node --experimental-strip-types --test tests/decision-backend.test.ts
```

When deployment is approved, connect a Convex project with the normal Convex
CLI flow. Codegen may add the conventional `_generated` folder; do not commit
deployment credentials or local environment values.
