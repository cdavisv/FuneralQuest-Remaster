import { MAP_H, MAP_W } from "./mapData.js";

interface BoxSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  front: string;
  side: string;
  roof: string;
  windows?: boolean;
}

/** y is the bottom edge of the front face. */
const BUILDINGS: BoxSpec[] = [
  {
    id: "spirit-university",
    x: 100,
    y: 175,
    w: 130,
    d: 28,
    h: 78,
    front: "#d98d56",
    side: "#a8643a",
    roof: "#c0753f",
    windows: true,
  },
  {
    id: "yangs",
    x: 122,
    y: 345,
    w: 110,
    d: 30,
    h: 62,
    front: "#e9eaee",
    side: "#a9aab2",
    roof: "#1f3a31",
    windows: true,
  },
  {
    id: "church",
    x: 388,
    y: 392,
    w: 70,
    d: 30,
    h: 60,
    front: "#8a5a34",
    side: "#5e3a1c",
    roof: "#6d4524",
  },
  {
    id: "cafe",
    x: 485,
    y: 260,
    w: 70,
    d: 34,
    h: 100,
    front: "#5d5f66",
    side: "#3f4046",
    roof: "#4a4b52",
    windows: true,
  },
  {
    id: "funeral-home",
    x: 645,
    y: 392,
    w: 90,
    d: 32,
    h: 70,
    front: "#e8e4e0",
    side: "#8c7d76",
    roof: "#2b2b30",
    windows: true,
  },
  {
    id: "store",
    x: 610,
    y: 535,
    w: 100,
    d: 32,
    h: 55,
    front: "#e6d27a",
    side: "#b19a3f",
    roof: "#d4bf61",
  },
  {
    id: "hospital",
    x: 405,
    y: 640,
    w: 80,
    d: 36,
    h: 105,
    front: "#dadcde",
    side: "#9a9ca0",
    roof: "#c4c6c8",
    windows: true,
  },
  // Expanded places (no original art: stand-ins in the same flat style).
  {
    id: "city-hall",
    x: 760,
    y: 585,
    w: 70,
    d: 28,
    h: 58,
    front: "#eae5d9",
    side: "#b9b2a1",
    roof: "#d2cbb9",
    windows: true,
  },
  {
    id: "reaper-club",
    x: 880,
    y: 590,
    w: 70,
    d: 26,
    h: 58,
    front: "#2b2b35",
    side: "#1a1a21",
    roof: "#3a3a46",
  },
  // Batch A places (stand-ins).
  {
    id: "police-station",
    x: 288,
    y: 98,
    w: 70,
    d: 20,
    h: 46,
    front: "#aebfd6",
    side: "#6f7f96",
    roof: "#8c9db4",
  },
  {
    id: "crematorium",
    x: 388,
    y: 98,
    w: 70,
    d: 20,
    h: 46,
    front: "#7a6d66",
    side: "#4d433e",
    roof: "#5c514b",
  },
  {
    id: "florist",
    x: 488,
    y: 98,
    w: 70,
    d: 20,
    h: 46,
    front: "#f2c6d4",
    side: "#b88a98",
    roof: "#dda8ba",
  },
  {
    id: "gazette",
    x: 588,
    y: 98,
    w: 70,
    d: 20,
    h: 46,
    front: "#e8e0c8",
    side: "#a89f84",
    roof: "#cfc6a8",
  },
  // Batch B places (stand-ins).
  {
    id: "coroner",
    x: 618,
    y: 700,
    w: 62,
    d: 20,
    h: 40,
    front: "#c9d4cf",
    side: "#8c9a94",
    roof: "#aab8b1",
  },
  {
    id: "health-department",
    x: 714,
    y: 700,
    w: 62,
    d: 20,
    h: 40,
    front: "#d9e6d2",
    side: "#9bac92",
    roof: "#c2d2b8",
  },
  {
    id: "pawn-shop",
    x: 810,
    y: 700,
    w: 62,
    d: 20,
    h: 40,
    front: "#c9a55a",
    side: "#8f6f2c",
    roof: "#a88a3f",
  },
  {
    id: "mournes",
    x: 906,
    y: 700,
    w: 62,
    d: 20,
    h: 40,
    front: "#3a3238",
    side: "#241f23",
    roof: "#4a4147",
  },
  {
    id: "bank",
    x: 92,
    y: 660,
    w: 90,
    d: 30,
    h: 90,
    front: "#d9d9dd",
    side: "#9c9ca3",
    roof: "#e6e6ea",
  },
];

const HOUSES = [
  { x: 870, y: 335 },
  { x: 890, y: 405 },
  { x: 862, y: 455 },
];

