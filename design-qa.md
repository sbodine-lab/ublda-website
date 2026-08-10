# Decision Center font-reference QA

## Comparison target

- Source visual truth: `/Users/sambodine/.codex/visualizations/2026/08/10/019fe903-0592-75a0-be33-f4a9b2eacae5/decision-center-qa/font-reference.png`
- Browser implementation: `/Users/sambodine/.codex/visualizations/2026/08/10/019fe903-0592-75a0-be33-f4a9b2eacae5/decision-center-qa/iphone-brand-sans.png`
- Focused header crop: `/Users/sambodine/.codex/visualizations/2026/08/10/019fe903-0592-75a0-be33-f4a9b2eacae5/decision-center-qa/iphone-brand-sans-header.png`
- Combined comparison input: `/Users/sambodine/.codex/visualizations/2026/08/10/019fe903-0592-75a0-be33-f4a9b2eacae5/decision-center-qa/font-reference-comparison.png`
- Route and state: local mobile ballot, signed-in demo, no response selected.
- Browser viewport: `390 x 844` CSS pixels; document client width `382` pixels.
- Source pixels: `326 x 68`.
- Implementation pixels: full viewport `382 x 827`; focused crop `382 x 62`.
- Density normalization: native-pixel focused comparison. The source is a wordmark crop rather than a full screen, so letterform, weight, tracking, color, and rendering were compared; absolute wordmark size and copy were not treated as fidelity requirements.

## Full-view comparison evidence

The reference supplies typography only. The browser capture confirms the selected family is applied consistently across the complete ballot without horizontal overflow or a layout regression. The visible type scale resolves to exactly `14px`, `17px`, and `36px` at the tested viewport.

## Focused-region comparison evidence

The combined header comparison shows the implementation using the same geometric sans character as the reference: open counters, rounded `U` and `D`, restrained medium weight, navy color, and loose uppercase tracking. The implementation intentionally reads `UBLDA DECISIONS` rather than the source crop's `UBLDA` because it is the product lockup.

## Required fidelity surfaces

- Fonts and typography: Plus Jakarta Sans matches the reference and is already the UBLDA brand body family. Body uses weight 400; display and lockup use 500. The scale remains limited to three visible sizes.
- Spacing and layout rhythm: the font swap preserves the ballot's spacing and creates no horizontal overflow (`382 / 382`).
- Colors and visual tokens: navy text and cream background remain aligned with the source and existing brand tokens.
- Image quality and asset fidelity: the existing supplied UBLDA logo asset remains sharp and unchanged; no replacement drawing or generated asset was introduced.
- Copy and content: ballot copy is unchanged. `DECISIONS` is an intentional product-lockup addition.

## Comparison history

### Pass 1

- Finding: P1 typography mismatch. The implementation used Instrument Serif throughout, while the selected reference is a clean geometric sans.
- Fix: changed the Decision Center family to Plus Jakarta Sans, restored medium emphasis for display text and the logo lockup, and retained the three-size system.

### Pass 2

- Post-fix evidence: `font-reference-comparison.png` and `iphone-brand-sans.png`.
- No actionable P0, P1, or P2 differences remain for the selected font target.
- P3 intentional deviation: the app lockup is smaller and includes `DECISIONS`; the source is a cropped brand specimen, not a full app header specification.

## Functional verification

- Page identity: `UBLDA Decision Center` at the intended ballot route.
- Console: no warnings or errors.
- Responsive layout: no horizontal overflow at the iPhone viewport.
- Primary interaction: response selection remains functional and reveals the conditional proposal field.

final result: passed
