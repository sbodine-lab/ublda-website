# UBLDA workspace setup and operations

The authenticated UBLDA workspace contains two lightweight internal tools:

- Decisions turns a board question into one private link, one roster-bound response per person, live aggregate results, and an explicit final outcome.
- Scheduling turns a set of dates into one private availability link, autosaves each roster member's grid, ranks full-duration meeting windows live, and lets an admin choose the final time.

Both tools use the same Logto identity and Convex member roster. Adding Alexa, Cooper, or any other teammate happens once in **members** with an approved identity alias; access is never hardcoded into the application.

## Current status

The repository contains the responsive frontend, Convex schema/functions, consolidated REST/MCP gateway, and a fictional local demo adapter for credential-free testing. Live readiness still depends on the Logto, Convex, and Vercel configuration below; repository code alone is not production proof.

## Free-tier fit

The expected nine-member usage is comfortably below the current technical allowances, but plan terms can change and should be rechecked before launch:

- [Convex Free limits](https://docs.convex.dev/production/state/limits) currently include 0.5 GB of database storage and 1,000,000 function calls per month. The five-minute auto-close schedule is about 8,640 calls in a 30-day month before member activity.
- [Logto Cloud Free](https://logto.io/pricing) currently includes up to 50,000 monthly active users, 50,000 access tokens, and three applications, far beyond this roster's expected use. Logto is also [open source](https://github.com/logto-io/logto).
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
| `VITE_LOGTO_ENDPOINT` | `.env.local` and Vercel | Browser-visible | Logto tenant endpoint ending in `.logto.app` |
| `VITE_LOGTO_APP_ID` | `.env.local` and Vercel | Browser-visible | Logto single-page application ID |
| `VITE_DECISION_CENTER_MODE` | Local `.env.local` only | Browser-visible | Optional `demo` or `live` override; production defaults to live and fails closed |
| `CONVEX_SITE_URL` | Vercel | Server-only | Convex HTTP Actions origin ending in `.convex.site` |
| `DECISION_AGENT_GATEWAY_SECRET` | Vercel and Convex | Server-only | Identical high-entropy secret used to authenticate the gateway before Convex processes a bearer token |
| `DECISION_AGENT_ALLOWED_ORIGINS` | Vercel | Server-only | Optional comma-separated browser origins for the agent API; same-origin remains allowed |
| `LOGTO_ISSUER` | Vercel | Server-only | Exact Logto OIDC issuer used to verify the hosted-login ID token |
| `LOGTO_APP_ID` | Vercel | Server-only | Same Logto SPA application ID used as the ID-token audience |
| `CONVEX_AUTH_ISSUER` | Vercel and Convex | Server-only | Canonical same-origin auth-bridge URL, for example `https://ublda.org/api/convex-auth` |
| `CONVEX_AUTH_APP_ID` | Vercel and Convex | Server-only | Dedicated audience for five-minute Convex tokens |
| `CONVEX_AUTH_JWKS` | Convex | Server-side deployment setting | Public JWKS URL; use the same auth-bridge URL |
| `CONVEX_AUTH_SIGNING_PRIVATE_KEY` | Vercel | Secret | PKCS8 RSA private key used only by the auth bridge |
| `CONVEX_AUTH_PUBLIC_JWKS` | Vercel | Server-only | One matching RS256 public signing key, including a stable `kid` |
| `CONVEX_AUTH_ALLOWED_ORIGINS` | Vercel | Server-only | Comma-separated production origins allowed to exchange a Logto ID token |
| `BOOTSTRAP_ADMIN_EMAILS` | Convex deployment | Server-side deployment setting | Comma-separated, normalized verified emails allowed to initialize an empty workspace |

`VITE_*` values are intentionally readable by the browser. The Logto endpoint and SPA application ID are public identifiers. Never put a Logto Management API secret, Convex deploy key, agent bearer token, password, or any other secret in a `VITE_*` variable or a committed env file.

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

### 2. Configure Logto Cloud Free for pre-created accounts

Create a dedicated Logto tenant and **Single-page app**, then:

1. Use Logto's hosted sign-in page with email address and password enabled. Keep phone, username, social connectors, and other unused methods disabled.
2. Disable public account registration in the sign-in experience. The UBLDA page exposes one redirect button and never collects or handles credentials itself.
3. Pre-create each approved administrator/member in the Logto user console or Management API. Deliver initial passwords outside the repository; never place a member password in source, a committed env file, a test, a screenshot, shell history, or deployment logs.
4. Register `http://localhost:5173/auth/callback` and `https://ublda.org/auth/callback` as redirect URIs. Register the matching `/workspace` URLs as post-sign-out redirect URIs. Add a preview host only while deliberately testing that preview.
5. Copy the tenant endpoint to `VITE_LOGTO_ENDPOINT` and the SPA application ID to `VITE_LOGTO_APP_ID`.
6. Copy the exact OIDC issuer from tenant discovery metadata to Vercel's server-only `LOGTO_ISSUER`. It is normally `https://<tenant>.logto.app/oidc`. Set Vercel's server-only `LOGTO_APP_ID` to the same SPA app ID; Logto uses it as the ID-token audience.
7. The React client requests Logto's email scope in addition to the default `openid`, `profile`, and `offline_access` scopes. Inspect one development ID token before bootstrap and confirm `aud` is the app ID, `email` is the signed-in primary address, and `email_verified` is the boolean `true`. Do not bootstrap if any claim is absent or differently typed.

Authentication is one pre-created Logto user per person, while authorization is one UBLDA member record in Convex. Disabling public registration is defense in depth: a valid Logto session still cannot access the workspace until its verified email is present in the Convex roster. Existing verified Clerk identity rows may migrate once to a matching verified Logto identity; arbitrary verified rows cannot be rebound.

### 3. Set Convex deployment variables

Use placeholders below when rehearsing; substitute the approved values without committing them:

```sh
npx convex env set CONVEX_AUTH_ISSUER https://example.org/api/convex-auth
npx convex env set CONVEX_AUTH_APP_ID ublda-convex
npx convex env set CONVEX_AUTH_JWKS https://example.org/api/convex-auth
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
- `VITE_LOGTO_ENDPOINT`
- `VITE_LOGTO_APP_ID`
- `LOGTO_ISSUER`
- `LOGTO_APP_ID`
- `CONVEX_AUTH_ISSUER`
- `CONVEX_AUTH_APP_ID`
- `CONVEX_AUTH_SIGNING_PRIVATE_KEY`
- `CONVEX_AUTH_PUBLIC_JWKS`
- `CONVEX_AUTH_ALLOWED_ORIGINS`
- `CONVEX_SITE_URL`
- `DECISION_AGENT_GATEWAY_SECRET` using a separately generated 32–512 character
  server-only value; set the exact same value in the matching Convex deployment
- `DECISION_AGENT_ALLOWED_ORIGINS` only if a browser client on another approved origin needs the API

`CONVEX_AUTH_ISSUER` and `CONVEX_AUTH_APP_ID` must match in Vercel and Convex. Set `CONVEX_AUTH_JWKS` and `BOOTSTRAP_ADMIN_EMAILS` only in Convex. The bridge verifies each Logto token against Logto's remote JWKS and issues an RS256 token valid for five minutes; it never receives or stores a member password. Logto redirect and post-sign-out settings must include the exact final Vercel/custom-domain host.

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

Then verify the immutable deployment on desktop and a real iPhone, including Logto email/password sign-in, sign-out, rejection of an unapproved identity, and recovery from an iMessage in-app browser. A successful local build or Vercel HTTP 200 is not production proof by itself.

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
