# UBLDA workspace setup and operations

The authenticated UBLDA workspace contains two lightweight internal tools:

- Decisions turns a board question into one private link, one roster-bound response per person, live aggregate results, and an explicit final outcome.
- Scheduling turns a set of dates into one private availability link, autosaves each roster member's grid, ranks full-duration meeting windows live, and lets an admin choose the final time.

Both tools use the same Clerk identity and Convex member roster. Adding Alexa, Cooper, or any other teammate happens once in **members** with an approved identity alias; access is never hardcoded into the application.

## Current status

The repository contains the responsive frontend, Convex schema/functions, and the consolidated REST/MCP gateway. It also contains a fictional local demo adapter for credential-free testing.

No Convex project, Clerk application, Vercel environment, custom domain, or production deployment was created or verified as part of this build. The application is **not confirmed live**. Creating cloud projects, setting production credentials, or deploying requires a separate, explicit deployment authorization.

## Free-tier fit

The expected nine-member usage is comfortably below the current technical allowances, but plan terms can change and should be rechecked before launch:

- [Convex Free limits](https://docs.convex.dev/production/state/limits) currently include 0.5 GB of database storage and 1,000,000 function calls per month. The five-minute auto-close schedule is about 8,640 calls in a 30-day month before member activity.
- [Clerk Hobby](https://clerk.com/pricing) currently includes 50,000 monthly retained users per application, far beyond this roster.
- [Vercel Hobby](https://vercel.com/docs/plans/hobby) currently includes 1,000,000 function invocations per month, but its fair-use terms limit it to personal, non-commercial use. Confirm that the club's account and use qualify; usage capacity alone is not plan eligibility.

No billing method is required or configured by this repository. Keep usage alerts enabled in each provider and do not upgrade or attach a payment method without approval.

## Run the local demo

The demo needs no account and writes no club data:

```sh
npm install
npm run dev
```

Open [http://localhost:5173/decisions](http://localhost:5173/decisions), choose **Continue to sign in**, and the preview adapter will simulate an approved board identity. The button does not contact an identity provider in demo mode. All names, emails, decisions, ballots, and agent keys in the preview are fictional; state resets after a full reload.

Useful demo checks:

- `/decisions` — workspace and participation list
- `/decisions/new` — one-page creator
- `/d/v_8f3b92d1c4a74eb5a61f0d27` — phone-first ballot
- `/decisions/v_b9071df54e2a4c96a8137f40/results` — closed-decision results
- `/decisions/settings` — roster and approved identity aliases
- `/decisions/integrations` — personal agent-key and MCP setup UI
- `/scheduling` — scheduling dashboard and live poll results
- `/scheduling/new` — create a scheduling poll and copy its private link
- `/s/s_preview_fall_kickoff` — phone-first availability grid
- `/s/s_preview_fall_kickoff/results` — live ranked meeting windows

Do not silently fall back to the demo in a production build. If live configuration is incomplete, use the fail-closed adapter so private routes show a setup error instead of fictional data.

## Configuration map

Start from [`.env.decisions.example`](../.env.decisions.example). It is separate from the existing `.env.example` and contains placeholders only.

| Variable | Set in | Exposure | Purpose |
| --- | --- | --- | --- |
| `VITE_CONVEX_URL` | `.env.local` and Vercel | Browser-visible | Convex client URL ending in `.convex.cloud` |
| `VITE_CLERK_PUBLISHABLE_KEY` | `.env.local` and Vercel | Browser-visible | Clerk publishable key |
| `VITE_DECISION_CENTER_MODE` | Local `.env.local` only | Browser-visible | Optional `demo` or `live` override; production defaults to live and fails closed |
| `CONVEX_SITE_URL` | Vercel | Server-only | Convex HTTP Actions origin ending in `.convex.site` |
| `DECISION_AGENT_GATEWAY_SECRET` | Vercel and Convex | Server-only | Identical high-entropy secret used to authenticate the gateway before Convex processes a bearer token |
| `DECISION_AGENT_ALLOWED_ORIGINS` | Vercel | Server-only | Optional comma-separated browser origins for the agent API; same-origin remains allowed |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex deployment | Server-side deployment setting | Clerk issuer used by `convex/auth.config.ts` |
| `BOOTSTRAP_ADMIN_EMAILS` | Convex deployment | Server-side deployment setting | Comma-separated, normalized verified emails allowed to initialize an empty workspace |

`VITE_*` values are intentionally readable by the browser. Never put a Clerk secret key, Convex deploy key, agent bearer token, or any other secret in a `VITE_*` variable or a committed env file.

## Live setup

### 1. Create or link a Convex Free deployment

Use a dedicated UBLDA project rather than either existing Stride project.

```sh
npx convex dev
```

The Convex CLI will offer to create or link a development deployment and normally writes its local client configuration to `.env.local`. Confirm that the generated client URL is the intended UBLDA deployment before running any mutation.

Record both deployment URLs:

- `https://<deployment>.convex.cloud` for `VITE_CONVEX_URL`
- `https://<deployment>.convex.site` for `CONVEX_SITE_URL`

Keep `npx convex dev` running while developing against the live development database. Do not run `npx convex deploy` until a production deployment is explicitly authorized.

### 2. Configure Clerk Hobby for pre-created accounts

Create a dedicated Clerk application, then:

1. Enable email address and password sign-in, plus Google as a social connection.
2. Set the application to Clerk **Restricted** mode. Do not enable public sign-up. The UBLDA interface intentionally exposes only Google, email/password, and the provider-required verification-code step; it has no create-account link.
3. Pre-create each approved administrator/member in Clerk. Deliver initial passwords outside the repository and require secure password handling; never place a member password in source, an env file, a test, a screenshot, or deployment logs.
4. Keep email verification code available for device-trust or second-factor challenges. It is not an account-creation path. The custom sign-in flow sends the code only after a correct password reaches a provider-required verification step.
5. Leave Clerk **Organizations** disabled; the Decision Center's own roster remains the membership boundary. Google sign-in does not require a Google Workspace organization. Keep phone and unused social connections disabled.
6. For production Google sign-in, use a dedicated OAuth client with only the basic `openid`, email, and profile scopes. Configure Clerk's exact OAuth callback as the authorized redirect URI, keep Google email subaddress blocking enabled, and never commit or log the client secret.
7. Copy the publishable key to `VITE_CLERK_PUBLISHABLE_KEY`.
8. In Clerk's [**Convex integration** setup](https://clerk.com/docs/guides/development/integrations/databases/convex), activate the integration. It maps the required `aud: "convex"` session claim.
9. In Clerk's **Sessions > Claims** editor, add the verified identity fields used by the roster linker without replacing the integration's audience claim:

   ```json
   {
     "aud": "convex",
     "email": "{{user.primary_email_address}}",
     "email_verified": "{{user.email_verified}}",
     "name": "{{user.full_name}}"
   }
   ```

10. Copy the integration's Frontend API/issuer URL, including `https://`, for `CLERK_JWT_ISSUER_DOMAIN`. It must match the `domain` in `convex/auth.config.ts`; `applicationID: "convex"` matches the integration audience.
11. Inspect one development token before bootstrap and confirm `aud` is `convex`, `email` is the signed-in primary verified address, and `email_verified` is the boolean `true`. Do not bootstrap if any claim is absent or differently typed.

The installed Convex client also supports Clerk's older preconfigured `convex` JWT template. For a new setup, use Clerk's current Convex integration flow above rather than hand-building the audience claim.

Authentication is one pre-created Clerk user per person, while authorization is one UBLDA member record. Approved `@umich.edu` and personal aliases can still resolve to the same roster member, and the database enforces one ballot per member rather than one ballot per email or device.

### 3. Set Convex deployment variables

Use placeholders below when rehearsing; substitute the approved values without committing them:

```sh
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://example.clerk.accounts.dev
npx convex env set BOOTSTRAP_ADMIN_EMAILS first.admin@example.invalid
```

For production, set these values on the production Convex deployment too. Verify the active deployment before each command; development and production env values are separate.

### 4. Bootstrap the first administrator

Bootstrap is intentionally one-time and fail-closed:

1. Set `BOOTSTRAP_ADMIN_EMAILS` before any member exists.
2. Sign in using one verified email on that allowlist.
3. Invoke `members.bootstrapCurrentIdentity` through the live application flow.
4. Verify that one active admin member and one verified identity were created.
5. Use the authenticated roster settings to add the other members and their approved email aliases.
6. Each added member signs in and claims a pending approved identity through `members.claimApprovedIdentity`.

After any member exists, a new identity cannot bootstrap the workspace. It must be pre-approved by an admin. One person may have multiple approved email aliases, but the database enforces one ballot per `(decisionId, memberId)` rather than one ballot per email.

For the production deployment, reduce `BOOTSTRAP_ADMIN_EMAILS` to the smallest approved set after the first admin has been verified. Do not remove or alter the verified database identity as a substitute for normal roster management.

### 5. Configure Vercel

Set these for each intended Vercel environment:

- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `CONVEX_SITE_URL`
- `DECISION_AGENT_GATEWAY_SECRET` using a separately generated 32–512 character
  server-only value; set the exact same value in the matching Convex deployment
- `DECISION_AGENT_ALLOWED_ORIGINS` only if a browser client on another approved origin needs the API

`CLERK_JWT_ISSUER_DOMAIN` and `BOOTSTRAP_ADMIN_EMAILS` belong in Convex, not Vercel. Clerk redirect/origin settings must include the exact final Vercel/custom-domain host.

The Convex HTTP Actions reject direct public traffic unless
`X-UBLDA-Gateway-Secret` matches this shared value. Never put the secret in a
`VITE_*` variable, client configuration, bearer token, log, or screenshot.

For pre-Convex abuse control, configure one Vercel WAF fixed-window rate-limit
rule covering both `/mcp` and `/api/decision-agent/*`, keyed by IP or JA4. Vercel
documents WAF rate limiting on Hobby, but the rule is project-side deployment
state, not an in-process guarantee in this repository. Serverless memory is not
shared across instances and must not be treated as a reliable IP limiter. Verify
the published WAF rule and its Hobby usage terms before release; automatic DDoS
mitigation alone is not a precise per-client quota control.

The checked-in `vercel.json` already keeps the gateway to one Vercel Function:

- `/mcp` rewrites to the MCP handler
- `/api/decision-agent/:path*` rewrites to the REST handler
- the SPA fallback preserves `/decisions/*`, `/d/*`, `/scheduling/*`, and `/s/*` routes

Before any authorized release, run:

```sh
npm run lint
npm test
npm run build
```

Then verify the immutable deployment on desktop and a real iPhone, including the configured Clerk sign-in methods and recovery from an iMessage in-app browser. A successful local build or Vercel HTTP 200 is not production proof by itself.

## Governance model

### Identity and privacy

- The electorate is snapshotted per decision; board size is never hardcoded.
- Members outside an electorate cannot view that decision. Drafts are visible only to the creator and admins.
- Interim aggregate results follow the decision's visibility rule: after submit, after close, or admins only.
- Named missing responders and individual response detail are available only to the decision creator/admin through manager-authorized queries.
- `aggregate_only` prevents managers from receiving individual ballots. `admins_can_view_individual` permits the protected manager detail view.
- The public agent-results operation returns aggregate counts only. The gateway strips identity, ballot, free-text, and missing-responder fields again as defense in depth.
- Agent tokens are personal, scoped, revocable, rate-limited, hashed at rest, and shown in full only once.
- The owner-local UBLDA Brain is a separate data path. The Decision Center API and MCP server must never proxy private Brain transcripts, strategy, or owner-only context.

### Lifecycle

The server enforces:

```text
Draft -> Open -> Closed -> Finalized
                  |
                  +-> Open (audited reopen)
```

- Publishing is separate from draft creation.
- A finalized decision is immutable.
- Only a closed decision can be finalized.
- Reopening requires a future replacement deadline when the old deadline has passed.
- `autoClose` defaults to `false`. With `autoClose` enabled, ballots are rejected after the deadline. A scheduled status transition has not been deployed or verified, so the owner should still confirm and manually close the decision.
- Options, electorate, and counting rules lock after the first ballot.
- A material context edit after voting begins increments the revision and requires every prior voter to reconfirm.

### Decision rules

Every decision stores its rules explicitly; no quorum, threshold, or tie behavior is inferred:

- Response type: yes/no/propose, single choice, ranked choice, or input only
- Minimum turnout: optional and separate from the outcome calculation
- Outcome rule: advisory, plurality, majority, approval threshold, or Borda
- Borda: `N` points for first place through `1` point for last place
- Tie rule: manual, status quo, runoff, or creator decides
- Result visibility: after submit, after close, or admins only
- Response privacy: aggregate only or protected manager detail
- Response edits: optionally allowed until close; an update replaces, rather than duplicates, the member's ballot

Even when a numeric rule identifies a recommended option, an authorized member records the board's actual final outcome manually.

## REST API

The stable base is:

```text
https://<your-ublda-host>/api/decision-agent/v1
```

Every request needs a personal bearer token. Keep the token in the client's secret store or environment and reference it as `$UBLDA_DECISION_TOKEN`; do not paste it into source code, screenshots, logs, or chat.

Scopes are exact and do not imply each other:

| Scope | Operations |
| --- | --- |
| `decisions:read` | List decisions and get non-private configuration |
| `decisions:write` | Create private drafts |
| `decisions:publish` | Publish a draft |
| `decisions:manage` | Read named response status without choices; close a decision |
| `results:read` | Read aggregate results only |

Create a draft with an idempotency key:

```sh
curl -X POST "https://<your-ublda-host>/api/decision-agent/v1/decisions/drafts" \
  -H "Authorization: Bearer $UBLDA_DECISION_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: weekly-format-2026-08-09-v1" \
  --data '{
    "title": "Should we trial the shorter meeting format?",
    "overview": "Decide whether to use a shorter agenda for the next four meetings, then review it.",
    "responseType": "yes_no_other",
    "autoClose": false,
    "minimumTurnout": 5,
    "approvalThreshold": 0.6,
    "resultsVisibility": "after_response"
  }'
```

Publishing is intentionally separate and also idempotent:

```sh
curl -X POST "https://<your-ublda-host>/api/decision-agent/v1/decisions/<decision-id>/publish" \
  -H "Authorization: Bearer $UBLDA_DECISION_TOKEN" \
  -H "Idempotency-Key: publish-<decision-id>-v1"
```

Read operations:

```sh
curl "https://<your-ublda-host>/api/decision-agent/v1/decisions?status=open" \
  -H "Authorization: Bearer $UBLDA_DECISION_TOKEN"

curl "https://<your-ublda-host>/api/decision-agent/v1/decisions/<decision-id>/results" \
  -H "Authorization: Bearer $UBLDA_DECISION_TOKEN"
```

The REST/MCP surface can create drafts, publish, list/get, read response status, read aggregate results, and close. It does not finalize decisions; finalization remains an authenticated member action in the governed workspace.

Agent-created deadlines must be absolute ISO 8601 instants with `Z` or an
explicit UTC offset. `timeZone` must be a canonical IANA name such as
`America/Detroit`; it controls how that instant is displayed and does not
reinterpret a local wall-clock time.

## Remote MCP

The stable stateless endpoint is:

```text
https://<your-ublda-host>/mcp
```

Example client configuration:

```json
{
  "mcpServers": {
    "ublda-decisions": {
      "type": "http",
      "url": "https://<your-ublda-host>/mcp",
      "headers": {
        "Authorization": "Bearer ${UBLDA_DECISION_TOKEN}"
      }
    }
  }
}
```

Available tools depend on the token's exact scopes:

- `ublda_decision_create_draft`
- `ublda_decision_publish`
- `ublda_decisions_list`
- `ublda_decision_get`
- `ublda_decision_response_status`
- `ublda_decision_aggregate_results`
- `ublda_decision_close`

Use a separate token per person and client, request the smallest scope set, add an expiration when practical, and revoke a key immediately when the client is retired or a token may have been exposed.

## Codex skill

The reusable skill package lives in [`skills/ublda-decisions`](../skills/ublda-decisions). Install it for the current macOS user with:

```sh
mkdir -p "$HOME/.codex/skills"
cp -R skills/ublda-decisions "$HOME/.codex/skills/ublda-decisions"
```

Create a personal key at `/decisions/integrations` with `decisions:write` and
`decisions:publish`, store it as `UBLDA_DECISION_TOKEN` in the local secret
environment, then invoke `$ublda-decisions`. The skill creates and publishes
through the REST API and returns the opaque `/d/<slug>` link for the group chat.
It never stores the token in the repository or derives a public URL from the
private decision title.

More gateway implementation detail is in [`server/decisionAgent/README.md`](../server/decisionAgent/README.md).
