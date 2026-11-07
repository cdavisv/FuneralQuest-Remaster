import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { joinStep } from "../scripts/analysis.js";
import { BRIEF } from "../scripts/studioBrief.js";
import { cutLoop, tailIntoHead } from "../scripts/studioLoop.js";
import type { AudioManifest } from "../src/manifestTypes.js";
import {
  DEFAULT_PACK,
  isPackId,
  nextBarTime,
  PACK_IDS,
  PACKS,
  packChain,
  resolveTrack,
  stemGains,
} from "../src/packs.js";
import { AMBIENCE, EFFECTS_IDS, LAYERED, MUSIC, moodLayers, STINGERS } from "../src/tracks.js";

const repo = join(import.meta.dirname, "..", "..", "..");

const track = (title: string, extra: Partial<AudioManifest["tracks"][string]> = {}) => ({
  kind: "music" as const,
  title,
  loop: true,
  channels: 2,
  duration: 10,
  files: [{ ogg: `music/${title}.ogg`, m4a: `music/${title}.m4a`, bytes: 1 }],
  lufs: -16,
  peakDb: -3,
  ...extra,
});
const manifest = (tracks: Record<string, ReturnType<typeof track>>): AudioManifest => ({
  generator: "test",
  license: "test",
  sampleRate: 48000,
  totalBytes: 0,
  live: [],
  tracks,
});

describe("sound packs", () => {
  it("are Synth and Studio, Synth by default", () => {
    expect([...PACK_IDS]).toEqual(["synth", "studio", "remaster"]);
    expect(PACKS.remaster.dir).toBe("audio-remaster");
    expect(PACKS.remaster.title).toBe("Original, remastered");
    expect(PACKS.remaster.description).toMatch(/not the 2001 recordings/);
    expect(DEFAULT_PACK).toBe("synth");
    expect(PACKS.synth.dir).toBe("audio");
    expect(PACKS.studio.dir).toBe("audio-studio");
    expect(isPackId("studio")).toBe(true);
    expect(isPackId("vinyl")).toBe(false);
    expect(isPackId(undefined)).toBe(false);
  });

  it("chain from the pick to Synth", () => {
    expect(packChain("synth")).toEqual(["synth"]);
    expect(packChain("studio")).toEqual(["studio", "synth"]);
  });

  const synth = manifest({ desk: track("synth desk"), bank: track("synth bank") });
  const studio = manifest({ desk: track("studio desk") });

  it("resolve a track from the picked pack when it has it", () => {
    const r = resolveTrack({ synth, studio }, "desk", "studio");
    expect(r?.pack).toBe("studio");
    expect(r?.track.title).toBe("studio desk");
  });

  it("fall back to Synth per track when the picked pack lacks it", () => {
    const r = resolveTrack({ synth, studio }, "bank", "studio");
    expect(r?.pack).toBe("synth");
    expect(r?.track.title).toBe("synth bank");
  });

  it("fall back to Synth for everything when the Studio pack is absent", () => {
    expect(resolveTrack({ synth, studio: null }, "desk", "studio")?.pack).toBe("synth");
    expect(resolveTrack({ synth }, "desk", "studio")?.pack).toBe("synth");
  });

  it("never use Studio when Synth is picked, and give null for an unknown id", () => {
    expect(resolveTrack({ synth, studio }, "desk", "synth")?.track.title).toBe("synth desk");
    expect(resolveTrack({ synth, studio }, "nope", "studio")).toBeNull();
    expect(resolveTrack({}, "desk", "studio")).toBeNull();
  });
});

describe("negotiation stems", () => {
  it("mix mode passes the mood layers through", () => {
    expect(stemGains(undefined, [1, 0.5, 0])).toEqual([1, 0.5, 0]);
    expect(stemGains("mix", [1, 1, 1])).toEqual([1, 1, 1]);
  });

  it("crossfade mode keeps one piece at a time, at constant power", () => {
    expect(stemGains("crossfade", moodLayers(0))).toEqual([1, 0, 0]);
    expect(stemGains("crossfade", moodLayers(4.5))).toEqual([0, 1, 0]);
    expect(stemGains("crossfade", moodLayers(10))).toEqual([0, 0, 1]);
    for (let mood = 0; mood <= 10; mood += 0.25) {
      const g = stemGains("crossfade", moodLayers(mood));
      const power = g.reduce((s, x) => s + x * x, 0);
      expect(power, `mood ${mood}`).toBeCloseTo(1, 9);
    }
  });

  it("change piece on a bar line", () => {
    const t = { bpm: 120, beatsPerBar: 4, loopStart: 0.25, loopEnd: 32.25 };
    // a bar is 2 s; started at t=10, so bar lines at 10, 12, 14...
    expect(nextBarTime(10, 10, t)).toBeCloseTo(10);
    expect(nextBarTime(10.5, 10, t)).toBeCloseTo(12);
    expect(nextBarTime(13.999, 10, t)).toBeCloseTo(14);
    // after a loop (32 s) the grid carries on from the loop start
    expect(nextBarTime(43, 10, t)).toBeCloseTo(44);
    // no tempo: at once
    expect(nextBarTime(7, 1, { loopStart: 0, loopEnd: 5 })).toBe(7);
  });
});

