import type { Stereo } from "../dsp/core.js";

/**
 * A one-shot effect. `render` is deterministic (its randomness comes from a seed derived from
 * the id) and returns a buffer that starts and ends at silence.
 */
export interface SfxDef {
  id: string;
  /** What it is, for the report and the ledger. */
  title: string;
  /**
   * "live": synthesised in the browser at start-up (short UI sounds: no download, no latency).
   * "file": rendered to Ogg Opus / AAC by the build.
   */
  delivery: "live" | "file";
  /** Mixing group: UI sounds sit lower than game effects. */
  group: "ui" | "sfx";
  render: (sr: number) => Stereo;
}

/**
 * An ambience bed. `render` returns exactly `Math.round(seconds * sr)` samples that loop
 * seamlessly (the signal is periodic: its end runs into its start without a step).
 */
export interface AmbienceDef {
  id: string;
  title: string;
  seconds: number;
  render: (sr: number) => Stereo;
}
