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

## Community photograph, September 21

Sam requested replacing the abstract artwork beside “Part of a broader UBLDA community” with a Ross photograph treated as paned glass. `public/consulting/ross-paned-glass.jpg` is a derivative of the existing, previously selected `ross-front-entrance.jpg` above. It retains that source and credit.

Rendered using the actual Paper Design `FlutedGlass` shader from `@paper-design/shaders-react` 0.0.80 in Chrome WebGL2 at 1333 × 1000. Settings: lines, prism, size 0.95, distortion 0.2, shadows 0.12, highlights 0.12, angle/shift/stretch/blur/edges/grain/speed 0, fit cover, background #f8f7f3, shadow #0a3658, highlight #ffffff. Exported at JPEG quality 86. The glass treatment is baked into the asset and lazy-loaded as a normal image, so this section adds no runtime shader bundle, GPU context, or animation. The original photo remains unchanged.

Paper reference: https://shaders.paper.design/fluted-glass. Desktop uses the existing portrait crop and mobile the existing 4:3 crop.
