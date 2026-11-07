import { AMBIENCES } from "./ambience/index.js";
import { removeMean, type Stereo } from "./dsp/core.js";
import { UI_MASTER } from "./live.js";
import { allScores } from "./music/index.js";
import type { MasterOptions } from "./seq/master.js";
import type { Rendered } from "./seq/render.js";
import { renderScore } from "./seq/render.js";
import type { Score } from "./seq/score.js";
import { EFFECTS } from "./sfx/effects.js";
import { UI_SOUNDS } from "./sfx/ui.js";
import type { TrackKind } from "./tracks.js";

/**
 * Everything the build renders, with how it is mastered. Music and stingers come from scores
 * (src/music), ambience and effects from their own generators (src/ambience, src/sfx).
 */
export interface CatalogEntry {
  id: string;
  kind: TrackKind;
  title: string;
  /** "file": rendered by the build; "live": synthesised in the browser. */
  delivery: "file" | "live";
  loop: boolean;
  /** Mono files for ambience and effects (smaller, and the client plays them centred anyway). */
  channels: 1 | 2;
  /** The score, for music and stingers (tempo, key, form for the report). */
  score?: Score;
  render: (sr: number) => Rendered;
  master: MasterOptions;
}

export const MUSIC_MASTER: MasterOptions = {
  target: -16,
  measure: "integrated",
  ceilingDb: -3,
  loop: true,
};
export const STING_MASTER: MasterOptions = {
  target: -16,
  measure: "integrated",
  ceilingDb: -3,
  loop: false,
};
export const AMB_MASTER: MasterOptions = {
  target: -26,
  measure: "integrated",
  ceilingDb: -6,
  loop: true,
};
export const SFX_MASTER: MasterOptions = {
  target: -16,
  measure: "momentary",
  ceilingDb: -2,
  loop: false,
};

const fromStereo = (s: Stereo, sr: number): Rendered => ({ stems: [s], length: s.l.length, sr });

export function catalog(): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const score of allScores()) {
    out.push({
      id: score.id,
      kind: score.loop ? "music" : "stinger",
      title: score.title,
      delivery: "file",
      loop: score.loop,
      channels: 2,
      score,
      render: (sr) => renderScore(score, sr),
      master: score.loop ? MUSIC_MASTER : STING_MASTER,
    });
  }
  for (const a of AMBIENCES) {
    out.push({
      id: a.id,
      kind: "ambience",
      title: a.title,
      delivery: "file",
      loop: true,
      channels: 1,
      render: (sr) => {
        const s = a.render(sr);
        removeMean(s.l);
        removeMean(s.r);
        return fromStereo(s, sr);
      },
      master: AMB_MASTER,
    });
  }
  for (const e of EFFECTS) {
    out.push({
      id: e.id,
      kind: "sfx",
      title: e.title,
      delivery: "file",
      loop: false,
      channels: 1,
      render: (sr) => fromStereo(e.render(sr), sr),
      master: SFX_MASTER,
    });
  }
  for (const u of UI_SOUNDS) {
    out.push({
      id: u.id,
      kind: "ui",
      title: u.title,
      delivery: "live",
      loop: false,
      channels: 1,
      render: (sr) => fromStereo(u.render(sr), sr),
      master: UI_MASTER,
    });
  }
  return out;
}