describe("studio loop cutting", () => {
  const sr = 1000;
  // a recording that is not periodic: a slow chirp
  const n = 8000;
  const l = new Float32Array(n);
  for (let i = 0; i < n; i++) l[i] = Math.sin(2 * Math.PI * (3 + i / 2000) * (i / sr));
  const x = { l, r: l.slice() };

  it("cutLoop joins its end to its start without a step", () => {
    const period = cutLoop(x, sr, 1, 5, 0.25);
    expect(period.l.length).toBe(4000);
    const wrapped = new Float32Array(2000);
    wrapped.set(period.l.subarray(3000), 0);
    wrapped.set(period.l.subarray(0, 1000), 1000);
    const step = Math.abs((wrapped[1000] as number) - (wrapped[999] as number));
    expect(step).toBeLessThanOrEqual(joinStep(wrapped).p999 * 1.01);
  });

  it("tailIntoHead makes a period whose seam is the recording's own continuity", () => {
    const period = tailIntoHead(x, sr, 0.5);
    expect(period.l.length).toBe(n - 500);
    // the last sample of the period flows into the first, which starts as the tail
    expect(Math.abs((period.l[0] as number) - (x.l[n - 500] as number))).toBeLessThan(0.05);
  });
});

describe("the pack manifests", () => {
  const read = (dir: string) => {
    const p = join(repo, "assets", dir, "manifest.json");
    return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as AudioManifest) : null;
  };
  const synth = read("audio");
  const studio = read("audio-studio");
  const remaster = read("audio-remaster");
  const fileIds = [...MUSIC, ...STINGERS, ...AMBIENCE, ...EFFECTS_IDS];

  for (const [pack, m, dir] of [
    ["synth", synth, "audio"],
    ["studio", studio, "audio-studio"],
    ["remaster", remaster, "audio-remaster"],
  ] as const) {
    it(`${pack}: every entry is a known id, with its files, sizes and loop points`, () => {
      if (!m) return;
      let total = 0;
      for (const [id, t] of Object.entries(m.tracks)) {
        expect(fileIds as readonly string[], id).toContain(id);
        expect(t.files.length, id).toBe(LAYERED[id as keyof typeof LAYERED] ?? 1);
        for (const f of t.files) {
          const a = join(repo, "assets", dir, f.ogg);
          const b = join(repo, "assets", dir, f.m4a);
          expect(existsSync(a), f.ogg).toBe(true);
          expect(existsSync(b), f.m4a).toBe(true);
          expect(statSync(a).size + statSync(b).size, id).toBe(f.bytes);
          total += f.bytes;
        }
        if (t.loop) {
          expect(t.loopStart, id).toBeDefined();
          expect(t.loopEnd as number, id).toBeGreaterThan(t.loopStart as number);
          expect(t.loopEnd as number, id).toBeLessThanOrEqual(t.duration);
        }
        expect(Number.isFinite(t.lufs) && Number.isFinite(t.peakDb), id).toBe(true);
        expect(t.peakDb, id).toBeLessThan(-1);
      }
      expect(total).toBe(m.totalBytes);
    });

    it(`${pack}: loop seams measure clean after the client's repair`, () => {
      if (!m) return;
      for (const [id, t] of Object.entries(m.tracks)) {
        if (!t.loop) continue;
        expect(t.loopCheck, id).toBeDefined();
        // the step at the seam is within the signal's own steps
        expect(t.loopCheck?.joinRatio as number, id).toBeLessThan(1);
      }
    });
  }

  it("synth covers every file id; studio is a subset of the same ids with the same kinds", () => {
    if (synth) for (const id of fileIds) expect(synth.tracks[id], id).toBeDefined();
    if (!studio || !synth) return;
    for (const [id, t] of Object.entries(studio.tracks)) {
      expect(t.kind, id).toBe(synth.tracks[id]?.kind);
      expect(t.loop, id).toBe(synth.tracks[id]?.loop);
      expect(t.channels, id).toBe(synth.tracks[id]?.channels);
    }
    expect(studio.live).toEqual(synth.live);
  });

  it("studio loudness matches the Synth targets", () => {
    if (!studio) return;
    for (const [id, t] of Object.entries(studio.tracks)) {
      if (t.kind === "music" || t.kind === "stinger")
        expect(Math.abs(t.lufs + 16), id).toBeLessThan(0.6);
      if (t.kind === "ambience") expect(Math.abs(t.lufs + 26), id).toBeLessThan(0.6);
    }
  });

  it("studio negotiation stems are whole pieces in step, crossfaded", () => {
    const t = studio?.tracks.negotiation;
    if (!t) return;
    expect(t.layerMode).toBe("crossfade");
    expect(t.files).toHaveLength(3);
    expect(t.bpm).toBe(120);
    expect(t.beatsPerBar).toBe(4);
    // exactly 16 bars at 120 bpm between the loop points
    expect((t.loopEnd as number) - (t.loopStart as number)).toBeCloseTo(32, 3);
  });

  it("every studio file is in the provenance sidecar with its prompt, model, generation and cost", () => {
    if (!studio) return;
    const p = join(repo, "assets", "audio-studio", "sources.json");
    expect(existsSync(p)).toBe(true);
    const sources = JSON.parse(readFileSync(p, "utf8")) as {
      ledger: { actual: number }[];
      tracks: Record<
        string,
        {
          stems?: {
            prompt: string;
            model: string;
            generationId: string;
            credits: number;
            generatedOn: string;
          }[];
        }
      >;
    };
    for (const [id, t] of Object.entries(studio.tracks)) {
      const stems = sources.tracks[id]?.stems ?? [];
      expect(stems.length, id).toBe(t.files.length);
      for (const s of stems) {
        expect(s.prompt.length, id).toBeGreaterThan(20);
        expect(["eleven_music_v2_5", "eleven_text_to_sound_v2"], id).toContain(s.model);
        expect(s.generationId, id).toMatch(/^[A-Za-z0-9]{20}$/);
        expect(s.credits, id).toBeGreaterThan(0);
        expect(s.generatedOn, id).toMatch(/^\d{4}-\d\d-\d\d$/);
      }
    }
    const spent = sources.ledger.reduce((s, l) => s + l.actual, 0);
    expect(spent).toBeLessThanOrEqual(120_000);
  });

  it("the brief has a prompt for every id the Studio pack may deliver", () => {
    const briefIds = new Set(BRIEF.map((b) => b.id.replace(/\.layer\d$/, "")));
    for (const id of fileIds) expect(briefIds.has(id), id).toBe(true);
  });
});

