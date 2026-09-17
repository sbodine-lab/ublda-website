# Scrolling and loading — September 17, 2026

Both public sites keep browser-native wheel, trackpad, touch, keyboard and scrollbar input. Same-page links now use native smooth scrolling, which can be interrupted or replaced by a later destination. New pages, initial deep links and reduced-motion navigation arrive immediately. No extra wheel interception, synthetic touch inertia or second animation clock was added.

The club's short reveals now move 24px over 650ms with a gentler settling curve. Consulting reveals settle in 700ms instead of 1250ms, with 22px of movement; text remains visible during the entrance. Existing white flock artwork, hero-logo formation, sticky values and brand design are preserved.

## Rendering changes

- Club header geometry is measured before style changes. Transform variables live on the wordmark rather than being inherited by the whole website. Section queries are cached and header state changes only when necessary.
- Sticky-value geometry is read in one batch; opacity writes are localized and skipped when unchanged.
- Event recap height changes request a safe ScrollTrigger refresh. Hover/child transitions no longer trigger full refreshes.
- The hero logo reuses the finished canvas during its solid hold; its subtle transform continues without repainting the same image.
- Consulting band colors are precomputed, its retina framebuffer is capped at 1.5x, and its clock pauses offscreen or in a hidden tab. Returning or resuming preserves the animation phase.
- Removed the Consulting scroll handler for a retired metrics section. Reveal observers are cleaned up without replaying completed entrances when motion resumes.

[GSAP's ScrollTrigger documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) informed the refresh and animation lifecycle review.

## Loading changes

The retired homepage and recruiting-table page are loaded only on their own routes. The recruiting shader library is no longer part of the public entry download. Public club and Consulting routes use their local fonts without requesting unused Google font families; workspace and other legacy routes still load their font stylesheet when needed.

A cold-context comparison of production builds served from the same local preview measured encoded JavaScript bodies:

| Page | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Club homepage | 190,984 bytes | about 149,870 bytes | 21.5% |
| Consulting homepage | 135,168 bytes | about 93,742 bytes | 30.6% |

The final cleanup removes a few more bytes of unused code. These are downloaded JavaScript comparisons, not claims of equivalent improvements in total load time. Six scenarios cover desktop, emulated touch and reduced motion for both homepages. Layout shifts remained below 0.01. Style-recalculation time improved in the sampled normal-motion runs, but those timing values are machine-specific. This browser session delivered frames at roughly 30Hz, so the run does not establish 60/120Hz behavior or real-device field performance.

## Validation

- Production build, ESLint and 153 existing tests; four pre-existing generated Convex lint warnings remain.
- 148 public navigation checks across desktop/mobile, normal/reduced motion and 22 public pages, with no page errors.
- 44 targeted checks covering intermediate smooth-scroll positions, rapid destination changes, canvas visibility/pause/resume, local-font loading, lazy shader loading, reduced motion, overflow and four axe scans.
- Visual review of the club story/hero boundary and Consulting bands/statement boundary.

Scripts accept a base URL and output directory:

```sh
node scripts/audit-public-navigation.mjs http://127.0.0.1:5180 outputs/motion-navigation-local
node scripts/audit-scroll-behavior.mjs http://127.0.0.1:5180 outputs/scroll-behavior-local
node scripts/audit-scroll-performance.mjs http://127.0.0.1:5180 outputs/scroll-final
```

Repeat navigation and behavior checks against https://ublda.org after deployment. JSON evidence and screenshots are retained under ignored outputs. Existing broad accessibility reports remain in this directory and docs/accessibility; this follow-up is not a formal accessibility certification.
