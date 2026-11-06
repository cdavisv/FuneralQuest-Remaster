/** places/palors: the foggy street of funeral parlors (redraw of the traced photograph). */
import { lettering } from "../font.mjs";
import { Defs, doc, ellipse, g, mix, n, path, rect, rng, shade, tint } from "../lib.mjs";
import { P } from "../palette.mjs";
import { camera, streetLamp } from "../parts.mjs";

const FOG = "#b4bcc0";

function render() {
  const D = new Defs("pa");
  const R = rng(11);
  const cam = camera({ f: 250, cx: 275, hy: 214, height: 1.7 });
  const out = [];

  // Overcast sky: pale at the horizon, slate above, with long cloud streaks.
  out.push(
    rect(
      0,
      0,
      550,
      400,
      D.lg(0, 0, 0, 215, [
        [0, "#6f7a82"],
        [0.6, "#98a2a8"],
        [1, "#c4cacc"],
      ]),
    ),
  );
  for (const [y, x, w, op] of [
    [40, 300, 260, 0.5],
    [70, 120, 200, 0.35],
    [24, 60, 160, 0.3],
    [105, 380, 180, 0.3],
    [130, 210, 160, 0.25],
  ]) {
    out.push(
      path(
        `M${x} ${y}q${w * 0.2} -9 ${w * 0.45} -3q${w * 0.25} -8 ${w * 0.55} 3q-${w * 0.4} 7 -${w} 0z`,
        "#d8dcdc",
        { opacity: op },
      ),
    );
  }

  // Slices from far to near: a fog veil between each slice thickens the distance.
  const zs = [];
  for (let z = 90; z > 4; z -= z > 30 ? 13 : z > 14 ? 6 : 4.5) zs.push(z);
  const roofs = [P.shackRoof, "#4a4a52", "#5a3a2c", "#3e4a3e", "#55504a"];
  const walls = ["#6b7468", "#8a8378", "#7a6a5e", "#6e7680", "#8c8a7a", "#76705e"];

  const bldg = [];
  // Buildings on both sides: z0 to z1 along the street, set back a little at random.
  for (const s of [-1, 1]) {
    let z = 3.2;
    let i = s < 0 ? 0 : 2;
    while (z < 95) {
      const len = R.range(6, 9.5);
      const h = R.range(5.5, 8.5);
      const gable = R.range(1.6, 3);
      const set = 7 + R.range(0, 0.6);
      bldg.push({
        s,
        z0: z,
        z1: z + len,
        h,
        gable,
        set,
        wall: walls[i % walls.length],
        roof: roofs[i % roofs.length],
        cross: i % 3 !== 1,
        i,
      });
      z += len + R.range(0.4, 1.6);
      i += 1;
    }
  }

  function building(b) {
    const { s, z0, z1, h, gable, set, wall, roof } = b;
    const X = set * s;
    const zm = (z0 + z1) / 2;
    const parts = [];
    const lit = s < 0 ? tint(wall, 0.12) : shade(wall, 0.12);
    // Near end wall (facing us), gabled, from the facade back 8 m.
    const back = X + 8 * s;
    parts.push(
      path(
        cam.poly([
          [X, 0, z0],
          [back, 0, z0],
          [back, h, z0],
          [(X + back) / 2, h + gable, z0],
          [X, h, z0],
        ]),
        shade(wall, 0.25),
        {
          stroke: P.ink,
          strokeWidth: 0.6,
          strokeLinejoin: "round",
        },
      ),
    );
    // Roof plane rising away from the street to the ridge (visible above the eave).
    const ridge = X + 4 * s;
    parts.push(
      path(
        cam.poly([
          [X + 0.4 * s * -1, h - 0.1, z0 - 0.3],
          [ridge, h + 3.2, z0 - 0.3],
          [ridge, h + 3.2, z1 + 0.3],
          [X - 0.4 * s, h - 0.1, z1 + 0.3],
        ]),
        roof,
        {
          stroke: P.ink,
          strokeWidth: 0.6,
          strokeLinejoin: "round",
        },
      ),
    );
    // shingle courses
    let courses = "";
    for (let t = 0.2; t < 1; t += 0.2) {
      const yy = h - 0.1 + 3.3 * t;
      const xx = X - 0.4 * s + (ridge - X + 0.4 * s) * t;
      const p1 = cam.pr(xx, yy, z0 - 0.3);
      const p2 = cam.pr(xx, yy, z1 + 0.3);
      courses += `M${n(p1[0])} ${n(p1[1])}L${n(p2[0])} ${n(p2[1])}`;
    }
    parts.push(path(courses, "none", { stroke: shade(roof, 0.35), strokeWidth: 0.5 }));
    // chimney on some
    if (b.i % 2 === 0) {
      const cz = z0 + (z1 - z0) * 0.25;
      parts.push(
        path(
          cam.poly([
            [ridge - 1.2 * s, h + 2, cz],
            [ridge - 1.2 * s, h + 4.6, cz],
            [ridge - 1.2 * s, h + 4.6, cz + 0.9],
            [ridge - 1.2 * s, h + 2, cz + 0.9],
          ]),
          "#6a4a3a",
          { stroke: P.ink, strokeWidth: 0.5 },
        ),
      );
    }
    // Facade (plane X), with a pediment over the middle.
    parts.push(
      path(
        cam.poly([
          [X, 0, z0],
          [X, h, z0],
          [X, h, zm - 2],
          [X, h + gable, zm],
          [X, h, zm + 2],
          [X, h, z1],
          [X, 0, z1],
        ]),
        lit,
        {
          stroke: P.ink,
          strokeWidth: 0.7,
          strokeLinejoin: "round",
        },
      ),
    );
    // Roof: a strip seen from below along the eave, darker.
    parts.push(
      path(
        cam.poly([
          [X, h, z0],
          [X - 0.5 * s, h - 0.05, z0],
          [X - 0.5 * s, h - 0.05, z1],
          [X, h, z1],
        ]),
        roof,
        { stroke: P.ink, strokeWidth: 0.5 },
      ),
    );
    // Pediment trim.
    parts.push(
      path(
        `M${[
          [X - 0.2 * s, h, zm - 2.3],
          [X - 0.2 * s, h + gable + 0.2, zm],
          [X - 0.2 * s, h, zm + 2.3],
        ]
          .map(([a, b2, c]) =>
            cam
              .pr(a, b2, c)
              .map((v) => n(v))
              .join(" "),
          )
          .join("L")}`,
        "none",
        {
          stroke: tint(wall, 0.45),
          strokeWidth: Math.max(0.6, cam.s(zm) * 0.12),
          strokeLinejoin: "round",
        },
      ),
    );
    // Arched door with steps.
    const dz0 = zm - 0.75;
    const dz1 = zm + 0.75;
    const dh = 2.5;
    const door = [];
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI * (k / 8);
      door.push(cam.pr(X - 0.02 * s, dh + Math.sin(a) * 0.75, zm - Math.cos(a) * 0.75));
    }
    const [dl] = [cam.pr(X - 0.02 * s, 0.3, dz0)];
    const dr = cam.pr(X - 0.02 * s, 0.3, dz1);
    const dp = `M${n(dl[0])} ${n(dl[1])}L${door.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}L${n(dr[0])} ${n(dr[1])}Z`;
    parts.push(path(dp, b.i % 2 ? "#3a2418" : "#2a1e1a", { stroke: P.ink, strokeWidth: 0.6 }));
    parts.push(
      path(
        cam.poly([
          [X, 0, dz0 - 0.4],
          [X - 0.6 * s, 0, dz0 - 0.4],
          [X - 0.6 * s, 0.3, dz0 - 0.4],
          [X - 0.6 * s, 0.3, dz1 + 0.4],
          [X, 0.3, dz1 + 0.4],
          [X, 0, dz1 + 0.4],
        ]),
        "#a8a49a",
        { stroke: P.ink, strokeWidth: 0.5 },
      ),
    );
    // Windows either side.
    for (const wz of [z0 + (zm - z0) * 0.45, zm + (z1 - zm) * 0.55]) {
      const wy0 = 1.4;
      const wy1 = 3.4;
      const ww = 0.6;
      parts.push(
        path(
          cam.poly([
            [X - 0.02 * s, wy0, wz - ww],
            [X - 0.02 * s, wy1, wz - ww],
            [X - 0.02 * s, wy1, wz + ww],
            [X - 0.02 * s, wy0, wz + ww],
          ]),
          "#3e4a52",
          {
            stroke: tint(wall, 0.5),
            strokeWidth: Math.max(0.5, cam.s(wz) * 0.1),
          },
        ),
      );
      const m1 = cam.pr(X - 0.02 * s, (wy0 + wy1) / 2, wz - ww);
      const m2 = cam.pr(X - 0.02 * s, (wy0 + wy1) / 2, wz + ww);
      const v1 = cam.pr(X - 0.02 * s, wy0, wz);
      const v2 = cam.pr(X - 0.02 * s, wy1, wz);
      parts.push(
        path(
          `M${n(m1[0])} ${n(m1[1])}L${n(m2[0])} ${n(m2[1])}M${n(v1[0])} ${n(v1[1])}L${n(v2[0])} ${n(v2[1])}`,
          "none",
          {
            stroke: tint(wall, 0.5),
            strokeWidth: Math.max(0.4, cam.s(wz) * 0.06),
          },
        ),
      );
      // a cold reflection
      parts.push(
        path(
          cam.poly([
            [X - 0.03 * s, wy1 - 0.2, wz - ww + 0.1],
            [X - 0.03 * s, wy1 - 0.2, wz - ww + 0.5],
            [X - 0.03 * s, wy0 + 0.2, wz - 0.1],
          ]),
          "#8c9aa2",
          { opacity: 0.45 },
        ),
      );
    }
    // Gilded cross in the pediment.
    if (b.cross) {
      const cy = h + gable * 0.42;
      const cw = 0.42;
      const cross = cam.poly([
        [X - 0.05 * s, cy - 0.9, zm - 0.09],
        [X - 0.05 * s, cy + 0.6, zm - 0.09],
        [X - 0.05 * s, cy + 0.6, zm + 0.09],
        [X - 0.05 * s, cy - 0.9, zm + 0.09],
      ]);
      const arm = cam.poly([
        [X - 0.05 * s, cy + 0.14, zm - cw],
        [X - 0.05 * s, cy + 0.32, zm - cw],
        [X - 0.05 * s, cy + 0.32, zm + cw],
        [X - 0.05 * s, cy + 0.14, zm + cw],
      ]);
      parts.push(path(cross + arm, "#c9a032", { stroke: P.woodDark, strokeWidth: 0.5 }));
    }
    // A blade sign on a bracket, facing up the street, with a coffin painted on it.
    if (b.i % 2 === 1 || b.z0 < 8) {
      const sz = z0 + 0.6;
      const bx0 = X - 0.15 * s;
      const bx1 = X - 1.3 * s;
      const by = 3.6;
      const a1 = cam.pr(bx0, by + 0.95, sz);
      const a2 = cam.pr(bx1 - 0.1 * s, by + 0.95, sz);
      parts.push(
        path(`M${n(a1[0])} ${n(a1[1])}L${n(a2[0])} ${n(a2[1])}`, "none", {
          stroke: "#222",
          strokeWidth: Math.max(0.5, cam.s(sz) * 0.07),
        }),
      );
      const board = cam.poly([
        [bx0 - 0.2 * s, by, sz],
        [bx1, by, sz],
        [bx1, by + 0.85, sz],
        [bx0 - 0.2 * s, by + 0.85, sz],
      ]);
      parts.push(
        path(board, b.i % 3 === 0 ? "#5a2a20" : "#2e3a2e", { stroke: P.ink, strokeWidth: 0.6 }),
      );
      const mx = (bx0 - 0.2 * s + bx1) / 2;
      const cw = 0.18;
      const coffin = cam.poly([
        [mx - cw * 0.6, by + 0.12, sz],
        [mx - cw, by + 0.55, sz],
        [mx - cw * 0.5, by + 0.75, sz],
        [mx + cw * 0.5, by + 0.75, sz],
        [mx + cw, by + 0.55, sz],
        [mx + cw * 0.6, by + 0.12, sz],
      ]);
      parts.push(path(coffin, "#c9a032"));
    }
    return g(parts);
  }

  // Lamps every 11 m on each kerb.
  const blurR = D.blur(1.5);
  const lamps = [];
  for (const s of [-1, 1]) for (let z = s < 0 ? 5 : 9.5; z < 80; z += 11) lamps.push({ s, z });

  const groundPoly = cam.poly([
    [-7.5, 0.18, 1.1],
    [7.5, 0.18, 1.1],
    [7.5, 0.18, 140],
    [-7.5, 0.18, 140],
  ]);
  const roadFill = D.lg(0, 214, 0, 400, [
    [0, "#5a5e60"],
    [0.5, "#44484a"],
    [1, "#2e3032"],
  ]);
  function ground(zNear, zFar) {
    const a = Math.max(zNear, 1.1);
    const b = zFar;
    const parts = [];
    const near = a < 6;
    parts.push(
      path(
        cam.poly([
          [-4, 0, a],
          [4, 0, a],
          [4, 0, b],
          [-4, 0, b],
        ]),
        roadFill,
      ),
    );
    void near;
    for (const s of [-1, 1]) {
      parts.push(
        path(
          cam.poly([
            [4.2 * s, 0.18, a],
            [7.5 * s, 0.18, a],
            [7.5 * s, 0.18, b],
            [4.2 * s, 0.18, b],
          ]),
          "#8a8a84",
        ),
      );
      parts.push(
        path(
          cam.poly([
            [4 * s, 0, a],
            [4.2 * s, 0.18, a],
            [4.2 * s, 0.18, b],
            [4 * s, 0, b],
          ]),
          "#7e7c74",
        ),
      );
    }
    let joints = "";
    for (let z = Math.ceil(a / 2.2) * 2.2; z < b; z += 2.2) {
      for (const s of [-1, 1]) {
        const [p1, p2] = [cam.pr(4.2 * s, 0.18, z), cam.pr(7.5 * s, 0.18, z)];
        joints += `M${n(p1[0])} ${n(p1[1])}L${n(p2[0])} ${n(p2[1])}`;
      }
    }
    if (joints)
      parts.push(path(joints, "none", { stroke: "#6e6e68", strokeWidth: 0.5, opacity: 0.7 }));
    for (let z = Math.ceil(a / 5) * 5; z < b; z += 5) {
      parts.push(
        path(
          cam.poly([
            [-0.08, 0.01, z],
            [0.08, 0.01, z],
            [0.08, 0.01, Math.min(b, z + 2.2)],
            [-0.08, 0.01, Math.min(b, z + 2.2)],
          ]),
          "#a8a490",
          { opacity: 0.7 },
        ),
      );
    }
    return g(parts);
  }

  // The ground once, with its own smooth fog toward the horizon; the veils leave it alone.
  out.push(ground(1.1, 140));
  out.push(
    path(
      groundPoly,
      D.lg(0, 214, 0, 330, [
        [0, FOG, 0.95],
        [0.35, FOG, 0.45],
        [1, FOG, 0],
      ]),
    ),
  );
  for (let k = 0; k < zs.length; k++) {
    const zFar = k === 0 ? 140 : zs[k];
    const zNear = zs[k + 1] ?? 0;
    // fog veil over everything drawn so far
    out.push(
      path(`M-5 -5H555V405H-5Z${groundPoly}`, FOG, {
        opacity: k === 0 ? 0.5 : 0.15,
        fillRule: "evenodd",
      }),
    );
    const inSlice = (z) => z < zFar && z >= zNear;
    for (const b of bldg.filter((x) => inSlice(x.z0)).sort((a, b2) => b2.z0 - a.z0))
      bldg.length && out.push(building(b));
    for (const l of lamps.filter((x) => inSlice(x.z))) {
      const [x, y] = cam.pr(4.55 * l.s, 0.18, l.z);
      const hh = cam.s(l.z) * 3.6;
      out.push(streetLamp(D, x, y, hh, { lit: true }));
      // its wet reflection on the road
      const [rx, ry] = cam.pr(3.4 * l.s, 0, l.z + 0.4);
      const rh = cam.s(l.z) * 1.1;
      if (l.z < 40)
        out.push(
          ellipse(rx, ry + rh * 0.4, rh * 0.07, rh * 0.45, P.lamp1, {
            opacity: 0.3,
            filter: blurR,
          }),
        );
    }
  }
  // Ground mist hugging the street, and a lighter band at the horizon.
  out.push(
    rect(
      0,
      150,
      550,
      110,
      D.lg(0, 150, 0, 260, [
        [0, FOG, 0],
        [0.55, FOG, 0.55],
        [1, FOG, 0],
      ]),
    ),
  );
  // A sign on the nearest left parlor.
  const sgn = cam.pr(-6.95, 4.3, 6.2);
  void sgn;
  void lettering;
  void mix;
  return doc({
    title: "places/palors (Remastered)",
    body: rect(0, 0, 550, 400, P.black) + out.join(""),
    defs: D,
  });
}

export const pieces = [
  {
    id: "places/palors",
    kind: "redraw",
    overrides: "places/palors",
    usedBy: "the rival visit (bg), the Expanded office (bg behind the parlor building)",
    grade: "B",
    notes:
      "One-point street of parlors in fog, drawn in perspective with gas lamps and gilt crosses.",
    render,
  },
];
