# Public website accessibility audit

Date: September 17, 2026. Target: WCAG 2.2 Level AA.

The release candidate passes the automated scans and interaction checks described below. The audit found and fixed issues that were not present in the initial automated scan results, particularly motion controls, keyboard access to profiles, and text reflow.

## Scope and method

The redesigned club pages are `/`, `/about`, `/events`, `/team`, `/join`, `/brand`, `/links`, and `/unsubscribe`. Regression scans also cover `/consulting`, `/consulting/practice`, `/consulting/leadership`, and `/consulting/contact`; the Consulting design and application are unchanged.

- axe-core 4.13 with WCAG 2.0 A/AA, 2.1 AA, 2.2 AA, and best-practice rules, in Chrome at 320px and 1440px: 24 page/viewport scans, no reported violations or document overflow.
- 63 interaction and layout checks: keyboard order and focus, skip navigation, motion controls, modal profiles, mobile navigation, program disclosures, carousel controls, event recaps, text spacing, and zoom reflow.
- Text spacing: line height 1.5, paragraph spacing 2em, letter spacing 0.12em, and word spacing 0.16em, across the eight club routes at 320, 768, 1024, and 1440px.
- Zoom reflow: 640×450 and 320×225 CSS viewports, equivalent to a 1280×900 viewport at 200% and 400% browser zoom. All club routes remain free of horizontal document scrolling.
- Manual source and browser review supplements automation for motion, readable animation states, focus visibility, content growth, image alternatives, landmarks, and disclosure behavior.
- Local browser results are retained under `outputs/accessibility-final/`. The scripts accept a base URL so the same checks can be repeated on the production alias.

## Findings resolved

| Finding | Related criteria | Resolution |
| --- | --- | --- |
| Automatic logo, sculpture, and marquee loops had only a device-level reduced-motion alternative. | 2.2.2 | Added a keyboard-accessible 44px pause control that persists the user's choice. It stops canvas and CSS motion; device reduced-motion preferences remain respected. |
| The opening state of the word reveal was too faint, and outgoing value copy faded. | 1.4.3 | Large word-reveal text now starts at a calculated 3.72:1 contrast against cream and resolves to 11.86:1. Value text remains opaque as panels overlap. |
| Team profiles appeared on hover/focus but did not provide a reliable keyboard path to the profile link. Mobile overlays could cover background controls. | 1.4.13, 2.1.1, 2.4.3, 2.4.11, 4.1.2 | Retained the desktop visual preview and added native named dialogs for activation. Focus enters the dialog, the LinkedIn link is reachable, and Escape restores focus to the originating person. |
| A full-screen mobile menu left the main content available behind it. | 2.1.2, 2.4.3 | Background main/footer content becomes inert while the menu is open. Escape closes the menu and restores trigger focus. |
| Client-side navigation and anchor changes did not consistently move keyboard focus. | 2.4.1, 2.4.3 | Added a focusable main target and explicit route/anchor focus handling. The skip link transfers focus to main. |
| Overflow containers could clip focus rings, and some secondary links had small target heights. | 2.4.7, 2.4.11, 2.5.8 | Added consistent visible focus rings, inset rings only for clipped card controls, scroll margins, and 44px heights for secondary navigation links. |
| Event calendar layouts overflowed at narrow widths with enlarged spacing. | 1.4.10, 1.4.12 | Constrained grid tracks, added short mobile month labels, and allowed text to wrap. |
| Fixed card and sticky-panel geometry could restrict growing text. | 1.4.4, 1.4.10, 1.4.12 | Expanded cards size to their content. Value sections use ordinary flow on mobile, short screens, reduced motion, and whenever their text becomes too tall for the viewport. |
| Join and Unsubscribe server redirects would bypass the reviewed pages. | Release parity | Removed those two redirects. The page buttons retain the existing membership and removal form destinations. |

## Other checks and applicability

The pages have English language metadata, descriptive titles, one main landmark and one h1 per route, named navigation, heading structure, meaningful link context, and existing alt text for informative logos. Decorative particles/sculptures are excluded from assistive navigation. The carousel has previous/next controls and does not require dragging. No audio, video with speech, flashing sequences, timed tasks, or authentication flow are introduced by this redesign. Event dates, remote-speaker disclosure, RSVP destinations, and calendar timezone are preserved.

The public club pages link to existing third-party membership, RSVP, consulting application, and removal forms. Those external services, authenticated leadership tools, and a full VoiceOver/NVDA interoperability review are outside this audit. Passing automated checks is not, by itself, a certification of full WCAG conformance. Future content and components should receive the same review.

## Repeat the checks

With the local preview running:

```sh
node scripts/audit-public-accessibility.mjs http://127.0.0.1:5178 outputs/accessibility-local
node scripts/audit-public-interactions.mjs http://127.0.0.1:5178 outputs/accessibility-local
npm run build
npm run lint
npm test
```

Replace the base URL with `https://ublda.org` for a live check. The browser harness bypasses CSP only in its isolated test context so it can inject axe and text-spacing overrides; production CSP configuration remains unchanged. Tests do not submit forms or send messages.

Release checks: production build passes; 153 existing tests pass; ESLint reports no errors and four pre-existing generated Convex warnings. A pre-existing large-bundle warning remains unrelated to the club redesign.

## Standards references

- [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- [Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)
