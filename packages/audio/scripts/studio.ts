/**
 * `pnpm --filter @fq/audio run studio [--sources dir] [--only id,id] [--audition]`
 *
 * Post-production of the Studio pack: recordings generated with ElevenLabs from the prompts in
 * `studioBrief.ts`, one chosen take per track (`assets/audio-studio/takes.json`), made into the
 * same deliveries as the Synth pack with the same pipeline (`pipeline.ts`): loops cut on bar
 * lines and crossfaded (`studioLoop.ts`), one-shots trimmed, everything mastered to the Synth
 * pack's levels, encoded to Ogg Opus and AAC, measured, and written to `assets/audio-studio/`
 * with `manifest.json` (the Synth manifest's schema), `sources.json` (prompt, model, parameters,
 * generation ids, credits, post-production and checks per track) and `LICENSES.md`.
 *
 * The generated recordings themselves are not in the repository. They are read from `--sources`
 * (default `~/.cache/fq-audio-studio/source`, files named `<id>__<generationId>.mp3`); each one
 * is also kept in the owner's ElevenLabs account under the generation id recorded here.
 *
 * `--audition` measures every take of every track (onsets, envelope, seam, level) without
 * writing anything, to help choose between takes.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AMB_MASTER, MUSIC_MASTER, SFX_MASTER, STING_MASTER } from "../src/catalog.js";
import type { Stereo } from "../src/dsp/core.js";
import { loudness } from "../src/dsp/loudness.js";
import type { AudioManifest, ManifestTrack } from "../src/manifestTypes.js";
import type { MasterOptions } from "../src/seq/master.js";
import {
  clipped,
  estimateKey,
  estimateTempo,
  joinStep,
  longestSilence,
  mean,
  runaway,
  spectralCentroid,
  stft,
} from "./analysis.js";
import { decodeChannels, deliver, describeDelivered, ebur128Full, ffmpeg, SR } from "./pipeline.js";
import { BRIEF, type BriefEntry } from "./studioBrief.js";
import { beatGrid, chooseLoop, cutLoop, monoOf, tailIntoHead } from "./studioLoop.js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const outDir = join(repo, "assets", "audio-studio");
const synthDir = join(repo, "assets", "audio");

/** One generation, as the ElevenLabs run reported it. */
export interface Take {
  generationId: string;
  sessionId: string;
  nodeId: string;
  /** Credits charged for this generation. */
  credits: number;
  /** ISO date of the generation. */
  date: string;
  /** The prompt and parameters, if they differ from the brief's current ones (an earlier try). */
  prompt?: string;
  params?: Record<string, number | boolean | string>;
}

export interface TakesFile {
  flowId: string;
  /** The credit ledger, batch by batch. */
  ledger: { batch: string; description: string; estimated: number; actual: number }[];
  tracks: Record<
    string,
    {
      takes: Take[];
      /** The take delivered, or null when the track falls back to Synth. */
      chosen: string | null;
      /** Why this take (or why none). */
      reason: string;
      /** The speech screen of a music track (see docs/audio/README.md). */
      voiceCheck?: string;
    }
  >;
}

interface Checks {
  seconds: number;
  lufsIntegrated: number;
  lufsMomentaryMax: number;
  truePeakDb: number;
  centroidHz: number;
  longestQuietSec: number;
  leadingSilenceSec: number;
  dc: number;
  clippedSamples: number;
  bpmEstimated?: number;
  bpmTracked?: number;
  keyEstimated?: string;
  narrowband?: string;
  onsets?: number;
  onsetsExpected?: [number, number];
  envelope?: string;
  loop?: { bars?: number; seamSimilarity?: number; method: string };
  flags: string[];
}

const masterFor = (b: BriefEntry): MasterOptions =>
  b.kind === "music"
    ? MUSIC_MASTER
    : b.kind === "stinger"
      ? STING_MASTER
      : b.kind === "ambience"
        ? AMB_MASTER
        : SFX_MASTER;

