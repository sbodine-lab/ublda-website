# UBLDA Consulting — service-division identity

## Current direction — September 21, 2026

Sam requested more consistent colors and a closer match to the original Board of Innovation reference. Live reference inspection confirmed electric blue `#0A0AE5`, charcoal `#0D1319`, off-white `#F9F7F7`, dark text `#11262B`, and pale-blue emphasis `#CDDAFF`. These now define the consulting palette. The parent UBLDA website keeps its existing identity.

The hero, callout bands, primary buttons, illustration gradients, program cards, leadership artwork, and footer share those roles. There are no separate hero blue endpoints, teal illustration palettes, or purple service palettes. The consulting wordmark uses charcoal/dark text for UBLDA and electric blue for CONSULTING, with its existing geometry and full-name lockup preserved.

The homepage follows the reference composition more closely: a headline and actions over animated bands, a centered statement, three large light cards over a stepped background, an illustration/text split, large service cards, a full-width callout, and client/team sections. The three cards describe program stages, not fabricated performance metrics. UBLDA facts and application destinations remain intact. Mobile layout, 30fps decorative canvas painting, pause, reduced motion, and offscreen suspension are preserved.

Verification: build and 163 tests pass; lint has zero errors and four existing generated-code warnings. All fourteen consulting routes pass automated accessibility, horizontal-overflow, and shared-palette checks at 320px and 1440px. Phone/tablet/landscape interaction checks and screenshot review supplement those scans. This is browser emulation, not physical-device testing.

## Historical direction — September 16 (superseded palette)

September 16, 2026. Supersedes Ink & Persimmon after Sam rejected red and requested a clearer subbrand relationship, a new wordmark, and colors grounded in professional brand-architecture practice.

## Architecture and positioning

Use the parent-name + service-name model: **UBLDA Consulting**. This is a specialized division of UBLDA, not an independent organization and not a Ross institutional unit. Retain the recognizable UBLDA name, parent navy, teal and warm white. Distinguish the division through cobalt accents, a typographic wordmark, clear service language, and its established abstract art/motion system.

Its scope has two sides: business strategy for organizations with a disability mission, and accessibility-related consulting for companies across industries, including corporate accessibility teams, products, services and workplaces. State that it is student-led and pro bono. Do not imply certification, legal compliance guarantees or professional credentials the team has not established.

## Evidence and design judgment

- IBM's identity guidance describes consistent relationships between the master identity and business-unit/service logotypes: https://www.ibm.com/design/language/ibm-logos/8-bar/
- IBM's brand-expression guidance identifies IBM Consulting among related brands and says the systems work as parts of a greater whole: https://www.ibm.com/design/event/brand-expression/
- Virginia Tech's architecture distinguishes closely connected named extensions from more independent subbrands, demonstrating why the relationship should drive the identity: https://brand.vt.edu/architecture.html
- IBM Carbon separates dominant neutral surfaces, a primary action color, purposeful supporting colors, and light/dark themes: https://carbondesignsystem.com/elements/color/overview/
- Contrast criteria: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

These are precedents and principles, not rules governing UBLDA. Our recommendation is a closely connected service-division identity. No source prescribes an objectively correct consulting hue, and no universal rule requires a new symbol for every division. A separate icon would add an identifier stakeholders must learn; the UBLDA Consulting name already communicates the relationship and specialization.

## Wordmark

The header uses an original stacked type composition: UBLDA in DM Sans Bold, CONSULTING in a smaller, tracked DM Sans Semibold (650). Both lines remain together at their designed proportions. There is no parent pictorial mark, Block M, Ross mark, or new independent icon in this identity.

Outlined SVG assets (no font dependency):
- public/consulting/logos/consulting-wordmark-color.svg — parent navy + cobalt on light backgrounds.
- public/consulting/logos/consulting-wordmark-white.svg — warm white on dark backgrounds.

The website reverses the same artwork to white over the hero. Keep surrounding clear space of at least one quarter of the wordmark height, with more where possible; do not compress or stretch it. Website width is 116px on desktop and 104px on mobile. The public /brand page previews and offers both assets. Regenerate from the existing fonts using scripts/design/generate-consulting-wordmark.py (fontTools required).

Keep the visible UBLDA home link to the parent website. Campus affiliation and OCCB partnership remain text only. The parent organization keeps its existing logo and palette.

## Color roles

| Role | Hex | Use |
| --- | --- | --- |
| UBLDA navy | #0A3658 | Main text and the parent name in the wordmark |
| Parent teal | #67B8B3 | Selected artwork, connecting to UBLDA |
| Cobalt | #3559A8 | Consulting action/link/emphasis color and service name |
| Deep navy | #092C49 | Footer, dark service pages, shader shadows |
| Warm white | #FAF9F6 | Main reading surface and reversed text |
| White | #FFFFFF | Client and metric panels |
| Stone | #EEEFED | Neutral supporting surfaces |
| Ice blue | #E0E8FF | Highlights, light buttons, inverse focus rings |
| Blue gray | #E5EAF4 | Research bands and light artwork surfaces |
| Muted text | #59616B / #C1C8D2 | Secondary text on light / dark |
| Shader endpoints | #385B9E → #092C49 | Blue to parent-related navy |

Avoid the previous full-site teal tint and all red/persimmon/peach treatments. Light and dark areas have distinct jobs. White metric panels stay separate from the page; client information uses an open two-column section with each logo paired directly with its description; service artwork varies across cobalt ribbon, pale-blue arches and restrained iris weave. Teal appears in the perspective and practice art. It is not applied to every surface.

## Motion and verification

No changes to band geometry, 6.59-second phase timing, 720ms column delay, scroll behavior, pause controls or reduced-motion behavior.

Calculated color contrast: cobalt/warm white 6.34:1; cobalt/stone 5.79:1; muted text/stone 5.44:1; navy/ice blue 10.20:1; white text over brightest shader endpoint 6.32:1; ice-blue text over that endpoint 5.43:1; muted light text/deep navy 8.49:1. RGB interpolation between the shader endpoints stays within those luminance bounds.

Chrome QA includes desktop and mobile visual review, the wordmark on light/dark backgrounds, layout at responsive breakpoints, all consulting routes, flat-background text contrast and parent-site navigation. Flat-background checks exclude artwork overlays and canvas, which need separate visual and endpoint checks; this is not a full accessibility audit.

September 16 refinement: Sam requested a smaller, firmer wordmark and removal of the blue-topped client panel. The revised wordmark uses heavier outlined lettering; the client section has no enclosing card or border. Bold/semibold sources are static instances of the official Google Fonts DM Sans variable font (opsz 14, weights 700/650), distributed under public/consulting/OFL-wordmark.txt.
