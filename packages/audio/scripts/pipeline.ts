/**
 * The delivery half of the audio build, shared by the Synth render (`render.ts`) and the Studio
 * pack's post-production (`studio.ts`): master a buffer, lay a loop out as a file, trim a
 * one-shot, encode Ogg Opus and AAC with the installed ffmpeg, re-master if the codec overshoots
 * the ceiling, measure the decoded loop seam and read the encoded loudness back.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { statSync } from "node:fs";
import { join, relative } from "node:path";
import { activeLength, type Stereo, sliceStereo, stereo } from "../src/dsp/core.js";
import { LOOP_FADE } from "../src/live.js";
import { repairLoop } from "../src/loop.js";
import type { ManifestTrack } from "../src/manifestTypes.js";
import { type Mastered, type MasterOptions, master } from "../src/seq/master.js";
import type { Rendered } from "../src/seq/render.js";
import type { TrackKind } from "../src/tracks.js";
import { joinStep } from "./analysis.js";
import { readF32, writeWav } from "./wav.js";

export const SR = 48000;
/** Lead-in before the loop start and the overrun after its end, in the file (see `loopFile`). */
export const PRE = 0.25;
export const POST = 0.5;

/** Bitrates (kbit/s) by kind and channel count: [opus, aac]. */
export function bitrates(kind: TrackKind, channels: number): [number, number] {
  if (kind === "music" || kind === "stinger") return channels === 2 ? [40, 48] : [28, 32];
  if (kind === "ambience") return channels === 2 ? [32, 40] : [24, 32];
  return channels === 2 ? [40, 48] : [32, 40];
}

/**
 * A loop file: the period, with PRE seconds of its own end before it and POST seconds of its own
 * start after it. Whatever delay a decoder adds (Opus pre-skip, AAC priming that a browser does
 * not trim), the window [loopStart, loopEnd] is still exactly one period of a periodic signal.
 */
export function loopFile(period: Stereo): Stereo {
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
export function trimmed(b: Stereo): Stereo {
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

export function cloneRendered(r: Rendered): Rendered {
  return { ...r, stems: r.stems.map((s) => ({ l: s.l.slice(), r: s.r.slice() })) };
}

export function toDualMono(b: Stereo): void {
  for (let i = 0; i < b.l.length; i++) {
    const v = ((b.l[i] as number) + (b.r[i] as number)) * 0.5;
    b.l[i] = v;
    b.r[i] = v;
  }
}

/** True when the two channels are the same signal (within a hair). */
export function isMono(b: Stereo): boolean {
  let d = 0;
  let s = 0;
  for (let i = 0; i < b.l.length; i++) {
    d += ((b.l[i] as number) - (b.r[i] as number)) ** 2;
    s += (b.l[i] as number) ** 2 + (b.r[i] as number) ** 2;
  }
  return s === 0 || d / s < 0.01;
}

export function ffmpeg(args: string[]): string {
  return execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1 << 28,
  });
}