export function decodeSource(path: string, tmp: string, filter?: string): Stereo {
  const raw = join(tmp, "src.f32");
  ffmpeg([
    "-i",
    path,
    ...(filter ? ["-af", filter] : []),
    "-f",
    "f32le",
    "-ac",
    "2",
    "-ar",
    String(SR),
    raw,
  ]);
  const [l, r] = decodeRaw(raw);
  return { l, r };
}

function decodeRaw(raw: string): [Float32Array, Float32Array] {
  const b = readFileSync(raw);
  const n = Math.floor(b.length / 8);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    l[i] = b.readFloatLE(i * 8);
    r[i] = b.readFloatLE(i * 8 + 4);
  }
  return [l, r];
}

/** Index of the first sample within 40 dB of the peak (less 10 ms), for trimming a lead-in. */
export function soundStart(x: Stereo): number {
  let pk = 0;
  for (let i = 0; i < x.l.length; i++)
    pk = Math.max(pk, Math.abs(x.l[i] as number), Math.abs(x.r[i] as number));
  const thr = pk * 0.01;
  for (let i = 0; i < x.l.length; i++)
    if (Math.abs(x.l[i] as number) > thr || Math.abs(x.r[i] as number) > thr)
      return Math.max(0, i - Math.round(0.01 * SR));
  return 0;
}

/** A one-shot: lead-in trimmed (5 ms fade in), cut to `maxSeconds`, closed with a fade out. */
export function oneShot(x: Stereo, maxSeconds: number | undefined, fadeOut: number): Stereo {
  const s = soundStart(x);
  const end = Math.min(x.l.length, s + Math.round((maxSeconds ?? 1e9) * SR));
  const out: Stereo = { l: x.l.slice(s, end), r: x.r.slice(s, end) };
  const fi = Math.min(out.l.length, Math.round(0.005 * SR));
  for (let i = 0; i < fi; i++) {
    out.l[i] = (out.l[i] as number) * (i / fi);
    out.r[i] = (out.r[i] as number) * (i / fi);
  }
  {
    // always close with a fade: generated one-shots often stop at the asked length mid-sound
    const fo = Math.min(out.l.length, Math.round(fadeOut * SR));
    for (let i = 0; i < fo; i++) {
      const k = out.l.length - 1 - i;
      const g = Math.sin(((i / fo) * Math.PI) / 2);
      out.l[k] = (out.l[k] as number) * g;
      out.r[k] = (out.r[k] as number) * g;
    }
  }
  return out;
}

/** Onset times (s): peaks of the positive spectral flux above an adaptive threshold, 60 ms apart. */
export function onsets(signal: Float32Array, sr: number): number[] {
  const size = 1024;
  const hop = 256;
  // 50 ms of silence first, so an attack on the very first sample still counts
  const pad = Math.round(0.05 * sr);
  const x = new Float32Array(signal.length + pad);
  x.set(signal, pad);
  const frames = stft(x, size, hop);
  const flux: number[] = [0];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i] as Float64Array;
    const b = frames[i - 1] as Float64Array;
    let s = 0;
    for (let k = 1; k < a.length; k++)
      s += Math.max(0, Math.log1p(1000 * (a[k] as number)) - Math.log1p(1000 * (b[k] as number)));
    flux.push(s);
  }
  const max = Math.max(...flux);
  const out: number[] = [];
  const w = 6;
  let last = -1e9;
  for (let i = 1; i < flux.length - 1; i++) {
    const v = flux[i] as number;
    if (v < (flux[i - 1] as number) || v < (flux[i + 1] as number)) continue;
    let m = 0;
    let n = 0;
    for (let j = Math.max(0, i - 3 * w); j <= Math.min(flux.length - 1, i + w); j++) {
      m += flux[j] as number;
      n++;
    }
    const t = (i * hop - pad) / sr;
    if (v > 1.5 * (m / n) + 0.08 * max && t - last > 0.06) {
      out.push(t);
      last = t;
    }
  }
  return out;
}

