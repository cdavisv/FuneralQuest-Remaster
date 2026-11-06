/** places/store: the Di-Mart casket warehouse aisle (redraw of the traced photograph). */
import { lettering } from "../font.mjs";
import { Defs, doc, g, n, path, rect, rng, shade, tint } from "../lib.mjs";
import { P } from "../palette.mjs";
import { box3, camera } from "../parts.mjs";

function render() {
  const D = new Defs("st");
  const R = rng(5);
  const camY = 1.55;
  const cam = camera({ f: 260, cx: 290, hy: 172, height: camY });
  const out = [];
  const ceilY = 6.2;
  const far = 26;

  // Room shell: floor, ceiling, back wall.
  out.push(rect(0, 0, 550, 400, "#1c1814"));
  out.push(
    path(
      cam.poly([
        [-12, 0, 1],
        [12, 0, 1],
        [12, 0, far],
        [-12, 0, far],
      ]),
      D.lg(0, 172, 0, 400, [
        [0, "#6e665a"],
        [0.4, "#5a5248"],
        [1, "#3a342e"],
      ]),
    ),
  );
  out.push(
    path(
      cam.poly([
        [-12, ceilY, 1],
        [12, ceilY, 1],
        [12, ceilY, far],
        [-12, ceilY, far],
      ]),
      D.lg(0, 0, 0, 172, [
        [0, "#2a2620"],
        [1, "#4a443c"],
      ]),
    ),
  );
  // Floor seams converging.
  let seams = "";
  for (let x = -6; x <= 6; x += 1.5) {
    const a = cam.pr(x, 0, 1.2);
    const b = cam.pr(x, 0, far);
    seams += `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;
  }
  for (let z = 2; z < far; z *= 1.35) {
    const a = cam.pr(-12, 0, z);
    const b = cam.pr(12, 0, z);
    seams += `M${n(a[0])} ${n(a[1])}L${n(b[0])} ${n(b[1])}`;
  }
  out.push(path(seams, "none", { stroke: "#2e2a24", strokeWidth: 0.6, opacity: 0.5 }));

  // Back wall with the store's banner.
  const bw = cam.poly([
    [-12, 0, far],
    [12, 0, far],
    [12, ceilY, far],
    [-12, ceilY, far],
  ]);
  out.push(path(bw, "#5a5046"));
  const [bx0, by0] = cam.pr(-2.1, 4.6, far);
  const [bx1, by1] = cam.pr(2.1, 3.6, far);
  out.push(rect(bx0, by0, bx1 - bx0, by1 - by0, "#d8c060", { stroke: P.ink, strokeWidth: 0.8 }));
  out.push(rect(bx0 + 2, by0 + 2, 4, by1 - by0 - 4, "#c03030"));
  out.push(rect(bx1 - 6, by0 + 2, 4, by1 - by0 - 4, "#c03030"));
  out.push(
    lettering("DI-MART", (bx0 + bx1) / 2, by0 + (by1 - by0) * 0.24, (by1 - by0) * 0.52, "#2a2010", {
      align: "middle",
      weight: 0.17,
    }),
  );
  // A loading door below.
  const [dx0, dy0] = cam.pr(-1.3, 2.9, far);
  const [dx1, dy1] = cam.pr(1.3, 0, far);
  out.push(rect(dx0, dy0, dx1 - dx0, dy1 - dy0, "#3a342c", { stroke: P.ink, strokeWidth: 0.6 }));
  let slats = "";
  for (let y = dy0 + 2.5; y < dy1; y += 2.5) slats += `M${n(dx0)} ${n(y)}H${n(dx1)}`;
  out.push(path(slats, "none", { stroke: "#2a241e", strokeWidth: 0.5 }));

  // Fluorescent tubes on the ceiling, each with its glow.
  for (let z = 3; z < far; z += 3.2) {
    out.push(
      path(
        cam.poly([
          [-0.7, ceilY - 0.05, z],
          [0.7, ceilY - 0.05, z],
          [0.7, ceilY - 0.05, z + 1.2],
          [-0.7, ceilY - 0.05, z + 1.2],
        ]),
        "#f4f2e0",
        {
          stroke: "#8a8676",
          strokeWidth: 0.5,
        },
      ),
    );
  }

  const finishes = [
    { c: "#7a4a24", h: P.goldLo }, // oak
    { c: "#5a2e18", h: P.goldLo }, // mahogany
    { c: "#9aa0a8", h: "#e0e0e0" }, // steel
    { c: "#3a3a3e", h: "#b8b8b8" }, // black lacquer
    { c: "#b08a30", h: "#ffe080" }, // brass
    { c: "#d8d4c8", h: P.goldLo }, // white
  ];

  // Racks on both sides: uprights, beams, and a casket on each bay of each level.
  const levels = [0.15, 1.75, 3.35];
  const parts = [];
  for (let z = far - 2.6; z >= 1.2; z -= 2.6) {
    for (const s of [-1, 1]) {
      const xin = 2.2 * s;
      const xout = 3.4 * s;
      const [xa, xb] = s < 0 ? [xout, xin] : [xin, xout];
      const bay = [];
      // dark back of the bay
      bay.push(
        path(
          cam.poly([
            [xout, 0, z],
            [xout, 4.9, z],
            [xout, 4.9, z + 2.6],
            [xout, 0, z + 2.6],
          ]),
          "#1e1a16",
        ),
      );
      for (const ly of levels) {
        const f = finishes[R.int(0, finishes.length - 1)];
        const ch = 0.62;
        const len = 2.15;
        const zc = z + 0.22;
        const body = f.c;
        // casket as a box with a raised lid band
        bay.push(
          box3(
            cam,
            xa + 0.05 * s,
            xb - 0.05 * s,
            ly + 0.1,
            ly + 0.1 + ch,
            zc,
            zc + len,
            { end: shade(body, 0.25), side: body, top: tint(body, 0.25), bottom: shade(body, 0.4) },
            { lw: 0.6, camY },
          ),
        );
        // lid seam and handle rail along the aisle side
        const xs = xin - 0.001 * s;
        const s1 = cam.pr(xs, ly + 0.1 + ch * 0.62, zc);
        const s2 = cam.pr(xs, ly + 0.1 + ch * 0.62, zc + len);
        const h1 = cam.pr(xs, ly + 0.1 + ch * 0.33, zc + 0.25);
        const h2 = cam.pr(xs, ly + 0.1 + ch * 0.33, zc + len - 0.25);
        bay.push(
          path(`M${n(s1[0])} ${n(s1[1])}L${n(s2[0])} ${n(s2[1])}`, "none", {
            stroke: shade(body, 0.45),
            strokeWidth: 0.6,
          }),
        );
        bay.push(
          path(`M${n(h1[0])} ${n(h1[1])}L${n(h2[0])} ${n(h2[1])}`, "none", {
            stroke: f.h,
            strokeWidth: Math.max(0.6, cam.s(zc) * 0.05),
            strokeLinecap: "round",
          }),
        );
        // a hanging price tag on some
        if (R.next() < 0.45) {
          const t = cam.pr(xs, ly + 0.1 + ch * 0.5, zc + len * 0.5);
          const k = cam.s(zc + len * 0.5);
          bay.push(
            path(
              `M${n(t[0])} ${n(t[1])}l${n(-0.04 * k * s)} ${n(0.18 * k)}h${n(-0.16 * k * s)}l0 ${n(-0.12 * k)}z`,
              "#f0ead0",
              { stroke: P.ink, strokeWidth: 0.4 },
            ),
          );
        }
        // the shelf beam under the casket
        bay.push(
          box3(
            cam,
            xin - 0.02 * s,
            xin + 0.06 * s,
            ly - 0.05,
            ly + 0.1,
            z,
            z + 2.6,
            { end: "#7a2a1a", side: "#c0482a", top: "#d86040", bottom: "#5a1a10" },
            { lw: 0.5, camY },
          ),
        );
      }
      // top beam and upright
      bay.push(
        box3(
          cam,
          xin - 0.02 * s,
          xin + 0.06 * s,
          4.85,
          5.0,
          z,
          z + 2.6,
          { end: "#7a2a1a", side: "#c0482a", bottom: "#5a1a10" },
          { lw: 0.5, camY },
        ),
      );
      bay.push(
        box3(
          cam,
          xin - 0.08 * s,
          xin + 0.08 * s,
          0,
          5.0,
          z,
          z + 0.12,
          { end: "#b04028", side: "#8a3020" },
          { lw: 0.5, camY },
        ),
      );
      parts.push(g(bay));
    }
    // Light falls off with depth: a veil per bay row, far to near.
    parts.push(rect(0, 0, 550, 400, "#2a241e", { opacity: 0.07 }));
  }
  out.push(...parts);
  // Glow from the tubes over the aisle, and a polished-floor reflection down the middle.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(290, 120, 300, [
        [0, "#fff8e0", 0.12],
        [1, "#fff8e0", 0],
      ]),
    ),
  );
  out.push(
    path(
      cam.poly([
        [-1.2, 0.001, 1.2],
        [1.2, 0.001, 1.2],
        [0.6, 0.001, far],
        [-0.6, 0.001, far],
      ]),
      D.lg(0, 172, 0, 400, [
        [0, "#d8d0b8", 0.05],
        [1, "#d8d0b8", 0.18],
      ]),
    ),
  );
  // Vignette.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.rg(275, 190, 380, [
        [0.55, "#000", 0],
        [1, "#000", 0.55],
      ]),
    ),
  );

  return doc({ title: "places/store (Remastered)", body: out.join(""), defs: D });
}

export const pieces = [
  {
    id: "places/store",
    kind: "redraw",
    overrides: "places/store",
    usedBy: "Di-Mart (bg behind people/store_guy)",
    grade: "B",
    notes:
      "The Di-Mart casket aisle: racked caskets in six finishes on red racking, receding to the DI-MART banner; centre kept calm for the store clerk.",
    render,
  },
];
