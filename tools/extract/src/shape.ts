import type {
  Color,
  CXForm,
  FillStyle,
  GradStop,
  LineStyle,
  Matrix,
  MorphDef,
  ShapeDef,
  ShapeRec,
} from "./types.js";

/** A straight or quadratic edge in twips. */
export interface Seg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Control point of a quadratic curve. */
  cx?: number;
  cy?: number;
}

export type PaintOp =
  | { kind: "fill"; style: FillStyle; loops: Seg[][]; seams: Seg[][] }
  | { kind: "line"; style: LineStyle; loops: Seg[][] };

const KEY_OFF = 1 << 22;
const key = (x: number, y: number): number => (x + KEY_OFF) * 2 ** 24 + (y + KEY_OFF);

/** Join edges end-to-start into runs. Under the even-odd rule the split into runs does not change the area. */
function chain(edges: Seg[]): Seg[][] {
  const byStart = new Map<number, number[]>();
  edges.forEach((e, i) => {
    const k = key(e.x0, e.y0);
    const l = byStart.get(k);
    if (l) l.push(i);
    else byStart.set(k, [i]);
  });
  const used = new Uint8Array(edges.length);
  const loops: Seg[][] = [];
  for (let i = 0; i < edges.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const first = edges[i] as Seg;
    const run: Seg[] = [first];
    let cur = first;
    for (;;) {
      const cand = byStart.get(key(cur.x1, cur.y1));
      let next = -1;
      if (cand) {
        while (cand.length) {
          const j = cand.pop() as number;
          if (!used[j]) {
            next = j;
            break;
          }
        }
      }
      if (next < 0) break;
      used[next] = 1;
      cur = edges[next] as Seg;
      run.push(cur);
      if (cur.x1 === first.x0 && cur.y1 === first.y0) break;
    }
    loops.push(run);
  }
  return loops;
}

