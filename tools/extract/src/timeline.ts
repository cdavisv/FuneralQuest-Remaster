import { ID_CX } from "./swf.js";
import type { CXForm, Matrix, TimelineData } from "./types.js";

export interface Item {
  depth: number;
  charId: number;
  matrix: Matrix;
  cx: CXForm;
  ratio: number;
  name: string | undefined;
  clipDepth: number | undefined;
  /** Frame index (in the owning timeline) at which this instance was created. */
  placedFrame: number;
}

const cache = new WeakMap<TimelineData, Map<number, Item>[]>();

/** Display list state after each frame of a timeline (index 0 = after frame 1). */
function build(tl: TimelineData): Map<number, Item>[] {
  const states: Map<number, Item>[] = [];
  let dl = new Map<number, Item>();
  tl.frames.forEach((fr, fi) => {
    dl = new Map(dl);
    for (const c of fr.cmds) {
      if (c.op === "remove") {
        dl.delete(c.depth);
        continue;
      }
      const old = dl.get(c.depth);
      if (c.charId !== undefined && !(c.move && old)) {
        dl.set(c.depth, {
          depth: c.depth,
          charId: c.charId,
          matrix: c.matrix ?? [1, 0, 0, 1, 0, 0],
          cx: c.cx ?? ID_CX,
          ratio: c.ratio ?? 0,
          name: c.name,
          clipDepth: c.clipDepth,
          placedFrame: fi,
        });
      } else if (old) {
        dl.set(c.depth, {
          ...old,
          charId: c.charId ?? old.charId,
          matrix: c.matrix ?? old.matrix,
          cx: c.cx ?? old.cx,
          ratio: c.ratio ?? old.ratio,
          name: c.name ?? old.name,
          clipDepth: c.clipDepth ?? old.clipDepth,
          placedFrame: c.charId !== undefined ? fi : old.placedFrame,
        });
      }
    }
    states.push(dl);
  });
  return states;
}

export function displayAt(tl: TimelineData, frame: number): Item[] {
  let states = cache.get(tl);
  if (!states) {
    states = build(tl);
    cache.set(tl, states);
  }
  const dl = states[Math.min(frame, states.length - 1)];
  if (!dl) return [];
  return [...dl.values()].sort((a, b) => a.depth - b.depth);
}

/** Index of the first frame whose top-level actions contain stop(), if any. */
export function firstStop(tl: TimelineData): number | undefined {
  for (let i = 0; i < tl.frames.length; i++) {
    for (const code of tl.frames[i]?.actions ?? []) {
      if (hasStop(code)) return i;
    }
  }
  return undefined;
}

function hasStop(code: Uint8Array): boolean {
  let p = 0;
  while (p < code.length) {
    const op = code[p] as number;
    if (op === 0) return false;
    if (op === 0x07) return true;
    if (op >= 0x80) p += 3 + ((code[p + 1] as number) | ((code[p + 2] as number) << 8));
    else p += 1;
  }
  return false;
}

/** The frame a sprite instance shows when its parent timeline is at `parentFrame`. */
export function spriteFrame(tl: TimelineData, placedFrame: number, parentFrame: number): number {
  const n = tl.frames.length;
  if (n <= 1) return 0;
  const elapsed = Math.max(0, parentFrame - placedFrame);
  const stop = firstStop(tl);
  if (stop !== undefined) return Math.min(elapsed, stop);
  return elapsed % n;
}

/** Frames a sprite plays before it stops (or its length when it loops). */
function playLength(tl: TimelineData): number {
  const stop = firstStop(tl);
  return stop !== undefined ? stop + 1 : tl.frames.length;
}

/**
 * Length of the animation a movie shows, in frames. Movies with one root frame are animated by
 * sprites that keep playing, so the length is the longest sprite (counting the frame it was
 * placed on). `lookup` resolves a character id to its timeline when it is a sprite.
 */
export function animationLength(
  tl: TimelineData,
  lookup: (id: number) => TimelineData | undefined,
  own = true,
  seen: ReadonlySet<TimelineData> = new Set(),
): number {
  let len = own ? tl.frames.length : playLength(tl);
  tl.frames.forEach((_, fi) => {
    for (const it of displayAt(tl, fi)) {
      const child = lookup(it.charId);
      if (!child || seen.has(child)) continue;
      len = Math.max(
        len,
        it.placedFrame + animationLength(child, lookup, false, new Set([...seen, tl])),
      );
    }
  });
  return len;
}
