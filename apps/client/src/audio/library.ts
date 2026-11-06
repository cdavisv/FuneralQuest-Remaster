import { type AudioManifest, LOOP_FADE, type ManifestTrack, repairLoop } from "@fq/audio";

/**
 * Loads the rendered audio: assets/audio/manifest.json, then each track's files on demand
 * (Ogg Opus where the browser has it, AAC otherwise), decoded and with the loop seam repaired.
 * Decoded music is kept for the last few tracks only (a minute of stereo music is ~20 MB as
 * PCM); the compressed bytes of anything fetched are kept, so coming back is quick. Anything
 * missing (no manifest, a 404, a file the browser cannot decode) resolves to null, once, with a
 * console warning, and is not asked for again.
 */
export interface LibraryDeps {
  /** Base URL of assets/audio (no trailing slash). */
  base: string;
  /** Preferred container: "ogg" (Opus) or "m4a" (AAC). */
  format: "ogg" | "m4a";
  fetchBytes(url: string): Promise<ArrayBuffer>;
  decode(bytes: ArrayBuffer): Promise<AudioBuffer>;
  warn?(message: string): void;
}

/** Decoded tracks kept per kind before the least recently used is dropped. */
const KEEP: Record<string, number> = { music: 4, ambience: 3, stinger: 6, sfx: 64, ui: 16 };

export class AudioLibrary {
  private manifestP: Promise<AudioManifest | null> | null = null;
  private bytes = new Map<string, Promise<ArrayBuffer | null>>();
  private decoded = new Map<string, AudioBuffer[]>();
  private pending = new Map<string, Promise<AudioBuffer[] | null>>();
  private format: "ogg" | "m4a";
  readonly missing = new Set<string>();

  constructor(private readonly deps: LibraryDeps) {
    this.format = deps.format;
  }

  manifest(): Promise<AudioManifest | null> {
    this.manifestP ??= this.deps
      .fetchBytes(`${this.deps.base}/manifest.json`)
      .then((b) => JSON.parse(new TextDecoder().decode(b)) as AudioManifest)
      .catch(() => {
        this.warn("no audio manifest: the game plays silently");
        return null;
      });
    return this.manifestP;
  }

  async track(id: string): Promise<ManifestTrack | null> {
    return (await this.manifest())?.tracks[id] ?? null;
  }

  private warn(message: string) {
    (this.deps.warn ?? console.warn)(`[audio] ${message}`);
  }

  private fetchFile(path: string): Promise<ArrayBuffer | null> {
    let p = this.bytes.get(path);
    if (!p) {
      p = this.deps.fetchBytes(`${this.deps.base}/${path}`).catch(() => null);
      this.bytes.set(path, p);
    }
    return p;
  }

  /** Fetches (but does not decode) a track's files, for later. */
  async prefetch(id: string): Promise<void> {
    const t = await this.track(id);
    if (!t) return;
    await Promise.all(t.files.map((f) => this.fetchFile(this.format === "ogg" ? f.ogg : f.m4a)));
  }

  private async decodeFile(f: { ogg: string; m4a: string }): Promise<AudioBuffer | null> {
    for (const fmt of this.format === "ogg" ? (["ogg", "m4a"] as const) : (["m4a"] as const)) {
      const bytes = await this.fetchFile(f[fmt]);
      if (!bytes) continue;
      try {
        // decodeAudioData detaches its argument: give it a copy so the cache stays usable
        const buf = await this.deps.decode(bytes.slice(0));
        if (fmt !== this.format) this.format = fmt;
        return buf;
      } catch {
        // this browser cannot decode the format: try the other one
      }
    }
    return null;
  }

  /** The decoded stems of a track (loop seams repaired), or null if it cannot be had. */
  buffers(id: string): Promise<AudioBuffer[] | null> {
    const hit = this.decoded.get(id);
    if (hit) {
      this.decoded.delete(id);
      this.decoded.set(id, hit);
      return Promise.resolve(hit);
    }
    if (this.missing.has(id)) return Promise.resolve(null);
    let p = this.pending.get(id);
    if (p) return p;
    p = (async () => {
      const t = await this.track(id);
      if (!t) {
        if (await this.manifest()) this.warn(`"${id}" is not in the manifest`);
        this.missing.add(id);
        return null;
      }
      const bufs: AudioBuffer[] = [];
      for (const f of t.files) {
        const b = await this.decodeFile(f);
        if (!b) {
          this.warn(`could not load "${id}" (${f.ogg})`);
          this.missing.add(id);
          return null;
        }
        if (t.loop && t.loopStart !== undefined && t.loopEnd !== undefined) {
          const s = Math.round(t.loopStart * b.sampleRate);
          const e = Math.round(t.loopEnd * b.sampleRate);
          for (let c = 0; c < b.numberOfChannels; c++) {
            repairLoop(b.getChannelData(c), s, e, Math.round(LOOP_FADE * b.sampleRate));
          }
        }
        bufs.push(b);
      }
      this.remember(id, t.kind, bufs);
      return bufs;
    })().finally(() => this.pending.delete(id));
    this.pending.set(id, p);
    return p;
  }

  private kinds = new Map<string, string>();

  private remember(id: string, kind: string, bufs: AudioBuffer[]) {
    this.decoded.set(id, bufs);
    this.kinds.set(id, kind);
    const same = [...this.decoded.keys()].filter((k) => this.kinds.get(k) === kind);
    const keep = KEEP[kind] ?? 8;
    for (const old of same.slice(0, Math.max(0, same.length - keep))) this.decoded.delete(old);
  }
}
