import type { Page } from "@playwright/test";

/**
 * Contrast measured as drawn. axe-core cannot judge text over a background image, a gradient or
 * the art's pieces (it reports "needs review" for all of it), which is nearly every surface of this
 * game. So: collect every visible piece of live text with its colour, size and place; paint the
 * page again with all text made transparent; sample what is behind each piece in that picture; and
 * compare as WCAG does (4.5 for normal text, 3 for large). The worst of the sampled points counts,
 * apart from the brightest and darkest tenth, which are the edges of a letter's own anti-aliasing.
 */
export interface Finding {
  text: string;
  selector: string;
  ratio: number;
  need: number;
  fg: string;
  bg: string;
}

export async function measureContrast(page: Page): Promise<Finding[]> {
  const items = await page.evaluate(() => {
    const out: {
      text: string;
      selector: string;
      color: [number, number, number, number];
      size: number;
      bold: boolean;
      points: { x: number; y: number }[];
    }[] = [];
    const parse = (c: string): [number, number, number, number] => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      const p = (m?.[1] ?? "0,0,0").split(/[ ,/]+/).map(Number);
      return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 1];
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const node = n as Text;
      const text = (node.textContent ?? "").trim();
      const el = node.parentElement;
      if (!el || text.length < 2) continue;
      // Inactive controls are exempt (WCAG 1.4.3), as is text hidden from everyone.
      if (
        el.closest(
          "script, style, noscript, svg, [aria-hidden='true'], .fq-sr, [inert], [aria-disabled='true'], :disabled",
        )
      )
        continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      let op = 1;
      for (let e: Element | null = el; e; e = e.parentElement)
        op *= Number(getComputedStyle(e).opacity);
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()]
        .filter(
          (r) =>
            r.width > 3 &&
            r.height > 3 &&
            r.bottom > 0 &&
            r.right > 0 &&
            r.top < innerHeight &&
            r.left < innerWidth,
        )
        .map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
      if (rects.length === 0) continue;
      // Sample only the points where this very text is what is on top (not clipped by a scroller,
      // a corner or covered by something else).
      const points: { x: number; y: number }[] = [];
      for (const r of rects.slice(0, 3)) {
        const cols = Math.max(2, Math.min(10, Math.floor(r.w / 6)));
        const rows = Math.max(2, Math.min(4, Math.floor(r.h / 5)));
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const x = r.x + ((i + 0.5) / cols) * r.w;
            const y = r.y + ((j + 0.5) / rows) * r.h;
            const hit = document.elementFromPoint(x, y);
            if (hit && (el === hit || el.contains(hit))) points.push({ x, y });
          }
        }
      }
      if (points.length === 0) continue;
      const c = parse(cs.color);
      c[3] *= op;
      const sel = `${el.tagName.toLowerCase()}${el.className && typeof el.className === "string" ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}` : ""}`;
      out.push({
        text: text.slice(0, 40),
        selector: sel,
        color: c,
        size: Number.parseFloat(cs.fontSize),
        bold: Number(cs.fontWeight) >= 700,
        points,
      });
    }
    return out;
  });

  // The page again, with every glyph transparent, to read the background.
  const style = await page.addStyleTag({
    content:
      "*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } img, svg text { visibility: visible; }",
  });
  const shot = (await page.screenshot({ type: "png" })).toString("base64");
  await style.evaluate((n) => (n as Element).remove());

  return page.evaluate(
    async ({ items, shot }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${shot}`;
      await img.decode();
      const scale = img.naturalWidth / innerWidth;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return [];
      ctx.drawImage(img, 0, 0);
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const lum = (c: number[]) =>
        0.2126 * lin(c[0] ?? 0) + 0.7152 * lin(c[1] ?? 0) + 0.0722 * lin(c[2] ?? 0);
      const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const bad: {
        text: string;
        selector: string;
        ratio: number;
        need: number;
        fg: string;
        bg: string;
      }[] = [];
      for (const it of items) {
        const large = it.size >= 24 || (it.bold && it.size >= 18.66);
        const need = large ? 3 : 4.5;
        const ratios: { r: number; bg: number[] }[] = [];
        for (const pt of it.points) {
          const x = Math.round(pt.x * scale);
          const y = Math.round(pt.y * scale);
          const d = ctx.getImageData(x, y, 1, 1).data;
          const a = it.color[3];
          const fg = [0, 1, 2].map((k) => (it.color[k] ?? 0) * a + (d[k] ?? 0) * (1 - a));
          ratios.push({
            r: ratio(lum(fg), lum([d[0] ?? 0, d[1] ?? 0, d[2] ?? 0])),
            bg: [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0],
          });
        }
        if (ratios.length === 0) continue;
        ratios.sort((p, q) => p.r - q.r);
        // Ignore the worst tenth: a sample that landed on a neighbouring pixel's edge, an icon, a border.
        const at = ratios[Math.floor(ratios.length * 0.1)] ?? ratios[0];
        if (at && at.r < need - 0.05) {
          bad.push({
            text: it.text,
            selector: it.selector,
            ratio: Math.round(at.r * 100) / 100,
            need,
            fg: `rgba(${it.color.join(",")})`,
            bg: `rgb(${at.bg.join(",")})`,
          });
        }
      }
      return bad;
    },
    { items, shot },
  );
}
