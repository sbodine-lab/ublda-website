# UBLDA Consulting — Ink & Persimmon

September 16, 2026. This supersedes the earlier teal/mint consulting palette after Sam found it too blended and monochromatic.

## Design rationale

Retain UBLDA navy (#0A3658) and warm paper (#FAF9F6) as the family connection. Give Consulting a warm persimmon action color and a darker, less blue ink. Use mostly neutral reading surfaces, deliberate light/dark section changes, and limited warm accents. Keep the parent logo and parent site palette intact. The parent teal survives in the workplace illustration rather than coloring every surface.

The professional precedent is a color system with explicit roles, not a claim that any one hue is objectively more professional. IBM Carbon uses dominant neutrals, a consistent primary action color, purposeful additional colors, and light/dark contrast moments. IBM Design Language likewise lets supporting colors gain impact against a restrained core. This design applies those principles to UBLDA's own identity.

Sources:
- https://carbondesignsystem.com/elements/color/overview/
- https://www.ibm.com/design/language/color/
- https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html

## Palette and allocation

| Role | Color | Application |
| --- | --- | --- |
| Parent navy | #0A3658 | Primary text, research bands |
| Ink | #141F2E | Dark service pages, footer, shader shadows |
| Paper | #FAF9F6 | Main reading surface |
| White | #FFFFFF | Metric cards and client panel |
| Stone | #EEECE7 | Secondary neutral surfaces |
| Persimmon | #B63E26 | Actions, links, emphasis and selected states |
| Peach | #FFDDCC | Highlights and focus rings on dark backgrounds |
| Blue gray | #DCE4F1 | Research transitions and accessibility artwork |
| Parent teal | #67B8B3 | Workplace artwork only |
| Muted text | #59616B / #C1C8D2 | Secondary text on light / dark backgrounds |
| Shader | #AD3C24 → #141F2E | Warm/cool contrast; existing geometry and timing |

## Page rhythm

The homepage moves from warm animated hero to paper, cool research bands with white cards, a blue orbital illustration, three distinguishable service artworks, a warm callout, and a white client panel with a narrow persimmon rule. The footer settles into ink. This avoids simply swapping every teal area for orange.

Artwork stays original vector geometry: copper strategy ribbons, blue arches on a light ground for accessibility, parent-teal workplace weave, cool blue perspective contours, and warm/cool practice waves. Do not use artwork colors for unlabeled status or category meaning; service titles remain explicit.

Keep existing font families, layout, shader geometry, scroll timing, pause behavior and reduced-motion support. The shader still uses 22 bands, a 6.59-second cycle and 720ms column delay. No new dependencies, stock photos, or image downloads.

## Verification

Color-pair calculations: persimmon/paper 5.38:1; persimmon/stone 4.80:1; muted text/stone 5.31:1; paper/brightest shader endpoint 5.78:1; secondary light text/ink 9.85:1. Peach was lightened to #FFDDCC so even normal text exceeds 4.5:1 against the brightest shader endpoint. Interpolation between shader endpoints remains bounded by those endpoint luminances.

Chrome: all 14 consulting routes at 390px without horizontal overflow. Computed text colors on flat backgrounds passed the applicable 4.5:1 or 3:1 threshold. This targeted check excludes canvas, gradients, and artwork overlays, which receive separate visual and endpoint checks; it is not a full accessibility audit. Desktop hero, service cards and section transitions visually reviewed. Existing motion and geometry were not changed.
