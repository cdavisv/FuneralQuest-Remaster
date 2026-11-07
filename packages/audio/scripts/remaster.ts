/**
 * `pnpm --filter @fq/audio run remaster [--only id,id] [--sources dir]`: post-production of the
 * "Original, remastered" pack, as `studio.ts` does for the Studio pack, from the brief
 * (`remasterBrief.ts`) and the chosen takes (`assets/audio-remaster/takes.json`). Each remake is
 * delivered at its original's length: music loops cut to exactly one or two bars at 120 bpm on a
 * bar line, ambience loops (the sound-effects model's own seamless loops) stretched to the exact
 * length with the pitch kept, one-shots trimmed and cut to within 10 % of the original's length.
 * Levels follow the pack conventions of each kind, offset by how loud the original was against
 * the other originals of its kind (a quiet tick stays quiet beside a gong), within -8 to +3 dB.
 *
 * Writes `assets/audio-remaster/` (music/, ambience/, sfx/, manifest.json keyed both by game
 * track id and by original sound, sources.json, LICENSES.md). The downloaded generations are kept
 * outside the repository in `~/.cache/fq-audio-remaster/source/<id>__<generationId>.mp3`.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AMB_MASTER, MUSIC_MASTER, SFX_MASTER, STING_MASTER } from "../src/catalog.js";
import type { Stereo } from "../src/dsp/core.js";
import type { AudioManifest, ManifestTrack } from "../src/manifestTypes.js";
import type { MasterOptions } from "../src/seq/master.js";
import { deliver, describeDelivered, SR } from "./pipeline.js";
import { MUSIC_MODEL, REMASTER, type RemasterEntry } from "./remasterBrief.js";
import { decodeSource, oneShot, type TakesFile } from "./studio.js";
import { beatGrid, chooseLoop, cutLoop, monoOf } from "./studioLoop.js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const outDir = join(repo, "assets", "audio-remaster");

interface BriefSound {
  file: string;
  seconds: number;
  loops: number;
  kind: string;
  measured: { lufs: number | null };
}

function baseMaster(e: RemasterEntry): MasterOptions {
  if (e.kind === "ambience") return AMB_MASTER;
  if (e.kind === "sfx") return SFX_MASTER;
  return e.loop ? MUSIC_MASTER : STING_MASTER;
}

/** dB to add to the kind's target: the original's loudness against the median of its kind. */
function relativeOffset(e: RemasterEntry, sounds: BriefSound[]): number {
  const group = (s: BriefSound) =>
    s.kind === "ambience" ? "ambience" : s.kind.startsWith("music") ? "music" : "sfx";
  const mine = sounds.find((s) => s.file === e.originals[0]);
  if (!mine || mine.measured.lufs === null) return 0;
  const peers = sounds
    .filter((s) => group(s) === group(mine) && s.measured.lufs !== null)
    .map((s) => s.measured.lufs as number)
    .sort((a, b) => a - b);
  const median = peers[Math.floor(peers.length / 2)] ?? (mine.measured.lufs as number);
  return Math.max(-8, Math.min(3, (mine.measured.lufs as number) - median));
}