/** Envelope words: when the peak comes, how fast the sound dies, whether it is cut off. */
function envelope(x: Float32Array, sr: number): string {
  const win = Math.round(0.01 * sr);
  const lv: number[] = [];
  for (let s = 0; s + win <= x.length; s += win) {
    let e = 0;
    for (let i = s; i < s + win; i++) e += (x[i] as number) ** 2;
    lv.push(10 * Math.log10(e / win + 1e-12));
  }
  const pk = Math.max(...lv);
  const at = lv.indexOf(pk);
  let d20 = lv.length;
  for (let i = at; i < lv.length; i++)
    if ((lv[i] as number) < pk - 20) {
      d20 = i;
      break;
    }
  const tail = lv.slice(-5).reduce((a, b) => Math.max(a, b), -200);
  return `peak at ${(at * 0.01).toFixed(2)} s, -20 dB after ${((d20 - at) * 0.01).toFixed(2)} s, last 50 ms ${(tail - pk).toFixed(0)} dB re peak`;
}

function measure(b: BriefEntry, shipped: string, tmp: string, t: ManifestTrack): Checks {
  const chans = decodeChannels(shipped, 2, tmp) as [Float32Array, Float32Array];
  const a = t.loopStart !== undefined ? Math.round(t.loopStart * SR) : 0;
  const e = t.loopEnd !== undefined ? Math.round(t.loopEnd * SR) : (chans[0]?.length ?? 0);
  const x: Stereo = { l: chans[0].slice(a, e), r: chans[1].slice(a, e) };
  const mono = monoOf(x);
  const size = 8192;
  const frames = stft(mono, size, 4096);
  const loud = loudness(x, SR);
  const r128 = ebur128Full(shipped);
  const flags: string[] = [];
  const c: Checks = {
    seconds: Math.round((mono.length / SR) * 100) / 100,
    lufsIntegrated: Math.round(loud.integrated * 10) / 10,
    lufsMomentaryMax: Math.round(loud.momentaryMax * 10) / 10,
    truePeakDb: r128.truePeak,
    centroidHz: frames.length ? Math.round(spectralCentroid(frames, SR, size)) : 0,
    longestQuietSec: longestSilence(mono, SR, -50),
    leadingSilenceSec: Math.round((soundStart(x) / SR) * 100) / 100,
    dc: Number(mean(mono).toExponential(1)),
    clippedSamples: clipped(mono),
    flags,
  };
  if (c.clippedSamples > 0) flags.push("clipping");
  if (Math.abs(c.dc) > 1e-3) flags.push("dc offset");
  if (Number.isFinite(c.truePeakDb) && c.truePeakDb > -0.5) flags.push("true peak above -0.5 dBTP");
  if (b.kind === "music" || b.kind === "stinger") {
    c.bpmEstimated = estimateTempo(mono, SR);
    const k = estimateKey(frames, SR, size);
    c.keyEstimated = `${k.key} (r ${k.r.toFixed(2)})`;
    const rw = runaway(frames, SR, size);
    c.narrowband = `${rw.stuck ? "STUCK " : ""}${Math.round(rw.share * 100)}% of frames @ ${rw.hz.toFixed(0)} Hz`;
    if (rw.stuck) flags.push("stuck narrowband tone");
  }
  if (b.kind === "music" && c.longestQuietSec > 0.5) flags.push("dead air in a loop");
  if (b.kind === "ambience" && c.longestQuietSec > 1.5) flags.push("dead air in an ambience");
  if (b.kind === "sfx" || b.kind === "stinger") {
    const on = onsets(mono, SR);
    c.onsets = on.length;
    c.envelope = envelope(mono, SR);
    if (b.onsets) {
      c.onsetsExpected = b.onsets;
      if (on.length < b.onsets[0] || on.length > b.onsets[1])
        flags.push(`onsets ${on.length} outside ${b.onsets[0]}-${b.onsets[1]}`);
    }
    if (c.leadingSilenceSec > 0.05) flags.push("leading silence");
  }
  if (t.loopCheck && t.loopCheck.joinRatio > 1.5) flags.push("loop seam step");
  return c;
}

