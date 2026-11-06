/**
 * `pnpm --filter @fq/audio run analyse [--out dir] [--spectrograms main,town,negotiation]`
 *
 * Measures every music track and stinger as shipped (the decoded Ogg Opus files under
 * assets/audio): duration, the score's tempo and key next to the tempo and key estimated from the
 * audio, peak and integrated loudness, spectral centroid, the longest near-silence, DC offset,
 * clipped samples, the loop seam, and the most prominent narrowband partial (a runaway
 * resonance would stand out there). Draws spectrograms with ffmpeg for the tracks named.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Stereo } from "../src/dsp/core.js";
import { loudness } from "../src/dsp/loudness.js";
import type { AudioManifest } from "../src/manifestTypes.js";
import {
  clipped,
  estimateKey,
  estimateTempo,
  longestSilence,
  mean,
  runaway,
  spectralCentroid,
  stft,
} from "./analysis.js";
import { readF32 } from "./wav.js";

const SR = 48000;
const here = dirname(fileURLToPath(import.meta.url));
const audioDir = join(here, "..", "..", "..", "assets", "audio");

function decodeStereo(path: string, tmp: string): Stereo {
  const raw = join(tmp, "a.f32");
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    path,
    "-f",
    "f32le",
    "-ac",
    "2",
    "-ar",
    String(SR),
    raw,
  ]);
  const [l, r] = readF32(raw, 2) as [Float32Array, Float32Array];
  return { l, r };
}

function main() {
  const args = process.argv.slice(2);
  const outArg = args.indexOf("--out");
  const out = outArg >= 0 ? (args[outArg + 1] as string) : join(tmpdir(), "fq-audio-analysis");
  const specArg = args.indexOf("--spectrograms");
  const specs = new Set(
    (specArg >= 0 ? (args[specArg + 1] ?? "") : "main,negotiation,cityhall").split(","),
  );
  mkdirSync(out, { recursive: true });
  const manifest = JSON.parse(
    readFileSync(join(audioDir, "manifest.json"), "utf8"),
  ) as AudioManifest;
  const rows: Record<string, unknown>[] = [];
  for (const [id, t] of Object.entries(manifest.tracks)) {
    if (t.kind !== "music" && t.kind !== "stinger") continue;
    // Sum the stems (the negotiation at full intensity) and take one loop period for loops.
    const stems = t.files.map((f) => decodeStereo(join(audioDir, f.ogg), out));
    const n = stems[0]?.l.length ?? 0;
    const full: Stereo = { l: new Float32Array(n), r: new Float32Array(n) };
    for (const s of stems)
      for (let i = 0; i < n; i++) {
        full.l[i] = (full.l[i] as number) + (s.l[i] as number);
        full.r[i] = (full.r[i] as number) + (s.r[i] as number);
      }
    const a = t.loopStart !== undefined ? Math.round(t.loopStart * SR) : 0;
    const b = t.loopEnd !== undefined ? Math.round(t.loopEnd * SR) : n;
    const x: Stereo = { l: full.l.slice(a, b), r: full.r.slice(a, b) };
    const mono = new Float32Array(x.l.length);
    for (let i = 0; i < mono.length; i++) mono[i] = ((x.l[i] as number) + (x.r[i] as number)) / 2;
    const size = 8192;
    const frames = stft(mono, size, 4096);
    const key = estimateKey(frames, SR, size);
    const tempo = estimateTempo(mono, SR);
    let pk = 0;
    for (const ch of [x.l, x.r])
      for (let i = 0; i < ch.length; i++) pk = Math.max(pk, Math.abs(ch[i] as number));
    const row = {
      id,
      title: t.title,
      seconds: Math.round((mono.length / SR) * 10) / 10,
      bpm: t.bpm,
      bpmEstimated: tempo,
      key: t.key,
      keyEstimated: `${key.key} (r ${key.r.toFixed(2)})`,
      peakDb: Math.round(20 * Math.log10(pk) * 10) / 10,
      lufs: Math.round(loudness(x, SR).integrated * 10) / 10,
      centroidHz: Math.round(spectralCentroid(frames, SR, size)),
      longestQuietSec: longestSilence(mono, SR, -50),
      dc: Number(mean(mono).toExponential(1)),
      clipped: clipped(mono),
      loop: t.loopCheck
        ? `codec ${t.loopCheck.periodDb} dB, join ${t.loopCheck.rawJoin} -> ${t.loopCheck.joinRatio}`
        : "-",
      narrowband: (() => {
        const r = runaway(frames, SR, size);
        return `${r.stuck ? "STUCK " : ""}${Math.round(r.share * 100)}% of frames @ ${r.hz.toFixed(0)} Hz, ${r.stdDb.toFixed(1)} dB sd`;
      })(),
    };
    rows.push(row);
    console.log(
      `${id.padEnd(13)} ${String(row.seconds).padStart(5)} s  bpm ${t.bpm ?? "-"}/${tempo}  key ${t.key} / ${row.keyEstimated}  ` +
        `peak ${row.peakDb}  ${row.lufs} LUFS  centroid ${row.centroidHz} Hz  quiet ${row.longestQuietSec.toFixed(2)} s  ` +
        `dc ${row.dc}  clip ${row.clipped}  ${row.loop}  narrowband ${row.narrowband}`,
    );
    if (specs.has(id)) {
      const png = join(out, `${id}.png`);
      execFileSync("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        join(audioDir, (t.files[0] as { ogg: string }).ogg),
        "-lavfi",
        "showspectrumpic=s=1600x1400:legend=1:scale=log:fscale=log:start=40:stop=6000:drange=90,scale=1600:800",
        png,
      ]);
      console.log(`  spectrogram: ${png}`);
    }
  }
  writeFileSync(join(out, "report.json"), `${JSON.stringify(rows, null, 2)}\n`);
  console.log(`\nreport: ${join(out, "report.json")}`);
}

main();
