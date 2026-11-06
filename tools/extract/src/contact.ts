import type { ManifestAsset } from "./manifest.js";
import { esc } from "./render.js";

export interface SheetEntry {
  asset: ManifestAsset;
}

const urlOf = (file: string): string => file.split("/").map(encodeURIComponent).join("/");

/** Relative path from assets/classic/ to the asset file. */
const rel = (a: ManifestAsset): string => (a.file ?? "").replace(/^classic\//, "");

export function contactSheetHtml(assets: ManifestAsset[]): string {
  const groups = new Map<string, ManifestAsset[]>();
  for (const a of assets) {
    if (!a.file) continue;
    const g =
      a.kind === "picture"
        ? `pictures: ${a.category}`
        : a.kind === "ui"
          ? "ui"
          : a.kind === "ui-screen"
            ? "ui/screens"
            : a.kind === "ui-part"
              ? "ui/parts (unnamed pieces)"
              : "ui/textures";
    const l = groups.get(g) ?? [];
    l.push(a);
    groups.set(g, l);
  }
  const sections = [...groups]
    .map(([g, list]) => {
      const figs = list
        .map((a) => {
          const flags = [
            a.needsRedraw
              ? '<span class="redraw" title="' +
                esc(a.needsRedrawReason ?? "") +
                '">needs redraw</span>'
              : "",
            a.frameCount > 1
              ? `<span class="frames">${a.frameCount} frames @ ${a.frameRate} fps</span>`
              : "",
            a.embedsBitmaps ? '<span class="bmp">bitmap</span>' : "",
          ].join("");
          return `<figure data-id="${esc(a.id)}"><img loading="lazy" src="${esc(urlOf(rel(a)))}" alt="${esc(a.id)}"><figcaption><b>${esc(a.id)}</b>${flags}</figcaption></figure>`;
        })
        .join("\n");
      return `<section><h2>${esc(g)} <small>${list.length}</small></h2><div class="grid">\n${figs}\n</div></section>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Funeral Quest classic art: contact sheet</title>
<style>
body{font:14px/1.3 system-ui,sans-serif;margin:0;background:#2a2a2e;color:#eee}
header{position:sticky;top:0;background:#1b1b1f;padding:10px 16px;z-index:2;display:flex;gap:16px;align-items:center}
input{font:inherit;padding:4px 8px;width:260px}
h2{margin:24px 16px 8px}h2 small{color:#999;font-weight:normal}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:0 16px}
figure{margin:0;background:#8d8d92;border-radius:4px;overflow:hidden}
figure img{display:block;width:100%;height:180px;object-fit:contain;background:repeating-conic-gradient(#999 0 25%,#aaa 0 50%) 0 0/16px 16px}
figcaption{background:#1b1b1f;padding:4px 8px;font-size:12px;word-break:break-all}
.redraw{background:#b33;margin-left:6px;padding:0 4px;border-radius:3px}
.frames{background:#357;margin-left:6px;padding:0 4px;border-radius:3px}
.bmp{background:#563;margin-left:6px;padding:0 4px;border-radius:3px}
</style></head><body>
<header><b>Funeral Quest classic art</b><input id="q" placeholder="filter by id" oninput="for(const f of document.querySelectorAll('figure'))f.style.display=f.dataset.id.includes(this.value.toLowerCase())?'':'none'"><span>Credit: Akiko Robinson. License: Proton SDK license.</span></header>
${sections}
</body></html>
`;
}

/** SVG page of thumbnails (labelled by id) for rendering to PNG. */
export function contactSheetSvg(
  assets: ManifestAsset[],
  cols: number,
  cellW = 240,
  cellH = 180,
): { svg: string; width: number; height: number } {
  const pad = 8;
  const label = 22;
  const rows = Math.ceil(assets.length / cols);
  const width = cols * (cellW + pad) + pad;
  const height = rows * (cellH + label + pad) + pad;
  const cells = assets
    .map((a, i) => {
      const x = pad + (i % cols) * (cellW + pad);
      const y = pad + Math.floor(i / cols) * (cellH + label + pad);
      const color = a.needsRedraw ? "#ffb0b0" : "#ffffff";
      return `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" fill="#8d8d92"/><image x="${x}" y="${y}" width="${cellW}" height="${cellH}" preserveAspectRatio="xMidYMid meet" href="${esc(rel(a))}"/><text x="${x + 2}" y="${y + cellH + 15}" font-family="DejaVu Sans, sans-serif" font-size="12" fill="${color}">${esc(a.id.length > 34 ? `…${a.id.slice(-33)}` : a.id)}${a.needsRedraw ? " [redraw]" : ""}</text>`;
    })
    .join("");
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#2a2a2e"/>${cells}</svg>\n`,
    width,
    height,
  };
}