/** Joins consecutive edges of a stroke into polylines, in record order. */
function chainLine(edges: Seg[]): Seg[][] {
  const out: Seg[][] = [];
  let cur: Seg[] = [];
  let lx = Number.NaN;
  let ly = Number.NaN;
  for (const e of edges) {
    if (e.x0 !== lx || e.y0 !== ly) {
      if (cur.length) out.push(cur);
      cur = [];
    }
    cur.push(e);
    lx = e.x1;
    ly = e.y1;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Converts shape records to paint operations: per style group, fills by style index, then strokes. */
export function shapePaintOps(def: ShapeDef): PaintOp[] {
  const ops: PaintOp[] = [];
  let fills = def.fills;
  let lines = def.lines;
  let fe = new Map<number, Seg[]>();
  let le = new Map<number, Seg[]>();
  // Edges shared by two different fills: antialiasing leaves a hairline gap there unless overpainted.
  let se = new Map<number, Seg[]>();
  let x = 0;
  let y = 0;
  let f0 = 0;
  let f1 = 0;
  let ln = 0;
  const flush = (): void => {
    for (const i of [...fe.keys()].sort((a, b) => a - b)) {
      const st = fills[i - 1];
      if (st)
        ops.push({
          kind: "fill",
          style: st,
          loops: chain(fe.get(i) as Seg[]),
          seams: chainLine(se.get(i) ?? []),
        });
    }
    for (const i of [...le.keys()].sort((a, b) => a - b)) {
      const st = lines[i - 1];
      if (st) ops.push({ kind: "line", style: st, loops: chainLine(le.get(i) as Seg[]) });
    }
    fe = new Map();
    le = new Map();
    se = new Map();
  };
  const add = (s: Seg): void => {
    if (f0) {
      const rev: Seg = { x0: s.x1, y0: s.y1, x1: s.x0, y1: s.y0 };
      if (s.cx !== undefined && s.cy !== undefined) {
        rev.cx = s.cx;
        rev.cy = s.cy;
      }
      const l = fe.get(f0);
      if (l) l.push(rev);
      else fe.set(f0, [rev]);
    }
    if (f1) {
      const l = fe.get(f1);
      if (l) l.push(s);
      else fe.set(f1, [s]);
    }
    if (f0 && f1 && f0 !== f1) {
      for (const f of [f0, f1]) {
        const l = se.get(f);
        if (l) l.push(s);
        else se.set(f, [s]);
      }
    }
    if (ln) {
      const l = le.get(ln);
      if (l) l.push(s);
      else le.set(ln, [s]);
    }
  };
  for (const r of def.recs) {
    if (r.k === "style") {
      if (r.newStyles) {
        flush();
        fills = r.newStyles.fills;
        lines = r.newStyles.lines;
      }
      if (r.moveTo) [x, y] = r.moveTo;
      if (r.f0 !== undefined) f0 = r.f0;
      if (r.f1 !== undefined) f1 = r.f1;
      if (r.ln !== undefined) ln = r.ln;
    } else if (r.k === "line") {
      if (r.dx !== 0 || r.dy !== 0) add({ x0: x, y0: y, x1: x + r.dx, y1: y + r.dy });
      x += r.dx;
      y += r.dy;
    } else {
      const cx = x + r.cx;
      const cy = y + r.cy;
      const ax = cx + r.ax;
      const ay = cy + r.ay;
      add({ x0: x, y0: y, x1: ax, y1: ay, cx, cy });
      x = ax;
      y = ay;
    }
  }
  flush();
  return ops;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function lerpColor(a: Color, b: Color, t: number): Color {
  return { r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t), a: lerp(a.a, b.a, t) };
}

function lerpMatrix(a: Matrix, b: Matrix, t: number): Matrix {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
    lerp(a[3], b[3], t),
    lerp(a[4], b[4], t),
    lerp(a[5], b[5], t),
  ];
}

function lerpFill(a: FillStyle, b: FillStyle, t: number): FillStyle {
  if (a.type === "solid" && b.type === "solid")
    return { type: "solid", color: lerpColor(a.color, b.color, t) };
  if (a.type === "grad" && b.type === "grad") {
    const stops: GradStop[] = a.stops.map((s, i) => {
      const o = b.stops[i] ?? s;
      return { ratio: lerp(s.ratio, o.ratio, t), color: lerpColor(s.color, o.color, t) };
    });
    return { type: "grad", radial: a.radial, matrix: lerpMatrix(a.matrix, b.matrix, t), stops };
  }
  if (a.type === "bitmap" && b.type === "bitmap") {
    return {
      type: "bitmap",
      id: a.id,
      matrix: lerpMatrix(a.matrix, b.matrix, t),
      clipped: a.clipped,
    };
  }
  return a;
}

/** Interpolates a morph shape at t in 0..1. */
export function morphAt(m: MorphDef, t: number): ShapeDef {
  const recs: ShapeRec[] = [];
  let ei = 0;
  const nextEnd = (): ShapeRec => {
    const e = m.end[ei++];
    if (!e) throw new Error("morph end shape has fewer records than start shape");
    return e;
  };
  for (const s of m.start) {
    if (s.k === "style") {
      const out: ShapeRec = { k: "style" };
      if (s.f0 !== undefined) out.f0 = s.f0;
      if (s.f1 !== undefined) out.f1 = s.f1;
      if (s.ln !== undefined) out.ln = s.ln;
      if (s.moveTo) {
        const e = nextEnd();
        if (e.k !== "style" || !e.moveTo) throw new Error("morph records out of step");
        out.moveTo = [lerp(s.moveTo[0], e.moveTo[0], t), lerp(s.moveTo[1], e.moveTo[1], t)];
      }
      recs.push(out);
      continue;
    }
    const e = nextEnd();
    if (e.k === "style") throw new Error("morph records out of step");
    const sc = s.k === "line" ? { cx: s.dx / 2, cy: s.dy / 2, ax: s.dx / 2, ay: s.dy / 2 } : s;
    const ec = e.k === "line" ? { cx: e.dx / 2, cy: e.dy / 2, ax: e.dx / 2, ay: e.dy / 2 } : e;
    if (s.k === "line" && e.k === "line") {
      recs.push({ k: "line", dx: lerp(s.dx, e.dx, t), dy: lerp(s.dy, e.dy, t) });
    } else {
      recs.push({
        k: "curve",
        cx: lerp(sc.cx, ec.cx, t),
        cy: lerp(sc.cy, ec.cy, t),
        ax: lerp(sc.ax, ec.ax, t),
        ay: lerp(sc.ay, ec.ay, t),
      });
    }
  }
  return {
    bounds: {
      xMin: lerp(m.startBounds.xMin, m.endBounds.xMin, t),
      xMax: lerp(m.startBounds.xMax, m.endBounds.xMax, t),
      yMin: lerp(m.startBounds.yMin, m.endBounds.yMin, t),
      yMax: lerp(m.startBounds.yMax, m.endBounds.yMax, t),
    },
    fills: m.fills.map(([a, b]) => lerpFill(a, b, t)),
    lines: m.lines.map(([a, b]) => ({
      width: lerp(a.width, b.width, t),
      color: lerpColor(a.color, b.color, t),
    })),
    recs,
  };
}

export function mmul(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, x1, y1] = m1;
  const [a2, b2, c2, d2, x2, y2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * x2 + c1 * y2 + x1,
    b1 * x2 + d1 * y2 + y1,
  ];
}

/** Apply c2 first, then c1. */
export function cxmul(c1: CXForm, c2: CXForm): CXForm {
  const mul = c1.mul.map((m, i) => Math.trunc((m * (c2.mul[i] as number)) / 256));
  const add = c1.add.map(
    (a, i) => a + Math.trunc(((c1.mul[i] as number) * (c2.add[i] as number)) / 256),
  );
  return {
    mul: mul as unknown as CXForm["mul"],
    add: add as unknown as CXForm["add"],
  };
}
