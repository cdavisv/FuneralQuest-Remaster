import { Buffer } from "node:buffer";
import { cxmul, mmul, morphAt, type PaintOp, type Seg, shapePaintOps } from "./shape.js";
import { ID_CX, type Swf, SwfError } from "./swf.js";
import { displayAt, type Item, spriteFrame } from "./timeline.js";
import type {
  Color,
  CXForm,
  EditTextDef,
  FillStyle,
  FontDef,
  LineStyle,
  Matrix,
  ShapeDef,
  TimelineData,
} from "./types.js";

export interface RenderOptions {
  /** Draw a dashed marker for dynamic text fields (reference screens). */
  fieldMarkers?: boolean;
  /** Instance names to leave out of the render. */
  hide?: ReadonlySet<string>;
  /** Character ids to leave out when nested (not when rendered as the top-level character). */
  hideChars?: ReadonlySet<number>;
  /** Draw buttons in this state flag (1 up, 2 over, 4 down). Default 1. */
  buttonState?: number;
}

export interface RenderResult {
  defs: string;
  body: string;
  usesBitmaps: boolean;
  paths: number;
  /** Extent of everything drawn, in pixels. */
  bounds: { x0: number; y0: number; x1: number; y1: number } | undefined;
  fields: { variable: string; x: number; y: number; w: number; h: number }[];
}

const MAX_DEPTH = 24;

const f2 = (v: number): string => {
  const r = Math.round(v * 100) / 100;
  return Object.is(r, -0) ? "0" : String(r);
};

const hex2 = (v: number): string =>
  Math.max(0, Math.min(255, Math.round(v)))
    .toString(16)
    .padStart(2, "0");

function applyCx(c: Color, cx: CXForm): Color {
  return {
    r: Math.max(0, Math.min(255, Math.trunc((c.r * cx.mul[0]) / 256) + cx.add[0])),
    g: Math.max(0, Math.min(255, Math.trunc((c.g * cx.mul[1]) / 256) + cx.add[1])),
    b: Math.max(0, Math.min(255, Math.trunc((c.b * cx.mul[2]) / 256) + cx.add[2])),
    a: Math.max(0, Math.min(255, Math.trunc((c.a * cx.mul[3]) / 256) + cx.add[3])),
  };
}

function isOpaque(st: FillStyle, cx: CXForm): boolean {
  if (st.type === "solid") return applyCx(st.color, cx).a === 255;
  if (st.type === "grad") return st.stops.every((s) => applyCx(s.color, cx).a === 255);
  return true;
}

const rgb = (c: Color): string => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;

/** SVG matrix() with every term scaled (twips to pixels is 1/20). */
function matrixAttr(m: Matrix, scale = 1): string {
  const v = m.map((x) => x * scale);
  return `matrix(${v.map((x, i) => (i < 4 ? String(Math.round(x * 1e7) / 1e7) : f2(x))).join(" ")})`;
}

export class Renderer {
  private defs = new Map<string, string>();
  private ids = 0;
  usesBitmaps = false;
  paths = 0;
  private b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  private fields: RenderResult["fields"] = [];
  private shapeCache = new Map<ShapeDef, PaintOp[]>();

  constructor(
    private swf: Swf,
    private opts: RenderOptions = {},
  ) {}

  /** Render one frame of a timeline (the root, or a sprite when `charId` is given). */
  renderFrame(tl: TimelineData, frame: number): RenderResult {
    const body: string[] = [];
    this.renderTimelineItems(tl, frame, [1, 0, 0, 1, 0, 0], ID_CX, body, 0, false);
    return this.result(body);
  }

  renderCharacter(charId: number, frame = 0, m: Matrix = [1, 0, 0, 1, 0, 0]): RenderResult {
    const body: string[] = [];
    this.renderChar(charId, m, ID_CX, body, 0, frame, 0, false);
    return this.result(body);
  }

  private result(body: string[]): RenderResult {
    const hasB = Number.isFinite(this.b.x0);
    return {
      defs: [...this.defs.values()].join(""),
      body: body.join(""),
      usesBitmaps: this.usesBitmaps,
      paths: this.paths,
      bounds: hasB ? { ...this.b } : undefined,
      fields: this.fields,
    };
  }

