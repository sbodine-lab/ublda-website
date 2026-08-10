# Decision Center navigation-font QA

## Comparison target

- Source visual truth: the supplied UBLDA desktop-navigation screenshot.
- Browser implementation: `/Users/sambodine/.codex/visualizations/2026/08/10/019fe903-0592-75a0-be33-f4a9b2eacae5/decision-center-qa/iphone-plus-jakarta-final.png`.
- Route and state: local mobile ballot, signed-in demo, no response selected.
- Browser viewport: `390 x 844` CSS pixels; captured ballot client width `347` pixels.
- Reference pixels: `2048 x 198`; implementation capture: `347 x 783`.
- The comparison judges font family, optical weight, tracking, and readability rather than identical composition.

## Full-view comparison evidence

The screenshot's navigation and sign-in control use Plus Jakarta Sans. The form system now uses that same clean sans family everywhere, including headings. It retains exactly three visible sizes (`14px`, `17px`, `36px`) and creates no horizontal overflow (`347 / 347`).

## Focused-region comparison evidence

Reference values verified from the live UBLDA navigation:

- Navigation and controls: Plus Jakarta Sans, `17px`, weight `400`.
- Small labels: Plus Jakarta Sans, `14px`, weight `500`.
- Form display headings: Plus Jakarta Sans, `36px`, weight `500`.

All ballot text now uses the reference family. Weight and size provide hierarchy without introducing a second typeface.

## Required fidelity surfaces

- Fonts and typography: Plus Jakarta Sans handles headings, body, controls, metadata, and the logo lockup. Weights remain `400` and `500`.
- Spacing and layout rhythm: the all-sans system preserves the mobile layout and fits the viewport without clipping.
- Colors and visual tokens: navy text, cream background, teal accents, and muted supporting copy remain aligned with the live site.
- Image quality and asset fidelity: the supplied UBLDA logo asset remains unchanged and sharp; no replacement drawing or generated asset was introduced.
- Copy and content: ballot copy is unchanged. `UBLDA DECISIONS` remains the intentional product lockup.

## Comparison history

### Pass 1

- Finding: P1 mismatch. Applying Instrument Serif to every text element did not match the UBLDA system.
- Fix: moved body and UI copy to Plus Jakarta Sans.

### Pass 2

- Finding: P1 mismatch after checking the live site. The all-sans treatment matched the cropped wordmark but not the website's main heading system.
- Fix: copied the live `ublda.org` roles directly: Instrument Serif headings plus Plus Jakarta Sans body and controls.

### Pass 3

- Post-fix evidence: `live-font-system-comparison.png` and `iphone-live-type-system.png`.
- The mixed system matched the complete live homepage at that point in the review.

### Pass 4

- Finding: the mixed serif/sans system was faithful to the complete live homepage, but the user selected the simpler navigation type as the form-system reference.
- Fix: applied Plus Jakarta Sans across every Decision Center surface, including headings, while preserving the three-size scale.
- Post-fix evidence: `iphone-plus-jakarta-final.png`.
- No actionable P0, P1, or P2 typography differences remain.

## Functional verification

- Page identity: `UBLDA Decision Center` at the intended ballot route.
- Console: no warnings or errors.
- Responsive layout: no horizontal overflow at the iPhone viewport.
- Primary interaction: response selection remains functional and reveals the conditional proposal field.

final result: passed
