# Consulting accessibility audit — September 17, 2026

Target: WCAG 2.2 Level AA. Scope: the public UBLDA Consulting website and its shared navigation, motion controls, footer, service cards, insights filters, and inquiry form.

## Pages reviewed

Fourteen routes: `/consulting`, `/consulting/work`, `/consulting/practice`, `/consulting/services`, all three service detail pages (strategy, accessibility, workplace), `/consulting/leadership`, `/consulting/partners`, `/consulting/contact`, `/consulting/insights`, and all three published insight articles. The club homepage's decorative dot was also removed as requested.

## Findings and changes

| Finding | Criteria | Change |
| --- | --- | --- |
| The Insights index skipped from its h1 to card h3 headings. | 1.3.1 | Its article cards now use h2 headings, while cards below section headings on other pages retain h3. |
| The motion pause state reset across routes and reloads; its only control was at the bottom of the page. | 2.2.2 | Added a 44px header control and persistent preference shared with the club site. Canvas bands, decorative SVG motion, entry transitions, and metric movement respect it. Device reduced-motion settings remain authoritative. |
| Reveal animations made text temporarily transparent. | 1.4.3 | Text stays opaque while the entrance translation plays. Paused and reduced-motion views show content immediately. |
| Dismissing About from a submenu link could leave focus on a hidden element. Hover-opened content also needed a reliable Escape path. | 1.4.13, 2.1.1, 2.4.3 | Escape restores the About trigger when focus is inside the submenu. Escape also dismisses hover-opened content, focus leaving closes it, and nested Escape preserves the outer mobile menu. |
| Client-side page changes did not consistently place keyboard focus at the new content. | 2.4.1, 2.4.3 | Main is focusable, skip navigation transfers focus, and route/anchor changes explicitly focus the destination. Header DOM order matches its visual order. |
| Service-card titles disappeared on hover/focus and fixed overlapping text geometry could restrict enlarged copy. | 1.4.4, 1.4.10, 1.4.12 | Titles and descriptions remain visible together over a dark gradient. Cards grow with their content and have inset keyboard focus rings that stay visible. |
| Secondary links and controls had small targets. | 2.5.8 | Footer, dropdown, filter, text-link, parent-site, menu, and motion targets have at least 44px height. |
| Contact fields did not visibly distinguish required and optional inputs. | 3.3.1, 3.3.2 | Added visible requirement labels, linked the email-draft instructions to the form, retained native required/email validation, and kept the preparation status region mounted. |
| Filter changes did not announce the number of results. | 4.1.3 | Added a named filter group and a polite result-count status. |

## Verification

- axe-core 4.13: 28 scans across the 14 routes at 320px and 1440px with reduced motion, using WCAG 2.0 A/AA, 2.1 AA, 2.2 AA, and best-practice rules. No reported violations or page errors after the fixes. The baseline reported the Insights heading-order issue at both widths.
- An additional axe scan checks the homepage with normal motion and a service card focused by keyboard.
- All 112 interaction and layout checks pass. They cover skip navigation, route focus, stored motion preference, frozen canvas output, device reduced motion, About disclosure behavior, mobile focus trapping and Escape, service-card focus/visibility, insight filtering, contact validation, and removal of the club hero dot.
- Text-spacing overrides use line height 1.5, paragraph spacing 2em, letter spacing 0.12em, and word spacing 0.16em across all 14 routes at 320, 768, 1024, and 1440px. Checks include off-screen text/control bounds and overlapping header controls, not only document scroll width.
- Reflow is checked at 640×450 and 320×225 CSS viewports, equivalent to a 1280×900 viewport at 200% and 400% zoom.
- Desktop and mobile screenshots supplement automation. Source review covers readable canvas/color states, meaningful text alternatives, landmarks, semantic headings, native form validation, and keyboard access. Decorative art is hidden from assistive navigation. The site introduces no spoken media, flashing sequences, timed tasks, or drag-only interactions.
- Production build and all 153 existing tests pass. ESLint reports no errors and four pre-existing generated Convex warnings. The existing large-bundle warning is unrelated to this change.

Scripts accept a base URL and output folder:

```sh
node scripts/audit-consulting-accessibility.mjs http://127.0.0.1:5178 outputs/consulting-final
node scripts/audit-consulting-interactions.mjs http://127.0.0.1:5178 outputs/consulting-final
```

The same scripts are repeated against `https://ublda.org` after deployment. JSON results and screenshots are retained in ignored `outputs/consulting-final/` and `outputs/consulting-production/`. The isolated test browser bypasses CSP to inject axe and text-spacing overrides; the site's production security policy is unchanged. No valid inquiry submission, email draft launch, application submission, or external message is performed by these tests.

## Limits

This is a scoped engineering audit, not a formal certification of complete WCAG conformance. External application/membership forms and email applications, authenticated leadership tools, and full VoiceOver/NVDA interoperability testing are outside this review. Future content and component changes need the same checks.

## Standards

- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- [Content on Hover or Focus](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html)
- [Text Spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html)