function prepare(
  e: RemasterEntry,
  src: string,
  tmp: string,
  semitones = 0,
): { stem: Stereo; post: string } {
  // Optional transposition (pitch only, tempo kept) when the music model ignored the asked key.
  const pitch = semitones ? `:pitch=${(2 ** (semitones / 12)).toFixed(6)}` : "";
  const moved = semitones
    ? `; transposed ${semitones > 0 ? "+" : ""}${semitones} semitones (tempo kept) to the original's key`
    : "";
  if (e.loop && e.model === MUSIC_MODEL) {
    const bpm = e.bpm ?? 120;
    const bpb = e.beatsPerBar ?? 4;
    let x = decodeSource(src, tmp);
    const tracked = beatGrid(monoOf(x), SR, bpm, bpb).grid.bpm;
    const ratio = bpm / tracked;
    x = decodeSource(src, tmp, `rubberband=tempo=${ratio.toFixed(6)}${pitch}:pitchq=quality`);
    const mono = monoOf(x);
    const { grid, frames } = beatGrid(mono, SR, bpm, bpb);
    const bars = e.bars ?? 1;
    const target = (bars * bpb * 60) / bpm;
    const c = chooseLoop(mono, SR, grid, frames.mags, {
      targetSec: target,
      minSec: target * 0.7,
      maxSec: target * 1.3,
      fixedBars: bars,
    });
    const fade = Math.min(c.crossfade, target / 8);
    return {
      stem: cutLoop(x, SR, c.start, c.start + target, fade),
      post: `stretched x${ratio.toFixed(4)} from ${tracked.toFixed(2)} bpm to ${bpm}; ${bars} bar(s) from ${c.start.toFixed(3)} s (bar-line seam similarity ${c.similarity.toFixed(3)}), ${fade.toFixed(3)} s equal-power crossfade of the continuation into the head${moved}`,
    };
  }
  if (e.loop) {
    // The sound-effects model's loop: seamless but not the asked length. Stretch it whole.
    const raw = decodeSource(src, tmp);
    const have = raw.l.length / SR;
    const ratio = have / e.seconds;
    const x = decodeSource(src, tmp, `rubberband=tempo=${ratio.toFixed(6)}:pitchq=quality`);
    const n = Math.round(e.seconds * SR);
    const stem: Stereo = { l: x.l.slice(0, n), r: x.r.slice(0, n) };
    // pad if the stretch fell a few samples short (repeat the head: it follows the tail)
    if (stem.l.length < n) {
      const l = new Float32Array(n);
      const r = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        l[i] = x.l[i % x.l.length] as number;
        r[i] = x.r[i % x.r.length] as number;
      }
      return {
        stem: { l, r },
        post: `model loop ${have.toFixed(3)} s stretched x${ratio.toFixed(4)} to ${e.seconds} s`,
      };
    }
    return {
      stem,
      post: `model loop ${have.toFixed(3)} s stretched x${ratio.toFixed(4)} to ${e.seconds} s (pitch kept)`,
    };
  }
  const x = decodeSource(src, tmp);
  const max = Math.max(e.seconds * 1.1, 0.12);
  return {
    stem: oneShot(x, max, e.kind === "music" ? 0.6 : 0.06),
    post: `lead-in trimmed, cut to at most ${max.toFixed(2)} s (the original's ${e.seconds} s plus 10 %) with a fade`,
  };
}