/** The music's own tempo, tracked on the decoded recording (for the time-stretch of layers). */
function trackedBpm(x: Stereo, prior: number, beatsPerBar: number): number {
  return beatGrid(monoOf(x), SR, prior, beatsPerBar).grid.bpm;
}

interface Prepared {
  stems: Stereo[];
  loop?: { bars?: number; seamSimilarity?: number; method: string };
  bpmTracked?: number;
}

function prepare(b: BriefEntry, src: string, tmp: string): Prepared {
  if (b.kind === "music") {
    const prior = b.bpm ?? 100;
    const bpb = b.beatsPerBar ?? 4;
    let x = decodeSource(src, tmp);
    let filterNote = "";
    if (b.loopBars !== undefined) {
      // Layers must share one tempo exactly: stretch to the brief's (pitch kept).
      const bpm = trackedBpm(x, prior, bpb);
      const ratio = prior / bpm;
      x = decodeSource(src, tmp, `rubberband=tempo=${ratio.toFixed(6)}:pitchq=quality`);
      filterNote = `, stretched x${ratio.toFixed(4)} from ${bpm.toFixed(2)} bpm`;
    }
    const mono = monoOf(x);
    const { grid, frames } = beatGrid(mono, SR, prior, bpb);
    const target =
      b.loopBars !== undefined ? (b.loopBars * bpb * 60) / prior : (b.loopSeconds ?? 40);
    const choice = chooseLoop(mono, SR, grid, frames.mags, {
      targetSec: target,
      minSec: target * 0.7,
      maxSec: target * 1.3,
      ...(b.loopBars !== undefined ? { fixedBars: b.loopBars } : {}),
    });
    // layers: exactly loopBars at the brief's tempo, so the three stay in step
    const end = b.loopBars !== undefined ? choice.start + target : choice.end;
    const period = cutLoop(x, SR, choice.start, end, choice.crossfade);
    return {
      stems: [period],
      bpmTracked: Math.round(grid.bpm * 10) / 10,
      loop: {
        bars: choice.bars,
        seamSimilarity: Math.round(choice.similarity * 1000) / 1000,
        method: `bar lines ${choice.start.toFixed(3)} s to ${end.toFixed(3)} s of the recording, ${choice.crossfade.toFixed(2)} s equal-power crossfade of the continuation into the head${filterNote}`,
      },
    };
  }
  const x = decodeSource(src, tmp);
  if (b.kind === "ambience" && b.pulse) {
    // a pulse (clock, monitor): cut on it like music so the rhythm runs straight through the seam
    const mono = monoOf(x);
    const { grid, frames } = beatGrid(mono, SR, b.pulse.bpm, b.pulse.beatsPerBar);
    const target = b.loopSeconds ?? 8;
    const choice = chooseLoop(mono, SR, grid, frames.mags, {
      targetSec: target,
      minSec: target * 0.6,
      maxSec: Math.min(target * 1.4, mono.length / SR - 1),
    });
    return {
      stems: [cutLoop(x, SR, choice.start, choice.end, Math.min(choice.crossfade, 0.25))],
      bpmTracked: Math.round(grid.bpm * 10) / 10,
      loop: {
        bars: choice.bars,
        seamSimilarity: Math.round(choice.similarity * 1000) / 1000,
        method: `pulse at ${grid.bpm.toFixed(1)} per minute; ${choice.bars} groups of ${b.pulse.beatsPerBar} from ${choice.start.toFixed(3)} s to ${choice.end.toFixed(3)} s, short equal-power crossfade`,
      },
    };
  }
  if (b.kind === "ambience") {
    // The model was asked for a seamless loop: keep it whole if its own seam holds, else crossfade.
    const mono = monoOf(x);
    const n = mono.length;
    const w = new Float32Array(2 * SR);
    for (let i = 0; i < SR; i++) {
      w[i] = mono[n - SR + i] as number;
      w[SR + i] = mono[i] as number;
    }
    const j = joinStep(w);
    const step = Math.abs((w[SR] as number) - (w[SR - 1] as number));
    const rms = (a: number, z: number) => {
      let e = 0;
      for (let i = a; i < z; i++) e += (mono[i] as number) ** 2;
      return 10 * Math.log10(e / (z - a) + 1e-12);
    };
    const half = Math.round(0.5 * SR);
    const levelJump = Math.abs(rms(0, half) - rms(n - half, n));
    if (j.p999 > 0 && step / j.p999 < 1) {
      return {
        stems: [x],
        loop: {
          method: `as generated (the model's loop): seam step ${(step / j.p999).toFixed(2)} of the 99.9th-percentile step, level ${levelJump.toFixed(1)} dB across it`,
        },
      };
    }
    return {
      stems: [tailIntoHead(x, SR, 1)],
      loop: {
        method: `tail crossfaded into head over 1 s (the model's own seam stepped ${(step / (j.p999 || 1)).toFixed(2)}, level ${levelJump.toFixed(1)} dB)`,
      },
    };
  }
  return { stems: [oneShot(x, b.maxSeconds, b.kind === "stinger" ? 0.3 : 0.08)] };
}

