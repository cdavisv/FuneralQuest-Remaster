#!/usr/bin/env python3
"""
Contact sheet and comparison sheets for the Remastered pack.

  python3 tools/art/sheets.py

Writes assets/remastered/contact-sheet.png and .html (every piece, with its grade), and
assets/remastered/comparisons/<id>.png plus comparisons.png (each traced original beside its
redraw). Needs rsvg-convert and Pillow.
"""
import html
import json
import os
import subprocess
import tempfile

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
REM = os.path.join(ROOT, "assets", "remastered")
CLA = os.path.join(ROOT, "assets", "classic")
TMP = tempfile.mkdtemp(prefix="fq-sheets-")


def font(size):
    for f in ("/usr/share/fonts/TTF/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def render(svg, w, h, bg):
    out = os.path.join(TMP, "r.png")
    subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), "--keep-aspect-ratio", "-b", bg, svg, "-o", out], check=True)
    im = Image.open(out).convert("RGB")
    tile = Image.new("RGB", (w, h), bg)
    tile.paste(im, ((w - im.width) // 2, (h - im.height) // 2))
    return tile


def bg_for(a):
    if a["kind"] == "icon":
        return "#e8dcc0"
    if a["kind"] == "ui":
        return "#888888"
    return "#000000"


def contact_sheet(assets):
    tw, th, pad, lab, cols = 275, 200, 8, 34, 6
    rows = (len(assets) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + lab + pad) + pad + 40), "#2a2a2a")
    d = ImageDraw.Draw(sheet)
    d.text((pad, 10), "Funeral Quest Remastered art pack: every piece, with its grade (A ships, B placeholder, C needs an artist)", fill="#dddddd", font=font(16))
    colours = {"A": "#7ccf7c", "B": "#e8c060", "C": "#e07060"}
    for i, a in enumerate(assets):
        x = pad + (i % cols) * (tw + pad)
        y = 40 + pad + (i // cols) * (th + lab + pad)
        sheet.paste(render(os.path.join(REM, a["id"] + ".svg"), tw, th, bg_for(a)), (x, y))
        d.text((x, y + th + 3), a["id"], fill="#dddddd", font=font(12))
        d.text((x, y + th + 18), f"{a['kind']}  grade {a['grade']}", fill=colours[a["grade"]], font=font(11))
    sheet.save(os.path.join(REM, "contact-sheet.png"), optimize=True)

    cards = []
    for a in assets:
        cards.append(
            f'<figure class="k-{a["kind"]}"><img src="{html.escape(a["id"])}.svg" alt="" loading="lazy">'
            f'<figcaption><b>{html.escape(a["id"])}</b> <span class="g{a["grade"]}">{a["grade"]}</span>'
            f'<br>{html.escape(a.get("overrides", "new"))}<br><small>{html.escape(a["notes"])}</small></figcaption></figure>'
        )
    page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Funeral Quest Remastered: contact sheet</title>
<style>
body{{background:#222;color:#ddd;font:14px/1.4 system-ui,sans-serif;margin:16px}}
main{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}}
figure{{margin:0;background:#2e2e2e;padding:8px;border-radius:4px}}
img{{width:100%;aspect-ratio:550/400;object-fit:contain;background:#000;display:block}}
.k-icon img{{background:#e8dcc0}} .k-ui img{{background:#888}}
.gA{{color:#7ccf7c}} .gB{{color:#e8c060}} .gC{{color:#e07060}} small{{color:#aaa}}
</style></head><body>
<h1>Funeral Quest Remastered art pack</h1>
<p>New art in the style of Akiko Robinson's original art, CC BY 4.0 (see manifest.json). Grades: A ships, B acceptable placeholder, C needs an artist.
Compare the twelve redraws with the traced originals in <a href="comparisons.png">comparisons.png</a>.</p>
<main>{''.join(cards)}</main></body></html>
"""
    with open(os.path.join(REM, "contact-sheet.html"), "w") as f:
        f.write(page)


def comparisons(assets):
    os.makedirs(os.path.join(REM, "comparisons"), exist_ok=True)
    tw, th = 440, 320
    redraws = [a for a in assets if a["kind"] == "redraw"]
    tiles = []
    for a in redraws:
        pair = Image.new("RGB", (tw * 2 + 30, th + 46), "#2a2a2a")
        d = ImageDraw.Draw(pair)
        pair.paste(render(os.path.join(CLA, a["id"] + ".svg"), tw, th, "#000000"), (10, 36))
        pair.paste(render(os.path.join(REM, a["id"] + ".svg"), tw, th, "#000000"), (tw + 20, 36))
        d.text((10, 8), f"{a['id']}: original (auto-traced photograph)", fill="#dddddd", font=font(14))
        d.text((tw + 20, 8), f"Remastered redraw (grade {a['grade']})", fill="#e8c060", font=font(14))
        pair.save(os.path.join(REM, "comparisons", a["id"].replace("/", "__") + ".png"), optimize=True)
        tiles.append(pair)
    cols = 2
    w, h = tiles[0].size
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * w + 10, rows * h + 10), "#1a1a1a")
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * w + 5, (i // cols) * h + 5))
    sheet.save(os.path.join(REM, "comparisons.png"), optimize=True)


def main():
    with open(os.path.join(REM, "manifest.json")) as f:
        assets = json.load(f)["assets"]
    order = {"redraw": 0, "place": 1, "portrait": 2, "fix": 3, "ui": 4, "icon": 5}
    assets.sort(key=lambda a: (order.get(a["kind"], 9), a["id"]))
    contact_sheet(assets)
    comparisons(assets)
    print("sheets written")


if __name__ == "__main__":
    main()
