# Cloudflare migration

The website is a Vite React SPA with ten server API handlers. A static-only upload would preserve pages but break membership signup, contact mail, auth bridging, event signups, and leadership operations. Cloudflare Workers Static Assets serves the existing `dist` files without invoking the Worker. Only `/api/*` and `/mcp` invoke the compatibility adapter, which reuses the existing handlers and their authorization checks.

## Preview prepared October 5, 2026

- Source: `main` at `c53bea9879eed5226ce228e6279b777e35c3d418`.
- Preview: https://ublda-website-preview.samuel-l-bodine.workers.dev
- Initial version: `d869f493-83ba-40cc-8909-e1dd35876c72`.
- Preview has no production secrets. Blob routes return 503 instead of using ephemeral local files. Leadership remains fail-closed without its public build configuration.
- Existing public layout, content, client routes, external form links, and backend services are retained. Static cache/security headers and relative redirects are generated from `vercel.json`.
- `www.ublda.org` requires the separate canonical-host redirect Worker; Workers Assets rejects hostname matching in `_redirects`. `wrangler.www.jsonc` deliberately has no domain or route attached yet.

## Cost and capacity

[Static asset requests and storage are free](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). [Workers Free](https://developers.cloudflare.com/workers/platform/limits/) has 100,000 dynamic requests per account per day, 10 ms CPU per request, 128 MB memory, and 50 subrequests per request. This preview has 113 asset files and a 324 KiB compressed Worker bundle. Deployment startup time was 14 ms, which is startup time rather than request CPU time.

The frontend needs no paid feature. API capacity is not yet proven: verify production auth, Blob parsing/conditional writes, and MCP CPU under the Free limit, and check any other Workers sharing the account quota. If those operations consistently exceed the Free limit, optimize or request a plan decision before enabling Workers Paid. The student offer is a separate user decision involving a card and possible overages; it is not enabled by this repository.

Vercel Blob is an existing external dependency, so this does not eliminate every Vercel quota. The [Blob SDK supports a static token outside Vercel](https://vercel.com/docs/vercel-blob/using-blob-sdk). The paused team's actual private Blob access still requires an approved read-only check; it must not be assumed available. If the store is inaccessible, stop cutover and plan a separately approved storage migration with a verified backup. Never replace existing state with an empty store.

## Build and local checks

```sh
npm ci
npm run build:cloudflare
npm run check:cloudflare
npm run typecheck:convex
npm test
npm run lint
npm run preview:cloudflare
```

`nodejs_compat` and the compatibility date enable runtime secret population in `process.env`. The adapter maps verified Cloudflare connection/location metadata to the headers used by existing handlers. It preserves repeated query values, translates existing API rewrites, limits buffered request bodies to 1 MiB, returns JSON for missing APIs, and retains the handlers' method, origin, and authorization rules.

## Approval gates and remaining production checks

1. Use a supported secure user handoff for existing production credentials: the user enters required existing values directly into the UBLDA Worker’s encrypted secret settings. Ordinary approval does not authorize bulk secret extraction. Do not put secrets in chat, logs, commits, or a bulk local export. Persistent access changes require action-time approval.
2. Obtain the actual production browser-visible `VITE_CONVEX_URL`, `VITE_LOGTO_ENDPOINT`, and `VITE_LOGTO_APP_ID`; rebuild with them. Do not enable demo mode in production.
3. Preserve existing `GOOGLE_SCRIPT_URL`, `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`, `BLOB_READ_WRITE_TOKEN`, auth-bridge settings, and Convex gateway settings. Do not create replacement credentials or change Convex data.
4. Verify read-only access to the existing four private Blob objects (`craft-night/state.json`, `bba-mtc-2026/shifts.json`, `speaker-ops/state.json`, `operations/state.json`) without logging contents. Confirm Vercel's team pause does not block them. Confirm runtime secret/key sizes fit the 5 KB per-variable limit.
5. Preview login and contact origins are intentionally not allowlisted. Any temporary Logto callback/origin or auth configuration expansion requires approval. Keep the production issuer `https://ublda.org/api/convex-auth` and exact existing audiences/keys to preserve Convex trust.
6. Verify form validation and approved end-to-end submission/delivery; avoid adding dummy records or sending emails without an authorized test. Verify authenticated leadership data, MCP, and the Free CPU budget. Preserve equivalent existing abuse controls before cutover.
7. Check the Cloudflare account's current plan and quota. No paid/student enrollment is authorized.
8. Export the complete authoritative DNS zone, including mail, verification, TXT, and CAA records. Obtain explicit approval for the concrete DNS/nameserver changes. Attach apex and www only after preview acceptance. Do not alter email routing.
9. After approved cutover, verify apex/www HTTPS, deep client routes, `/apply`, `/apply.`, `/unsubscribe`, assets/security headers, all forms, auth/JWKS, and important authenticated operations.

## Rollback snapshot

Observed October 5, 2026, 14:23 UTC:

| Setting | Existing value |
| --- | --- |
| Registrar DNS nameservers | `ns51.domaincontrol.com`, `ns52.domaincontrol.com` |
| Apex A | `76.76.21.21` |
| www CNAME | `cname.vercel-dns.com` |
| Vercel team | `sbodine-labs-projects` / `team_BA9TgGu2OO1W5k1o3iAJdEoz` |
| Vercel project | `ublda-website` / `prj_hhHYGpyXi2Ylnzyc3Cco13JqakZF` |
| Current apex response | HTTP 402, `DEPLOYMENT_DISABLED` |

The complete DNS zone has not yet been exported. Retain the Vercel project and all existing data/configuration. DNS rollback to Vercel requires resolving the existing team pause first; restoring these records alone currently returns HTTP 402. For later Cloudflare deployments, record each version ID and use `wrangler rollback <version-id>` when an earlier verified version exists. The first unconfigured preview is not a verified production rollback target.