  private def(key: string, make: (id: string) => string): string {
    const known = this.defs.get(key);
    if (known) return known.match(/id="([^"]+)"/)?.[1] as string;
    const id = `d${++this.ids}`;
    this.defs.set(key, make(id));
    return id;
  }

  private grow(x: number, y: number): void {
    if (x < this.b.x0) this.b.x0 = x;
    if (y < this.b.y0) this.b.y0 = y;
    if (x > this.b.x1) this.b.x1 = x;
    if (y > this.b.y1) this.b.y1 = y;
  }

  // ---- display lists

  private renderTimelineItems(
    tl: TimelineData,
    frame: number,
    m: Matrix,
    cx: CXForm,
    out: string[],
    depth: number,
    clipMode: boolean,
  ): void {
    this.renderItems(displayAt(tl, frame), frame, m, cx, out, depth, clipMode);
  }

  private renderItems(
    items: Item[],
    parentFrame: number,
    m: Matrix,
    cx: CXForm,
    out: string[],
    depth: number,
    clipMode: boolean,
  ): void {
    for (let i = 0; i < items.length; i++) {
      const it = items[i] as Item;
      if (it.clipDepth !== undefined && !clipMode) {
        // Items above this depth up to clipDepth are masked by this item's shape.
        const clipEnd = it.clipDepth;
        const masked: Item[] = [];
        while (i + 1 < items.length && (items[i + 1] as Item).depth <= clipEnd) {
          masked.push(items[++i] as Item);
        }
        const clipShapes: string[] = [];
        this.renderItem(it, parentFrame, m, cx, clipShapes, depth, true);
        const inner: string[] = [];
        this.renderItems(masked, parentFrame, m, cx, inner, depth, false);
        if (inner.length === 0) continue;
        if (clipShapes.length === 0) continue;
        const id = this.def(
          `clip:${clipShapes.join("")}`,
          (cid) => `<clipPath id="${cid}">${clipShapes.join("")}</clipPath>`,
        );
        out.push(`<g clip-path="url(#${id})">${inner.join("")}</g>`);
        continue;
      }
      if (it.clipDepth !== undefined) continue;
      if (it.name && this.opts.hide?.has(it.name)) continue;
      if (this.opts.hideChars?.has(it.charId)) continue;
      this.renderItem(it, parentFrame, m, cx, out, depth, clipMode);
    }
  }

  private renderItem(
    it: Item,
    parentFrame: number,
    m: Matrix,
    cx: CXForm,
    out: string[],
    depth: number,
    clipMode: boolean,
  ): void {
    const ch = this.swf.characters.get(it.charId);
    if (!ch) return;
    const mm = mmul(m, it.matrix);
    const cc = cxmul(cx, it.cx);
    if (ch.type === "sprite") {
      const f = spriteFrame(ch.timeline, it.placedFrame, parentFrame);
      this.renderChar(it.charId, mm, cc, out, depth + 1, f, it.ratio, clipMode);
    } else {
      this.renderChar(it.charId, mm, cc, out, depth + 1, 0, it.ratio, clipMode);
    }
  }

  private renderChar(
    id: number,
    m: Matrix,
    cx: CXForm,
    out: string[],
    depth: number,
    frame: number,
    ratio: number,
    clipMode: boolean,
  ): void {
    if (depth > MAX_DEPTH) throw new SwfError("sprite nesting too deep");
    const ch = this.swf.characters.get(id);
    if (!ch) return;
    switch (ch.type) {
      case "shape":
        this.paintShape(ch.def, m, cx, out, clipMode);
        break;
      case "morph":
        this.paintShape(morphAt(ch.def, ratio / 65535), m, cx, out, clipMode);
        break;
      case "sprite":
        this.renderTimelineItems(ch.timeline, frame, m, cx, out, depth, clipMode);
        break;
      case "button": {
        const want = this.opts.buttonState ?? 1;
        const recs = ch.records.filter((r) => r.states & want).sort((a, b) => a.depth - b.depth);
        for (const r of recs) {
          const rcx = r.cx ? cxmul(cx, r.cx) : cx;
          this.renderChar(r.charId, mmul(m, r.matrix), rcx, out, depth + 1, 0, 0, clipMode);
        }
        break;
      }
      case "text":
        this.paintText(ch, m, cx, out, clipMode);
        break;
      case "edit":
        if (!clipMode) this.paintEdit(ch.def, m, cx, out);
        break;
      default:
        break;
    }
  }

  // ---- shapes

  private pathData(loops: Seg[][], m: Matrix, close: boolean): string {
    const [a, b, c, d, tx, ty] = m;
    const X = (x: number, y: number): number => (a * x + c * y + tx) / 20;
    const Y = (x: number, y: number): number => (b * x + d * y + ty) / 20;
    const parts: string[] = [];
    for (const run of loops) {
      const s0 = run[0] as Seg;
      let px = X(s0.x0, s0.y0);
      let py = Y(s0.x0, s0.y0);
      this.grow(px, py);
      parts.push(`M${f2(px)} ${f2(py)}`);
      for (const s of run) {
        const ex = X(s.x1, s.y1);
        const ey = Y(s.x1, s.y1);
        if (s.cx !== undefined && s.cy !== undefined) {
          const qx = X(s.cx, s.cy);
          const qy = Y(s.cx, s.cy);
          parts.push(`Q${f2(qx)} ${f2(qy)} ${f2(ex)} ${f2(ey)}`);
          this.grow(qx, qy);
        } else {
          parts.push(`L${f2(ex)} ${f2(ey)}`);
        }
        this.grow(ex, ey);
        px = ex;
        py = ey;
      }
      if (close) parts.push("Z");
    }
    return parts.join("");
  }

  private paintShape(def: ShapeDef, m: Matrix, cx: CXForm, out: string[], clipMode: boolean): void {
    let ops = this.shapeCache.get(def);
    if (!ops) {
      ops = shapePaintOps(def);
      this.shapeCache.set(def, ops);
    }
    const sc = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
    for (const op of ops) {
      if (op.kind === "fill") {
        const d = this.pathData(op.loops, m, true);
        if (!d) continue;
        this.paths++;
        if (clipMode) {
          out.push(`<path d="${d}" clip-rule="evenodd"/>`);
          continue;
        }
        const fill = this.fillAttr(op.style, m, cx);
        out.push(`<path d="${d}" ${fill} fill-rule="evenodd"/>`);
        if (op.seams.length > 0 && isOpaque(op.style, cx)) {
          // Overpaint the shared edges by a quarter pixel so antialiasing leaves no hairline gap.
          const sd = this.pathData(op.seams, m, false);
          const paint = fill.match(/fill="([^"]+)"/)?.[1] ?? "none";
          out.push(
            `<path d="${sd}" fill="none" stroke="${paint}" stroke-width="0.5" stroke-linejoin="round" stroke-linecap="round"/>`,
          );
        }
      } else if (!clipMode) {
        const d = this.pathData(op.loops, m, false);
        if (!d) continue;
        this.paths++;
        out.push(`<path d="${d}" ${this.strokeAttr(op.style, sc, cx)}/>`);
      }
    }
  }

  private strokeAttr(st: LineStyle, sc: number, cx: CXForm): string {
    const c = applyCx(st.color, cx);
    const w = Math.max((st.width / 20) * sc, 0.5);
    const op = c.a < 255 ? ` stroke-opacity="${f2(c.a / 255)}"` : "";
    return `fill="none" stroke="${rgb(c)}"${op} stroke-width="${f2(w)}" stroke-linecap="round" stroke-linejoin="round"`;
  }

  private fillAttr(st: FillStyle, m: Matrix, cx: CXForm): string {
    if (st.type === "solid") {
      const c = applyCx(st.color, cx);
      return c.a < 255 ? `fill="${rgb(c)}" fill-opacity="${f2(c.a / 255)}"` : `fill="${rgb(c)}"`;
    }
    if (st.type === "grad") {
      const g = mmul(m, st.matrix);
      const stops = st.stops.map((s) => {
        const c = applyCx(s.color, cx);
        const o = c.a < 255 ? ` stop-opacity="${f2(c.a / 255)}"` : "";
        return `<stop offset="${f2(s.ratio / 255)}" stop-color="${rgb(c)}"${o}/>`;
      });
      const tr = matrixAttr(g, 1 / 20);
      const key = `grad:${st.radial}:${tr}:${stops.join("")}`;
      const id = this.def(key, (gid) =>
        st.radial
          ? `<radialGradient id="${gid}" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="16384" gradientTransform="${tr}">${stops.join("")}</radialGradient>`
          : `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="-16384" y1="0" x2="16384" y2="0" gradientTransform="${tr}">${stops.join("")}</linearGradient>`,
      );
      return `fill="url(#${id})"`;
    }
    const ch = this.swf.characters.get(st.id);
    if (ch?.type !== "bitmap") return 'fill="#ff00ff"';
    const bm = ch.def;
    if (bm.kind !== "jpeg" || bm.hasAlpha)
      throw new SwfError(`unsupported bitmap kind in fill (tag ${bm.tag})`);
    this.usesBitmaps = true;
    const imgKey = `img:${st.id}`;
    const href = `data:image/jpeg;base64,${Buffer.from(bm.data).toString("base64")}`;
    const imgId = this.def(
      imgKey,
      (iid) => `<image id="${iid}" width="${bm.width}" height="${bm.height}" href="${href}"/>`,
    );
    // Bitmap pixel -> shape twips (fill matrix) -> placement -> pixels.
    const trans = matrixAttr(mmul(m, st.matrix), 1 / 20);
    const pid = this.def(
      `pat:${st.id}:${trans}`,
      (pid2) =>
        `<pattern id="${pid2}" patternUnits="userSpaceOnUse" width="${bm.width}" height="${bm.height}" patternTransform="${trans}"><use href="#${imgId}"/></pattern>`,
    );
    return `fill="url(#${pid})"`;
  }

  // ---- text

  private glyphPath(font: FontDef, index: number, gm: Matrix): string {
    const g = font.glyphs[index];
    if (!g) return "";
    let ops = this.shapeCache.get(g);
    if (!ops) {
      ops = shapePaintOps(g);
      this.shapeCache.set(g, ops);
    }
    let d = "";
    for (const op of ops) if (op.kind === "fill") d += this.pathData(op.loops, gm, true);
    return d;
  }

  private paintText(
    ch: Extract<import("./types.js").Character, { type: "text" }>,
    m: Matrix,
    cx: CXForm,
    out: string[],
    clipMode: boolean,
  ): void {
    const base = mmul(m, ch.matrix);
    let font: FontDef | undefined;
    let color: Color = { r: 0, g: 0, b: 0, a: 255 };
    let x = 0;
    let y = 0;
    let h = 240;
    for (const run of ch.runs) {
      if (run.fontId !== undefined) font = this.swf.fonts.get(run.fontId);
      if (run.color) color = run.color;
      if (run.x !== undefined) x = run.x;
      if (run.y !== undefined) y = run.y;
      if (run.height !== undefined) h = run.height;
      let d = "";
      for (const g of run.glyphs) {
        if (font) {
          const gm = mmul(base, [h / 1024, 0, 0, h / 1024, x, y]);
          d += this.glyphPath(font, g.index, gm);
        }
        x += g.advance;
      }
      if (!d) continue;
      this.paths++;
      if (clipMode) out.push(`<path d="${d}"/>`);
      else {
        const c = applyCx(color, cx);
        const op = c.a < 255 ? ` fill-opacity="${f2(c.a / 255)}"` : "";
        out.push(`<path d="${d}" fill="${rgb(c)}"${op}/>`);
      }
    }
  }

  private paintEdit(def: EditTextDef, m: Matrix, cx: CXForm, out: string[]): void {
    const { xMin, xMax, yMin, yMax } = def.bounds;
    const corner = (x: number, y: number): [number, number] => [
      (m[0] * x + m[2] * y + m[4]) / 20,
      (m[1] * x + m[3] * y + m[5]) / 20,
    ];
    const [x0, y0] = corner(xMin, yMin);
    const [x1, y1] = corner(xMax, yMax);
    this.grow(x0, y0);
    this.grow(x1, y1);
    const font = def.fontId !== undefined ? this.swf.fonts.get(def.fontId) : undefined;
    if (def.variable)
      this.fields.push({ variable: def.variable, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    const html = (def.flags2 & 2) !== 0 && def.text ? parseHtmlText(def.text) : undefined;
    const text = html ? html.text : def.text;
    if (text) {
      const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
      const size =
        html?.size !== undefined ? html.size * scale : ((def.fontHeight ?? 240) / 20) * scale;
      let color = def.color ?? { r: 0, g: 0, b: 0, a: 255 };
      if (html?.color) color = html.color;
      const c = applyCx(color, cx);
      const align = html?.align ?? def.align ?? 0;
      const lm = ((def.leftMargin ?? 0) / 20) * m[0];
      const rm = ((def.rightMargin ?? 0) / 20) * m[0];
      const anchor = align === 2 ? "middle" : align === 1 ? "end" : "start";
      const tx = align === 2 ? (x0 + x1) / 2 : align === 1 ? x1 - rm : x0 + lm + 2;
      const fam = fontFamily(html?.face ?? font?.name);
      const lines = text.split(/\r\n|\r|\n/);
      const bold = font?.bold ? ' font-weight="bold"' : "";
      const ital = font?.italic ? ' font-style="italic"' : "";
      const tspans = lines
        .map(
          (l, i) => `<tspan x="${f2(tx)}" y="${f2(y0 + size * (1 + i * 1.2))}">${esc(l)}</tspan>`,
        )
        .join("");
      out.push(
        `<text font-family="${fam}" font-size="${f2(size)}"${bold}${ital} fill="${rgb(c)}" text-anchor="${anchor}">${tspans}</text>`,
      );
    } else if (this.opts.fieldMarkers) {
      out.push(
        `<rect x="${f2(x0)}" y="${f2(y0)}" width="${f2(x1 - x0)}" height="${f2(y1 - y0)}" fill="none" stroke="#00a0c0" stroke-width="0.5" stroke-dasharray="3 2" opacity="0.7"/>`,
      );
    }
  }
}

interface HtmlText {
  text: string;
  face?: string;
  size?: number;
  color?: Color;
  align?: number;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Flash text fields can hold a small HTML subset; reduce it to plain text plus the first style. */
export function parseHtmlText(src: string): HtmlText {
  const out: HtmlText = { text: "" };
  const font = /<font\b([^>]*)>/i.exec(src);
  if (font) {
    const attrs = font[1] as string;
    const face = /face\s*=\s*"([^"]*)"/i.exec(attrs);
    const size = /size\s*=\s*"?(\d+)/i.exec(attrs);
    const color = /color\s*=\s*"#([0-9a-f]{6})"/i.exec(attrs);
    if (face?.[1]) out.face = face[1];
    if (size?.[1]) out.size = Number(size[1]);
    if (color?.[1]) {
      const v = Number.parseInt(color[1], 16);
      out.color = { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255, a: 255 };
    }
  }
  const al = /<p\b[^>]*align\s*=\s*"(\w+)"/i.exec(src);
  if (al?.[1]) out.align = { left: 0, right: 1, center: 2 }[al[1].toLowerCase() as "left"] ?? 0;
  out.text = src
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|\w+);/g, (m, e: string) =>
      e.startsWith("#") ? String.fromCharCode(Number(e.slice(1))) : (ENTITIES[e] ?? m),
    )
    .replace(/\n+$/, "");
  return out;
}

function fontFamily(name: string | undefined): string {
  if (!name) return "Arial, Helvetica, sans-serif";
  const n = name.replace(/[^A-Za-z0-9 _-]/g, "");
  return `${n}, Arial, Helvetica, sans-serif`;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function svgDocument(
  r: RenderResult,
  w: number,
  h: number,
  opts: { background?: Color | undefined; title?: string | undefined; box?: Box | undefined } = {},
): string {
  const box = opts.box ?? { x: 0, y: 0, w, h };
  const bg = opts.background
    ? `<rect x="${f2(box.x)}" y="${f2(box.y)}" width="${f2(box.w)}" height="${f2(box.h)}" fill="${rgb(opts.background)}"/>`
    : "";
  const title = opts.title ? `<title>${esc(opts.title)}</title>` : "";
  const defs = r.defs ? `<defs>${r.defs}</defs>` : "";
  const xl = r.usesBitmaps ? ' xmlns:xlink="http://www.w3.org/1999/xlink"' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg"${xl} width="${f2(w)}" height="${f2(h)}" viewBox="${f2(box.x)} ${f2(box.y)} ${f2(box.w)} ${f2(box.h)}">${title}${defs}${bg}${r.body}</svg>\n`;
}
