import type { TrackKind } from "./tracks.js";

/** The shape of assets/audio/manifest.json, written by the render and read by the client. */
export interface ManifestTrack {
  kind: TrackKind;
  title: string;
  loop: boolean;
  channels: number;
  /** Seconds in the file (a loop file has a lead-in and an overrun around the loop). */
  duration: number;
  /** One entry per stem (the negotiation has three); paths relative to assets/audio/. */
  files: { ogg: string; m4a: string; bytes: number }[];
  /** For loops: play from 0, then loop between these (seconds). */
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
}
