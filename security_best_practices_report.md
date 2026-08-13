# Leadership authentication hardening report

Date: 2026-08-12

Scope: the UBLDA leadership browser client, Logto-to-Convex token bridge, Convex member binding, and Speaker Ops authorization.

## Result

The application now has one leadership trust path:

1. Logto authenticates one named user.
2. The same-origin bridge verifies the Logto ID token and issues a five-minute Convex token.
3. Convex authorizes that stable Logto subject against an active member record.
4. Speaker Ops verifies the same identity and active Convex member before every read or mutation.

The orphaned applicant-account and recruiting-dashboard identity plane, including public E-board applications and interview scheduling, has been removed. General membership sign-up remains separate and does not create a leadership account or session.

## Resolved findings

### Critical: legacy Apps Script administrative session minting

The public Apps Script handler accepted a caller-supplied `googleSignIn` account and could mint a session without verifying a Google credential. Officer email strings could then become administrative roles.

Resolution:

- The Apps Script source now handles only general membership sign-up.
- Applicant-account, application, interview, resume, recruiting-export, recruiting-health, and dashboard endpoints are absent from the application.
- The retired recruiting UI, persistence layer, matching code, shared-password sessions, and generated runtime were deleted together.

Operational gate: the live Apps Script deployment must be updated with the membership-only source or disabled. Committing this source does not alter an already-published Apps Script web app.

### High: shared-password administrator fallback

The retired shared password could still create a signed HMAC administrator session and could be routed through the legacy applicant stack.

Resolution:

- Shared-password matching, HMAC issuance, local administrator payload construction, and applicant sign-in were deleted.
- Former environment-variable names cannot restore the behavior because no code reads them.
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
4. Redeploy the membership-only Apps Script or disable the old deployment.
5. Remove retired recruiting, email, and shared-password environment values from Vercel.
6. Configure and verify Vercel WAF rate limits for `/api/convex-auth`, `/api/speaker-ops`, `/mcp`, and `/api/decision-agent/*`.
7. Exercise sign-in, sign-out, account switching, unapproved-member rejection, offboarding, expired-invite recovery, and mobile in-app-browser recovery on the immutable production deployment.

## Ongoing nine-member operating model

- Give each person one Logto account; never share credentials or second factors.
- Keep at least two active Convex administrators, but make ordinary members non-admin by default.
- Offboard in this order: mark the Convex member inactive, revoke personal agent keys, revoke Logto sessions, then disable the Logto user.
- Add a new email as a pending alias and claim it before disabling an old verified alias.
- Rotate bridge keys with an overlap window and remove the retired public key only after issued tokens and caches expire.
- Review the active Logto users, Convex roster, administrators, pending invitations, and agent keys at least once per term.
