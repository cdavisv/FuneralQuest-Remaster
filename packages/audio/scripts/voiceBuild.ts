/**
 * `pnpm --filter @fq/audio run voice`: the character voice pack (assets/voice) from the takes
 * generated with ElevenLabs.
 *
 * Inputs: assets/voice/lines.json (scripts/voiceInventory.ts: every line and what to speak),
 * assets/voice/takes.json (every generation: line key, generation id, voice, model, prompt,
 * credits), assets/voice/cast.json (who voices whom), and the downloaded MP3 of each take in
 * `~/.cache/fq-voice/source/<key>__<generationId>.mp3` (FQ_VOICE_SOURCE; kept out of the
 * repository like the Studio pack's sources; each can be fetched again from the owner's account by
 * its generation id).
 *
 * For each take, in order, until one passes:
 * 1. Words: transcribed back with a local speech-to-text model (scripts/voiceTranscribe.py,
 *    faster-whisper, run once per take and cached) and compared with the line (voiceCheck.ts);
 *    any changed, added or missing word rejects the take.
 * 2. Trim: leading and trailing silence cut (frames 45 dB under the loudest frame, or under
 *    -55 dBFS), 60 ms kept before and 150 ms after, 10 ms and 40 ms fades.
 * 3. Checks: speaking rate (words per second, SPEAKING_RATE), clipped samples in the source, the
 *    noise floor in the pauses (the quietest 10% of 20 ms frames inside the speech: music or noise
 *    under the voice keeps it high), the longest pause.
 * 4. Loudness: integrated loudness to VOICE_LUFS, sample peak held under -1.5 dBFS (the gain is
 *    lowered if the peak would pass it), then Ogg Opus (32 kbit/s mono) and AAC (40 kbit/s mono),
 *    the bitrates the sound packs use for mono one-shots, read back with ffmpeg's EBU R128 meter.
 *
 * Writes assets/voice/<character>/<key>.ogg|m4a, manifest.json (the client's), sources.json (every
 * take with its prompt, voice, model, generation id, credits, transcript and checks) and
 * LICENSES.md. A line whose takes all fail has no clip, and is listed as dropped.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type VoiceClip, type VoiceManifest, voiceKey } from "../src/voice.js";
import { decode, ebur128Full, encode, ffmpeg, SR } from "./pipeline.js";
import { checkWords, SPEAKING_RATE, type WordCheck, wordCount } from "./voiceCheck.js";
import type { InventoryLine } from "./voiceInventory.js";
import { writeWav } from "./wav.js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const voiceDir = join(repo, "assets", "voice");
const cacheDir = process.env.FQ_VOICE_CACHE ?? join(homedir(), ".cache", "fq-voice");
const sourceDir = process.env.FQ_VOICE_SOURCE ?? join(cacheDir, "source");
const sttPython =
  process.env.FQ_STT_PYTHON ??
  join(homedir(), ".local", "share", "fq-stt", ".venv", "bin", "python");

/**
 * Integrated loudness of every clip, LUFS: the music's own level (-16), and the client ducks the
 * music by 8 dB while a voice speaks, so speech sits about 8 LU over it.
 */
export const VOICE_LUFS = -16;
const PEAK_CEILING_DB = -1.5;
const BITRATES: [number, number] = [32, 40];

export interface Take {
  key: string;
  generationId: string;
  sessionId: string;
  nodeId: string;
  voiceId: string;
  model: string;
  prompt: string;
  credits: number;
  batch: string;
  date: string;
}

interface TakesFile {
  flowId: string;
  model: string;
  batches: { name: string; estimate: number; actual: number; date: string; lines: number }[];
  takes: Take[];
}

interface TakeResult extends Take {
  file: string;
  transcript: string;
  words: WordCheck;
  checks: {
    sourceSeconds: number;
    seconds: number;
    wordsPerSecond: number;
    trimmedHead: number;
    trimmedTail: number;
    clippedSamples: number;
    floorDb: number;
    longestPause: number;
    gainDb: number;
    lufs: number;
    peakDb: number;
    lufsEncoded: number;
    truePeakEncoded: number;
    flags: string[];
  } | null;
  verdict: "chosen" | "rejected" | "spare";
  reason?: string;
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -120);
const r2 = (x: number) => Math.round(x * 100) / 100;

