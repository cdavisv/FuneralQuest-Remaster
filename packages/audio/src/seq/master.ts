import { dbToGain, peakStereo, type Stereo, scaleStereo } from "../dsp/core.js";
import { applyGain, limiterGain } from "../dsp/fx.js";
import { loudness } from "../dsp/loudness.js";
import { mixStems, type Rendered } from "./render.js";

export interface MasterOptions {
  /** Target loudness in LUFS. */
  target: number;
  /** What the target measures: the whole track, or its loudest 400 ms (short effects). */
  measure: "integrated" | "momentary";
  /** Sample-peak ceiling in dBFS. */
  ceilingDb: number;
  loop: boolean;
}

export interface Mastered extends Rendered {
  mix: Stereo;
  /** Loudness after mastering. */
  lufs: number;
  momentaryMax: number;
  /** Gain applied, dB. */
  gainDb: number;
  /** Peak after mastering, linear. */
  peak: number;
}

/**
 * Brings a render to its target loudness, then limits the peaks. Stems share one gain and one
 * limiter envelope (computed from their sum), so layered stems still add up to the mastered mix.
 */
export function master(r: Rendered, o: MasterOptions): Mastered {
  const before = loudness(mixStems(r.stems), r.sr);
  const measured = o.measure === "integrated" ? before.integrated : before.momentaryMax;
  const g = Number.isFinite(measured) ? o.target - measured : 0;
  for (const s of r.stems) scaleStereo(s, dbToGain(g));
  const ceiling = dbToGain(o.ceilingDb);
  // A second pass gets back what the limiter took (limiting lowers loudness a little).
  for (let pass = 0; pass < 2; pass++) {
    const env = limiterGain(mixStems(r.stems), r.sr, ceiling, o.loop);
    for (const s of r.stems) applyGain(s, env);
    if (pass === 0) {
      const now = loudness(mixStems(r.stems), r.sr);
      const m = o.measure === "integrated" ? now.integrated : now.momentaryMax;
      const fix = Number.isFinite(m) ? Math.min(3, Math.max(0, o.target - m)) : 0;
      for (const s of r.stems) scaleStereo(s, dbToGain(fix));
    }
  }
  const mix = mixStems(r.stems);
  const after = loudness(mix, r.sr);
  return {
    ...r,
    mix,
    lufs: after.integrated,
    momentaryMax: after.momentaryMax,
    gainDb: g,
    peak: peakStereo(mix),
  };
}
