# Consulting navigation — September 21, 2026

Sam requested the navigation style of [Board of Innovation](https://www.boardofinnovation.com/) while retaining accessibility. Inspected the live reference at 1440px and 390px, including its mobile menu and scroll behavior.

The consulting header now shares the reference's spacious desktop row, vertically centered wordmark, small uppercase links and square outlined action. The mobile navigation is a compact charcoal panel beneath the header with centered rows. It scrolls internally on short screens. UBLDA's brand, application destination, parent-site link and subtle pause control are retained.

About uses an explicit disclosure button rather than opening on hover. It supports Space/Enter, normal link tabbing, Escape with focus return, blur dismissal and outside-pointer dismissal, following the [WAI disclosure navigation pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/). The mobile panel retains focus containment, background inertness, Escape dismissal and resize recovery. Targets remain at least 44px tall; high-contrast focus and forced-colors boundaries remain visible. Existing pause and reduced-motion settings cover the small chevron transition.

Verification extends `scripts/audit-scroll-behavior.mjs` with navigation interaction cases. Its optional fourth argument selects `/consulting` for focused checks; the default still checks both public sites. Desktop, phone, landscape and intermediate-width layout screenshots live in ignored `outputs/navigation/`.
