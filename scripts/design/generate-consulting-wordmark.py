"""Regenerate the outlined consulting wordmark using the existing DM Sans fonts.
Requires fontTools. No external logo or icon artwork is used.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[2]
def line(text, font_name, size, baseline, tracking=0):
    font = TTFont(ROOT / 'public/consulting' / font_name)
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    scale, x, paths = size / font['head'].unitsPerEm, 1, []
    for char in text:
        name = cmap[ord(char)]
        pen = SVGPathPen(glyphs, ntos=lambda v: str(round(v, 3)))
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        paths.append(pen.getCommands())
        x += glyphs[name].width * scale + tracking
    return ''.join(paths), x - tracking

parent, width = line('UBLDA', 'dm-sans-bold.ttf', 38, 30, .1)
service, service_width = line('CONSULTING', 'dm-sans-semibold.ttf', 14.5, 49, 1.15)
for variant, parent_color, service_color in [('color', '#0A3658', '#3559A8'), ('white', '#FAF9F6', '#FAF9F6')]:
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {round(max(width, service_width) + 2, 2)} 54" role="img" aria-labelledby="title"><title id="title">UBLDA Consulting</title><path fill="{parent_color}" d="{parent}"/><path fill="{service_color}" d="{service}"/></svg>'''
    (ROOT / f'public/consulting/logos/consulting-wordmark-{variant}.svg').write_text(svg)