describe("the Original, remastered pack", () => {
  const dir = join(repo, "assets", "audio-remaster");
  const brief = JSON.parse(readFileSync(join(dir, "brief.json"), "utf8")) as {
    sounds: {
      file: string;
      seconds: number;
      loops: number;
      measured: { tags: unknown[]; centroidHz: number };
      remake: {
        id: string;
        prompt: string;
        deliverSeconds: number;
        loop: boolean;
        tracks: string[];
      };
    }[];
  };
  const m = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as AudioManifest;

  it("describes every original sound from measurements, with a prompt and the original's length", () => {
    expect(brief.sounds.length).toBe(40);
    for (const s of brief.sounds) {
      expect(s.measured.centroidHz, s.file).toBeGreaterThan(0);
      expect(Array.isArray(s.measured.tags), s.file).toBe(true);
      expect(s.remake.prompt.length, s.file).toBeGreaterThan(20);
      expect(s.remake.loop, s.file).toBe(s.loops > 1);
      expect(Math.abs(s.remake.deliverSeconds - s.seconds), s.file).toBeLessThan(0.01);
    }
  });

  it("never names a recording or a file of the original in its manifest", () => {
    for (const t of [...Object.values(m.tracks), ...Object.values(m.originals ?? {})])
      for (const f of t.files)
        expect(
          f.ogg.startsWith("originals/") ||
            f.ogg.startsWith("music/") ||
            f.ogg.startsWith("ambience/") ||
            f.ogg.startsWith("sfx/"),
          f.ogg,
        ).toBe(true);
    // any original it keys by must be one of the 40 described sounds
    const files = new Set(brief.sounds.map((s) => s.file));
    for (const k of Object.keys(m.originals ?? {})) expect(files.has(k), k).toBe(true);
  });

  it("falls back to Synth for every track it lacks", () => {
    const synth = JSON.parse(
      readFileSync(join(repo, "assets", "audio", "manifest.json"), "utf8"),
    ) as AudioManifest;
    for (const id of Object.keys(synth.tracks)) {
      const r = resolveTrack({ synth, remaster: m }, id, "remaster");
      expect(r?.pack, id).toBe(m.tracks[id] ? "remaster" : "synth");
    }
  });
});