function Box({ b }: { b: BoxSpec }) {
  const { x, y, w, d, h } = b;
  const dy = d * 0.5;
  return (
    <g>
      <ellipse cx={x + w / 2 + d / 2} cy={y + 10} rx={w * 0.7} ry={14} fill="#000" opacity="0.18" />
      <polygon
        points={`${x},${y} ${x + w},${y} ${x + w},${y - h} ${x},${y - h}`}
        fill={b.front}
        stroke="#222"
        strokeWidth="1.5"
      />
      <polygon
        points={`${x + w},${y} ${x + w + d},${y - dy} ${x + w + d},${y - dy - h} ${x + w},${y - h}`}
        fill={b.side}
        stroke="#222"
        strokeWidth="1.5"
      />
      <polygon
        points={`${x},${y - h} ${x + w},${y - h} ${x + w + d},${y - dy - h} ${x + d},${y - dy - h}`}
        fill={b.roof}
        stroke="#222"
        strokeWidth="1.5"
      />
      {b.windows &&
        [0.18, 0.5, 0.78].flatMap((fx) =>
          [0.2, 0.5, 0.78].map((fy) => (
            <rect
              key={`${fx}-${fy}`}
              x={x + w * fx - 5}
              y={y - h * fy - 6}
              width="10"
              height="12"
              fill="#f3f6ff"
              stroke="#333"
              strokeWidth="1"
            />
          )),
        )}
    </g>
  );
}

/** Stand-in overhead map used until the exported art exists. Drawn in the same coordinates as the hot-spots. */
export function FallbackMap() {
  return (
    <svg
      className="fq-fallback-map"
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern id="fq-gravel" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#a3a3a3" />
          <circle cx="2" cy="2" r="1" fill="#8e8e8e" />
          <circle cx="6" cy="5" r="1" fill="#b6b6b6" />
        </pattern>
        <pattern id="fq-water" width="14" height="14" patternUnits="userSpaceOnUse">
          <rect width="14" height="14" fill="#566a71" />
          <path d="M0 7 Q3.5 4 7 7 T14 7" stroke="#6b8189" strokeWidth="1" fill="none" />
        </pattern>
      </defs>
      <rect width={MAP_W} height={MAP_H} fill="url(#fq-gravel)" />
      <path
        d="M0 430 C140 380 300 440 380 330 C470 210 540 110 640 0 L760 0 C690 130 600 270 560 360 C500 480 330 520 190 560 C100 580 40 620 0 700 Z"
        fill="url(#fq-water)"
        stroke="#3b4a50"
        strokeWidth="4"
      />
      <path
        d="M0 40 L420 40 C470 60 430 110 400 130 C340 170 290 150 250 190 C180 250 60 260 0 250 Z"
        fill="#a8c66f"
        stroke="#6f8f3e"
        strokeWidth="3"
      />
      <path
        d="M560 340 C620 250 700 190 760 70 C800 30 900 40 1024 30 L1024 560 C960 560 860 500 780 440 C700 400 600 400 560 340 Z"
        fill="#a3c46b"
        stroke="#6f8f3e"
        strokeWidth="3"
      />
      <path
        d="M980 120 L820 300"
        stroke="#efece4"
        strokeWidth="26"
        strokeLinecap="round"
        opacity="0.9"
      />
      {[
        [760, 130],
        [820, 190],
        [870, 150],
        [905, 205],
        [790, 230],
      ].map(([cx, cy]) => (
        <g key={`${cx}-${cy}`} stroke="#6b4a1c" strokeWidth="4" strokeLinecap="round">
          <path d={`M${cx} ${(cy ?? 0) - 28} v50 M${(cx ?? 0) - 15} ${(cy ?? 0) - 12} h30`} />
        </g>
      ))}
      <rect
        x="818"
        y="140"
        width="34"
        height="42"
        rx="14"
        fill="#c5c9cf"
        stroke="#444"
        strokeWidth="2"
      />
      <text x="835" y="165" textAnchor="middle" fontSize="9" fill="#333">
        R.I.P
      </text>
      {BUILDINGS.map((b) => (
        <Box key={b.id} b={b} />
      ))}
      <path d="M392 330 L425 300 L460 330 Z" fill="#6d4524" stroke="#222" strokeWidth="1.5" />
      <path d="M425 300 v-42 M410 276 h30" stroke="#e6c35c" strokeWidth="7" strokeLinecap="round" />
      {HOUSES.map((h) => (
        <Box
          key={h.y}
          b={{
            id: `h${h.y}`,
            x: h.x,
            y: h.y,
            w: 56,
            d: 24,
            h: 44,
            front: "#c7cf9a",
            side: "#8d9460",
            roof: "#6c7140",
            windows: true,
          }}
        />
      ))}
    </svg>
  );
}
