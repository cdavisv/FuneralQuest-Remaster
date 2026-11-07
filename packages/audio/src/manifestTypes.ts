import type { TrackKind } from "./tracks.js";

/** The shape of assets/audio/manifest.json, written by the render and read by the client. */
export interface ManifestTrack {
  kind: TrackKind;
  title: string;
  loop: boolean;
  channels: number;
  /** Seconds in the file (a loop file has a lead-in and an overrun around the loop). */
  duration: number;
  /** One entry per stem (the negotiation has three); paths relative to the pack's directory. */
  files: { ogg: string; m4a: string; bytes: number }[];
  /** For loops: play from 0, then loop between these (seconds). */
  /**
   * How a player combines several stems. "mix" (the default, the Synth pack): the stems are
   * layers of one piece and add up. "crossfade" (the Studio pack's negotiation): each stem is a
   * whole piece in the same key, tempo and bar count, and one at a time is heard; a change of
   * stem crossfades on a bar line (see `stemGains` and `nextBarTime`).
   */
  layerMode?: "mix" | "crossfade";
  loopStart?: number;
  loopEnd?: number;
  /**
   * Measured on the decoded files: the codec's waveform error between the overrun and the start
   * (dB), and the step at the loop point over the signal's 99.9th-percentile step, before and
   * after the client's seam repair (`repairLoop`).
   */
  loopCheck?: { periodDb: number; rawJoin: number; joinRatio: number };
  /** Integrated loudness of the master (LUFS) and as ffmpeg reads the encoded Opus file. */
  lufs: number;
  lufsEncoded?: number;
  peakDb: number;
  bpm?: number;
  key?: string;
  bars?: number;
  beatsPerBar?: number;
}

export interface AudioManifest {
  generator: string;
  license: string;
  sampleRate: number;
  totalBytes: number;
  /** Ids synthesised in the browser (no file). */
  live: string[];
  tracks: Record<string, ManifestTrack>;
  /**
   * The "Original, remastered" pack only: the same deliveries keyed by the original 2001 sound
   * they remake (its path in the local extraction, e.g. `places/fire/5.mp3`), for the listening
   * page. `tracks` holds those that stand in for a game track, under the game's id.
   */
  originals?: Record<string, ManifestTrack>;
}
