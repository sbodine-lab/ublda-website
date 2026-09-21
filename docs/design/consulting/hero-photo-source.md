# Consulting hero image history

## Current: overhead visualization and live glass, September 21

Sam preferred a straight-down view and explicitly authorized image generation if a suitable real photograph could not be found. The current hero is an **AI-generated architectural visualization**, not a documentary aerial photograph or an exact survey of the present campus. The earlier photographic versions below are retained as design history.

Generated with the built-in ImageGen tool, using KPF's published aerial as an architectural reference: https://www.kpf.com/story/the-making-of-university-of-michigan-stephen-m-ross-school-of-business. The reference is credited there to Aerial Associates. Reference image: https://e1.nmcdn.io/assets/kpf2024/wp-content/uploads/imported-files/1-1588_1_000_N200_Aerial-Associates-1440x960.webp. The generated view approximates the reference's roof arrangement; it must not be repurposed as evidence of the building's exact footprint or current condition.

Current assets: `public/consulting/ross-overhead-1672.webp` (1672 × 941), `ross-overhead-1080.webp` (1080 × 608), and `ross-overhead-mobile.webp` (784 × 941, a crop beginning at x=630). WebP quality 91. The original generated PNG is retained in the local `outputs/ross-overhead/generated.png` working folder and the tool's generated-image directory.

`RossHero.tsx` loads the actual Paper Fluted Glass shader lazily using Paper's vanilla `ShaderMount` API. Native lines/prism treatment: size 0.68, distortion 0.025, shadows 0.18, highlights 0.1; blur, edge softness, stretch and grain are zero. A 24-second sine cycle adjusts texture shift by ±0.18 and highlights by ±0.025. Fluted Glass has no time uniform, so motion uses documented optical uniforms rather than an ineffective `speed` setting. The roof remains stationary apart from slight optical refraction. Rendering is capped at 30 updates/second, 900,000 pixels on phones and 2,200,000 on larger screens.

Motion freezes for the existing pause control, device reduced motion, hidden tabs, and offscreen content. The ordinary responsive image remains underneath as a fallback for unsupported WebGL, a failed module/texture load, or context loss. No text is embedded in the image. The headline is now “Business with accessibility in mind.”

### Final generation prompt

Create a refined photorealistic architectural visualization for a website hero: the Stephen M. Ross School of Business at the University of Michigan, viewed from DIRECTLY OVERHEAD, straight down, true 90 degree nadir camera. The attached actual aerial photograph is the architectural reference, not the target camera angle. Preserve its recognizable footprint and roof arrangement: broad rectangular glass Winter Garden atrium roof in the middle, elongated terracotta-red perimeter blocks with flat pale roofs, rectangular green planted roof terraces, the connected academic complex to its left, tree-lined Tappan Avenue on its right, mature green trees and neighboring collegiate stone buildings. Reconstruct the camera directly above the main Ross building, with roof planes parallel to the image plane, no horizon, no sky, no side facades, no isometric or oblique camera. This is an artistic architectural visualization, not a claim of an exact survey or documentary photograph. Keep plausible actual architectural identity, do not invent grand extra towers. Landscape 16:9 composition, wide enough to show the main Ross footprint nearly complete with a little campus context, main building filling middle and right two thirds, tree canopy and secondary roof context toward left. Crisp precise roof details and clear glass atrium grid, muted sage greenery, warm terracotta, soft limestone, calm overcast early autumn light, delicate realistic shadows. Sophisticated editorial architectural photography quality. Absolutely no blur, no frost, no glass pane effect across the image, no tilt-shift, no text, no logos, no overlay; the website will add its own subtle live glass shader afterward. Save the generated image to a local file.

## Fluted-glass trial, September 9

Source page: https://www.thorntontomasetti.com/project/university-michigan-ross-school-business
Image: https://www.thorntontomasetti.com/sites/default/files/styles/paragraph_slideshow/public/ross_1.jpg?itok=sgHjlwdC
Local asset: public/ross-front-entrance.jpg
Retrieved: 2026-09-09
Photo credit on the source page: Thornton Tomasetti.

Sam requested the Paper Fluted Glass effect over a more head-on photograph of the modern Ross building. This ground-level Tappan entrance view shows the glass canopy, sandstone columns, and upper glass facade more directly than the previous aerial. The source identifies the Ross School of Business in Ann Arbor; it does not establish a photo capture date. The source file is unmodified. The browser applies fluted-glass distortion, the cream readability overlay, and gentle drift. Sam selected the local preview for the website release on September 9, 2026. The source page does not state an open reuse license.

