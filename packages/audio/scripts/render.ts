/**
 * `pnpm --filter @fq/audio run render`: renders every track in the catalog, masters it, encodes
 * Ogg Opus and AAC (m4a) with the installed ffmpeg, checks the loops after decoding, and writes
 * assets/audio/ with manifest.json and LICENSES.md.
 *
 * Options: `--only id,id` renders a subset (the manifest then keeps the other entries it had).
 */
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { type CatalogEntry, catalog } from "../src/catalog.js";
import { activeLength, type Stereo, sliceStereo, stereo } from "../src/dsp/core.js";
import { LOOP_FADE } from "../src/live.js";
import { repairLoop } from "../src/loop.js";
import type { AudioManifest, ManifestTrack } from "../src/manifestTypes.js";
import { master } from "../src/seq/master.js";
import type { Rendered } from "../src/seq/render.js";
import { joinStep } from "./analysis.js";
import { readF32, writeWav } from "./wav.js";

const SR = 48000;
/** Lead-in before the loop start and the overrun after its end, in the file (see `loopFile`). */
const PRE = 0.25;
const POST = 0.5;

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const outDir = join(repo, "assets", "audio");

/** Bitrates (kbit/s) by kind and channel count: [opus, aac]. */
function bitrates(e: CatalogEntry, channels: number): [number, number] {
  if (e.kind === "music" || e.kind === "stinger") return channels === 2 ? [40, 48] : [28, 32];
  if (e.kind === "ambience") return channels === 2 ? [32, 40] : [24, 32];
  return channels === 2 ? [40, 48] : [32, 40];
}

/**
 * A loop file: the period, with PRE seconds of its own end before it and POST seconds of its own
 * start after it. Whatever delay a decoder adds (Opus pre-skip, AAC priming that a browser does
 * not trim), the window [loopStart, loopEnd] is still exactly one period of a periodic signal.
 */
function loopFile(period: Stereo): Stereo {
  const L = period.l.length;
  const pre = Math.round(PRE * SR);
  const n = pre + L + Math.round(POST * SR);
  const out = stereo(n);
  for (let i = 0; i < n; i++) {
    const j = (((i - pre) % L) + L) % L;
    out.l[i] = period.l[j] as number;
    out.r[i] = period.r[j] as number;
  }
  return out;
}

/** A one-shot trimmed to its sound plus 20 ms, with a 10 ms fade to zero. */
function trimmed(b: Stereo): Stereo {
  const end = Math.min(b.l.length, activeLength(b, 3e-5) + Math.round(0.02 * SR));
  const out = sliceStereo(b, 0, Math.max(end, Math.round(0.02 * SR)));
  const f = Math.min(out.l.length, Math.round(0.01 * SR));
  for (let i = 0; i < f; i++) {
    const k = out.l.length - 1 - i;
    out.l[k] = (out.l[k] as number) * (i / f);
    out.r[k] = (out.r[k] as number) * (i / f);
  }
  return out;
}

function cloneRendered(r: Rendered): Rendered {
  return { ...r, stems: r.stems.map((s) => ({ l: s.l.slice(), r: s.r.slice() })) };
}

function toDualMono(b: Stereo): void {
  for (let i = 0; i < b.l.length; i++) {
    const v = ((b.l[i] as number) + (b.r[i] as number)) * 0.5;
    b.l[i] = v;
    b.r[i] = v;
  }
}

/** True when the two channels are the same signal (within a hair). */
function isMono(b: Stereo): boolean {
  let d = 0;
  let s = 0;
  for (let i = 0; i < b.l.length; i++) {
    d += ((b.l[i] as number) - (b.r[i] as number)) ** 2;
    s += (b.l[i] as number) ** 2 + (b.r[i] as number) ** 2;
  }
  return s === 0 || d / s < 0.01;
}

