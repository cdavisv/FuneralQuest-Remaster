#!/usr/bin/env python3
"""
Comparison sheets for the eight Expanded places (docs/expanded-rules.md sections 30 and 31):

  python3 tools/art/places8_sheet.py

Writes assets/remastered/places-comparison.png (the Classic base map with every building in its
hot-spot, then the new buildings beside the original and Remastered ones) and
assets/remastered/places-scenes-comparison.png (the new pictures beside existing ones).
Needs rsvg-convert and Pillow.
"""
import json
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
REM = os.path.join(ROOT, "assets", "remastered")
PACKS = os.path.join(ROOT, "apps", "client", "src", "art", "packs")
CLASSIC_UI = os.path.join(PACKS, "classic", "ui")
TMP = tempfile.mkdtemp(prefix="fq-places8-")
NEW = ["police-station", "crematorium", "florist", "gazette", "coroner", "health-department", "pawn-shop", "mournes"]


def font(size):
    for f in ("/usr/share/fonts/TTF/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def render(svg, w, h=None, bg=None):
    out = os.path.join(TMP, "r.png")
    cmd = ["rsvg-convert", "-w", str(w)]
    if h:
        cmd += ["-h", str(h)]
    if bg:
        cmd += ["-b", bg]
    subprocess.run(cmd + [svg, "-o", out], check=True)
    return Image.open(out).convert("RGBA")


def building_path(id_):
    for p in (os.path.join(CLASSIC_UI, f"building-{id_}.svg"), os.path.join(REM, "ui", f"building-{id_}.svg")):
        if os.path.exists(p):
            return p
    return None


def map_sheet():
    pack = json.load(open(os.path.join(PACKS, "classic", "pack.json")))["map"]
    vx, vy, vw, vh = pack["viewBox"]
    W = 1400
    H = round(W * vh / vw)
    base = render(os.path.join(CLASSIC_UI, "deathville-map-base.svg"), W, H).convert("RGBA")
    rects = {**pack["buildings"], **pack["expanded"]}
    for id_, r in rects.items():
        p = building_path(id_)
        if not p:
            continue
        x = round((r["x"] - vx) / vw * W)
        y = round((r["y"] - vy) / vh * H)
        w = round(r["w"] / vw * W)
        h = round(r["h"] / vh * H)
        base.alpha_composite(render(p, w, h), (x, y))
    # strip of the buildings at 3x: originals and Remastered pieces, then the eight new ones
    ref = ["church", "hospital", "store", "city-hall", "reaper-club"]
    ids = ref + NEW
    cell_w, cell_h = 220, 200
    cols = 7
    rows = (len(ids) + cols - 1) // cols
    strip = Image.new("RGBA", (W, rows * (cell_h + 26) + 8), (138, 168, 138, 255))
    d = ImageDraw.Draw(strip)
    for i, id_ in enumerate(ids):
        p = building_path(id_)
        if not p:
            continue
        im = render(p, cell_w - 20, cell_h - 10)
        # keep aspect: render() with both w and h stretches (preserveAspectRatio none); use w only
        im = render(p, cell_w - 20)
        im.thumbnail((cell_w - 10, cell_h - 10))
        cx = (i % cols) * (W // cols) + (W // cols - im.width) // 2
        cy = (i // cols) * (cell_h + 26) + 4 + (cell_h - im.height)
        strip.alpha_composite(im, (cx, cy))
        d.text(((i % cols) * (W // cols) + 8, (i // cols) * (cell_h + 26) + cell_h + 6), ("existing: " if id_ in ref else "new: ") + id_, fill=(20, 30, 20), font=font(13))
    out = Image.new("RGBA", (W, H + strip.height), (20, 20, 20, 255))
    out.paste(base, (0, 0))
    out.paste(strip, (0, H))
    out.convert("RGB").save(os.path.join(REM, "places-comparison.png"))


def scene_sheet():
    items = [
        ("places/prep-table", "existing"),
        ("places/black-market", "existing"),
        ("places/parlor-office", "existing"),
        ("places/florist", "new"),
        ("places/gazette", "new"),
        ("places/coroner", "new"),
        ("places/health-department", "new"),
        ("places/pawn-shop", "new"),
        ("places/mournes", "new"),
    ]
    tw, th = 440, 320
    cols = 3
    rows = (len(items) + cols - 1) // cols
    pw, ph = 288, 210
    y0 = rows * (th + 26) + 16
    sheet = Image.new("RGB", (cols * (tw + 8) + 8, y0 + 2 * (ph + 26) + 8), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for i, (id_, tag) in enumerate(items):
        im = render(os.path.join(REM, f"{id_}.svg"), tw, th, "#000000").convert("RGB")
        x = 8 + (i % cols) * (tw + 8)
        y = 8 + (i // cols) * (th + 26)
        sheet.paste(im, (x, y))
        d.text((x, y + th + 4), f"{tag}: {id_}", fill=(220, 220, 220) if tag == "new" else (150, 150, 150), font=font(13))
    # portraits in front of the scenes they go with (an honest check of the pairing)
    pairs = [
        ("places/florist", "people/marigold-thorne"),
        ("places/gazette", "people/hal-pennywhistle"),
        ("places/coroner", "people/dr-grimble"),
        ("places/health-department", "people/inspector-mudge"),
        ("places/pawn-shop", "people/cousin-sal"),
        ("places/mournes", "people/augustus-mourne"),
    ]
    for i, (bg, fg) in enumerate(pairs):
        a = render(os.path.join(REM, f"{bg}.svg"), pw, ph, "#000000")
        b = render(os.path.join(REM, f"{fg}.svg"), pw, ph)
        a.alpha_composite(b)
        x = 8 + (i % 3) * (pw + 8) * 1
        y = y0 + (i // 3) * (ph + 26)
        sheet.paste(a.convert("RGB"), (x, y))
        d.text((x, y + ph + 4), f"{bg.split('/')[1]} + {fg.split('/')[1]}", fill=(220, 220, 220), font=font(12))
    sheet.save(os.path.join(REM, "places-scenes-comparison.png"))


if __name__ == "__main__":
    map_sheet()
    scene_sheet()
    print("places8 sheets written")
