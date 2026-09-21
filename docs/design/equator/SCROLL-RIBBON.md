# Scroll ribbon artwork

September 17, 2026. Replaces the boxed outline icons with original procedural 3D artwork.

## Reference research

Live Equator site https://equatorcompany.com/ was inspected visually and through public browser resources. Its bird is `/bird_low.mp4`, its closing cloud is `/cloud_low.mp4`, and its value illustrations are `/lottie/{sustainability,global,grounded,curiosity,difference}.lottie`. The player is `@lottiefiles/dotlottie-web` 0.54.1. The player is open source (MIT); no reusable license for the specific bird/video or value artwork was found. None of that media or animation data was copied into this implementation.

Open-source options evaluated:
- dotLottie Web: https://github.com/LottieFiles/dotlottie-web — MIT player, suitable for authored vector animations.
- Three.js: https://github.com/mrdoob/three.js — MIT renderer, selected for real 3D shading and continuous scroll morphs.
- particle-morph: https://github.com/mmdalipour/particle-morph — MIT particle morphing approach; adds React Three Fiber and particle-heavy aesthetics, not needed for the ribbon.
- MisterPrada/morph-particles: https://github.com/MisterPrada/morph-particles — relevant scroll/GPU experiment, but no license file was found in the displayed repository listing. Not used.

## September 21 revision

Sam selected the infinity sculpture as the useful form and requested recognizable symbols that relate to each value, continuous mobile morphing, and more of Equator's background movement. This supersedes the September 21 mobile fallback-only behavior.

The three original ribbon strips now form a group of people (inclusion), the retained infinity (shared purpose), an open book with a center fold (learning), a listening ear with an inner fold and incoming sound wave (listening), and a heart (community and care). Sam subsequently asked to replace the speech bubbles because they did not fit “Lead with curiosity. Listen with care.” The ear makes that connection direct and uses the same three ribbon strips. Equal-distance curve samples share a topology with the infinity. The existing ivory/teal material, eased morphs, and gentle 3D movement remain.

Phones, touch tablets, short windows, and enlarged text use flowing copy under a native CSS sticky sculpture shelf. One canvas stays in that shelf instead of hopping among five cards. Desktop keeps the pinned text composition with a shared sculpture position bounded by the values section. The morph timeline moves in either scroll direction and holds a complete symbol while its copy is read. The visible value counter uses that same timeline.

The introduction adds an original full-bleed field of flowing strands in UBLDA colors. It adapts the broad ambient movement of Equator's bird/cloud backgrounds without copying its media. Scroll-based text and element reveals run on phones as well as desktop.

## Rendering and fallbacks

Three.js loads as the values section enters view. One WebGL context serves the values on the home and About pages; the introduction uses a lightweight 2D canvas. The renderer matches its actual displayed size, caps pixel ratio at 1.5, and draws at 30fps on compact layouts (60fps on desktop). The background also draws at 30fps. Both stop drawing offscreen or in hidden tabs. The site Pause control and device reduced-motion preference retain static artwork and fully readable copy. Unsupported WebGL and context loss preserve the corresponding SVG form. Three.js license remains at `/licenses/three-LICENSE.txt`.

## Verification

`node scripts/audit-brand-motion.mjs <base>` verifies all five stages at 320x568, 390x844, 844x390, 1024x768, and 1440x900, stable sculpture positions, continuous reverse morphs, frame activity/offscreen suspension, Pause, reduced motion, overflow, accessibility, and all five no-WebGL fallbacks. `scripts/audit-scroll-behavior.mjs` retains navigation, menus, pause, and accessibility coverage for the homepage and consulting. Screenshots and audit output live in ignored `outputs/brand-motion/`.
