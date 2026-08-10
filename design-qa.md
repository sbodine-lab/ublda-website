# Decision Center live-type-system QA

## Comparison target

- Source visual truth: `https://ublda.org/`, rendered in the in-app browser.
- Source capture: `/Users/sambodine/.codex/visualizations/2026/08/10/019fe903-0592-75a0-be33-f4a9b2eacae5/decision-center-qa/ublda-live-home-mobile.png`
- Browser implementation: `/Users/sambodine/.codex/visualizations/2026/08/10/019fe903-0592-75a0-be33-f4a9b2eacae5/decision-center-qa/iphone-live-type-system.png`
- Combined comparison input: `/Users/sambodine/.codex/visualizations/2026/08/10/019fe903-0592-75a0-be33-f4a9b2eacae5/decision-center-qa/live-font-system-comparison.png`
- Route and state: local mobile ballot, signed-in demo, no response selected.
- Browser viewport: `390 x 844` CSS pixels; ballot client width `382` pixels.
- Source pixels: `719 x 880`; implementation pixels: `382 x 827`.
- Density normalization: the source capture was downsampled to `382px` width with Lanczos resampling before the side-by-side comparison. The comparison judges the typography system rather than identical page composition.

## Full-view comparison evidence

The live site uses a mixed brand system: Instrument Serif for headings and Plus Jakarta Sans for body and controls. The ballot now reproduces that same division, the same three visible sizes (`14px`, `17px`, `36px`), and the same regular optical weight. The font change creates no horizontal overflow (`382 / 382`).

## Focused-region comparison evidence

Computed live-site values:

- Body and navigation: Plus Jakarta Sans, `17px`, weight `400`, normal tracking.
- Page headings: Instrument Serif, `36px`, weight `400`, `-1.08px` tracking.
- Small navigation text: Plus Jakarta Sans, `14px`, weight `500`.

Computed ballot values match those family, size, weight, and tracking roles. Ballot section headings use Instrument Serif at the `17px` body tier to preserve the requested three-size limit.

## Required fidelity surfaces

- Fonts and typography: exact live families are reused. Instrument Serif handles headings; Plus Jakarta Sans handles body, controls, metadata, and the logo lockup. Weights remain `400` and `500`.
- Spacing and layout rhythm: the mixed system preserves the mobile layout and fits the viewport without clipping.
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
- No actionable P0, P1, or P2 typography differences remain.
- P3 intentional deviation: ballot section headings use the serif family at `17px`; making every heading `36px` would break the requested three-tier hierarchy and increase mobile density.

## Functional verification

- Page identity: `UBLDA Decision Center` at the intended ballot route.
- Console: no warnings or errors.
- Responsive layout: no horizontal overflow at the iPhone viewport.
- Primary interaction: response selection remains functional and reveals the conditional proposal field.

final result: passed
