#!/usr/bin/env python3
"""
Generate a Purnazen app icon set (Android).

Brand mark: a white lotus on a brand-colored field — "purna" (wholeness) + "zen".
Each app uses its brand primary: patient green #1FA77A (default), doctor blue
#2563EB, admin orange #EA580C.

Usage:
  generate_icon.py <res_dir> [primary_hex] [top_hex]

  primary_hex — field color (default #1FA77A)
  top_hex     — lighter top of the gradient (default: primary lightened)

Outputs (relative to the target res/ dir):
  mipmap-<dpi>/ic_launcher.png            legacy full icon (rounded square)
  mipmap-<dpi>/ic_launcher_round.png      legacy round icon
  mipmap-<dpi>/ic_launcher_foreground.png adaptive foreground (transparent)

Adaptive XML + background color are written separately by the caller — keep
values/ic_launcher_background.xml in sync with primary_hex.
"""
import math
import os
import sys
from PIL import Image, ImageDraw

GREEN      = (31, 167, 122, 255)   # #1FA77A brand primary (patient default)
GREEN_TOP  = (39, 185, 138, 255)   # lighter top for a subtle gradient
WHITE      = (255, 255, 255, 255)


def hex_to_rgba(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def lighten(c, f=0.12):
    return tuple(min(255, int(v + (255 - v) * f)) for v in c[:3]) + (255,)

# Per-density launcher icon edge length (px) and supersample factor.
DENSITIES = {
    'mdpi':    48,
    'hdpi':    72,
    'xhdpi':   96,
    'xxhdpi':  144,
    'xxxhdpi': 192,
}
# Adaptive foreground is a 108dp canvas; the lotus must stay in the 72dp safe zone.
FG_DENSITIES = {
    'mdpi':    108,
    'hdpi':    162,
    'xhdpi':   216,
    'xxhdpi':  324,
    'xxxhdpi': 432,
}

SS = 4  # supersample then downscale for clean antialiasing


def vesica_petal(size, length, width, fill, outline, ow):
    """A pointed lotus petal (vesica/lens), base at bottom-centre, tip up."""
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cx = size / 2
    base_y = size / 2
    tip_y = base_y - length
    # Two circular arcs meeting at base & tip form the lens.
    # Half-width at the belly = `width`/2, height = `length`.
    half = length / 2
    belly_y = base_y - half
    r = (half * half + (width / 2) ** 2) / (width)  # circle radius for the arc
    # Left arc centre to the right, right arc centre to the left.
    cxl = cx + (r - width / 2)
    cxr = cx - (r - width / 2)
    bbox_l = [cxl - r, belly_y - r, cxl + r, belly_y + r]
    bbox_r = [cxr - r, belly_y - r, cxr + r, belly_y + r]
    # Build the petal as the intersection of the two discs.
    a = Image.new('L', (size, size), 0)
    b = Image.new('L', (size, size), 0)
    ImageDraw.Draw(a).ellipse(bbox_l, fill=255)
    ImageDraw.Draw(b).ellipse(bbox_r, fill=255)
    from PIL import ImageChops
    mask = ImageChops.darker(a, b)
    # Clip to the petal's vertical span so stray disc area is removed.
    span = Image.new('L', (size, size), 0)
    ImageDraw.Draw(span).rectangle([0, tip_y, size, base_y], fill=255)
    mask = ImageChops.darker(mask, span)
    petal = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    petal.paste(fill, (0, 0), mask)
    if outline and ow > 0:
        # Stroke = mask minus an eroded mask, painted in the outline colour, so
        # adjacent white petals stay visually separated over the green field.
        from PIL import ImageFilter
        eroded = mask.filter(ImageFilter.MinFilter(ow * 2 + 1))
        ring = ImageChops.subtract(mask, eroded)
        petal.paste(outline, (0, 0), ring)
    return petal


def draw_lotus(canvas_px, scale=0.62):
    """White lotus centred on a transparent square of `canvas_px`.

    All petal bases meet at the canvas centre and fan upward/outward; petal
    length stays < half the canvas so nothing clips when rotated.
    """
    big = canvas_px * SS
    img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    L = big * 0.44 * (scale / 0.62)   # bounded so L < big/2 (no clip on rotate)
    W = L * 0.52                       # petal belly width
    ow = max(2, int(big * 0.007))
    # outer petals drawn first so the upright centre petal sits on top
    layout = [(-72, 0.80), (72, 0.80), (-37, 0.92), (37, 0.92), (0, 1.0)]
    for ang, k in layout:
        petal = vesica_petal(big, L * k, W * k, WHITE, PRIMARY, ow)
        rot = petal.rotate(ang, resample=Image.BICUBIC, center=(big / 2, big / 2))
        img.alpha_composite(rot, (0, 0))
    # small calyx accent at the base where petals meet
    d = ImageDraw.Draw(img)
    rb = big * 0.06
    d.ellipse([big / 2 - rb, big / 2 - rb * 0.4, big / 2 + rb, big / 2 + rb * 1.5], fill=WHITE)
    # The visual mass sits above centre; nudge the whole lotus down so it reads
    # as vertically centred.
    shifted = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    shifted.alpha_composite(img, (0, int(big * 0.10)))
    return shifted.resize((canvas_px, canvas_px), Image.LANCZOS)


def rounded_bg(px, radius_frac=0.22, circle=False):
    big = px * SS
    bg = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    # vertical gradient
    grad = Image.new('RGBA', (1, big))
    for y in range(big):
        t = y / big
        c = tuple(int(PRIMARY_TOP[i] * (1 - t) + PRIMARY[i] * t) for i in range(4))
        grad.putpixel((0, y), c)
    grad = grad.resize((big, big))
    mask = Image.new('L', (big, big), 0)
    md = ImageDraw.Draw(mask)
    if circle:
        md.ellipse([0, 0, big, big], fill=255)
    else:
        md.rounded_rectangle([0, 0, big, big], radius=int(big * radius_frac), fill=255)
    bg.paste(grad, (0, 0), mask)
    return bg.resize((px, px), Image.LANCZOS)


def build(res_dir):
    for dpi, px in DENSITIES.items():
        out = os.path.join(res_dir, f'mipmap-{dpi}')
        os.makedirs(out, exist_ok=True)
        lotus = draw_lotus(px, scale=0.60)
        for circle, name in [(False, 'ic_launcher.png'), (True, 'ic_launcher_round.png')]:
            icon = rounded_bg(px, circle=circle)
            # centre the lotus a touch smaller inside the bg
            lp = draw_lotus(int(px * 0.92), scale=0.60)
            ox = (px - lp.width) // 2
            icon.alpha_composite(lp, (ox, ox))
            icon.convert('RGBA').save(os.path.join(out, name))
        # adaptive foreground (transparent, lotus in safe zone)
        fg_px = FG_DENSITIES[dpi]
        fg = Image.new('RGBA', (fg_px, fg_px), (0, 0, 0, 0))
        lp = draw_lotus(int(fg_px * 0.62), scale=0.62)
        off = (fg_px - lp.width) // 2
        fg.alpha_composite(lp, (off, off))
        fg.save(os.path.join(out, 'ic_launcher_foreground.png'))
        print(f'  wrote {dpi} ({px}px)')


PRIMARY = GREEN
PRIMARY_TOP = GREEN_TOP

if __name__ == '__main__':
    target = sys.argv[1]
    if len(sys.argv) > 2:
        PRIMARY = hex_to_rgba(sys.argv[2])
        PRIMARY_TOP = hex_to_rgba(sys.argv[3]) if len(sys.argv) > 3 else lighten(PRIMARY)
    print(f'Generating icons into {target} (primary '
          f'#{PRIMARY[0]:02X}{PRIMARY[1]:02X}{PRIMARY[2]:02X})')
    build(target)
    print('done')
