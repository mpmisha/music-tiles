#!/usr/bin/env python3
"""Generate Music Tiles app icons in the shared Playground aesthetic:
a twilight gradient plate with four lanes and a couple of glossy candy tiles,
one bearing a music note. Run: python3 tools/generate_icon.py"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
SIZES = [180, 192, 512, 1024]

# Twilight surface gradient (matches skins.js Twilight).
TOP = (92, 120, 219)
BOTTOM = (56, 66, 153)
# Candy lane colors (purple, blue, pink, yellow) approx from the block palette.
LANE = [(150, 102, 237), (86, 156, 237), (237, 128, 176), (255, 204, 61)]


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def brighten(c, f):
    return tuple(min(255, round(x * f)) for x in c)


def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)


def candy_tile(img, x, y, w, h, color, note=False):
    d = ImageDraw.Draw(img)
    r = int(min(w, h) * 0.22)
    # bevel shadow
    inset = max(1, int(h * 0.03))
    rounded(d, [x + inset, y + inset, x + w - inset, y + h - inset], r, brighten(color, 0.6))
    # raised face
    fx, fy = x + w * 0.04, y + h * 0.04
    fw, fh = w * 0.92, h * 0.88
    rounded(d, [fx, fy, fx + fw, fy + fh], int(r * 0.85), color)
    # gloss
    gloss = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(gloss)
    rounded(gd, [fx, fy, fx + fw, fy + fh * 0.42], int(r * 0.7), (255, 255, 255, 60))
    img.alpha_composite(gloss)
    if note:
        d = ImageDraw.Draw(img)
        # a simple eighth-note glyph
        cx, cy = x + w * 0.42, y + h * 0.66
        rr = w * 0.13
        d.ellipse([cx - rr, cy - rr * 0.8, cx + rr, cy + rr * 0.8], fill=(255, 255, 255, 235))
        stem_x = cx + rr * 0.85
        d.rectangle([stem_x - w * 0.035, y + h * 0.28, stem_x + w * 0.02, cy], fill=(255, 255, 255, 235))
        d.polygon([(stem_x, y + h * 0.28), (stem_x + w * 0.16, y + h * 0.34),
                   (stem_x + w * 0.16, y + h * 0.46), (stem_x, y + h * 0.40)], fill=(255, 255, 255, 235))


def make(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 255))
    # gradient background
    bg = ImageDraw.Draw(img)
    for yy in range(size):
        bg.line([(0, yy), (size, yy)], fill=lerp(TOP, BOTTOM, yy / size) + (255,))
    # plate padding + 4 lanes
    pad = size * 0.13
    board = [pad, pad, size - pad, size - pad]
    ImageDraw.Draw(img).rounded_rectangle(board, radius=int(size * 0.16),
                                          fill=(16, 18, 41, 70))
    bx, bw = pad, (size - 2 * pad)
    lane_w = bw / 4
    # two staggered candy tiles per lane feel; keep it simple: one row of 4 small
    # + one prominent note tile.
    top = size * 0.20
    tile_h = size * 0.20
    gap = lane_w * 0.14
    for i in range(4):
        lx = bx + i * lane_w + gap
        lw = lane_w - gap * 2
        candy_tile(img, lx, top, lw, tile_h, LANE[i])
    # big note tile centered lower
    nw = lane_w * 1.6
    nx = bx + bw / 2 - nw / 2
    ny = size * 0.52
    candy_tile(img, nx, ny, nw, nw * 0.92, LANE[3], note=True)
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    base = make(1024)
    for s in SIZES:
        base.resize((s, s), Image.LANCZOS).convert("RGB").save(
            os.path.join(OUT, f"icon-{s}.png"))
        print("wrote", f"icon-{s}.png")


if __name__ == "__main__":
    main()
