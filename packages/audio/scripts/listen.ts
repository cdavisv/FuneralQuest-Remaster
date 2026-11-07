/**
 * `pnpm --filter @fq/audio run listen-page`: writes docs/audio/listen.html, a static page that
 * plays every track of the Synth pack (assets/audio) next to the Studio pack (assets/audio-studio)
 * and, where one exists, the original 2001 sound that did the same job, with the track's id,
 * title and where it plays, and a notes field per track that is kept in the browser's local
 * storage and can be exported as text. Below the tracks: every original 2001 sound, and every
 * clip of the character voice pack (assets/voice), grouped by character, with its exact text.
 *
 * The original 2001 sounds are NOT in the repository and not in either pack: `pnpm
 * listen:originals` extracts them on the owner's machine (outside the repository, see
 * scripts/originals.ts) and `pnpm listen` serves them at /assets/audio-original/. The page lists
 * them from the extraction's index when it was generated, and says how to get them when they
 * cannot be loaded.
 *
 * The data is written into the page (no fetch), and the players point at the packs with paths
 * relative to the page, so it works opened straight from disk (file://) in a web browser, and through
 * `pnpm listen`, a small local server for places that cannot read files next to the page (a
 * sandboxed preview, a remote machine).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AudioManifest } from "../src/manifestTypes.js";
import { AMBIENCE, EFFECTS_IDS, MUSIC, STINGERS } from "../src/tracks.js";
import { VOICE_CHARACTERS, type VoiceManifest } from "../src/voice.js";
import { BRIEF } from "./studioBrief.js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const read = <T>(p: string): T | null =>
  existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;

interface Sources {
  tracks: Record<
    string,
    {
      fallback?: string;
      reason?: string;
      stems?: {
        brief: string;
        prompt: string;
        generationId: string;
        checks?: { flags: string[] };
      }[];
    }
  >;
}

interface OriginalIndex {
  sounds: {
    file: string;
    swf: string;
    swfId: string;
    characterId: number;
    exportName?: string;
    seconds: number;
    loops: number[];
    startedAt: string;
  }[];
}

/**
 * Loop counts of the sounds welcome.swf starts by script (its decompiled ActionScript, listed in
 * docs/reference/sound-inventory.md): `start(0, n)`.
 */
const SCRIPT_LOOPS: Record<string, number> = {
  "welcome/intro.mp3": 1,
  "welcome/Map.mp3": 9999,
  "welcome/paper.mp3": 1,
};

/**
 * Which new track does the job each original sound did, by function. From the cue map
 * (src/cues.ts: ENGINE_MUSIC, PICTURE_AMBIENCE, PICTURE_SOUNDS, the parlor backgrounds) and the
 * sound inventory (which picture starts each sound, how long it is, how often it loops). A
 * pairing is a listening aid, not a claim that the new track imitates the original.
 */
