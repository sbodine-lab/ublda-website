# Consulting subbrand palette — September 16, 2026

The live parent site uses navy #0A3658, logo teal #67B8B3, and cream #FAF9F6. Consulting retains the parent navy and cream, leads with a deeper, slightly bluer teal, and uses mint and mist for supporting surfaces. The existing sans-serif typography and band geometry provide additional distinction. Gold stays within the parent logo rather than becoming another large surface color; this also respects Sam's earlier dislike of a gold footer.

| Role | Color |
| --- | --- |
| Accent: links, buttons, emphasis, metrics | #126A70 |
| Ink: primary text | #0A3658 |
| Dark: footer and service pages | #07263E |
| Paper: page backgrounds | #FAF9F6 |
| Mint: large hero highlights and CTA background | #C8E8DF |
| Mist: secondary surfaces | #E4EEEA |
| Logo teal: decorative bands and accents | #67B8B3 |
| Shader endpoints | #14777B → #07263E |

The canvas reads its two endpoint colors from CSS. The 22 bands, 6.59-second cycle, 720ms column delay, responsive columns, visibility pause, and reduced-motion behavior are unchanged. Metric and footer bands now derive from the same CSS palette. Partner logos and photography retain their own colors.

## Verification

Contrast: accent/cream 6.01:1; navy/mint 9.55:1; cream against the brightest shader band 5.04:1; large mint hero text against that same band 4.06:1. Interpolated shader colors remain inside these brightness bounds. Light focus rings are used on dark surfaces; the light dropdown retains the dark teal ring.

Chrome review: desktop hero, metrics, dark services, mobile hero/menu/contact; all 14 consulting routes at 390px without horizontal overflow. Computed flat-background text checks found no failures (the transparent homepage header is over canvas and was verified against the shader endpoint separately). Reduced-motion rendering verified. Production build, existing tests, and lint are release checks. Palette usage and current DM Sans typography are also documented at /brand.
