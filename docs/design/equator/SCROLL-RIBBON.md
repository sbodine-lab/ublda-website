# Scroll ribbon artwork

September 17, 2026. Replaces the boxed outline icons with original procedural 3D artwork.

## Reference research

Live Equator site https://equatorcompany.com/ was inspected visually and through public browser resources. Its bird is `/bird_low.mp4`, its closing cloud is `/cloud_low.mp4`, and its value illustrations are `/lottie/{sustainability,global,grounded,curiosity,difference}.lottie`. The player is `@lottiefiles/dotlottie-web` 0.54.1. The player is open source (MIT); no reusable license for the specific bird/video or value artwork was found. None of that media or animation data was copied into this implementation.

Open-source options evaluated:
- dotLottie Web: https://github.com/LottieFiles/dotlottie-web — MIT player, suitable for authored vector animations.
- Three.js: https://github.com/mrdoob/three.js — MIT renderer, selected for real 3D shading and continuous scroll morphs.
- particle-morph: https://github.com/mmdalipour/particle-morph — MIT particle morphing approach; adds React Three Fiber and particle-heavy aesthetics, not needed for the ribbon.
- MisterPrada/morph-particles: https://github.com/MisterPrada/morph-particles — relevant scroll/GPU experiment, but no license file was found in the displayed repository listing. Not used.

## Visual meaning

One persistent Three.js canvas begins with opening pages in the hero, becomes intertwined paths in the story margin, and follows the values section. Three related sheets transform into an open arch (inclusion), converging/interwoven paths (different experiences and shared purpose), unfolding pages (learning), facing arcs (listening/dialogue), and a bridge (community carried forward). Geometry and choreography are original; no stock icon silhouettes or decorative boxes remain.

The sculpture has ivory faces and teal shading. The panels retain their existing headings and copy. On phones the artwork stays in its allocated space above each heading; it does not travel over text. On wide desktops it follows the story's existing left margin and rises along that margin while morphing between value panels.

## Implementation boundaries

Three.js is dynamically imported when the artwork enters view. One WebGL context serves hero/story/values on the homepage and About page. Other public page hero treatments are unchanged. Rendering pauses outside visible artwork, in hidden tabs, and under the site's Pause control. Reduced-motion, unsupported WebGL, and loading use vector renderings of the same original surfaces. Three.js license distributed at `/licenses/three-LICENSE.txt`.

## Verification

Build and 156 existing tests pass; lint has no errors (four pre-existing generated-file warnings). Browser checks at widths 320, 390, 768, 1024, 1440, and 2560 show no horizontal overflow. Visually checked the hero, story margin, values, and mobile layout. Confirmed animation changes pixels, resumes after Pause, hides offscreen, and retains five static value illustrations with reduced motion or unavailable WebGL. Homepage and About page each mount one journey canvas; no page errors observed.