function ffmpeg(args: string[]): string {
  return execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function encode(
  wav: string,
  base: string,
  channels: number,
  rates: [number, number],
): [string, string] {
  const ogg = `${base}.ogg`;
  const m4a = `${base}.m4a`;
  const ac = ["-ac", String(channels)];
  ffmpeg([
    "-i",
    wav,
    ...ac,
    "-c:a",
    "libopus",
    "-b:a",
    `${rates[0]}k`,
    "-vbr",
    "on",
    "-application",
    "audio",
    "-map_metadata",
    "-1",
    ogg,
  ]);
  ffmpeg([
    "-i",
    wav,
    ...ac,
    "-c:a",
    "aac",
    "-b:a",
    `${rates[1]}k`,
    "-map_metadata",
    "-1",
    "-movflags",
    "+faststart",
    m4a,
  ]);
  return [ogg, m4a];
}

/** Decodes a file to float PCM at 48 kHz and returns the left (or only) channel. */
function decode(path: string, channels: number, tmp: string): Float32Array {
  const raw = join(tmp, "decoded.f32");
  ffmpeg(["-i", path, "-f", "f32le", "-ac", String(channels), "-ar", String(SR), raw]);
  return readF32(raw, channels)[0] as Float32Array;
}

/** The highest sample peak, dBFS, of the given files once decoded. */
function decodedPeakDb(paths: string[], channels: number, tmp: string): number {
  let p = 0;
  for (const path of paths) {
    const raw = join(tmp, "peak.f32");
    ffmpeg(["-i", path, "-f", "f32le", "-ac", String(channels), "-ar", String(SR), raw]);
    for (const ch of readF32(raw, channels))
      for (let i = 0; i < ch.length; i++) p = Math.max(p, Math.abs(ch[i] as number));
  }
  return p > 0 ? 20 * Math.log10(p) : -120;
}

/** ffmpeg's own EBU R128 reading of a file, integrated LUFS (a cross-check of ours). */
function ebur128(path: string): number {
  const res = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", path, "-af", "ebur128", "-f", "null", "-"],
    {
      encoding: "utf8",
    },
  );
  const tail = res.stderr.slice(res.stderr.lastIndexOf("Integrated loudness"));
  const m = /I:\s+(-?[\d.]+) LUFS/.exec(tail);
  return m ? Number(m[1]) : Number.NaN;
}

interface LoopCheck {
  /** Waveform agreement of the decoded overrun with the decoded start (codec error), dB. */
  periodDb: number;
  /** Step across the loop point / 99.9th-percentile step, as decoded (before the client's repair). */
  rawJoin: number;
  /** The same after `repairLoop`, which is what the client plays. */
  joinRatio: number;
}

/** The step a player hears at the loop point, relative to the signal's own steps. */
function joinRatioAt(x: Float32Array, s: number, e: number): number {
  const around = new Float32Array(2 * SR);
  for (let i = 0; i < SR; i++) {
    around[i] = x[e - SR + i] as number;
    around[SR + i] = x[s + i] as number;
  }
  const ref = joinStep(around).p999;
  const step = Math.abs((around[SR] as number) - (around[SR - 1] as number));
  return ref > 0 ? step / ref : 0;
}

function checkLoop(
  file: string,
  channels: number,
  loopStart: number,
  loopEnd: number,
  tmp: string,
): LoopCheck {
  const x = decode(file, channels, tmp);
  const s = Math.round(loopStart * SR);
  const e = Math.round(loopEnd * SR);
  const n = Math.min(Math.round(0.4 * SR), x.length - e);
  let diff = 0;
  let sig = 0;
  for (let i = 0; i < n; i++) {
    diff += ((x[e + i] as number) - (x[s + i] as number)) ** 2;
    sig += (x[s + i] as number) ** 2;
  }
  const rawJoin = joinRatioAt(x, s, e);
  repairLoop(x, s, e, Math.round(LOOP_FADE * SR));
  return {
    periodDb: sig > 0 ? 10 * Math.log10(diff / sig + 1e-12) : -120,
    rawJoin,
    joinRatio: joinRatioAt(x, s, e),
  };
}

