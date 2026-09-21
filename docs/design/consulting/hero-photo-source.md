# Consulting hero photograph

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

The actual Paper FlutedGlass shader is rendered at 2160 × 1440 with close pane spacing (size 0.89), distortion 0.03, shadows 0.16, and highlights 0.24. All other shader settings above are retained, with a 3,000,000 maximum pixel count. A centered 1.025× render scale trims the glass shader's edge artifacts. Sam requested a slightly more visible paned-glass appearance after viewing the aerial hero. The stronger edge highlights and pane shading make the glass legible while restrained refraction preserves the roof geometry.

WebP exports at quality 88: ross-hero-glass-2160.webp and ross-hero-glass-1080.webp use a 2160 × 1215 landscape crop beginning 70px below the rendered image's top. ross-hero-glass-mobile.webp uses the source rectangle x=780, y=0, width=1200, height=1440, exported at 900 × 1080. The native picture element selects the portrait asset on phones. The portrait fills the lower 74% of the mobile hero and fades into the navigation background, allowing more of Ross to remain visible. Desktop hero height follows 16:9 proportions within 620–1000px with a 42% vertical focal position. Both retain a gradient for legible white controls and headings. The glass treatment is baked into the images; no runtime shader is added.
