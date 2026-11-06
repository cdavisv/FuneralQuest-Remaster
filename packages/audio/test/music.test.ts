import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { joinStep } from "../scripts/analysis.js";
import { catalog } from "../src/catalog.js";
import { loudness } from "../src/dsp/loudness.js";
import type { AudioManifest } from "../src/manifestTypes.js";
import { battle } from "../src/music/action.js";
import { newDay } from "../src/music/civic.js";
import { allScores } from "../src/music/index.js";
import { master } from "../src/seq/master.js";
import { renderScore } from "../src/seq/render.js";
import { scoreBeats } from "../src/seq/score.js";
import { AMBIENCE, EFFECTS_IDS, MUSIC, STINGERS, UI_IDS } from "../src/tracks.js";

const repo = join(import.meta.dirname, "..", "..", "..");
const SR = 48000;

describe("the catalog", () => {
  it("has exactly the ids the client knows", () => {
    const ids = catalog()
      .map((e) => e.id)
      .sort();
    expect(ids).toEqual([...MUSIC, ...STINGERS, ...AMBIENCE, ...EFFECTS_IDS, ...UI_IDS].sort());
  });
});

describe("the score", () => {
  const scores = allScores();

  it("every loop is a piece with form: 16 bars or more, a lead, a real melody", () => {
    for (const s of scores.filter((x) => x.loop)) {
      expect(s.bars, s.id).toBeGreaterThanOrEqual(16);
      const leads = s.parts.filter((p) => p.level === 0);
      expect(leads.length, s.id).toBeGreaterThan(0);
      const pitches = new Set(leads.flatMap((p) => p.notes.map((n) => n.p)));
      expect(pitches.size, `${s.id} melody range`).toBeGreaterThanOrEqual(8);
      const seconds = (scoreBeats(s) * 60) / s.bpm;
      expect(seconds, s.id).toBeGreaterThanOrEqual(25);
    }
  });

  it("keeps every note inside the piece and in a sane range", () => {
    for (const s of scores) {
      const total = scoreBeats(s);
      for (const p of s.parts) {
        for (const n of p.notes) {
          expect(n.t, `${s.id}/${p.name}`).toBeGreaterThanOrEqual(0);
          expect(n.t, `${s.id}/${p.name}`).toBeLessThan(total);
          expect(n.p, `${s.id}/${p.name}`).toBeGreaterThanOrEqual(21);
          expect(n.p, `${s.id}/${p.name}`).toBeLessThanOrEqual(108);
        }
      }
    }
  });

  it("varies keys and tempos", () => {
    const loops = scores.filter((s) => s.loop);
    expect(new Set(loops.map((s) => s.key)).size).toBeGreaterThanOrEqual(10);
    expect(new Set(loops.map((s) => s.bpm)).size).toBeGreaterThanOrEqual(10);
  });

  it("most pieces quote the main theme's motif (up a fifth, down by step to home)", () => {
    const quotes = (notes: { t: number; p: number }[]) => {
      const ps = [...notes].sort((a, b) => a.t - b.t).map((n) => n.p);
      for (let i = 0; i + 4 < ps.length; i++) {
        const [a, b, c, d, e] = ps.slice(i, i + 5) as [number, number, number, number, number];
        if (b - a === 7 && c < b && d < c && e === a && c - a >= 3 && c - a <= 4) return true;
      }
      return false;
    };
    const quoting = scores
      .filter((s) => s.parts.some((p) => p.level === 0 && quotes(p.notes)))
      .map((s) => s.id);
    expect(quoting.length).toBeGreaterThanOrEqual(12);
    expect(quoting).toContain("main");
  });
});

describe("rendering", () => {
  it("is deterministic", () => {
    const a = renderScore(newDay(), SR).stems[0];
    const b = renderScore(newDay(), SR).stems[0];
    expect(a?.l).toEqual(b?.l);
  });

  it("a loop joins without a step, and masters to -16 LUFS without clipping", () => {
    const r = renderScore(battle(), SR);
    expect(r.length).toBe(Math.round(((16 * 4 * 60) / 152) * SR));
    const m = master(r, { target: -16, measure: "integrated", ceilingDb: -3, loop: true });
    expect(Math.abs(loudness(m.mix, SR).integrated + 16)).toBeLessThan(0.3);
    expect(m.peak).toBeLessThanOrEqual(10 ** (-3 / 20) + 1e-3);
    for (const ch of [m.mix.l, m.mix.r]) {
      // the join (last sample to first) is no bigger a step than the music's own
      expect(joinStep(ch).ratio).toBeLessThan(1);
      let mean = 0;
      for (const x of ch) mean += x;
      expect(Math.abs(mean / ch.length)).toBeLessThan(1e-4);
    }
  });

  it("a one-shot ends in silence", () => {
    const r = renderScore(newDay(), SR);
    const l = r.stems[0]?.l as Float32Array;
    expect(Math.abs(l[l.length - 1] as number)).toBeLessThan(1e-4);
  });
});

describe("the rendered files (assets/audio)", () => {
  const dir = join(repo, "assets/audio");
  const manifestPath = join(dir, "manifest.json");
  const has = existsSync(manifestPath);
  const manifest = has ? (JSON.parse(readFileSync(manifestPath, "utf8")) as AudioManifest) : null;

  it("exist (run `pnpm --filter @fq/audio run render`)", () => {
    expect(has).toBe(true);
  });

  it("cover every file-delivered track and every manifest entry has its files", () => {
    if (!manifest) return;
    for (const e of catalog()) {
      if (e.delivery === "live") expect(manifest.live).toContain(e.id);
      else expect(manifest.tracks[e.id], e.id).toBeDefined();
    }
    let total = 0;
    for (const [id, t] of Object.entries(manifest.tracks)) {
      expect(t.files.length, id).toBeGreaterThan(0);
      for (const f of t.files) {
        for (const file of [f.ogg, f.m4a]) {
          expect(existsSync(join(dir, file)), file).toBe(true);
          expect(statSync(join(dir, file)).size, file).toBeGreaterThan(500);
        }
        total += f.bytes;
      }
    }
    expect(total).toBe(manifest.totalBytes);
    expect(total).toBeLessThan(15e6);
  });

  it("are loudness-normalised and their loops are seamless after decoding", () => {
    if (!manifest) return;
    const target = { music: -16, stinger: -16, ambience: -26 } as Record<string, number>;
    for (const [id, t] of Object.entries(manifest.tracks)) {
      const want = target[t.kind];
      if (want !== undefined) expect(Math.abs(t.lufs - want), id).toBeLessThan(0.5);
      expect(t.peakDb, id).toBeLessThanOrEqual(-1);
      if (t.loop) {
        expect(t.loopStart, id).toBeDefined();
        expect(t.loopEnd, id).toBeGreaterThan(t.loopStart as number);
        expect(t.loopCheck?.joinRatio, id).toBeLessThan(1.5);
      }
    }
  });

  it("are all in the ledger", () => {
    if (!manifest) return;
    const ledger = readFileSync(join(dir, "LICENSES.md"), "utf8");
    for (const t of Object.values(manifest.tracks)) {
      for (const f of t.files) {
        expect(ledger).toContain(`| ${f.ogg} |`);
        expect(ledger).toContain(`| ${f.m4a} |`);
      }
    }
  });
});