function main() {
  const args = process.argv.slice(2);
  const onlyArg = args.indexOf("--only");
  const only = onlyArg >= 0 ? new Set((args[onlyArg + 1] ?? "").split(",")) : null;
  const tmp = mkdtempSync(join(tmpdir(), "fq-audio-"));
  const entries = catalog();
  const manifestPath = join(outDir, "manifest.json");
  const previous: AudioManifest | null =
    only && existsSync(manifestPath)
      ? (JSON.parse(readFileSync(manifestPath, "utf8")) as AudioManifest)
      : null;
  if (!only) rmSync(outDir, { recursive: true, force: true });
  for (const d of ["music", "ambience", "sfx"]) mkdirSync(join(outDir, d), { recursive: true });

  const tracks: Record<string, ManifestTrack> = { ...(previous?.tracks ?? {}) };
  const live: string[] = [];
  const t0 = Date.now();
  for (const e of entries) {
    if (e.delivery === "live") {
      live.push(e.id);
      continue;
    }
    if (only && !only.has(e.id)) continue;
    const started = Date.now();
    const rendered = e.render(SR);
    // Mono deliveries are measured as shipped: fold to mono before mastering.
    if (e.channels === 1) for (const st of rendered.stems) toDualMono(st);
    const dir = e.kind === "ambience" ? "ambience" : e.kind === "sfx" ? "sfx" : "music";
    const channels = e.channels === 1 || rendered.stems.every(isMono) ? 1 : 2;
    const rates = bitrates(e, channels);
    let files: ManifestTrack["files"] = [];
    let m = master(cloneRendered(rendered), e.master);
    let duration = 0;
    // Lossy codecs overshoot the master's peaks (Opus by up to 3 dB on sharp attacks). If a
    // decoded file comes within 1 dB of full scale, master again with a lower ceiling: the
    // limiter takes the few offending peaks and the loudness stays where it was.
    for (let attempt = 0, ceilingDb = e.master.ceilingDb; ; attempt++) {
      files = [];
      m.stems.forEach((stem, i) => {
        const body = e.loop ? loopFile(stem) : trimmed(stem);
        duration = body.l.length / SR;
        const name = m.stems.length > 1 ? `${e.id}.layer${i}` : e.id;
        const wav = join(tmp, `${name}.wav`);
        writeWav(wav, body, SR, channels === 1);
        const [ogg, m4a] = encode(wav, join(outDir, dir, name), channels, rates);
        files.push({
          ogg: relative(outDir, ogg),
          m4a: relative(outDir, m4a),
          bytes: statSync(ogg).size + statSync(m4a).size,
        });
      });
      const decoded = decodedPeakDb(
        files.flatMap((f) => [join(outDir, f.ogg), join(outDir, f.m4a)]),
        channels,
        tmp,
      );
      if (decoded <= -1 || attempt === 3) break;
      ceilingDb -= 1.5;
      console.log(
        `  ${e.id}: decoded peak ${decoded.toFixed(1)} dBFS, mastering again at ${ceilingDb} dBFS`,
      );
      m = master(cloneRendered(rendered), { ...e.master, ceilingDb });
    }
    let loopStart: number | undefined;
    let loopEnd: number | undefined;
    const checks: LoopCheck[] = [];
    if (e.loop) {
      loopStart = PRE;
      loopEnd = PRE + m.length / SR;
      for (const f of files) {
        checks.push(
          checkLoop(join(outDir, f.ogg), channels, loopStart, loopEnd, tmp),
          checkLoop(join(outDir, f.m4a), channels, loopStart, loopEnd, tmp),
        );
      }
    }
    // Loudness as ffmpeg reads the encoded file (the mix for single files; stems are summed in the client).
    const lufsFile =
      files.length === 1 ? ebur128(join(outDir, (files[0] as { ogg: string }).ogg)) : Number.NaN;
    const track: ManifestTrack = {
      kind: e.kind,
      title: e.title,
      loop: e.loop,
      channels,
      duration: Math.round(duration * 1000) / 1000,
      files,
      lufs: Math.round(m.lufs * 10) / 10,
      peakDb: Math.round(20 * Math.log10(m.peak) * 10) / 10,
    };
    if (Number.isFinite(lufsFile)) track.lufsEncoded = lufsFile;
    if (loopStart !== undefined && loopEnd !== undefined) {
      track.loopStart = loopStart;
      track.loopEnd = Math.round(loopEnd * 1e6) / 1e6;
      track.loopCheck = {
        periodDb: Math.round(Math.max(...checks.map((c) => c.periodDb)) * 10) / 10,
        rawJoin: Math.round(Math.max(...checks.map((c) => c.rawJoin)) * 100) / 100,
        joinRatio: Math.round(Math.max(...checks.map((c) => c.joinRatio)) * 100) / 100,
      };
    }
    if (e.score) {
      track.bpm = e.score.bpm;
      track.key = e.score.key;
      track.bars = e.score.bars;
      track.beatsPerBar = e.score.beatsPerBar;
    }
    tracks[e.id] = track;
    const kb = files.reduce((s, f) => s + f.bytes, 0) / 1024;
    console.log(
      `${e.id.padEnd(16)} ${e.kind.padEnd(8)} ${duration.toFixed(1).padStart(6)} s  ${m.lufs.toFixed(1)} LUFS` +
        `${Number.isFinite(lufsFile) ? ` (ffmpeg ${lufsFile.toFixed(1)})` : ""}  peak ${track.peakDb} dBFS  ${kb.toFixed(0)} KB` +
        `${track.loopCheck ? `  loop: codec ${track.loopCheck.periodDb} dB, join ${track.loopCheck.rawJoin} -> ${track.loopCheck.joinRatio}` : ""}` +
        `  ${((Date.now() - started) / 1000).toFixed(1)} s`,
    );
  }
  const totalBytes = Object.values(tracks).reduce(
    (s, t) => s + t.files.reduce((a, f) => a + f.bytes, 0),
    0,
  );
  const manifest: AudioManifest = {
    generator: "packages/audio (pnpm --filter @fq/audio run render)",
    license:
      "Generated from source in packages/audio; same licence as the project (see license.txt).",
    sampleRate: SR,
    totalBytes,
    live,
    tracks: Object.fromEntries(Object.entries(tracks).sort(([a], [b]) => a.localeCompare(b))),
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(outDir, "LICENSES.md"), ledger(manifest));
  rmSync(tmp, { recursive: true, force: true });
  console.log(
    `\n${Object.keys(tracks).length} tracks, ${(totalBytes / 1e6).toFixed(2)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`,
  );
}

