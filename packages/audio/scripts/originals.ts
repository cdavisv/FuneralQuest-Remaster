/**
 * `pnpm listen:originals`: extracts the original 2001 game's embedded sounds from its Flash files
 * (legacy/dist/public/flash/**\/*.swf, DefineSound tags) for the owner's private side-by-side
 * listening on the listening page (docs/audio/listen.html, through `pnpm listen`, which serves
 * them at /assets/audio-original/).
 *
 * THESE FILES ARE NEVER COMMITTED OR DISTRIBUTED. The original sounds and music are licensed for
 * the original game only, and CLAUDE.md says they must not be copied into the new tree, so they
 * are written outside the repository: `~/.cache/fq-audio-original/` (or FQ_AUDIO_ORIGINAL_DIR),
 * like the Studio pack's source downloads. `assets/audio-original/` is also in .gitignore in
 * case anyone points the output there, and packages/audio/test/originals.test.ts fails if any
 * file under it is tracked by git or named by a manifest. No build, bundle, service worker list,
 * Docker context or wrapper reads either place. Neither the Synth pack nor the Studio pack
 * contains any of this audio.
 *
 * Each sound's MP3 data is written unchanged: the frames as stored in the SWF (after the
 * DefineSound header and the MP3 SeekSamples field), so the file is a plain MPEG audio stream with
 * no re-encoding, normalising or trimming. Written as `<swf id>/<export name or character id>.mp3`
 * (the swf id as for art: the path under flash/ without `.swf`, lowercased), with index.json.
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHeader, parseSwf, readTags, TAG } from "../../../tools/extract/src/swf.js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const flashDir = join(repo, "legacy", "dist", "public", "flash");
/** Where the extracted originals live: outside the repository. */
export const ORIGINALS_DIR =
  process.env.FQ_AUDIO_ORIGINAL_DIR ?? join(homedir(), ".cache", "fq-audio-original");
const outDir = ORIGINALS_DIR;

const FORMATS = [
  "PCM (native)",
  "ADPCM",
  "MP3",
  "PCM (LE)",
  "Nellymoser 16k",
  "Nellymoser 8k",
  "Nellymoser",
  "",
  "",
  "",
  "",
  "Speex",
];
const RATES = [5512, 11025, 22050, 44100];

export interface OriginalSound {
  /** Path under the originals directory. */
  file: string;
  /** The SWF, relative to legacy/dist/public/flash. */
  swf: string;
  /** The swf id (as for art ids). */
  swfId: string;
  characterId: number;
  exportName?: string;
  format: string;
  sampleRate: number;
  channels: 1 | 2;
  /** From the sample count. */
  seconds: number;
  /** Loop counts the original started it with (StartSound tags); empty when started by script. */
  loops: number[];
  /** Where it is started (timeline frame or script). */
  startedAt: string;
  bytes: number;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.toLowerCase().endsWith(".swf")) out.push(p);
  }
  return out.sort();
}

function main() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const sounds: OriginalSound[] = [];
  const problems: string[] = [];
  for (const path of walk(flashDir)) {
    const swf = relative(flashDir, path).split("\\").join("/");
    const swfId = swf.replace(/\.swf$/i, "").toLowerCase();
    const file = new Uint8Array(readFileSync(path));
    let parsed: ReturnType<typeof parseSwf> | null = null;
    try {
      parsed = parseSwf(file);
    } catch (e) {
      problems.push(
        `${swf}: the timeline could not be parsed (${(e as Error).message}); loop counts unknown`,
      );
    }
    const { body, bodyStart } = parseHeader(file);
    const tags = readTags(body, bodyStart, body.length);
    const exports = new Map<number, string>();
    for (const t of tags) {
      if (t.code !== TAG.ExportAssets) continue;
      const dv = new DataView(t.data.buffer, t.data.byteOffset, t.data.byteLength);
      let p = 2;
      for (let i = 0, n = dv.getUint16(0, true); i < n; i++) {
        const id = dv.getUint16(p, true);
        p += 2;
        let name = "";
        while (p < t.data.length && t.data[p] !== 0)
          name += String.fromCharCode(t.data[p++] as number);
        p++;
        exports.set(id, name);
      }
    }
    for (const t of tags) {
      if (t.code !== TAG.DefineSound) continue;
      const d = t.data;
      const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
      const id = dv.getUint16(0, true);
      const flags = d[2] as number;
      const format = flags >> 4;
      const sampleRate = RATES[(flags >> 2) & 3] ?? 0;
      const channels = (flags & 1) === 1 ? 2 : 1;
      const sampleCount = dv.getUint32(3, true);
      const exportName = exports.get(id);
      if (format !== 2) {
        problems.push(`${swf} sound ${id}: ${FORMATS[format] ?? format}, not MP3: not extracted`);
        continue;
      }
      // MP3 SoundData: SeekSamples (SI16), then the MPEG frames as they are.
      const mp3 = d.subarray(9);
      if (!(mp3[0] === 0xff && ((mp3[1] ?? 0) & 0xe0) === 0xe0)) {
        problems.push(`${swf} sound ${id}: no MPEG frame sync at the start of its data`);
      }
      const name = (exportName ?? String(id)).replace(/[^A-Za-z0-9_-]/g, "_");
      const rel = `${swfId}/${name}.mp3`;
      mkdirSync(join(outDir, dirname(rel)), { recursive: true });
      writeFileSync(join(outDir, rel), mp3);
      const uses = parsed?.soundUses.filter((u) => u.soundId === id && !u.stop) ?? [];
      sounds.push({
        file: rel,
        swf,
        swfId,
        characterId: id,
        ...(exportName ? { exportName } : {}),
        format: "MP3",
        sampleRate,
        channels,
        seconds: Math.round((sampleCount / sampleRate) * 100) / 100,
        loops: [...new Set(uses.map((u) => u.loops ?? 1))],
        startedAt: uses.length ? uses.map((u) => u.where).join("; ") : "attached by script",
        bytes: mp3.length,
      });
    }
  }
  writeFileSync(
    join(outDir, "index.json"),
    `${JSON.stringify(
      {
        note: "The original 2001 game's own sounds, extracted locally for the owner's comparison only. Licensed for the original game only: never commit, ship or distribute. Not part of the Synth or Studio pack.",
        source: "legacy/dist/public/flash/**/*.swf (DefineSound tags, MP3 data unchanged)",
        sounds,
        problems,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `extracted ${sounds.length} original sounds from ${new Set(sounds.map((s) => s.swf)).size} SWFs to ${outDir}/`,
  );
  for (const p of problems) console.log(`  ${p}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