function main() {
  const args = process.argv.slice(2);
  const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const sources = opt("--sources") ?? join(homedir(), ".cache", "fq-audio-remaster", "source");
  const only = opt("--only") ? new Set((opt("--only") as string).split(",")) : null;
  const takes = JSON.parse(readFileSync(join(outDir, "takes.json"), "utf8")) as TakesFile;
  const brief = JSON.parse(readFileSync(join(outDir, "brief.json"), "utf8")) as {
    sounds: BriefSound[];
  };
  const synth = JSON.parse(
    readFileSync(join(repo, "assets", "audio", "manifest.json"), "utf8"),
  ) as AudioManifest;
  const prevPath = join(outDir, "manifest.json");
  const prev = existsSync(prevPath)
    ? (JSON.parse(readFileSync(prevPath, "utf8")) as AudioManifest)
    : null;
  const prevSources = existsSync(join(outDir, "sources.json"))
    ? (JSON.parse(readFileSync(join(outDir, "sources.json"), "utf8")) as {
        tracks: Record<string, unknown>;
      })
    : { tracks: {} };
  const tmp = mkdtempSync(join(tmpdir(), "fq-remaster-"));
  for (const d of ["music", "ambience", "sfx"]) mkdirSync(join(outDir, d), { recursive: true });
  const originals: Record<string, ManifestTrack> = { ...(prev?.originals ?? {}) };
  const tracks: Record<string, ManifestTrack> = { ...(prev?.tracks ?? {}) };
  const prov: Record<string, unknown> = { ...prevSources.tracks };
  for (const e of REMASTER) {
    if (only && !only.has(e.id)) continue;
    const rec = takes.tracks[e.id] as (typeof takes.tracks)[string] & { pitchSemitones?: number };
    const take = rec?.takes.find((t) => t.generationId === rec.chosen);
    const file = take ? join(sources, `${e.id}__${take.generationId}.mp3`) : null;
    if (!take || !file || !existsSync(file)) {
      prov[e.id] = {
        status: "not generated",
        originals: e.originals,
        tracks: e.tracks,
        model: e.model,
        prompt: e.prompt,
        params: e.params,
      };
      continue;
    }
    const started = Date.now();
    const { stem, post } = prepare(e, file, tmp, rec?.pitchSemitones ?? 0);
    const offset = relativeOffset(e, brief.sounds);
    const base = baseMaster(e);
    const d = deliver(
      {
        id: e.id,
        kind: e.kind === "music" ? (e.loop ? "music" : "stinger") : e.kind,
        title: e.description.split(" (")[0] as string,
        loop: e.loop,
        channels: e.kind === "music" ? 2 : 1,
        rendered: { stems: [stem], length: stem.l.length, sr: SR },
        master: { ...base, target: base.target + offset },
        maxTruePeakDb: -1,
      },
      outDir,
      tmp,
    );
    const t = d.track;
    if (e.bpm && e.loop) {
      t.bpm = e.bpm;
      t.beatsPerBar = e.beatsPerBar ?? 4;
      t.bars = e.bars ?? 1;
    }
    if (e.key) t.key = e.key;
    for (const o of e.originals) originals[o] = t;
    // as a game track only where the game plays the same kind of thing (a loop for a loop)
    const usedFor: string[] = [];
    for (const id of e.tracks) {
      const s = synth.tracks[id];
      if (s && s.loop === t.loop) {
        tracks[id] = { ...t, kind: s.kind, title: s.title };
        usedFor.push(id);
      }
    }
    prov[e.id] = {
      status: "delivered",
      originals: e.originals,
      tracks: usedFor,
      description: e.description,
      uncertain: e.uncertain ?? null,
      model: e.model,
      // a retake's own prompt when it was reworded, else the brief's
      prompt: take.prompt ?? e.prompt,
      params: take.params ?? e.params,
      generationId: take.generationId,
      sessionId: take.sessionId,
      nodeId: take.nodeId,
      generatedOn: take.date,
      credits: take.credits,
      chosenBecause: rec?.reason,
      otherTakes: (rec?.takes ?? [])
        .filter((x) => x.generationId !== take.generationId)
        .map((x) => ({
          generationId: x.generationId,
          credits: x.credits,
          date: x.date,
          ...(x.prompt ? { prompt: x.prompt, model: x.params } : {}),
        })),
      post: `${post}; level ${offset >= 0 ? "+" : ""}${offset.toFixed(1)} dB against its kind's target (the original's loudness against its peers)`,
    };
    console.log(describeDelivered(e.id, d, started));
  }
  const all = new Map<string, number>();
  for (const t of [...Object.values(originals), ...Object.values(tracks)])
    for (const f of t.files) all.set(f.ogg, f.bytes);
  const manifest: AudioManifest = {
    generator:
      "ElevenLabs generations post-processed by packages/audio (pnpm --filter @fq/audio run remaster)",
    license:
      "Generated with ElevenLabs under the owner's account from text prompts; no original 2001 audio was used. Redistribution terms are ElevenLabs' terms for that plan, unconfirmed (see LICENSES.md).",
    sampleRate: SR,
    totalBytes: [...all.values()].reduce((a, b) => a + b, 0),
    live: synth.live,
    tracks: Object.fromEntries(Object.entries(tracks).sort(([a], [b]) => a.localeCompare(b))),
    originals: Object.fromEntries(Object.entries(originals).sort(([a], [b]) => a.localeCompare(b))),
  };
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  const spent = takes.ledger.reduce((a, l) => a + l.actual, 0);
  writeFileSync(
    join(outDir, "sources.json"),
    `${JSON.stringify({ flowId: takes.flowId, connector: "ElevenLabs MCP (full connector cd8c8672 for music and reads; voice connector a51d19ce for the first sound-effects runs)", ledger: takes.ledger, spentCredits: spent, tracks: Object.fromEntries(Object.entries(prov).sort(([a], [b]) => a.localeCompare(b))) }, null, 2)}\n`,
  );
  writeFileSync(join(outDir, "LICENSES.md"), ledger(manifest, prov, spent, takes.ledger));
  rmSync(tmp, { recursive: true, force: true });
  const done = Object.values(prov).filter(
    (p) => (p as { status: string }).status === "delivered",
  ).length;
  console.log(
    `\n${done} of ${REMASTER.length} remakes delivered; ${Object.keys(tracks).length} game tracks; ${(manifest.totalBytes / 1e6).toFixed(2)} MB; ${spent} credits`,
  );
}

