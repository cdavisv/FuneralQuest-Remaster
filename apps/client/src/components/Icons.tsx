import { useArt } from "../art/ArtContext.js";

/** Small inline SVG icons. All decorative: callers put the accessible name on the parent. */

export type TagKind = "wood" | "silver" | "gold";

const COFFIN_FILL: Record<TagKind, { top: string; side: string; stroke: string }> = {
  wood: { top: "#9a5a2b", side: "#5e3012", stroke: "#2b1405" },
  silver: { top: "#f1f4f8", side: "#9aa4b2", stroke: "#4a5360" },
  gold: { top: "#ffe48a", side: "#c8921a", stroke: "#6b4a06" },
};

export function CoffinIcon({ kind }: { kind: TagKind }) {
  const art = useArt().piece(`coffin-tag-${kind}`);
  if (art) return <img className="fq-coffin fq-coffin-art" src={art} alt="" draggable={false} />;
  const c = COFFIN_FILL[kind];
  // A six-sided coffin seen from above: wide shoulders at the left, a narrow foot at the right.
  const outline = "M2 14 L9 4 L34 8 L42 14 L34 20 L9 24 Z";
  return (
    <svg className="fq-coffin" viewBox="0 0 44 28" aria-hidden="true" focusable="false">
      <path
        d="M2 17 L9 7 L34 11 L42 17 L34 23 L9 27 Z"
        fill={c.side}
        stroke={c.stroke}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d={outline} fill={c.top} stroke={c.stroke} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9 4 L9 24" stroke={c.stroke} strokeWidth="1" opacity="0.5" />
      <path d="M13 14 H34" stroke={c.stroke} strokeWidth="1" opacity="0.35" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="fq-icon">
      <path
        fill="currentColor"
        d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.4h-4L10.7 6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.3 2.6h4l.3-2.6c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"
      />
    </svg>
  );
}

export function ArrowIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="fq-icon">
      <path
        fill="currentColor"
        d={direction === "up" ? "M12 5 L21 18 L3 18 Z" : "M12 19 L3 6 L21 6 Z"}
      />
    </svg>
  );
}

export function QuillIcon() {
  return (
    <svg viewBox="0 0 40 36" aria-hidden="true" focusable="false" className="fq-quill">
      <path
        d="M36 2 C26 4 16 12 12 24 L14 26 C24 22 33 14 36 2 Z"
        fill="#c9cdd6"
        stroke="#4a4f66"
        strokeWidth="1"
      />
      <path d="M12 24 L8 30" stroke="#4a4f66" strokeWidth="1.2" />
      <rect x="4" y="28" width="14" height="7" rx="2" fill="#2b2a55" />
    </svg>
  );
}

export function HouseIcon() {
  return (
    <svg viewBox="0 0 120 70" aria-hidden="true" focusable="false" className="fq-house">
      <path d="M4 30 L60 4 L116 30 Z" fill="#6f7076" stroke="#222" strokeWidth="2" />
      <rect x="10" y="30" width="100" height="36" fill="#9a9ba0" stroke="#222" strokeWidth="2" />
      <rect x="44" y="34" width="32" height="32" fill="#4c4d52" stroke="#222" strokeWidth="2" />
      <path d="M50 66 V46 A10 10 0 0 1 70 46 V66" fill="#2c2d31" />
      {[18, 28, 84, 94].map((x) => (
        <rect
          key={x}
          x={x}
          y="38"
          width="8"
          height="12"
          fill="#d6d7dc"
          stroke="#222"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}

export type MoodTier = 0 | 1 | 2 | 3;

const TIER_COLOR: Record<MoodTier, string> = {
  0: "#7bd36b",
  1: "#f3e45a",
  2: "#f59a3a",
  3: "#ec4a3a",
};

/** A face whose mouth and brows carry the mood as well as its colour. */
export function MoodFace({ tier }: { tier: MoodTier }) {
  const mouth = ["M8 22 Q16 29 24 22", "M9 24 L23 24", "M9 25 Q16 21 23 25", "M8 26 Q16 18 24 26"][
    tier
  ];
  const brows =
    tier >= 2 ? (tier === 3 ? "M6 8 L13 11 M26 8 L19 11" : "M7 9 L13 10 M25 9 L19 10") : "";
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className="fq-face"
      data-tier={tier}
    >
      <circle cx="16" cy="16" r="14" fill={TIER_COLOR[tier]} stroke="#1c0f00" strokeWidth="2" />
      <circle cx="11" cy="14" r="2" fill="#1c0f00" />
      <circle cx="21" cy="14" r="2" fill="#1c0f00" />
      <path d={mouth} fill="none" stroke="#1c0f00" strokeWidth="2" strokeLinecap="round" />
      {brows && (
        <path d={brows} fill="none" stroke="#1c0f00" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  );
}
