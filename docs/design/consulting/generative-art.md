# Consulting artwork — September 16, 2026

Sam requested replacing photographs of other people with brand-aligned art or shaders. All people photography is removed from the public consulting pages: the homepage study image, strategy/workplace photos on cards and service pages, and campus study panorama on Practice.

Original procedural SVG artwork replaces the photos:

- Perspective: overlapping orbital contours on the homepage.
- Strategy: a flowing ribbon of parallel curves.
- Accessibility: nested, open arches.
- Workplace: two interwoven families of curves.
- Practice: a panoramic wave field, cropped responsively on mobile.

The artwork uses the current Consulting navy/cobalt palette with parent-teal perspective contours, blue strategy ribbons, light-blue accessibility arches, restrained iris workplace weave, and blue/teal practice waves. See subbrand-palette.md for the current identity. Vectors stay sharp at any resolution. It is decorative and hidden from assistive technology; meaningful adjacent headings and link names remain. Partner marks retain their own colors. The hero and callout canvas keep their geometry and motion; their endpoints follow the current palette.

Slow CSS transforms animate only when artwork is in view and the tab is visible. The footer Pause motion control pauses all art, and reduced-motion preferences disable these animations. There are no new dependencies, remote assets, or image-generation services.

Chrome review covered desktop compositions, mobile Practice crop, all 14 consulting routes at 390px (no horizontal overflow; no people-photo elements), keyboard-focused service-card descriptions, offscreen pause, global pause, and reduced motion. Existing stock photo files remain unreferenced historical assets; they are not loaded by the consulting pages.
