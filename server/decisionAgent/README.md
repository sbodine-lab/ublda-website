# Decision agent gateway

`api/decision-agent.ts` is the one Vercel function for both the scoped REST API
and remote MCP. It does not read the Convex database directly. Every bearer
token is authorized against a server-side Convex HTTP action, and every
operation is re-validated by its operation-specific Convex endpoint.

## Runtime configuration

- `CONVEX_SITE_URL`: the deployment's `https://*.convex.site` HTTP Actions URL.
- `DECISION_AGENT_GATEWAY_SECRET`: a server-only random secret of 32–512 visible
  ASCII characters. Set the identical value in Vercel and Convex. The gateway
  sends it as `X-UBLDA-Gateway-Secret` on every Convex HTTP Action request, and
  Convex rejects requests before bearer-token work when it is absent or wrong.
- `DECISION_AGENT_ALLOWED_ORIGINS`: optional comma-separated browser origins.
  Browser access is otherwise same-origin only. CLI and MCP clients without an
  `Origin` header are supported.

The Vercel router should send the canonical subpaths to this single function:

```json
{
  "source": "/api/decision-agent/:path*",
  "destination": "/api/decision-agent?decisionAgentPath=/:path*"
}
```

Until that rewrite is installed, the equivalent direct-function form is
`/api/decision-agent?decisionAgentPath=/mcp` (or another path below).

## REST surface

All calls require `Authorization: Bearer <personal-access-token>`.

| Method | Path | Scope | Notes |
| --- | --- | --- | --- |
| `POST` | `/v1/decisions/drafts` | `decisions:write` | Requires `Idempotency-Key` |
| `POST` | `/v1/decisions/:id/publish` | `decisions:publish` | Requires `Idempotency-Key` |
| `GET` | `/v1/decisions` | `decisions:read` | Optional `status`, `limit`, `cursor`; returns `{items, nextCursor}` |
| `GET` | `/v1/decisions/:id` | `decisions:read` | Non-private decision configuration |
| `GET` | `/v1/decisions/:id/response-status` | `decisions:manage` | Response/missing-member status, never choices |
| `GET` | `/v1/decisions/:id/results` | `results:read` | Aggregate counts only |
| `POST` | `/v1/decisions/:id/close` | `decisions:manage` | Optional audit note |
| `POST` | `/mcp` | token-dependent | Stateless MCP, SDK v2, current plus 2025 compatibility |

Remote MCP clients should point to the stable `/mcp` URL and attach the PAT as
an HTTP header on every request, for example:

```json
{
  "url": "https://your-ublda-domain.example/mcp",
  "headers": {
    "Authorization": "Bearer ${UBLDA_DECISION_TOKEN}"
  }
}
```

Scopes are exact and do not imply one another: a management token does not
silently gain read, write, publish, or results access. Aggregate result
responses are recursively stripped of named ballots, identities, comments,
reasoning, and individual response records as a defense in depth. Convex
remains the primary privacy boundary.

## Convex HTTP contract

The gateway calls these server-side endpoints with the original bearer token,
`X-Request-Id`, and (where required) `Idempotency-Key`:

- `POST /decision-agent/authorize`
- `POST /decision-agent/create-draft`
- `POST /decision-agent/publish`
- `POST /decision-agent/list`
- `POST /decision-agent/get`
- `POST /decision-agent/response-status`
- `POST /decision-agent/aggregate-results`
- `POST /decision-agent/close`

Authorization returns this exact shape:

```json
{
  "authorized": true,
  "principal": {
    "tokenId": "opaque-token-record-id",
    "memberId": "opaque-member-id",
    "clientName": "optional display name",
    "scopes": ["decisions:read"],
    "expiresAt": 1786320000000
  }
}
```

`expiresAt` may use Convex's epoch-millisecond convention. The gateway
normalizes it to epoch seconds before placing it in MCP `AuthInfo`.

Revocation, expiry, hashing, rate limiting, operation scope enforcement,
idempotency storage, and auditing live in Convex. The gateway never writes a
token to logs or responses and redacts an exact token if an upstream error
accidentally includes it.

## Create-draft mapping

The public contract stays short and agent-friendly. The Convex HTTP boundary
maps it to the internal `DecisionDraftInput`:

| Public field | Convex field / behavior |
| --- | --- |
| `title` | `title` |
| `overview` | full value to `context`; first 500 characters to `summary` |
| `responseType` | `responseType` |
| `options[].label`, `description` | option labels/descriptions; service derives safe keys |
| `eligibleMemberIds` | `electorateMemberIds`; omitted means active roster snapshot |
| ISO `deadline` with `Z` or a UTC offset | numeric `deadlineAt` via `Date.parse`; this is the absolute response instant |
| canonical IANA `timeZone` | display timezone metadata; omitted defaults to `America/Detroit` and does not reinterpret `deadline` |
| `autoClose` | `autoClose`, default `false` |
| `minimumTurnout` | `minimumTurnout` |
| `approvalThreshold` in the `(0, 1]` range | `approvalThresholdPercent = value * 100` and approval-threshold rule |
| `after_response` result visibility | internal `after_submit` |
| other result visibility values | unchanged |

The create and publish endpoints own idempotency. Reusing a key with the same
operation and payload returns the stored result; reusing it with a different
payload is a conflict.