const ORIGINAL_FOR: Record<string, string[]> = {
  "welcome/intro.mp3": ["main"],
  "welcome/Map.mp3": ["town"],
  "music/music_fight/1.mp3": ["battle"],
  "music/music_sneak/1.mp3": ["sneak"],
  "places/palors/5.mp3": ["sneak"],
  "places/yangs/6.mp3": ["yangs"],
  "places/funeral-ceremony/2.mp3": ["ceremony"],
  "places/funeral-ceremony2/6.mp3": ["ceremony"],
  "background/background_church/2.mp3": ["ceremony"],
  "places/desk/12.mp3": ["amb-clock"],
  "places/desk_enemy/8.mp3": ["amb-clock"],
  "background/background_1/2.mp3": ["amb-clock"],
  "background/background_2/2.mp3": ["amb-clock"],
  "background/background_3/2.mp3": ["amb-clock"],
  "background/background_4/2.mp3": ["amb-clock"],
  "background/background_5/2.mp3": ["amb-clock"],
  "places/embalming-room/3.mp3": ["amb-bubbles"],
  "places/fire/5.mp3": ["amb-fire"],
  "places/hospital_desk/5.mp3": ["amb-hospital"],
  "places/hospital_room/9.mp3": ["amb-monitor"],
  "closed/5.mp3": ["amb-night"],
  "morning_coffee/5.mp3": ["amb-birds"],
  "places/hospital_ambulance/2.mp3": ["siren"],
  "places/psych/7.mp3": ["psychic"],
  "stuff/money_bag/7.mp3": ["cash-register"],
  "stuff/money_bag_2/9.mp3": ["coins"],
  "stuff/toilet/3.mp3": ["toilet-flush"],
  "stuff/battle_lose/2.mp3": ["gong"],
  "stuff/lottery_win/19.mp3": ["bingo-ball"],
  "stuff/lottery_win/25.mp3": ["bingo-win"],
  "stuff/lottery_lose/19.mp3": ["bingo-ball"],
  "stuff/lottery_lose/26.mp3": ["bingo-lose"],
  "ring/ring/4.mp3": ["glint"],
  "ring/ring&hand/5.mp3": ["glint"],
  "animals/dog-dragging-hand/2.mp3": ["growl"],
  "mother/happy/5.mp3": ["harp-good-news"],
  "people/jesus_happy/13.mp3": ["angelic"],
  "wait/5.mp3": ["doorbell"],
};

/** Where the extraction writes (scripts/originals.ts, ORIGINALS_DIR; not imported, it runs). */
const originalsDir =
  process.env.FQ_AUDIO_ORIGINAL_DIR ?? join(homedir(), ".cache", "fq-audio-original");

function main() {
  const synth = read<AudioManifest>(join(repo, "assets", "audio", "manifest.json"));
  const studio = read<AudioManifest>(join(repo, "assets", "audio-studio", "manifest.json"));
  const sources = read<Sources>(join(repo, "assets", "audio-studio", "sources.json"));
  // The "Original, remastered" pack: a remake per original sound, keyed by the original's file.
  const remaster = read<AudioManifest>(join(repo, "assets", "audio-remaster", "manifest.json"));
  const remasterBrief = read<{
    sounds: { file: string; remake?: { id: string; prompt: string; description: string } }[];
  }>(join(repo, "assets", "audio-remaster", "brief.json"));
  const remakes = Object.fromEntries(
    (remasterBrief?.sounds ?? []).map((x) => {
      const t = remaster?.originals?.[x.file];
      return [
        x.file,
        {
          id: x.remake?.id ?? "",
          prompt: x.remake?.prompt ?? "",
          description: x.remake?.description ?? "",
          take: t
            ? {
                files: t.files.map((f) => f.ogg),
                loop: t.loop,
                a: t.loopStart,
                b: t.loopEnd,
                d: t.duration,
              }
            : null,
        },
      ];
    }),
  );
  const where = (id: string) =>
    BRIEF.find((b) => b.id === id || b.id === `${id}.layer0`)?.where ?? "";
  const originals = read<OriginalIndex>(join(originalsDir, "index.json"));
  const orig = (originals?.sounds ?? []).map((o) => {
    const loops = o.loops.length ? Math.max(...o.loops) : (SCRIPT_LOOPS[o.file] ?? 1);
    return {
      file: o.file,
      swf: o.swf,
      name: o.exportName ?? `sound ${o.characterId}`,
      d: o.seconds,
      loops,
      startedAt: o.startedAt,
      tracks: ORIGINAL_FOR[o.file] ?? [],
    };
  });
  const voice = read<VoiceManifest>(join(repo, "assets", "voice", "manifest.json"));
  const voices = (voice?.clips ?? []).map((c) => ({
    key: c.key,
    character: c.character,
    speaker: c.speaker,
    text: c.text,
    part: c.part,
    rulesets: c.rulesets,
    file: c.file.ogg,
    d: c.duration,
  }));
  const characters = VOICE_CHARACTERS.map((c) => ({ id: c.id, name: c.name, cast: c.cast }));
  const ids = [...MUSIC, ...STINGERS, ...AMBIENCE, ...EFFECTS_IDS];
  const rows = ids.map((id) => {
    const s = synth?.tracks[id];
    const t = studio?.tracks[id];
    const src = sources?.tracks[id];
    return {
      id,
      kind: s?.kind ?? t?.kind ?? "",
      title: s?.title ?? t?.title ?? id,
      where: where(id),
      orig: orig.filter((o) => o.tracks.includes(id)).map((o) => o.file),
      synth: s
        ? {
            files: s.files.map((f) => f.ogg),
            loop: s.loop,
            a: s.loopStart,
            b: s.loopEnd,
            d: s.duration,
          }
        : null,
      studio: t
        ? {
            files: t.files.map((f) => f.ogg),
            loop: t.loop,
            a: t.loopStart,
            b: t.loopEnd,
            d: t.duration,
          }
        : null,
      studioNote: t
        ? (src?.stems ?? [])
            .map(
              (x) =>
                `${x.brief}: "${x.prompt}"${x.checks?.flags.length ? ` [checks: ${x.checks.flags.join(", ")}]` : ""}`,
            )
            .join("\n")
        : `Not in the Studio pack: plays from Synth. ${src?.reason ?? ""}`,
    };
  });
  const out = join(repo, "docs", "audio", "listen.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    page(
      JSON.stringify(rows),
      JSON.stringify(orig),
      JSON.stringify(voices),
      JSON.stringify(characters),
      voice?.lufs ?? null,
      JSON.stringify(remakes),
    ),
  );
  const mapped = orig.filter((o) => o.tracks.length > 0).length;
  console.log(
    `wrote ${out} (${rows.length} tracks; ${orig.length} original sounds, ${mapped} beside a new track; ${voices.length} voice clips)`,
  );
}