function ledger(m: AudioManifest): string {
  const lines = [
    "# Audio ledger",
    "",
    "Every file in this directory is generated by code in `packages/audio` of this repository:",
    "oscillators, noise, envelopes, filters and simple physical models, sequenced from note data",
    "composed for this project (`packages/audio/src/music`), or effect and ambience generators",
    "(`packages/audio/src/sfx`, `packages/audio/src/ambience`). No recordings, samples, sample",
    "libraries, AI music services or material from the original 2001 game were used. Every file",
    "carries the project's licence (`license.txt` at the repository root), the same as the code",
    "that makes it. Rebuild with `pnpm --filter @fq/audio run render`.",
    "",
    "| File | Kind | Title | Source | Licence |",
    "|---|---|---|---|---|",
  ];
  for (const [id, t] of Object.entries(m.tracks)) {
    const src =
      t.kind === "ambience"
        ? "src/ambience"
        : t.kind === "sfx"
          ? "src/sfx/effects.ts"
          : "src/music";
    for (const f of t.files) {
      for (const file of [f.ogg, f.m4a]) {
        lines.push(
          `| ${file} | ${t.kind} | ${t.title} (\`${id}\`) | packages/audio/${src} | project licence |`,
        );
      }
    }
  }
  lines.push(
    "",
    `Synthesised in the browser, no file: ${m.live.map((id) => `\`${id}\``).join(", ")} (packages/audio/src/sfx/ui.ts).`,
    "",
  );
  return lines.join("\n");
}

main();