function frameRms(x: Float32Array, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + n <= x.length; i += n) {
    let e = 0;
    for (let j = i; j < i + n; j++) e += (x[j] as number) ** 2;
    out.push(Math.sqrt(e / n));
  }
  return out;
}

function transcribeAll(files: string[]): Record<string, string> {
  const cachePath = join(cacheDir, "transcripts.json");
  const cache: Record<string, string> = existsSync(cachePath)
    ? JSON.parse(readFileSync(cachePath, "utf8"))
    : {};
  const todo = files.filter((f) => cache[f] === undefined);
  if (todo.length) {
    const tmp = mkdtempSync(join(tmpdir(), "fq-stt-"));
    const out = join(tmp, "stt.json");
    execFileSync(sttPython, ["-I", join(here, "voiceTranscribe.py"), out, ...todo], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    Object.assign(cache, JSON.parse(readFileSync(out, "utf8")));
    rmSync(tmp, { recursive: true, force: true });
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
  }
  return cache;
}

function process1(text: string, src: string, outBase: string, tmp: string): TakeResult["checks"] {
  const x = decode(src, 1, tmp);
  const flags: string[] = [];
  let clipped = 0;
  for (const s of x) if (Math.abs(s) >= 0.999) clipped++;
  if (clipped) flags.push(`${clipped} clipped samples in the source`);
  const hop = Math.round(0.02 * SR);
  const rms = frameRms(x, hop);
  const loud = Math.max(...rms);
  const thr = Math.max(loud * 10 ** (-45 / 20), 10 ** (-55 / 20));
  const first = rms.findIndex((v) => v > thr);
  let last = rms.length - 1;
  while (last > 0 && (rms[last] as number) <= thr) last--;
  const start = Math.max(0, first * hop - Math.round(0.06 * SR));
  const end = Math.min(x.length, (last + 1) * hop + Math.round(0.15 * SR));
  const y = x.slice(start, end);
  const fi = Math.round(0.01 * SR);
  const fo = Math.round(0.04 * SR);
  for (let i = 0; i < fi && i < y.length; i++) y[i] = (y[i] as number) * (i / fi);
  for (let i = 0; i < fo && i < y.length; i++) {
    const k = y.length - 1 - i;
    y[k] = (y[k] as number) * (i / fo);
  }
  // The noise floor: the source's own silence before and after the speech (a generation with
  // music or noise under it has it there too), else the pauses inside the speech.
  const inner = rms.slice(first, last + 1);
  const edges = [...rms.slice(0, Math.max(0, first - 1)), ...rms.slice(last + 2)];
  const quiet = edges.length >= 3 ? edges : inner.filter((v) => v <= thr);
  const sorted = [...quiet].sort((a, b) => a - b);
  const floorDb = sorted.length ? r2(db(sorted[Math.floor(sorted.length / 2)] ?? 0)) : -120;
  if (floorDb > -50) flags.push(`noise floor ${floorDb} dBFS around the speech (music or noise?)`);
  let gap = 0;
  let longest = 0;
  for (const v of inner) {
    gap = v <= thr ? gap + 1 : 0;
    longest = Math.max(longest, gap);
  }
  const longestPause = r2((longest * hop) / SR);
  if (longestPause > 1.6) flags.push(`a pause of ${longestPause} s`);
  const seconds = y.length / SR;
  const wps = r2(wordCount(text) / seconds);
  if (wps < SPEAKING_RATE.min || wps > SPEAKING_RATE.max)
    flags.push(`speaking rate ${wps} words/s outside ${SPEAKING_RATE.min}-${SPEAKING_RATE.max}`);
  // loudness: gain to the target, peaks held under the ceiling by a limiter, measured again
  const raw = join(tmp, "trim.wav");
  writeWav(raw, { l: y, r: y }, SR, true);
  const before = ebur128Full(raw).lufs;
  const wav = join(tmp, "out.wav");
  let gainDb = VOICE_LUFS - before;
  let after = before;
  for (let pass = 0; pass < 3; pass++) {
    limit(raw, wav, gainDb);
    after = ebur128Full(wav).lufs;
    if (Math.abs(after - VOICE_LUFS) < 0.3) break;
    gainDb += VOICE_LUFS - after;
  }
  const z = decode(wav, 1, tmp);
  let peak = 0;
  for (const s of z) peak = Math.max(peak, Math.abs(s));
  if (db(peak) > PEAK_CEILING_DB + 0.2) flags.push(`peak ${r2(db(peak))} dBFS over the ceiling`);
  mkdirSync(dirname(outBase), { recursive: true });
  let [ogg] = encode(wav, outBase, 1, BITRATES);
  let enc = ebur128Full(ogg as string);
  // the codec can overshoot the limiter: lower the level until the encoded true peak is under -1 dBTP
  for (let tries = 0; tries < 3 && enc.truePeak > -1; tries++) {
    gainDb -= enc.truePeak + 1.3;
    limit(raw, wav, gainDb);
    after = ebur128Full(wav).lufs;
    [ogg] = encode(wav, outBase, 1, BITRATES);
    enc = ebur128Full(ogg as string);
    flags.push(`level lowered to ${r2(after)} LUFS to keep the encoded true peak under -1 dBTP`);
  }
  if (enc.truePeak > -0.5) flags.push(`encoded true peak ${enc.truePeak} dBTP`);
  return {
    sourceSeconds: r2(x.length / SR),
    seconds: r2(seconds),
    wordsPerSecond: wps,
    trimmedHead: r2(start / SR),
    trimmedTail: r2((x.length - end) / SR),
    clippedSamples: clipped,
    floorDb,
    longestPause,
    gainDb: r2(gainDb),
    lufs: r2(after),
    peakDb: r2(db(peak)),
    lufsEncoded: enc.lufs,
    truePeakEncoded: enc.truePeak,
    flags,
  };
}

/** Gain, then a look-ahead limiter at the peak ceiling (ffmpeg alimiter), to 32-bit float. */
function limit(src: string, dst: string, gainDb: number) {
  ffmpeg([
    "-i",
    src,
    "-af",
    `volume=${gainDb.toFixed(2)}dB,alimiter=limit=${10 ** (PEAK_CEILING_DB / 20)}:attack=5:release=60:level=disabled`,
    "-c:a",
    "pcm_f32le",
    "-ar",
    String(SR),
    dst,
  ]);
}

/** Flags that reject a take (the others are notes). */
const fatal = (flags: string[]) =>
  flags.filter((f) =>
    /clipped|noise floor|speaking rate|^encoded true peak|over the ceiling/.test(f),
  );

function main() {
  const lines = (
    JSON.parse(readFileSync(join(voiceDir, "lines.json"), "utf8")) as { lines: InventoryLine[] }
  ).lines;
  const takesFile = JSON.parse(readFileSync(join(voiceDir, "takes.json"), "utf8")) as TakesFile;
  const cast = JSON.parse(readFileSync(join(voiceDir, "cast.json"), "utf8")) as {
    characters: Record<string, { voiceId: string; voiceName: string }>;
  };
  const byVoiceKey = new Map<string, InventoryLine>();
  for (const l of lines) if (l.voice) byVoiceKey.set(l.voice.key, l);
  const files = takesFile.takes.map((t) => join(sourceDir, `${t.key}__${t.generationId}.mp3`));
  // A take generated (and charged) but not downloaded yet: listed, not used, fetched later by its id.
  const notDownloaded = takesFile.takes.filter((_t, i) => !existsSync(files[i] as string));
  const transcripts = transcribeAll(files.filter((f) => existsSync(f)));
  const tmp = mkdtempSync(join(tmpdir(), "fq-voice-"));
  const results: TakeResult[] = [];
  const clips: VoiceClip[] = [];
  const done = new Set<string>();
  for (const t of takesFile.takes) {
    const line = byVoiceKey.get(t.key);
    const file = join(sourceDir, `${t.key}__${t.generationId}.mp3`);
    if (notDownloaded.includes(t)) continue;
    const transcript = transcripts[file] ?? "";
    if (!line?.voice)
      throw new Error(`take ${t.generationId} is for ${t.key}, which is not a voiced line`);
    const text = line.voice.text;
    if (voiceKey(line.character, text) !== t.key) throw new Error(`key mismatch for ${t.key}`);
    if (cast.characters[line.character]?.voiceId !== t.voiceId)
      throw new Error(`take ${t.generationId} for ${t.key} is not in the cast voice`);
    const stripped = t.prompt.replace(/\[[^\]]*\]\s*/g, "").trim();
    if (stripped !== text)
      throw new Error(`prompt of ${t.generationId} is not the line's exact text`);
    const words = checkWords(text, transcript);
    const base = { ...t, file: `${t.key}__${t.generationId}.mp3`, transcript, words };
    if (done.has(t.key)) {
      results.push({ ...base, checks: null, verdict: "spare", reason: "an earlier take passed" });
      continue;
    }
    if (!words.ok) {
      results.push({
        ...base,
        checks: null,
        verdict: "rejected",
        reason: `words differ: ${words.diff}`,
      });
      continue;
    }
    const rel = `${line.character}/${t.key}`;
    const checks = process1(text, file, join(voiceDir, rel), tmp);
    const bad = checks ? fatal(checks.flags) : ["not processed"];
    if (bad.length) {
      results.push({ ...base, checks, verdict: "rejected", reason: bad.join("; ") });
      for (const ext of ["ogg", "m4a"]) rmSync(join(voiceDir, `${rel}.${ext}`), { force: true });
      continue;
    }
    done.add(t.key);
    results.push({ ...base, checks, verdict: "chosen" });
    const bytes = ["ogg", "m4a"].reduce(
      (n, ext) => n + statSync(join(voiceDir, `${rel}.${ext}`)).size,
      0,
    );
    clips.push({
      key: t.key,
      character: line.character,
      speaker: line.speaker,
      text,
      part: line.voice.part,
      rulesets: line.rulesets,
      file: { ogg: `${rel}.ogg`, m4a: `${rel}.m4a`, bytes },
      duration: checks?.seconds ?? 0,
    });
  }
  rmSync(tmp, { recursive: true, force: true });
  clips.sort((a, b) => a.character.localeCompare(b.character) || a.text.localeCompare(b.text));
  const totalBytes = clips.reduce((n, c) => n + c.file.bytes, 0);
  const manifest: VoiceManifest = {
    generator:
      "packages/audio/scripts/voiceBuild.ts from ElevenLabs takes (assets/voice/takes.json)",
    license:
      "See assets/voice/LICENSES.md: generated with ElevenLabs under the owner's account; redistribution terms are for the owner to confirm.",
    lufs: VOICE_LUFS,
    totalBytes,
    clips,
  };
  writeFileSync(join(voiceDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const credits = takesFile.takes.reduce((n, t) => n + t.credits, 0);
  const voiced = new Set(clips.map((c) => c.key));
  const pendingKeys = new Set(
    notDownloaded
      .filter((t) => !voiced.has(t.key) && !results.some((r) => r.key === t.key))
      .map((t) => t.key),
  );
  const dropped = [...byVoiceKey.values()].filter(
    (l) =>
      l.voice &&
      takesFile.takes.some((t) => t.key === l.voice?.key) &&
      !voiced.has(l.voice.key) &&
      !pendingKeys.has(l.voice.key),
  );
  const notGenerated = [...byVoiceKey.values()].filter(
    (l) => l.voice && !takesFile.takes.some((t) => t.key === l.voice?.key),
  );
  writeFileSync(
    join(voiceDir, "sources.json"),
    `${JSON.stringify(
      {
        flowId: takesFile.flowId,
        model: takesFile.model,
        lufsTarget: VOICE_LUFS,
        peakCeilingDb: PEAK_CEILING_DB,
        bitrates: { opus: BITRATES[0], aac: BITRATES[1] },
        speechToText: "faster-whisper small (int8, CPU), no prompt (scripts/voiceTranscribe.py)",
        batches: takesFile.batches,
        credits,
        takes: results,
        generatedNotDownloaded: notDownloaded
          .filter((t) => pendingKeys.has(t.key))
          .map((t) => ({
            key: t.key,
            generationId: t.generationId,
            sessionId: t.sessionId,
            credits: t.credits,
            prompt: t.prompt,
          })),
        dropped: dropped.map((l) => ({
          key: l.voice?.key,
          character: l.character,
          text: l.voice?.text,
        })),
        notGenerated: notGenerated.map((l) => ({
          key: l.voice?.key,
          character: l.character,
          text: l.voice?.text,
        })),
      },
      null,
      2,
    )}\n`,
  );
  writeLicenses(clips, results, credits);
  const passedFirst = new Set<string>();
  const seen = new Set<string>();
  for (const r of results) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    if (r.verdict === "chosen") passedFirst.add(r.key);
  }
  console.log(
    `voice pack: ${clips.length} clips, ${(totalBytes / 1e6).toFixed(2)} MB (ogg + m4a); ${passedFirst.size} passed on the first take, ${clips.length - passedFirst.size} on a later one, ${dropped.length} dropped, ${pendingKeys.size} generated but not downloaded, ${notGenerated.length} voiceable lines not generated; ${credits} credits`,
  );
  for (const r of results.filter((x) => x.verdict === "rejected"))
    console.log(`  rejected ${r.key} (${r.generationId}): ${r.reason}`);
  for (const r of results.filter(
    (x) => x.verdict === "chosen" && (x.words.viaProperNoun || x.checks?.flags.length),
  ))
    console.log(
      `  note ${r.key}: ${r.words.viaProperNoun ? "words matched through a proper-noun spelling; " : ""}${r.checks?.flags.join("; ") ?? ""}`,
    );
}

function writeLicenses(clips: VoiceClip[], results: TakeResult[], credits: number) {
  const chosen = new Map(results.filter((r) => r.verdict === "chosen").map((r) => [r.key, r]));
  const rows = clips.map((c) => {
    const r = chosen.get(c.key);
    return `| ${c.file.ogg} | ${c.speaker} | ${r?.model ?? ""} | ${r?.voiceId ?? ""} | ${r?.generationId ?? ""} | ${r?.date ?? ""} |`;
  });
  const text = `# Character voice ledger

What every file in this directory is, and what is not settled about it.

- **Origin.** Each clip was generated with ElevenLabs text to speech (model \`eleven_v4\`) under
  the project owner's ElevenLabs account, from the game's own text: the exact words of one line
  of dialogue (original 2001 lines word for word as written; Expanded lines as written for the
  remaster), with at most a bracketed delivery direction such as \`[deadpan]\` before it. The
  voices are ElevenLabs library voices chosen for each character (\`cast.json\`). Every prompt,
  voice, model, generation id, date and the credits charged are in \`sources.json\` and
  \`takes.json\`. The clips were then post-processed by \`packages/audio\` (\`pnpm --filter
  @fq/audio run voice\`): silence trimmed, loudness normalised to ${VOICE_LUFS} LUFS, encoded to Ogg
  Opus and AAC. No recording of a person and no audio from the original 2001 game was given to
  the generator.
- **Checked against the script.** Every clip was transcribed back to text with a local
  speech-to-text model and its words compared with the line; a take whose words differ in any
  way was rejected. The transcripts are in \`sources.json\`.
- **Licence: not established here.** These files are not covered by the project's licence. Their
  redistribution terms are those of ElevenLabs' terms of service for the plan the owner's account
  is on at the time of generation, and of the library voices used. The owner must confirm those
  terms allow shipping them (in the web build, the desktop and mobile apps, and any store build)
  before the voice pack ships in a store build. Until then the web build bundles it only when asked
  to (\`FQ_AUDIO_PACKS\` naming \`voice\`).
- **Cost.** ${credits} credits in all (every take, kept or not; the ledger is in \`sources.json\`).

| File | Speaker | Model | Voice id | Generation id | Generated on |
|---|---|---|---|---|---|
${rows.join("\n")}
`;
  writeFileSync(join(voiceDir, "LICENSES.md"), text);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