function main() {
  const args = process.argv.slice(2);
  const opt = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const sources = opt("--sources") ?? join(homedir(), ".cache", "fq-audio-studio", "source");
  const only = opt("--only") ? new Set((opt("--only") as string).split(",")) : null;
  const takesPath = join(outDir, "takes.json");
  const takes = JSON.parse(readFileSync(takesPath, "utf8")) as TakesFile;
  const tmp = mkdtempSync(join(tmpdir(), "fq-studio-"));

  if (args.includes("--audition")) {
    for (const b of BRIEF) {
      if (only && !only.has(b.id)) continue;
      for (const t of takes.tracks[b.id]?.takes ?? []) {
        const f = join(sources, `${b.id}__${t.generationId}.mp3`);
        if (!existsSync(f)) continue;
        const x = decodeSource(f, tmp);
        const mono = monoOf(x);
        const on = onsets(mono, SR);
        console.log(
          `${b.id.padEnd(18)} ${t.generationId}  ${(mono.length / SR).toFixed(2)} s  onsets ${on.length}${b.onsets ? ` (want ${b.onsets.join("-")})` : ""}  lead ${(soundStart(x) / SR).toFixed(2)} s  ${envelope(mono, SR)}`,
        );
      }
    }
    rmSync(tmp, { recursive: true, force: true });
    return;
  }

  const manifestPath = join(outDir, "manifest.json");
  const sourcesPath = join(outDir, "sources.json");
  const previous: AudioManifest | null =
    only && existsSync(manifestPath)
      ? (JSON.parse(readFileSync(manifestPath, "utf8")) as AudioManifest)
      : null;
  const prevSources: Record<string, unknown> =
    only && existsSync(sourcesPath)
      ? (JSON.parse(readFileSync(sourcesPath, "utf8")) as { tracks: Record<string, unknown> })
          .tracks
      : {};
  if (!only)
    for (const d of ["music", "ambience", "sfx"])
      rmSync(join(outDir, d), { recursive: true, force: true });
  for (const d of ["music", "ambience", "sfx"]) mkdirSync(join(outDir, d), { recursive: true });
  const synth = JSON.parse(readFileSync(join(synthDir, "manifest.json"), "utf8")) as AudioManifest;

  const tracks: Record<string, ManifestTrack> = { ...(previous?.tracks ?? {}) };
  const provenance: Record<string, unknown> = { ...prevSources };
  // Tracks are delivered per game id; the negotiation's three briefs make one track.
  const ids = [...new Set(BRIEF.map((b) => b.id.replace(/\.layer\d$/, "")))];
  for (const id of ids) {
    if (only && !only.has(id)) continue;
    const briefs = BRIEF.filter((b) => b.id === id || b.id.startsWith(`${id}.layer`));
    const first = briefs[0] as BriefEntry;
    const picks = briefs.map((b) => {
      const rec = takes.tracks[b.id];
      const take = rec?.takes.find((t) => t.generationId === rec.chosen);
      const file = take ? join(sources, `${b.id}__${take.generationId}.mp3`) : null;
      return { b, rec, take, file };
    });
    const missing = picks.filter((p) => !p.take || !p.file || !existsSync(p.file));
    if (missing.length) {
      delete tracks[id];
      provenance[id] = {
        fallback: "synth",
        reason: missing.map((p) => `${p.b.id}: ${p.rec?.reason ?? "not generated"}`).join("; "),
        takes: picks.map((p) => ({ brief: p.b.id, takes: p.rec?.takes ?? [] })),
      };
      console.log(
        `${id.padEnd(16)} falls back to Synth (${(provenance[id] as { reason: string }).reason})`,
      );
      continue;
    }
    const started = Date.now();
    const prepared = picks.map((p) => prepare(p.b, p.file as string, tmp));
    const stems = prepared.flatMap((p) => p.stems);
    const n = Math.min(...stems.map((s) => s.l.length));
    const even = stems.map((s) => ({ l: s.l.slice(0, n), r: s.r.slice(0, n) }));
    const synthTitle = synth.tracks[id]?.title;
    const d = deliver(
      {
        id,
        kind: first.kind,
        title: synthTitle ?? first.title,
        loop: first.kind === "music" || first.kind === "ambience",
        channels: first.kind === "music" || first.kind === "stinger" ? 2 : 1,
        rendered: { stems: even, length: n, sr: SR },
        master: masterFor(first),
        separateStems: even.length > 1,
        maxTruePeakDb: -1,
      },
      outDir,
      tmp,
    );
    const track = d.track;
    if (first.bpm !== undefined && (first.kind === "music" || first.kind === "stinger")) {
      track.bpm = prepared[0]?.bpmTracked ?? first.bpm;
      if (first.key) track.key = first.key;
      if (prepared[0]?.loop?.bars) track.bars = prepared[0].loop.bars;
      if (first.beatsPerBar) track.beatsPerBar = first.beatsPerBar;
    }
    if (first.loopBars !== undefined) track.bpm = first.bpm as number;
    tracks[id] = track;
    const checks = track.files.map((f, i) =>
      measure(briefs[i] ?? first, join(outDir, f.ogg), tmp, track),
    );
    provenance[id] = {
      title: track.title,
      where: first.where,
      generatedWith: "ElevenLabs",
      stems: picks.map((p, i) => ({
        brief: p.b.id,
        studioTitle: p.b.title,
        model: p.b.model,
        prompt: p.take?.prompt ?? p.b.prompt,
        params: p.take?.params ?? p.b.params,
        generationId: p.take?.generationId,
        sessionId: p.take?.sessionId,
        nodeId: p.take?.nodeId,
        generatedOn: p.take?.date,
        credits: p.take?.credits,
        chosenBecause: p.rec?.reason,
        voiceCheck: p.rec?.voiceCheck,
        otherTakes: (p.rec?.takes ?? [])
          .filter((t) => t.generationId !== p.take?.generationId)
          .map((t) => ({
            generationId: t.generationId,
            credits: t.credits,
            date: t.date,
            ...(t.prompt ? { prompt: t.prompt, params: t.params } : {}),
          })),
        post: prepared[i]?.loop ?? {
          method: "lead-in trimmed, cut to the brief's length with a fade",
        },
        checks: checks[i],
      })),
    };
    console.log(describeDelivered(id, d, started));
    for (const [i, c] of checks.entries())
      if (c.flags.length) console.log(`  ${briefs[i]?.id ?? id}: ${c.flags.join(", ")}`);
  }

  const totalBytes = Object.values(tracks).reduce(
    (s, t) => s + t.files.reduce((a, f) => a + f.bytes, 0),
    0,
  );
  const manifest: AudioManifest = {
    generator:
      "ElevenLabs generations post-processed by packages/audio (pnpm --filter @fq/audio run studio)",
    license:
      "Generated with ElevenLabs under the owner's account; redistribution terms are ElevenLabs' terms for that plan, unconfirmed (see LICENSES.md).",
    sampleRate: SR,
    totalBytes,
    live: synth.live,
    tracks: Object.fromEntries(Object.entries(tracks).sort(([a], [b]) => a.localeCompare(b))),
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const sorted = Object.fromEntries(
    Object.entries(provenance).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(
    sourcesPath,
    `${JSON.stringify({ flowId: takes.flowId, ledger: takes.ledger, tracks: sorted }, null, 2)}\n`,
  );
  writeFileSync(join(outDir, "LICENSES.md"), ledger(manifest, sorted, synth, takes));
  rmSync(tmp, { recursive: true, force: true });
  console.log(
    `\n${Object.keys(tracks).length} Studio tracks, ${(totalBytes / 1e6).toFixed(2)} MB (Synth: ${(synth.totalBytes / 1e6).toFixed(2)} MB)`,
  );
}

function ledger(
  m: AudioManifest,
  prov: Record<string, unknown>,
  synth: AudioManifest,
  takes: TakesFile,
): string {
  const total = takes.ledger.reduce((s, l) => s + l.actual, 0);
  const lines = [
    "# Studio audio ledger",
    "",
    "What every file in this directory is, and what is not settled about it.",
    "",
    "- **Origin.** Each file was generated with ElevenLabs (models `eleven_music_v2_5` for music",
    "  and stingers, `eleven_text_to_sound_v2` for ambience and effects) under the project owner's",
    "  ElevenLabs account, from the text prompt recorded for it in `sources.json` (with the model,",
    "  its parameters, the generation id, the date and the credits charged), and then",
    "  post-processed by `packages/audio` (`pnpm --filter @fq/audio run studio`): loops cut on bar",
    "  lines and crossfaded, one-shots trimmed, mastered to the Synth pack's loudness targets,",
    "  encoded to Ogg Opus and AAC. No recording, sample or music from the original 2001 game, and",
    "  no third-party audio, was given to the generator: the prompts are text written for this",
    "  project.",
    "- **Licence: not established here.** These files are not covered by the project's licence",
    "  the way the Synth pack is. Their redistribution terms are those of ElevenLabs' terms of",
    "  service for the plan the owner's account is on at the time of generation. The owner must",
    "  confirm those terms allow shipping them (in the web build, the desktop and mobile apps, and",
    "  any store build) before the Studio pack is made the default or shipped in a store build.",
    "  Until then the game's default stays the Synth pack.",
    "- **The Synth pack** (`assets/audio/`) remains fully generated from this repository's own code",
    "  and carries the project's licence; any id this pack lacks plays from it.",
    `- **Cost.** ${total.toFixed(0)} credits in all (the ledger is in \`sources.json\`).`,
    "",
    "| File | Kind | Id | Model | Generation id | Generated on |",
    "|---|---|---|---|---|---|",
  ];
  for (const [id, t] of Object.entries(m.tracks)) {
    const p = prov[id] as { stems: { model: string; generationId: string; generatedOn: string }[] };
    t.files.forEach((f, i) => {
      const s = p.stems[i] ?? p.stems[0];
      for (const file of [f.ogg, f.m4a])
        lines.push(
          `| ${file} | ${t.kind} | \`${id}\` | ${s?.model} | ${s?.generationId} | ${s?.generatedOn} |`,
        );
    });
  }
  const fallback = Object.keys(synth.tracks).filter((id) => !m.tracks[id]);
  lines.push(
    "",
    fallback.length
      ? `Not in this pack (played from the Synth pack): ${fallback.map((id) => `\`${id}\``).join(", ")}.`
      : "Every rendered Synth id has a Studio file.",
    `UI sounds synthesised in the browser (no file, both packs): ${m.live.map((id) => `\`${id}\``).join(", ")}.`,
    "",
  );
  return lines.join("\n");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