function ledger(
  m: AudioManifest,
  prov: Record<string, unknown>,
  spent: number,
  batches: TakesFile["ledger"],
): string {
  const rows: string[] = [];
  for (const [id, p] of Object.entries(prov)) {
    const q = p as {
      status: string;
      model: string;
      generationId?: string;
      generatedOn?: string;
      originals: string[];
    };
    if (q.status !== "delivered") continue;
    const t = m.originals?.[q.originals[0] as string];
    for (const f of t?.files ?? [])
      for (const file of [f.ogg, f.m4a])
        rows.push(
          `| ${file} | \`${id}\` | ${q.originals.join(", ")} | ${q.model} | ${q.generationId} | ${q.generatedOn} |`,
        );
  }
  const pending = Object.entries(prov)
    .filter(([, p]) => (p as { status: string }).status !== "delivered")
    .map(([id]) => `\`${id}\``);
  return [
    '# "Original, remastered" audio ledger',
    "",
    "What every file in this directory is, and what is not settled about it.",
    "",
    "- **What they are.** New audio made to resemble the original 2001 game's sounds, one remake per original sound. They are not the 2001 recordings. Each file was generated with ElevenLabs (`eleven_music_v2_5` for music, `eleven_text_to_sound_v2` for ambience and effects) under the project owner's ElevenLabs account, from the text prompt recorded for it in `sources.json` (with the model, its parameters, the generation id, the date and the credits charged), and then post-processed by `packages/audio` (`pnpm --filter @fq/audio run remaster`): loops cut to the original's length (three music loops also transposed to the original's key, where the model ignored the key asked for), one-shots trimmed, mastered and encoded as the other packs are.",
    "- **No original audio was used.** The 2001 sounds were analysed only on the owner's machine (`packages/audio/scripts/remasterDescribe.py`; numbers and words in `brief.json`). No original audio, and nothing derived from its samples other than those numbers and words, was uploaded to any service or given to a generator as input. The prompts describe the kind of sound, instruments, tempo, key, mood and length, never the original's notes.",
    "- **Licence: not established here.** These files are not covered by the project's licence. Their redistribution terms are those of ElevenLabs' terms of service for the plan the owner's account is on at the time of generation, for the owner to confirm before the pack is made the default or shipped in any build. The Synth pack remains fully generated from this repository's own code.",
    `- **Cost.** ${spent} credits in all, against a cap of 20,000:`,
    "",
    "| Batch | What | Estimated | Charged |",
    "|---|---|---|---|",
    ...batches.map((b) => `| ${b.batch} | ${b.description} | ${b.estimated} | ${b.actual} |`),
    "",
    "| File | Remake | Original sound(s) it resembles | Model | Generation id | Generated on |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    pending.length
      ? `Not generated yet: ${pending.join(", ")}.`
      : "Every original sound has a remake.",
    "",
  ].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
