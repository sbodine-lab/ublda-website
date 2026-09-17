# Public contact routing

September 17, 2026. Requested routing:

- General club questions: Samantha Naber, snaber@umich.edu.
- Consulting questions: Alex Forstner, alexfors@umich.edu.
- Consulting form sends to Alex and CCs Cooper Perry (cooperry@umich.edu), Alexa Chiang (atchiang@umich.edu), and Sam Bodine (sbodine@umich.edu).
- The sender's submitted address becomes Reply-To; visitors cannot override recipients or the From address.

Cooper's CC reflects the Executive Board Responsibilities document's EVP duties: VP coordination, progress tracking, action-item follow-up, and cross-functional initiatives. Alex remains responsible for replies, consistent with VP Education's ownership of the consulting program. Samantha's address was verified against Brain document156; leadership addresses also match the maintained roster.

## Sending

`POST /api/contact` sends a plain-text email through Resend. Production needs `RESEND_API_KEY` and `CONTACT_FROM_EMAIL=UBLDA Consulting <contact@mail.ublda.org>`. API credentials remain server-side. Sender verification is on the dedicated `mail.ublda.org` subdomain; do not replace root website or mailbox records. Resend domain ID: `9b66f723-ca69-49c8-a203-67f7bc374b33`.

The handler validates required fields and lengths, rejects newline injection in single-line fields, restricts browser origins to the public domain, and includes a honeypot plus a bounded per-instance IP burst guard. The burst guard is not a distributed quota. Exact retries use the same provider idempotency key for its 24-hour deduplication window. No visitor attachments or HTML are sent. Success appears only after the provider accepts the email; inbox placement is not guaranteed. Failure preserves form contents and provides a direct email link. No automatic acknowledgement is sent to visitors.

## Verification

All 163 tests pass, including routing, untrusted-recipient overrides, validation, honeypot, plain-text handling, provider failures, duplicate-send keys, burst-limit expiry, and API request restrictions. Browser testing with a mocked provider response verified error retention, retry, success state, disabled send-after-success, and mobile layout. No real test email was sent.

References: https://resend.com/docs/api-reference/emails/send-email and https://resend.com/docs/api-reference/domains/create-domain.
