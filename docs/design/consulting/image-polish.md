# Consulting image polish — September 16, 2026

Sam requested integrated logos, sharper images, better crops, and imagery relevant to the practice.

## Logo treatment

Consulting-only asset mapping preserves the rest of the club site. New vector files replace small raster logos and padded canvases. All marks use contain sizing and optical width limits, with multiply blending on the paper surface. BLDA's existing navy-backed artwork uses a reversible CSS monochrome treatment to remove the rectangle. Its source is unchanged. OCCB and WSO remain the existing assets, displayed below their native dimensions.

- Arc Thrift: https://arcthrift.com/web/assets/img/arc-logo.svg (official site header)
- Michigan Ross: https://michiganross.umich.edu/themes/custom/ross_theme/logo.svg (official site header; white lettering changed to Michigan navy for the light background, paths unchanged)
- Nestidd: https://nestidd.com/wp-content/uploads/Logo.svg (official site header)
- Microsoft: https://commons.wikimedia.org/wiki/File:Microsoft_logo_(2012).svg (vector originally sourced from Microsoft's Flipgrid; compared to Microsoft.com current header)
- UBLDA: existing canonical SVG paths with viewBox tightened to 285 297 433 439, preserving the mark and its clear space. Header monochrome styling is unchanged.

## Photos

Removed the reference site's generic cyclist/building and office images. Stock photos illustrate services; they are not UBLDA members or clients. People and disability are not inferred beyond the source descriptions and visibly shown scene.

- Strategy: Yan Krukau, Pexels, colleagues reviewing plans and charts. https://www.pexels.com/photo/employees-happily-having-a-meeting-with-their-boss-7792743/
- Workplace: Kampus Production, Pexels, colleagues collaborating including a wheelchair user. https://www.pexels.com/photo/women-and-a-man-on-wheelchair-having-a-meeting-6248975/
- Both Pexels photos are free to use under https://www.pexels.com/license/ . Downloaded responsive 960px and 2400px source-CDN variants, with no local raster editing. Total four variants approximately 884 KB. Intrinsic dimensions, lazy loading, async decoding, srcset, and breakpoint-specific subject positioning support stable loading and appropriate crops.
- Home story: Michigan Ross campus study photo, 800 × 1200, https://michiganross.umich.edu/sites/default/files/media/images/2026/04/study.JPG . Native portrait framing replaces a severely cropped exterior photograph.
- Practice: Michigan Ross Winter Garden, 1658 × 447, https://michiganross.umich.edu/sites/default/files/media/images/2026/04/michigan-ross-visit.jpg . Displayed at natural aspect ratio; replaces the enlarged 875px building photograph. A mobile-specific 900 × 1200 Winter Garden photo preserves the composition on narrow screens: https://michiganross.umich.edu/sites/default/files/media/images/2026/04/wintergarden.jpg . All Ross photos are from https://michiganross.umich.edu/campus-locations/ann-arbor . No open license is asserted; existing campus-photo editorial use continues.

Photo descriptions identify the scene without representing stock or campus subjects as UBLDA's team. Abstract accessibility, research, and monogram art remain crisp CSS graphics.

## Verification

Chrome desktop and 390px mobile review covered the affiliation strip, partner grid, client logos, study portrait, mobile Winter Garden source, service cards, and full workplace image. Adjusted individual logo sizing and removed the work-page logo panel after visual review. No horizontal overflow, failed images, or browser console errors on checked pages. Build and all 153 repository tests passed; lint has only the four pre-existing generated-file warnings.
