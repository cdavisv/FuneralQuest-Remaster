/**
 * Where each building sits on the Deathville map, in the original 1024 by 745 picture's
 * pixels, for the hand-drawn fallback map. The protocol sends only `{ id, label }` per place, so
 * the geometry is client-owned. The ids are fixed by the game: funeral-home, bank, store, cafe,
 * yangs, competitors, church, hospital, spirit-university, and in Expanded towns graveyard,
 * city-hall and reaper-club. (The Classic art pack keeps its own
 * building positions in its pack.json.) Ids the server sends that are not listed get a
 * visible pin along the bottom edge and a row in the place list, so a new building never
 * breaks the screen.
 */
export interface Hotspot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MAP_W = 1024;
export const MAP_H = 745;

export const HOTSPOTS: Record<string, Hotspot> = {
  "spirit-university": { x: 85, y: 55, w: 170, h: 130 },
  yangs: { x: 110, y: 245, w: 165, h: 115 },
  church: { x: 378, y: 288, w: 120, h: 112 },
  cafe: { x: 472, y: 122, w: 118, h: 148 },
  "funeral-home": { x: 628, y: 272, w: 150, h: 130 },
  competitors: { x: 832, y: 252, w: 175, h: 215 },
  store: { x: 598, y: 428, w: 150, h: 115 },
  hospital: { x: 385, y: 492, w: 135, h: 158 },
  bank: { x: 72, y: 532, w: 138, h: 140 },
  // Expanded places. The graveyard is the crosses and the stone on the base map.
  graveyard: { x: 695, y: 85, w: 185, h: 158 },
  "city-hall": { x: 752, y: 492, w: 112, h: 108 },
  "reaper-club": { x: 870, y: 500, w: 115, h: 100 },
};

export interface HotspotBox {
  left: string;
  top: string;
  width: string;
  height: string;
}

const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(3)}%`;

/** Known place: its hot-spot rectangle. Unknown place (or `knownOnly`): undefined. */
export function hotspotBox(
  id: string,
  index: number,
  total: number,
  knownOnly = false,
): HotspotBox | undefined {
  const spot = HOTSPOTS[id];
  if (spot) {
    return {
      left: pct(spot.x, MAP_W),
      top: pct(spot.y, MAP_H),
      width: pct(spot.w, MAP_W),
      height: pct(spot.h, MAP_H),
    };
  }
  return knownOnly ? undefined : pinBox(index, total);
}

/**
 * A place with no building art or hot-spot: a labelled pin along the bottom edge, spaced
 * evenly. Always on screen and always a real control, so a new building never breaks the map.
 */
export function pinBox(index: number, total: number): HotspotBox {
  const n = Math.max(total, 1);
  const w = Math.min(190, (MAP_W - 120) / n - 8);
  const slot = (MAP_W - 120) / n;
  return {
    left: pct(60 + index * slot + (slot - w) / 2, MAP_W),
    top: pct(MAP_H - 100, MAP_H),
    width: pct(w, MAP_W),
    height: pct(44, MAP_H),
  };
}

/** True when two rectangles share any area (touching edges do not count). */
export function rectsOverlap(a: Hotspot, b: Hotspot): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** The ids of every pair of rectangles that overlap, for checking a map's layout. */
export function overlappingPairs(rects: Record<string, Hotspot>): [string, string][] {
  const ids = Object.keys(rects);
  const out: [string, string][] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = rects[ids[i] as string];
      const b = rects[ids[j] as string];
      if (a && b && rectsOverlap(a, b)) out.push([ids[i] as string, ids[j] as string]);
    }
  }
  return out;
}

/**
 * The art pack's building spots for the places on this map. An Expanded town (any place the
 * pack lists only under `expanded`) uses the pack's Expanded spots over the originals; a
 * Classic town gets the original spots untouched.
 */
export function mapRects<R>(
  ids: string[],
  buildings: Record<string, R>,
  expanded: Record<string, R> | undefined,
): Record<string, R> {
  if (!expanded) return buildings;
  const isExpanded = Object.keys(expanded).some((id) => !(id in buildings) && ids.includes(id));
  return isExpanded ? { ...buildings, ...expanded } : buildings;
}
