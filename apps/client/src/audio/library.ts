import {
  type AudioManifest,
  LOOP_FADE,
  type ManifestTrack,
  type PackId,
  packChain,
  repairLoop,
  resolveTrack,
} from "@fq/audio";

/**
 * Loads the rendered audio: assets/audio/manifest.json, then each track's files on demand
 * (Ogg Opus where the browser has it, AAC otherwise), decoded and with the loop seam repaired.
 * Decoded music is kept for the last few tracks only (a minute of stereo music is ~20 MB as
 * PCM); the compressed bytes of anything fetched are kept, so coming back is quick. Anything
 * missing (no manifest, a 404, a file the browser cannot decode) resolves to null, once, with a
 * console warning, and is not asked for again.
 *
 * Sound packs: `base` is the Synth pack; `bases` may add the others (Studio, Original remastered).
 * With a pack in effect (`setPack`), each track plays from the first pack in its chain that has it
 * (`packChain`: remaster, Studio, Synth, from the pack in effect on), so a partial or absent pack
 * falls back track by track. A file that cannot be had from that pack (not cached and offline, a
 * 404) falls back the same way rather than going silent.
 */
export interface LibraryDeps {
  /** Base URL of assets/audio (no trailing slash). */
  base: string;
  /** Preferred container: "ogg" (Opus) or "m4a" (AAC). */
  format: "ogg" | "m4a";
  fetchBytes(url: string): Promise<ArrayBuffer>;
  decode(bytes: ArrayBuffer): Promise<AudioBuffer>;
  warn?(message: string): void;
  /** Base URLs of other packs (no trailing slash). The Synth pack's is `base`. */
  bases?: Partial<Record<PackId, string>>;
}

/** Decoded tracks kept per kind before the least recently used is dropped. */
const KEEP: Record<string, number> = { music: 4, ambience: 3, stinger: 6, sfx: 64, ui: 16 };

export class AudioLibrary {
  private manifests = new Map<PackId, Promise<AudioManifest | null>>();
  private pack: PackId = "synth";
  private generation = 0;
  /** Which pack each loaded id came from (for the debug probe). */
  readonly sources = new Map<string, PackId>();
  private bytes = new Map<string, Promise<ArrayBuffer | null>>();
  private decoded = new Map<string, AudioBuffer[]>();
  private pending = new Map<string, Promise<AudioBuffer[] | null>>();
  private format: "ogg" | "m4a";
  readonly missing = new Set<string>();
  /** The manifest entry each loaded id plays from (not always the first pack's: see `buffers`). */
  private used = new Map<string, ManifestTrack>();

  constructor(private readonly deps: LibraryDeps) {
    this.format = deps.format;
  }

  private baseOf(pack: PackId): string | undefined {
    return pack === "synth" ? this.deps.base : this.deps.bases?.[pack];
  }

  /** A pack's manifest (the Synth pack's by default), or null if it cannot be had. */
  manifest(pack: PackId = "synth"): Promise<AudioManifest | null> {
    let p = this.manifests.get(pack);
    if (!p) {
      const base = this.baseOf(pack);
      p = base
        ? this.deps
            .fetchBytes(`${base}/manifest.json`)
            .then((b) => JSON.parse(new TextDecoder().decode(b)) as AudioManifest)
            .catch(() => {
              this.warn(
                pack === "synth"
                  ? "no audio manifest: the game plays silently"
                  : `no ${pack} sound pack here: its tracks play from the Synth pack`,
              );
              return null;
            })
        : Promise.resolve(null);
      this.manifests.set(pack, p);
    }
    return p;
  }

  /** The selected pack. A change drops decoded audio (the compressed bytes stay cached). */
  setPack(pack: PackId): void {
    if (pack === this.pack) return;
    this.pack = pack;
    this.generation++;
    this.decoded.clear();
    this.pending.clear();
    this.missing.clear();
    this.sources.clear();
    this.used.clear();
  }

  /** Where a track plays from with the selected pack: the pack, its base URL, its entry. */
  private async resolve(
    id: string,
    skip: readonly PackId[] = [],
  ): Promise<{ pack: PackId; base: string; track: ManifestTrack } | null> {
    const chain = packChain(this.pack);
    const loaded = await Promise.all(chain.map((p) => this.manifest(p)));
    const r = resolveTrack(
      Object.fromEntries(chain.map((p, i) => [p, skip.includes(p) ? null : loaded[i]])),
      id,
      this.pack,
    );
    const base = r ? this.baseOf(r.pack) : undefined;
    return r && base ? { ...r, base } : null;
  }

  /** A track's manifest entry: the one of the pack its audio was actually loaded from. */
  async track(id: string): Promise<ManifestTrack | null> {
    return this.used.get(id) ?? (await this.resolve(id))?.track ?? null;
  }

  private warn(message: string) {
    (this.deps.warn ?? console.warn)(`[audio] ${message}`);
  }

  private fetchFile(base: string, path: string): Promise<ArrayBuffer | null> {
    const url = `${base}/${path}`;
    let p = this.bytes.get(url);
    if (!p) {
      p = this.deps.fetchBytes(url).catch(() => null);
      this.bytes.set(url, p);
    }
    return p;
  }

  /** Fetches (but does not decode) a track's files, for later. */
  async prefetch(id: string): Promise<void> {
    const r = await this.resolve(id);
    if (!r) return;
    await Promise.all(
      r.track.files.map((f) => this.fetchFile(r.base, this.format === "ogg" ? f.ogg : f.m4a)),
    );
  }

  private async decodeFile(
    base: string,
    f: { ogg: string; m4a: string },
  ): Promise<AudioBuffer | null> {
    for (const fmt of this.format === "ogg" ? (["ogg", "m4a"] as const) : (["m4a"] as const)) {
      const bytes = await this.fetchFile(base, f[fmt]);
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
    const generation = this.generation;
    p = (async () => {
      const failed: PackId[] = [];
      for (;;) {
        const r = await this.resolve(id, failed);
        const t = r?.track;
        if (!r || !t) {
          if (failed.length === 0 && (await this.manifest())) {
            this.warn(`"${id}" is not in the manifest`);
          }
          this.missing.add(id);
          return null;
        }
        const bufs = await this.decodeTrack(r.base, t, id);
        if (!bufs) {
          // this pack's files cannot be had: the next pack in the chain, if any, plays it
          failed.push(r.pack);
          continue;
        }
        // a pack change while this loaded: hand it over, but do not cache it for the new pack
        if (generation === this.generation) {
          this.remember(id, t.kind, bufs);
          this.sources.set(id, r.pack);
          this.used.set(id, t);
        }
        return bufs;
      }
    })().finally(() => this.pending.delete(id));
    this.pending.set(id, p);
    return p;
  }

  /** Every stem of a track decoded (loop seams repaired), or null with a warning if one fails. */
  private async decodeTrack(
    base: string,
    t: ManifestTrack,
    id: string,
  ): Promise<AudioBuffer[] | null> {
    const bufs: AudioBuffer[] = [];
    for (const f of t.files) {
      const b = await this.decodeFile(base, f);
      if (!b) {
        this.warn(`could not load "${id}" (${f.ogg})`);
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
    return bufs;
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