function page(
  data: string,
  originals: string,
  voices: string,
  characters: string,
  voiceLufs: number | null,
  remakes = "{}",
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Funeral Quest Remastered: Synth, Studio and the 2001 originals, side by side; character voices</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 15px/1.45 system-ui, sans-serif; margin: 0; padding: 1rem 1.5rem 4rem; background: #f6f3ee; color: #222; }
  h1 { font-size: 1.35rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 .5rem; border-bottom: 1px solid #ccc; }
  p.lead { max-width: 60rem; margin: .25rem 0 1rem; }
  .bar { position: sticky; top: 0; background: #f6f3ee; padding: .5rem 0; z-index: 2; display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; border-bottom: 1px solid #ddd; }
  .row { display: grid; grid-template-columns: 13rem 1fr 1fr 1fr 1fr 16rem; gap: .75rem; padding: .6rem 0; border-bottom: 1px solid #e3ded6; align-items: start; }
  .row:nth-child(even) { background: #fbf9f5; }
  .id { font-family: ui-monospace, monospace; font-weight: 600; }
  .title { font-style: italic; }
  .where { color: #555; font-size: .9em; }
  .pack h4 { margin: 0 0 .2rem; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: #666; }
  audio { width: 100%; display: block; margin-top: .3rem; }
  .play { font: inherit; font-weight: 600; padding: .45rem .9rem; min-width: 7.5rem; border: 1px solid #7a5a2a; border-radius: .4rem; background: #a38855; color: #1b1205; cursor: pointer; }
  .play:hover { background: #b89867; }
  .play.on { background: #3f1d01; color: #ffe0a8; }
  .play:disabled { opacity: .5; cursor: not-allowed; }
  .pl { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap; }
  .time { font-variant-numeric: tabular-nums; color: #444; white-space: nowrap; }
  .loaderr { color: #a33; font-size: .85em; margin-top: .2rem; }
  #warn { display: none; margin: .75rem 0; padding: .75rem 1rem; border: 2px solid #a33; background: #fff3f0; max-width: 60rem; }
  #warn code, noscript code { background: #eee; padding: 0 .3em; }
  .missing { color: #a33; font-size: .9em; }
  .note { font-size: .8em; color: #555; white-space: pre-wrap; max-height: 6.5em; overflow: auto; }
  textarea { width: 100%; min-height: 4.5rem; font: inherit; }
  .verdict label { margin-right: .6rem; font-size: .9em; white-space: nowrap; }
  .ok { color: #2a6; } .err { color: #a33; }
  #export { width: 100%; min-height: 12rem; display: none; margin-top: .5rem; }
  .orow { display: grid; grid-template-columns: 22rem 1fr 1fr 18rem; gap: .75rem; padding: .5rem 0; border-bottom: 1px solid #e3ded6; align-items: start; }
  .vrow { display: grid; grid-template-columns: 1fr 16rem 18rem; gap: .75rem; padding: .5rem 0; border-bottom: 1px solid #e3ded6; align-items: start; }
  .line { font-family: Georgia, serif; font-size: 1.02em; }
  .absent { color: #7a5a2a; font-size: .9em; }
  h3 { font-size: 1rem; margin: 1.25rem 0 .25rem; }
  @media (max-width: 900px) { .orow, .vrow { grid-template-columns: 1fr; } }
  @media (max-width: 900px) { .row { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>Synth, Studio and the 2001 originals, side by side; character voices</h1>
<p class="lead"><b>Neither sound pack contains the original game's audio.</b> The <b>Synth</b> pack is made by the remaster's own code; the <b>Studio</b> pack was generated with ElevenLabs from the text prompt shown, then post-processed. The original 2001 sounds and music are licensed for the original game only: the game plays them only in museum mode, inside the original client.</p>
<p class="lead">The <b>Original (2001)</b> column plays the 2001 game's own sounds, extracted from its Flash files on this machine by <code>pnpm listen:originals</code> for the owner's comparison only. They are not part of either sound pack, are kept outside the repository, and are never committed or distributed. They are paired with the new track that does the same job (from the cue map); one original that served several places is shown beside each. They play only through <code>pnpm listen</code>.</p>
<p class="lead">Every track the game plays, Synth next to Studio and, where there is one, the original. Loops repeat between their loop points when "Loop" is ticked; an original loop repeats as many times as the 2001 game repeated it (shown beside it), and one the original repeated 999 times or more repeats continuously. Pick a verdict and write a note for each track; notes stay in this browser. When done, press <b>Export notes</b> and send the text back. Press <b>Play</b> on any track. Open this file in a web browser, or run <code>pnpm listen</code> in the repository and open the address it prints.</p>
<div class="bar">
  <label><input type="checkbox" id="loop" checked> Loop</label>
  <button type="button" id="stop">Stop all</button>
  <button type="button" id="exportBtn">Export notes</button>
  <a id="download" download="funeral-quest-audio-notes.txt" href="#" hidden>Download the notes</a>
  <span id="status"></span>
</div>
<textarea id="export" readonly></textarea>
<noscript><p id="noscript"><b>This page needs JavaScript to build its players.</b> Open it in a web browser, or run <code>pnpm listen</code> in the repository and open the address it prints.</p></noscript>
<div id="warn"><b>The sound files could not be loaded from here.</b> This happens when the page is shown in a preview that cannot read the files next to it. In the repository, run <code>pnpm listen</code> and open the address it prints (it serves this page and both sound packs), or open this file in a normal web browser window.</div>
<div id="list"></div>
<script>
const TRACKS = ${data};
const ORIGINALS = ${originals};
const VOICES = ${voices};
const CHARACTERS = ${characters};
const VOICE_LUFS = ${JSON.stringify(voiceLufs)};
const ORIGINAL = "../../assets/audio-original/";
const VOICE = "../../assets/voice/";
const ORIG_BY_FILE = Object.fromEntries(ORIGINALS.map((o) => [o.file, o]));
const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");
// The originals are served by pnpm listen only; a fresh clone or a page opened from disk has none.
let originalsHere = null;
const ABSENT = "Not extracted here: run pnpm listen:originals, then pnpm listen, and open the address it prints.";
const KEY = "fq.listen.notes.v1";
const SYNTH = "../../assets/audio/";
const STUDIO = "../../assets/audio-studio/";
const REMASTER = "../../assets/audio-remaster/";
const REMAKES = ${remakes};
const notes = JSON.parse(localStorage.getItem(KEY) || "{}");
const save = () => localStorage.setItem(KEY, JSON.stringify(notes));
const players = [];
const KIND = { music: "Music loops", stinger: "Stingers", ambience: "Ambience loops", sfx: "Effects" };
const list = document.getElementById("list");
let loaded = 0, failed = 0, total = 0;
const status = () => { document.getElementById("status").textContent = loaded + " of " + total + " players loaded" + (failed ? ", " + failed + " failed" : ""); };
function player(base, p, label) {
  const wrap = document.createElement("div");
  if (label) { const l = document.createElement("div"); l.className = "note"; l.textContent = label; wrap.append(l); }
  const a = document.createElement("audio");
  a.controls = true; a.preload = "metadata";
  let m4a;
  if (p.mp3) {
    m4a = document.createElement("source"); m4a.src = base + encPath(p.file); m4a.type = "audio/mpeg";
    a.append(m4a);
  } else {
    const ogg = document.createElement("source"); ogg.src = base + p.file; ogg.type = 'audio/ogg; codecs="opus"';
    m4a = document.createElement("source"); m4a.src = base + p.file.replace(/\\.ogg$/, ".m4a"); m4a.type = "audio/mp4";
    a.append(ogg, m4a);
  }
  a.dataset.file = base + p.file;
  total++;
  a.addEventListener("loadedmetadata", () => { loaded++; a.dataset.loaded = "1"; status(); }, { once: true });
  m4a.addEventListener("error", () => { failed++; a.dataset.loaded = "0"; status(); }, { once: true });
  a.addEventListener("play", () => { for (const o of players) if (o !== a) o.pause(); });
  a.addEventListener("timeupdate", () => {
    // the file holds a little of its own start after loopEnd, so jumping back here is seamless
    if (p.loop && document.getElementById("loop").checked && p.b && a.currentTime >= p.b) a.currentTime = p.a + (a.currentTime - p.b);
  });
  // An original loop: the Flash player repeated the whole sound n times (999 or more: for good).
  let passes = 0;
  a.addEventListener("play", () => { if (a.currentTime < 0.05) passes = passes || 1; });
  a.addEventListener("ended", () => {
    if (!document.getElementById("loop").checked) { passes = 0; return; }
    if (p.mp3) {
      if (p.loops >= 999 || passes < p.loops) { passes++; a.currentTime = 0; a.play(); } else passes = 0;
      return;
    }
    if (p.loop) { a.currentTime = p.a || 0; a.play(); }
  });
  // A plain, obvious button as well as the browser's own controls, which some previews hide.
  const btn = document.createElement("button"); btn.type = "button"; btn.className = "play"; btn.textContent = "\u25B6 Play";
  const time = document.createElement("span"); time.className = "time";
  const fmt = (x) => { const v = Math.max(0, Math.floor(x || 0)); return Math.floor(v / 60) + ":" + String(v % 60).padStart(2, "0"); };
  const show = () => { time.textContent = fmt(a.currentTime) + " / " + fmt(p.d); };
  show();
  const err = document.createElement("div"); err.className = "loaderr"; err.hidden = true;
  const fail = (why) => { err.hidden = false; err.textContent = "Cannot play this file here (" + why + "). Run pnpm listen in the repository and open the address it prints."; btn.classList.remove("on"); btn.textContent = "\u25B6 Play"; };
  btn.addEventListener("click", () => {
    if (a.paused) { err.hidden = true; const r = a.play(); if (r && r.catch) r.catch((e) => fail(e && e.name ? e.name : "blocked")); }
    else a.pause();
  });
  a.addEventListener("play", () => { btn.classList.add("on"); btn.textContent = "\u25A0 Stop"; });
  a.addEventListener("pause", () => { btn.classList.remove("on"); btn.textContent = "\u25B6 Play"; });
  a.addEventListener("timeupdate", show);
  m4a.addEventListener("error", () => fail("file not found or not readable"), { once: true });
  const line = document.createElement("div"); line.className = "pl"; line.append(btn, time);
  players.push(a); wrap.append(line, a, err);
  return wrap;
}
function cell(name, base, t, extra) {
  const c = document.createElement("div"); c.className = "pack";
  const h = document.createElement("h4"); h.textContent = name + (t ? " (" + t.d.toFixed(1) + " s file)" : ""); c.append(h);
  if (!t) { const m = document.createElement("div"); m.className = "missing"; m.textContent = name === "Studio" ? "none: the game plays Synth" : "none"; c.append(m); }
  else t.files.forEach((f, i) => c.append(player(base, { ...t, file: f }, t.files.length > 1 ? ["calm", "uneasy", "angry"][i] + " stem" : "")));
  if (extra) { const n = document.createElement("div"); n.className = "note"; n.textContent = extra; c.append(n); }
  return c;
}
const loopsText = (o) => o.loops >= 999 ? "looped " + o.loops + " times by the original: repeats continuously" : o.loops > 1 ? "looped " + o.loops + " times by the original" : "played once";
function origPlayer(o) {
  const w = player(ORIGINAL, { file: o.file, mp3: true, loops: o.loops, d: o.d }, o.swf + " (" + o.name + "), " + o.d.toFixed(2) + " s, " + loopsText(o));
  w.classList.add("orig");
  return w;
}
function origCell(files) {
  const c = document.createElement("div"); c.className = "pack";
  const h = document.createElement("h4"); h.textContent = "Original (2001)"; c.append(h);
  if (!files.length) { const m = document.createElement("div"); m.className = "missing"; m.textContent = ORIGINALS.length ? "no original counterpart" : "not listed: run pnpm listen:originals, then regenerate this page"; c.append(m); return c; }
  for (const f of files) { const o = ORIG_BY_FILE[f]; if (o) c.append(origPlayer(o)); }
  return c;
}
// "Original, remastered": the remake of each original, beside it (new audio, not the 2001 recording).
function remasterCell(files) {
  const c = document.createElement("div"); c.className = "pack";
  const h = document.createElement("h4"); h.textContent = "Original, remastered"; c.append(h);
  if (!files.length) { const m = document.createElement("div"); m.className = "missing"; m.textContent = "no 2001 counterpart: the pack plays Synth"; c.append(m); return c; }
  const seen = new Set();
  for (const f of files) {
    const r = REMAKES[f];
    if (!r || seen.has(r.id)) continue;
    seen.add(r.id);
    if (r.take) r.take.files.forEach((file) => c.append(player(REMASTER, { ...r.take, file }, "")));
    else { const m = document.createElement("div"); m.className = "missing"; m.textContent = "not generated yet"; c.append(m); }
    const n = document.createElement("div"); n.className = "note"; n.textContent = 'Prompt: "' + r.prompt + '"'; c.append(n);
  }
  if (!seen.size) { const m = document.createElement("div"); m.className = "missing"; m.textContent = "not generated yet"; c.append(m); }
  return c;
}
function notesFor(key, label, options) {
  const n = notes[key] || (notes[key] = { verdict: "", text: "" });
  const mine = document.createElement("div");
  if (options) {
    const v = document.createElement("div"); v.className = "verdict";
    for (const [val, lab] of options) {
      const l = document.createElement("label"); const r = document.createElement("input");
      r.type = "radio"; r.name = "v-" + key; r.value = val; r.checked = n.verdict === val;
      r.addEventListener("change", () => { n.verdict = val; save(); });
      l.append(r, " " + lab); v.append(l);
    }
    mine.append(v);
  }
  const ta = document.createElement("textarea"); ta.placeholder = "Notes on " + label; ta.value = n.text;
  ta.addEventListener("input", () => { n.text = ta.value; save(); });
  mine.append(ta);
  return mine;
}
let kind = "";
for (const t of TRACKS) {
  if (t.kind !== kind) { kind = t.kind; const h = document.createElement("h2"); h.textContent = KIND[kind] || kind; list.append(h); }
  const row = document.createElement("div"); row.className = "row"; row.id = "t-" + t.id;
  const info = document.createElement("div");
  info.innerHTML = '<div class="id"></div><div class="title"></div><div class="where"></div>';
  info.querySelector(".id").textContent = t.id;
  info.querySelector(".title").textContent = t.title;
  info.querySelector(".where").textContent = t.where;
  const n = notes[t.id] || (notes[t.id] = { verdict: "", text: "" });
  const mine = document.createElement("div");
  const v = document.createElement("div"); v.className = "verdict";
  for (const [val, lab] of [["studio", "Keep Studio"], ["synth", "Keep Synth"], ["remaster", "Keep Remaster"], ["redo", "Redo"], ["either", "Either"]]) {
    const l = document.createElement("label"); const r = document.createElement("input");
    r.type = "radio"; r.name = "v-" + t.id; r.value = val; r.checked = n.verdict === val;
    r.addEventListener("change", () => { n.verdict = val; save(); });
    l.append(r, " " + lab); v.append(l);
  }
  const ta = document.createElement("textarea"); ta.placeholder = "Notes on " + t.id; ta.value = n.text;
  ta.addEventListener("input", () => { n.text = ta.value; save(); });
  mine.append(v, ta);
  row.append(info, cell("Synth", SYNTH, t.synth, ""), cell("Studio", STUDIO, t.studio, t.studioNote), origCell(t.orig), remasterCell(t.orig), mine);
  list.append(row);
}
// Every original 2001 sound, grouped by SWF.
{
  const h = document.createElement("h2"); h.id = "originals"; h.textContent = "Original 2001 sounds (" + ORIGINALS.length + ")"; list.append(h);
  const p = document.createElement("p"); p.className = "lead";
  p.textContent = "The 2001 game's own audio, every DefineSound in its Flash files, as extracted (MP3, unchanged). For comparison only: not part of either sound pack, kept outside the repository, never committed or distributed. With Loop ticked, each repeats as many times as the original repeated it.";
  list.append(p);
  if (!ORIGINALS.length) { const m = document.createElement("div"); m.className = "absent"; m.textContent = "None listed: run pnpm listen:originals, then pnpm --filter @fq/audio run listen-page."; list.append(m); }
  let swf = "";
  for (const o of ORIGINALS) {
    if (o.swf !== swf) { swf = o.swf; const h3 = document.createElement("h3"); h3.textContent = swf; list.append(h3); }
    const row = document.createElement("div"); row.className = "orow";
    const info = document.createElement("div");
    info.innerHTML = '<div class="id"></div><div class="where"></div>';
    info.querySelector(".id").textContent = o.name + " (" + o.d.toFixed(2) + " s)";
    info.querySelector(".where").textContent = loopsText(o) + "; started at " + o.startedAt + (o.tracks.length ? "; new counterpart: " + o.tracks.join(", ") : "; no new counterpart");
    row.append(info, origPlayer(o), remasterCell([o.file]), notesFor("orig:" + o.file, o.swf + " " + o.name, [["remaster", "Keep Remaster"], ["redo", "Redo remake"]]));
    list.append(row);
  }
}
// The character voice pack, by character.
{
  const h = document.createElement("h2"); h.id = "voices"; h.textContent = "Voices (" + VOICES.length + " clips)"; list.append(h);
  const p = document.createElement("p"); p.className = "lead";
  p.textContent = "Character voices, generated with ElevenLabs from the game's own text (assets/voice). Each clip shows the exact words it speaks; original 2001 lines are spoken word for word as written." + (VOICE_LUFS !== null ? " Normalised to " + VOICE_LUFS + " LUFS." : "");
  list.append(p);
  if (!VOICES.length) { const m = document.createElement("div"); m.className = "absent"; m.textContent = "No voice clips yet."; list.append(m); }
  for (const ch of CHARACTERS) {
    const mine = VOICES.filter((v) => v.character === ch.id);
    if (!mine.length) continue;
    const h3 = document.createElement("h3"); h3.textContent = ch.name + (ch.cast === "original" ? " (original 2001 cast)" : " (Expanded cast)") + ": " + mine.length; list.append(h3);
    for (const v of mine) {
      const row = document.createElement("div"); row.className = "vrow"; row.id = "v-" + v.key;
      const info = document.createElement("div");
      info.innerHTML = '<div class="line"></div><div class="where"></div>';
      info.querySelector(".line").textContent = v.speaker + ': "' + v.text + '"';
      info.querySelector(".where").textContent = v.key + " - " + v.rulesets.join(", ") + (v.part !== "whole" ? " - part of a longer line (" + v.part + ")" : "");
      row.append(info, player(VOICE, { file: v.file, d: v.d }, ""), notesFor("voice:" + v.key, v.speaker + " line", [["good", "Good"], ["redo", "Redo"], ["drop", "Drop"]]));
      list.append(row);
    }
  }
}
// The originals are only there through pnpm listen: say so in place of broken players.
fetch(ORIGINAL + "index.json", { method: "HEAD" }).then((r) => r.ok).catch(() => false).then((ok) => {
  originalsHere = ok;
  if (ok) return;
  for (const w of document.querySelectorAll(".orig")) {
    const a = w.querySelector("audio"); const i = players.indexOf(a);
    if (i >= 0) players.splice(i, 1);
    if (a && a.dataset.loaded !== "1") total--;
    const m = document.createElement("div"); m.className = "absent"; m.textContent = ABSENT;
    w.replaceWith(m);
  }
  status();
});
status();
// If no file can be read at all (a sandboxed preview, a moved page), say so plainly.
setTimeout(() => { if (total > 0 && loaded === 0) document.getElementById("warn").style.display = "block"; }, 4000);
document.getElementById("stop").addEventListener("click", () => { for (const a of players) a.pause(); });
document.getElementById("exportBtn").addEventListener("click", () => {
  const lines = ["Funeral Quest audio notes (" + new Date().toISOString().slice(0, 10) + ")", ""];
  for (const t of TRACKS) {
    const n = notes[t.id]; if (!n || (!n.verdict && !n.text.trim())) continue;
    lines.push(t.id + ": " + (n.verdict || "-") + (n.text.trim() ? " - " + n.text.trim().replace(/\\s+/g, " ") : ""));
  }
  for (const o of ORIGINALS) {
    const n = notes["orig:" + o.file]; if (!n || (!n.verdict && !n.text.trim())) continue;
    lines.push("original " + o.file + ": " + (n.verdict || "-") + (n.text.trim() ? " - " + n.text.trim().replace(/\\s+/g, " ") : ""));
  }
  for (const v of VOICES) {
    const n = notes["voice:" + v.key]; if (!n || (!n.verdict && !n.text.trim())) continue;
    lines.push("voice " + v.key + " (" + v.speaker + ': "' + v.text + '"): ' + (n.verdict || "-") + (n.text.trim() ? " - " + n.text.trim().replace(/\\s+/g, " ") : ""));
  }
  if (lines.length === 2) lines.push("(no notes yet)");
  const text = lines.join("\\n");
  const out = document.getElementById("export"); out.style.display = "block"; out.value = text; out.select();
  const a = document.getElementById("download"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.hidden = false;
});
</script>
</body>
</html>
`;
}

main();
