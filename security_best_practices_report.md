# Leadership authentication hardening report

Date: 2026-08-12

Scope: the UBLDA leadership browser client, Logto-to-Convex token bridge, Convex member binding, Speaker Ops authorization, and retired recruiting-administrator authentication paths.

## Result

The application now has one leadership trust path:

1. Logto authenticates one named user.
2. The same-origin bridge verifies the Logto ID token and issues a five-minute Convex token.
3. Convex authorizes that stable Logto subject against an active member record.
4. Speaker Ops verifies the same identity and active Convex member before every read or mutation.

The orphaned applicant-account and recruiting-dashboard identity plane is retired. Public applications, interview booking, and interviewer availability remain available without creating a second account or session system.

## Resolved findings

### Critical: legacy Apps Script administrative session minting

The public Apps Script handler accepted a caller-supplied `googleSignIn` account and could mint a session without verifying a Google credential. Officer email strings could then become administrative roles.

Resolution:

- Apps Script rejects the former applicant-account and interview-assignment actions without minting or restoring sessions.
- The Vercel applicant-account and dashboard endpoints return a permanent retirement response for every former auth action, including old sessions.
- Retired recruiting-admin endpoints fail closed instead of trusting local, HMAC, preview, or Apps Script sessions.
- Public application and booking endpoints remain independent of the retired account plane.

Operational gate: the live Apps Script deployment must be updated or disabled. Committing this source does not alter an already-published Apps Script web app. Revoke or invalidate its existing account sessions after deployment.

### High: shared-password administrator fallback

The retired shared password could still create a signed HMAC administrator session and could be routed through the legacy applicant stack.

Resolution:

- Shared-password matching, HMAC issuance, and local administrator payload construction are removed or permanently fail closed.
- Former environment-variable names cannot restore the behavior.
- Applicant sign-in is retired entirely, so an officer email cannot cross into leadership authorization through that route.
- Launch-readiness guidance no longer recommends a shared administrator secret.

### High: endless loading and account-crossing client work

Logto operation-level loading changes could repeatedly reset Convex authentication, while rejected or hung token fetchers could leave Convex in its indeterminate loading state. In-flight work could also outlive an account change.

Resolution:

- Convex observes only Logto's initial session-resolution loading state.
- Token exchange and refresh operations have deadlines and return `null` on every failure path, as required by the Convex auth adapter.
- Initial Logto resolution, Convex authentication, membership claims, and required workspace/detail/result queries all fail into a retryable error instead of spinning forever.
- Regular and forced refresh work is separated; stale work is cancelled or discarded by session generation.
- Session isolation uses the OIDC issuer and subject together.
- Cross-tab Logto storage changes and foreground account changes trigger safe re-resolution.
- Speaker Ops identity reads, API calls, and Convex membership lookups have bounded failure paths and a retry surface.
- Sign-out uses Logto's provider logout first and has local cleanup recovery if discovery or navigation fails.

### High: bridge key disclosure or mismatch

A malformed public JWKS could have reflected private RSA parameters, and a mismatched private/public pair would cause a production-wide sign-in outage.

Resolution:

- Private JWK parameters are rejected and only public RSA verification fields are emitted.
- The derived public key from the configured private key must match exactly one published `kid` before signing.
- Up to three public keys can overlap for zero-downtime rotation; the matching private key selects the active `kid`.
- Logto JWKS retrieval has bounded timeout, cooldown, and cache behavior.

### Medium: incomplete OIDC validation

Resolution:

- The bridge pins issuer, audience, and accepted algorithms.
- `sub`, `iat`, and `exp` are required.
- Clock skew and maximum token age/validity window are bounded.
- Multi-audience tokens require the configured application as `azp`.
- A verified email claim is mandatory before roster binding.

### Medium: stale invitations and alias-based privilege

Resolution:

- Pending Convex identity invitations expire after 14 days and can be deliberately renewed.
- Verified identities are not silently rebound by matching email.
- Approved aliases use bounded complete-email validation.
- Speaker confirmation permission follows the stable Convex member role, not whichever email alias is currently in the token.
- Inactive Convex members are rejected on every protected path.
- Roster mutations preserve at least one active administrator with a usable verified Logto identity, not merely an admin database row.

### Medium: Speaker Ops persistence reliability

Resolution:

- Current-schema workspace reads no longer rewrite Blob storage.
- Conditional writes preserve Vercel Blob's exact ETag validator so uncontended updates do not fail spuriously.
- The generated production runtime is built sequentially from the hardened TypeScript source, preventing the service bundle from embedding stale store code.

### Medium: HTTP and browser boundaries

Resolution:

- Auth and Speaker Ops APIs require POST JSON, exact approved origins, browser Fetch Metadata, and bounded announced and parsed bodies.
- Auth responses are non-cacheable and return generic, token-free errors.
- The public JWKS response publishes only sanitized public data.
- `www.ublda.org` canonicalizes to `ublda.org` before OAuth starts.
- The site sets a restrictive CSP, anti-framing, MIME-sniffing, referrer, and permissions headers.
- Callback return paths are per-tab, allowlisted, consumed once, and cannot become external redirects.

## Required production operations

These are provider or deployment settings and cannot be proven by repository code:

1. Rotate the leadership password that was previously shared in chat, then revoke existing Logto sessions.
2. Require MFA for all nine Logto users; prefer passkeys or authenticator apps and issue individual recovery codes.
3. Disable public Logto registration and verify only the exact apex redirect and post-logout URIs are registered.
4. Redeploy or disable the live Apps Script and invalidate its legacy sessions.
5. Remove retired shared-password environment values from Vercel after confirming no candidate flow depends on them.
6. Configure and verify Vercel WAF rate limits for `/api/convex-auth`, `/api/speaker-ops`, `/mcp`, and `/api/decision-agent/*`.
7. Exercise sign-in, sign-out, account switching, unapproved-member rejection, offboarding, expired-invite recovery, and mobile in-app-browser recovery on the immutable production deployment.

## Ongoing nine-member operating model

- Give each person one Logto account; never share credentials or second factors.
- Keep at least two active Convex administrators, but make ordinary members non-admin by default.
- Offboard in this order: mark the Convex member inactive, revoke personal agent keys, revoke Logto sessions, then disable the Logto user.
- Add a new email as a pending alias and claim it before disabling an old verified alias.
- Rotate bridge keys with an overlap window and remove the retired public key only after issued tokens and caches expire.
- Review the active Logto users, Convex roster, administrators, pending invitations, and agent keys at least once per term.
