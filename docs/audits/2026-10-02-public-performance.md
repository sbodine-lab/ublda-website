# Public website performance and routing fixes

Scope: the club website and UBLDA Consulting. Baseline: `d9247d42bf332744af0774c20e38c9b30292624e`.

## Findings and changes

- `/about/`, `/events/`, and other public URL variants bypassed the current club shell and rendered retired pages. Public paths now normalize trailing slashes and capitalization while retaining query strings and fragments. Workspace routes and their identifiers are unchanged.
- Consulting downloaded two TrueType fonts totaling 143,764 bytes. The same fonts in WOFF2 total 55,568 bytes, a 61.3% reduction. Conversion retained every character, glyph outline, and advance width; the existing font license remains in `public/consulting/OFL.txt`.
- Four lower-page club logos downloaded immediately, totaling 63,326 bytes. Native lazy loading now defers them until readers approach the sections, including duplicate uses in the story cards.
- The club value panels and ribbon measured their geometry during scroll even while offscreen. Those animation measurements now stop outside the viewport and resume on entry.
- The partner carousel ran continuously outside the viewport. It now pauses when offscreen or the tab is hidden, while retaining hover, user-pause, and reduced-motion behavior.

## Verification

`scripts/audit-public-performance-regressions.mjs` checks the two viewport sizes (390 and 1440 pixels), deferred logo loading, visible image completion, carousel pause/resume, zero offscreen panel measurements, ribbon re-entry, motion pause, eight canonical URL variants with preserved query/fragment, and uncached font downloads below 60 KB. It saves measurements and screenshots.

The existing scrolling, navigation, and accessibility audits cover the rendered public routes. Build, lint, and the 171-test suite are release gates. Four existing lint warnings are confined to generated Convex files.

These are controlled browser checks and measured asset savings, not a claim about real-user Core Web Vitals or a guaranteed load-time improvement on every device.
