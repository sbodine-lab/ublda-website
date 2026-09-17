# Equator reference / UBLDA local preview

Local URL: http://127.0.0.1:5178/
Values sequence: http://127.0.0.1:5178/#what-we-stand-for
Homepage events: http://127.0.0.1:5178/#events
Event archive: http://127.0.0.1:5178/events#past-events
Branch: codex/equator-local-redesign

The redesign was initially prepared locally on September 17, 2026. Sam subsequently authorized a WCAG audit, fixes, and production release. See [the accessibility audit](ACCESSIBILITY-AUDIT.md) for scope, findings, verification, and remaining assessment limits.

## Run

From this worktree:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5178 --strictPort
```

## Scope

The public club routes `/`, `/about`, `/events`, `/team`, `/join`, `/brand`, `/links`, and `/unsubscribe` use the new isolated page shell. Consulting, its subpages, authenticated operations, event signup tools, and APIs keep their existing implementations. The separate Consulting release #128 was incorporated by a fast-forward during this task; the redesign does not alter its source or global style tokens.

## Reference and motion

Reference: https://equatorcompany.com/#what-we-stand-for

Inspected at 1440 × 1000 and 390 × 844. The reference has one main scrolling page and a privacy utility page, rather than separate marketing subpages. UBLDA subpages extend the same visual system.

- Full-height cream opening: brand-color particles assemble into the intact official logo in 2.7 seconds, hold with a subtle dimensional tilt, and release into a flowing wave. The flock and official SVG artwork are composited on one canvas with a smooth premultiplied blend, avoiding a final renderer swap, edge doubling, and a brightness dip. Particle drift and shimmer settle as the mark resolves; tilt begins after a 350ms rest. No surrounding orbit or circle. Wordmark moves to the top and scales from 36px to 24px on desktop.
- National typefaces, 50px desktop/20px mobile margins, 96px desktop/52px mobile hero typography.
- Full-screen title with a white particle flock sampled from UBLDA’s actual logo. Feather-like flecks ripple between the mark and a wave, recreating the reference bird's flowing texture. Separated from the headline on desktop and placed in its own row on mobile.
- Scroll-linked story text with staggered word opacity.
- Five sticky value panels on roomy desktop viewports, with opaque backgrounds and a position counter. Mobile, short viewports, reduced motion, and text that grows beyond the viewport use ordinary stacked sections so copy cannot be obscured. `ValueSculpture.tsx` supplies a consistent family of animated contour ribbons: a continuous band, converging folds, open pages, opposing apertures, and woven strands.
- Two-column expanding program cards with semicircle controls.
- Horizontal community carousel with expanding detail panels, custom editorial artwork using real club/partner marks, aligned controls, and moving partner logos.
- Homepage events area after the community section: teal upcoming-event feature with a large navy calendar treatment, followed by two expandable past fireside-chat recaps on gold. An Events link in the main navigation and section links lead to the complete `/events` page.
- The Events page carries forward the previous website's one confirmed upcoming conversation and four past listings, including BLDA hosting/member-attendance attribution. It preserves the RSVP, October 1 7–8pm Eastern calendar entry, and in-person audience/remote Microsoft speaker disclosure. The old page and new sections share `src/lib/events.ts`; no additional dates or events were invented. Recaps expand with native keyboard-accessible disclosure controls, a restrained height transition, and a reduced-motion alternative.
- Interactive leadership list using existing member names, roles, and initials, with a desktop hover preview and a named modal for activation by mouse, touch, or keyboard. No invented portraits.
- Animated closing section and large brand footer.
- Mobile menu with an inert background, route/anchor focus handling, keyboard controls, a persistent pause-motion control, and reduced-motion alternatives.
- Unnecessary hero eyebrows, opening microcopy, editorial card captions/taglines, partner-strip caption, and numbered join labels removed. Essential event details, roles, application status, form guidance, and action labels remain.
- Sam's branding correction: below the opening logo, introduce UBLDA and its mission first, then state affiliation with the Stephen M. Ross School of Business. No Ross or Block M logos in website content. Removed the Ross mark from the story and partner strip, and Ross/OCCB marks from the legacy homepage implementation. BLDA’s separate logo contains no Block M and remains.
- Name usage: introduce the organization as “Undergraduate Business Leaders for Diverse Abilities (UBLDA)” in the opening, About introduction, and footer. Use “UBLDA” in navigation, buttons, and later mentions; retain the program name “UBLDA Consulting.”

The National fonts are local copies of publicly served reference assets under `public/equator-local/`, sourced from `https://equatorcompany.com/national-2-{regular,medium}.woff2`. Unused reference videos and animation data were moved to the ignored `outputs/equator-reference/` folder and are excluded from the release. Decorative motion uses brand-specific SVG/CSS and a custom canvas flock in `ParticleLogo.tsx`. The opening animation targets 60fps; white flocks target 30fps. Both pause outside the viewport and when the tab is hidden, and render static artwork with reduced motion. Logo artwork is the existing UBLDA SVG. Generic stock card imagery was replaced with club and partner artwork. No invented portraits are used.

Club copy draws on current public source and Brain records #349 (founding and BLDA relationship), #308 (Microsoft event), and the current event/leadership records in the repository. Form destinations and application timing retain the canonical source constants.

## Verification

- Production build passes.
- Existing test suite: 153 passed.
- ESLint: no errors; four pre-existing generated Convex unused-disable warnings.
- Route checks at desktop, tablet, and phone sizes: no horizontal document overflow, no broken images, no browser page errors.
- Program accordion, mobile menu, Escape dismissal, all carousel positions, team profile open/close, and reduced motion checked.
- Refinement pass: larger clear-background official logo, separated hero graphics, consistent card baselines, visible team roles, and phone-specific card heights. Expanded cards checked for heading/body overlap at 320, 390, 900, and 1440px.
- Axe checks use reduced motion to measure settled readable content rather than intentionally transitioning reveal frames. Reports and screenshots are in `outputs/equator-local/`.
- Events addition: checked homepage and Events page at 320, 390, 768, 800, 920, 1024, and 1440px with no horizontal overflow or navigation overlap. Confirmed calendar contents and RSVP destination, mobile menu navigation, keyboard recap toggles, and animated disclosure sizing. Axe reports no WCAG A/AA findings on the homepage/events page at 390 and 1440px.

This is a close visual and behavioral recreation with adapted content and branding, not a pixel-diff identity claim: page lengths change with club copy, UBLDA has nine team members, and its logo geometry differs from Equator’s.
