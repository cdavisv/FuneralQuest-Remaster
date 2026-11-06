import { type MasterOptions, master } from "./seq/master.js";
import { UI_SOUNDS } from "./sfx/ui.js";

/**
 * The sounds synthesised on the page instead of downloaded: the UI's clicks, page turns and
 * blips. Each takes a few milliseconds to render, so the client makes them all at start-up.
 */

/** UI sounds sit under the game's effects (which are mastered to a momentary -16 LUFS). */
export const UI_MASTER: MasterOptions = {
  target: -24,
  measure: "momentary",
  ceilingDb: -3,
  loop: false,
};

/** The crossfade, in seconds, that `repairLoop` uses at a loop's seam. */
export const LOOP_FADE = 0.03;

export const LIVE_IDS: readonly string[] = UI_SOUNDS.map((s) => s.id);

/** Renders one live sound, mastered, as left and right channels; null for an unknown id. */
export function renderLive(id: string, sr: number): { l: Float32Array; r: Float32Array } | null {
  const def = UI_SOUNDS.find((s) => s.id === id);
  if (!def) return null;
  const s = def.render(sr);
  const m = master({ stems: [s], length: s.l.length, sr }, UI_MASTER);
  return m.mix;
}