export function encode(
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

/** Decodes any file ffmpeg reads to float PCM at 48 kHz, as `channels` channels. */
export function decodeChannels(path: string, channels: number, tmp: string): Float32Array[] {
  const raw = join(tmp, "decoded.f32");
  ffmpeg(["-i", path, "-f", "f32le", "-ac", String(channels), "-ar", String(SR), raw]);
  return readF32(raw, channels);
}

/** Decodes a file to float PCM at 48 kHz and returns the left (or only) channel. */
export function decode(path: string, channels: number, tmp: string): Float32Array {
  return decodeChannels(path, channels, tmp)[0] as Float32Array;
}

/** The highest sample peak, dBFS, of the given files once decoded. */
export function decodedPeakDb(paths: string[], channels: number, tmp: string): number {
  let p = 0;
  for (const path of paths) {
    for (const ch of decodeChannels(path, channels, tmp))
      for (let i = 0; i < ch.length; i++) p = Math.max(p, Math.abs(ch[i] as number));
  }
  return p > 0 ? 20 * Math.log10(p) : -120;
}

/** ffmpeg's own EBU R128 reading of a file, integrated LUFS and true peak (dBTP). */
export function ebur128Full(path: string): { lufs: number; truePeak: number } {
  const res = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const tail = res.stderr.slice(res.stderr.lastIndexOf("Integrated loudness"));
  const m = /I:\s+(-?[\d.]+) LUFS/.exec(tail);
  const p = /Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(tail);
  return {
    lufs: m ? Number(m[1]) : Number.NaN,
    truePeak: p && p[1] !== "-inf" ? Number(p[1]) : Number.NaN,
  };
}

/** ffmpeg's own EBU R128 reading of a file, integrated LUFS (a cross-check of ours). */
export function ebur128(path: string): number {
  return ebur128Full(path).lufs;
}

export interface LoopCheck {
  /** Waveform agreement of the decoded overrun with the decoded start (codec error), dB. */
  periodDb: number;
  /** Step across the loop point / 99.9th-percentile step, as decoded (before the client's repair). */
  rawJoin: number;
  /** The same after `repairLoop`, which is what the client plays. */
  joinRatio: number;
}

/** The step a player hears at the loop point, relative to the signal's own steps. */
export function joinRatioAt(x: Float32Array, s: number, e: number): number {
  const around = new Float32Array(2 * SR);
  for (let i = 0; i < SR; i++) {
    around[i] = x[e - SR + i] as number;
    around[SR + i] = x[s + i] as number;
  }
  const ref = joinStep(around).p999;
  const step = Math.abs((around[SR] as number) - (around[SR - 1] as number));
  return ref > 0 ? step / ref : 0;
}

export function checkLoop(
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

export interface DeliverInput {
  id: string;
  kind: TrackKind;
  title: string;
  loop: boolean;
  /** 1 forces mono; 2 keeps stereo unless every stem is mono anyway. */
  channels: 1 | 2;
  rendered: Rendered;
  master: MasterOptions;
  /**
   * Master each stem on its own (stems that are alternatives, heard one at a time) instead of
   * one gain and limiter for their sum (layers that add up).
   */
  separateStems?: boolean;
  /**
   * Also hold the encoded Ogg files' true peak (ffmpeg's EBU R128 reading, dBTP) under this, by
   * mastering again with a lower ceiling (the Studio pack; the Synth render does not ask).
   */
  maxTruePeakDb?: number;
}

/** Masters the stems one by one and gathers them into one result (lufs: the loudest stem). */
function masterSeparately(r: Rendered, o: MasterOptions): Mastered {
  const each = r.stems.map((s) =>
    master({ stems: [{ l: s.l.slice(), r: s.r.slice() }], length: s.l.length, sr: r.sr }, o),
  );
  const first = each[0] as Mastered;
  return {
    ...first,
    stems: each.map((m) => m.stems[0] as Stereo),
    lufs: Math.max(...each.map((m) => m.lufs)),
    peak: Math.max(...each.map((m) => m.peak)),
  };
}

export interface Delivered {
  track: ManifestTrack;
  mastered: Mastered;
  /** The decoded peak of the encoded files, dBFS. */
  decodedPeakDb: number;
  duration: number;
}

/**
 * Masters, lays out, encodes and checks one track into `outDir`/{music,ambience,sfx}, and
 * returns its manifest entry (without the score fields, which the caller adds).
 */
export function deliver(e: DeliverInput, outDir: string, tmp: string): Delivered {
  const rendered = e.rendered;
  // Mono deliveries are measured as shipped: fold to mono before mastering.
  if (e.channels === 1) for (const st of rendered.stems) toDualMono(st);
  const dir = e.kind === "ambience" ? "ambience" : e.kind === "sfx" ? "sfx" : "music";
  const channels = e.channels === 1 || rendered.stems.every(isMono) ? 1 : 2;
  const rates = bitrates(e.kind, channels);
  let files: ManifestTrack["files"] = [];
  const doMaster = (o: MasterOptions) =>
    e.separateStems ? masterSeparately(rendered, o) : master(cloneRendered(rendered), o);
  let m = doMaster(e.master);
  let duration = 0;
  let decoded = 0;
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
    decoded = decodedPeakDb(
      files.flatMap((f) => [join(outDir, f.ogg), join(outDir, f.m4a)]),
      channels,
      tmp,
    );
    const truePeak =
      e.maxTruePeakDb === undefined
        ? Number.NEGATIVE_INFINITY
        : Math.max(...files.map((f) => ebur128Full(join(outDir, f.ogg)).truePeak));
    const tooHot = e.maxTruePeakDb !== undefined && truePeak > e.maxTruePeakDb;
    if ((decoded <= -1 && !tooHot) || attempt === 3) break;
    ceilingDb -= 1.5;
    console.log(
      `  ${e.id}: decoded peak ${decoded.toFixed(1)} dBFS${tooHot ? `, true peak ${truePeak.toFixed(1)} dBTP` : ""}, mastering again at ${ceilingDb} dBFS`,
    );
    m = doMaster({ ...e.master, ceilingDb });
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
    ...(e.separateStems && files.length > 1 ? { layerMode: "crossfade" as const } : {}),
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
  return { track, mastered: m, decodedPeakDb: decoded, duration };
}

export function describeDelivered(id: string, d: Delivered, started: number): string {
  const t = d.track;
  const kb = t.files.reduce((s, f) => s + f.bytes, 0) / 1024;
  return (
    `${id.padEnd(16)} ${t.kind.padEnd(8)} ${d.duration.toFixed(1).padStart(6)} s  ${d.mastered.lufs.toFixed(1)} LUFS` +
    `${t.lufsEncoded !== undefined ? ` (ffmpeg ${t.lufsEncoded.toFixed(1)})` : ""}  peak ${t.peakDb} dBFS  ${kb.toFixed(0)} KB` +
    `${t.loopCheck ? `  loop: codec ${t.loopCheck.periodDb} dB, join ${t.loopCheck.rawJoin} -> ${t.loopCheck.joinRatio}` : ""}` +
    `  ${((Date.now() - started) / 1000).toFixed(1)} s`
  );
}
