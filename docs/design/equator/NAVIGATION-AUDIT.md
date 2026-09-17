# Public navigation verification — September 17, 2026

The live site had two reproducible dead-end interactions:

- After following a header section link and scrolling away, clicking the same link again changed neither the URL nor the scroll position.
- Clicking the UBLDA header/footer home link while already on the homepage left the visitor at their current scroll position. Scroll-animation refreshes could also interfere with attempts to return to the top.

Navigation now responds to each React Router history entry, including repeated destinations. Scroll and focus handling waits for typography/layout readiness, uses an explicit instant scroll, and is separate from the animation refresh lifecycle. Stale page refresh callbacks are cancelled. Consulting home links use the same repeated-navigation trigger. Event recap links can reopen their destination on repeated navigation.

Membership and consulting application buttons now use the direct Google Form URLs resolved from the existing short links. The forms themselves and their audiences are unchanged. The existing pages already cover the reviewed destinations, so the reference-based design and page structure are preserved.

## Verification

All 148 navigation checks pass locally, with 52 unique link destinations inventoried and no page errors.

`scripts/audit-public-navigation.mjs` clicks the desktop and mobile header links twice after scrolling away, checks home/logo links, opens every program and community card, follows their Explore/Learn more links, verifies event details and archives, follows page CTAs and footer routes, and repeats navigation with animations active. It inventories links across 22 public club and Consulting pages, checks internal anchors and downloads, verifies the leadership login destination renders, and checks the four public forms without submitting responses.

Separate browser checks clicked the membership, consulting application, event RSVP, and mailing-list removal buttons and confirmed that each opened its intended Google Form. SVG and PNG download buttons produce the expected files. Email links remain `mailto:` actions; social links open external services. No external emails, applications, RSVP responses, or removal requests were submitted.

Run the audit against the local preview or production:

```sh
node scripts/audit-public-navigation.mjs http://127.0.0.1:5178 outputs/navigation-final
node scripts/audit-public-navigation.mjs https://ublda.org outputs/navigation-production
```

JSON evidence is retained in the ignored output folders. Release checks include the production build, ESLint, all 153 existing tests, and `git diff --check`. The four pre-existing generated Convex lint warnings and existing large-bundle warning are unrelated to this change.
