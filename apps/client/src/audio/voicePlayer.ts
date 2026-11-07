import type { VoiceClip, VoiceManifest } from "@fq/audio";
import { indexManifest, type VoiceIndex } from "./voiceLines.js";

/**
 * Plays character voices through the game's own audio graph: the backend hands over a
 * `VoiceOutput` (its context, the master bus to connect to, and a music duck), and this player
 * keeps its own "Voices" bus with its own volume and an analyser. One voice at a time: a new
 * screen's lines replace whatever was speaking (cut with a short fade), and the lines of one
 * screen play one after another. The voice pack (assets/voice) is fetched only when voices are
 * on: the manifest at the first line, each clip when it is first needed.
 */
export interface VoiceOutput {
  ctx: AudioContext;
  /** Where the voice bus connects (the master bus, so mute, the radio filter and the probe apply). */
  destination: AudioNode;
  /** Lower the music while someone speaks (true), bring it back (false). */
  duck(on: boolean): void;
  /** The music duck's current gain, for the probe. */
  duckLevel(): number;
}

export interface VoicePlayerDeps {
  /** Base URL of the voice pack (no trailing slash). */
  base: string;
  format: "ogg" | "m4a";
  fetchBytes(url: string): Promise<ArrayBuffer>;
  warn?(message: string): void;
}

export interface VoiceDebug {
  /** The key of the clip speaking now, or null. */
  playing: string | null;
  /** Every clip started this session, in order. */
  started: string[];
  /** Clips cut off before their end. */
  cut: string[];
  /** RMS of the voice bus, dBFS (-120 when silent). */
  level: number;
  /** The music duck's gain (1: not ducked). */
  duck: number;
  gain: number;
  clips: number;
}

const FADE_OUT = 0.04;

export class VoicePlayer {
  private bus: GainNode;
  private analyser: AnalyserNode;
  private manifest: Promise<VoiceIndex> | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private current: { clip: VoiceClip; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private queue: VoiceClip[] = [];
  private token = 0;
  private readonly started: string[] = [];
  private readonly cut: string[] = [];
  private samples: Float32Array<ArrayBuffer>;

  constructor(
    private readonly out: VoiceOutput,
    private readonly deps: VoicePlayerDeps,
  ) {
    this.bus = out.ctx.createGain();
    this.analyser = out.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.samples = new Float32Array(this.analyser.fftSize);
    this.bus.connect(this.analyser);
    this.bus.connect(out.destination);
  }

  get output(): VoiceOutput {
    return this.out;
  }

  /** The pack's index (fetched once; empty if the pack is not here). */
  index(): Promise<VoiceIndex> {
    if (!this.manifest) {
      this.manifest = this.deps
        .fetchBytes(`${this.deps.base}/manifest.json`)
        .then((b) => indexManifest(JSON.parse(new TextDecoder().decode(b)) as VoiceManifest))
        .catch(() => {
          (this.deps.warn ?? console.warn)("[voice] no voice pack here: lines stay text");
          return new Map();
        });
    }
    return this.manifest;
  }

  setVolume(v: number): void {
    const now = this.out.ctx.currentTime;
    const g = this.bus.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0)), now + 0.05);
  }

  private buffer(clip: VoiceClip): Promise<AudioBuffer | null> {
    let p = this.buffers.get(clip.key);
    if (!p) {
      const order = this.deps.format === "ogg" ? [clip.file.ogg, clip.file.m4a] : [clip.file.m4a];
      p = (async () => {
        for (const path of order) {
          try {
            const bytes = await this.deps.fetchBytes(`${this.deps.base}/${path}`);
            return await this.out.ctx.decodeAudioData(bytes);
          } catch {
            // not here, or this browser cannot decode it: try the other container
          }
        }
        (this.deps.warn ?? console.warn)(`[voice] could not load ${clip.key}`);
        return null;
      })();
      this.buffers.set(clip.key, p);
      // keep the last few decoded clips only
      if (this.buffers.size > 24) {
        const first = this.buffers.keys().next().value;
        if (first !== undefined) this.buffers.delete(first);
      }
    }
    return p;
  }

  /** Speak these clips in order, replacing anything speaking now. An empty list just stops. */
  speak(clips: readonly VoiceClip[]): void {
    this.stop();
    this.queue = [...clips];
    if (this.queue.length) void this.next(++this.token);
  }

  private async next(token: number): Promise<void> {
    const clip = this.queue.shift();
    if (!clip || token !== this.token) {
      if (token === this.token) this.out.duck(false);
      return;
    }
    const buf = await this.buffer(clip);
    if (token !== this.token) return;
    if (!buf) {
      void this.next(token);
      return;
    }
    const ctx = this.out.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    src.connect(gain).connect(this.bus);
    this.out.duck(true);
    this.current = { clip, src, gain };
    this.started.push(clip.key);
    src.onended = () => {
      if (this.current?.src !== src) return;
      this.current = null;
      gain.disconnect();
      void this.next(token);
    };
    src.start();
  }

  /** Cut the voice off cleanly (a short fade) and bring the music back. */
  stop(): void {
    this.token++;
    this.queue = [];
    const c = this.current;
    this.current = null;
    if (c) {
      this.cut.push(c.clip.key);
      const now = this.out.ctx.currentTime;
      c.gain.gain.setValueAtTime(c.gain.gain.value, now);
      c.gain.gain.linearRampToValueAtTime(0, now + FADE_OUT);
      try {
        c.src.stop(now + FADE_OUT + 0.01);
      } catch {
        // already stopped
      }
      setTimeout(() => c.gain.disconnect(), (FADE_OUT + 0.1) * 1000);
    }
    this.out.duck(false);
  }

  debug(): VoiceDebug {
    this.analyser.getFloatTimeDomainData(this.samples);
    let e = 0;
    for (const s of this.samples) e += s * s;
    const rms = Math.sqrt(e / this.samples.length);
    return {
      playing: this.current?.clip.key ?? null,
      started: [...this.started],
      cut: [...this.cut],
      level: rms > 0 ? Math.round(20 * Math.log10(rms) * 10) / 10 : -120,
      duck: Math.round(this.out.duckLevel() * 100) / 100,
      gain: Math.round(this.bus.gain.value * 100) / 100,
      clips: this.buffers.size,
    };
  }

  dispose(): void {
    this.stop();
    this.bus.disconnect();
  }
}

declare global {
  interface Window {
    /** Read-only probe of the character voices, for tests and the curious. */
    __fqVoice?: { debug(): VoiceDebug };
  }
}