The previous halftone trial remains accessible with `?art=halftone`.

## Previous halftone photograph

Source page: https://michiganross.umich.edu/campus-locations/ann-arbor
Image: https://michiganross.umich.edu/sites/default/files/media/images/2024/04/ROSS_Building_Aerials_2017_01resize.jpg
Local asset: public/ross-modern-exterior.jpg
Retrieved: 2026-09-08

The official Ross campus page identifies this as the Michigan Ross building at sunset. The filename dates the photograph to 2017; the 2024 path does not establish the capture date. Used for a local design trial at Sam's request to show the actual modern Ross building. Paper Halftone CMYK maps it to the site's navy and teal palette at render time. The original image file is unmodified.

## Hero photograph, September 21

Sam requested using a Ross photo with Paper Design's paned glass treatment as the consulting hero image. `public/consulting/ross-paned-glass.webp` is a derivative of the existing, previously selected `ross-front-entrance.jpg` above. It retains that source and credit. The community section now uses a heading and text without artwork.

Rendered using the actual Paper Design `FlutedGlass` shader from `@paper-design/shaders-react` 0.0.80 in Chrome WebGL2 at 1333 × 1000. Settings: lines, prism, size 0.9, distortion 0.09, shadows 0.055, highlights 0.065, angle/shift/stretch/blur/edges/grain/speed 0, fit cover, background #f8f7f3, shadow #0a3658, highlight #ffffff. Exported at WebP quality 88. The glass treatment is baked into the asset; the hero loads it with high priority as a normal image, adding no runtime shader bundle, GPU context, or animation. The original photo remains unchanged.

Paper reference: https://shaders.paper.design/fluted-glass. The hero uses a responsive cover crop and a dark overlay for white text and controls.

## Bird's-eye hero composition, September 21

Sam requested a grander Ross hero, then preferred a bird's-eye/top-down view using a real photograph if available. The current hero uses a real high-angle aerial showing the terracotta building, glass-roofed atrium, and green terraces. It is an oblique bird's-eye photograph, not a vertical survey or AI-generated scene.

Source page: https://architizer.com/projects/stephen-m-ross-school-of-business-university-of-michigan/
Image: https://architizer-prod.imgix.net/mediadata/projects/532009/bfa13173.jpg?auto=format%2Ccompress&cs=strip&q=80&w=2160
Source dimensions: 2160 × 1440. Retrieved September 21, 2026. Source: KPF project photography on Architizer. No individual photographer or open reuse license is identified on the project page. No open license is asserted here. This photograph records an earlier phase of the campus; no claim about its capture date or current building configuration is made in the hero.

The actual Paper FlutedGlass shader is rendered at 2160 × 1440, starting from Paper's documented default prism/lines setup. Final settings: size 0.68, distortion 0.1, shadows 0.25, highlights 0.1, edges 0.15, colorBack #0d1319, colorShadow #000000, colorHighlight #ffffff, fit cover, native shader scale 1.04, minPixelRatio 1, maxPixelCount 3,000,000. Angle, shift, stretch, blur, margins, grain, and speed remain 0. The native scale trims image-edge artifacts. Finer flutes and intra-pane refraction create optical depth; restrained highlights avoid an outlined-grid appearance. Distortion is lower than Paper's default 0.5 to keep this detailed aerial legible. Paper supports static as well as animated usage; the export retains its optical treatment without a continuously running canvas on phones.

Official references: https://shaders.paper.design/fluted-glass and https://github.com/paper-design/shaders. This is an adaptation of their documented example, not a claim of endorsement or of a prescribed aesthetic.

WebP exports at quality 88: ross-hero-glass-2160.webp and ross-hero-glass-1080.webp use a 2160 × 1215 landscape crop beginning 70px below the rendered image's top. ross-hero-glass-mobile.webp uses the source rectangle x=780, y=0, width=1200, height=1440, exported at 900 × 1080. The native picture element selects the portrait asset on phones. The portrait fills the lower 74% of the mobile hero and fades into the navigation background, allowing more of Ross to remain visible. Desktop hero height follows 16:9 proportions within 620–1000px with a 42% vertical focal position. Both retain a gradient for legible white controls and headings. The glass treatment is baked into the images; no runtime shader is added.
