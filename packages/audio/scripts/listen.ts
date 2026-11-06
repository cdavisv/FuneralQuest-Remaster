/**
 * `pnpm --filter @fq/audio run listen-page`: writes docs/audio/listen.html, a static page that
 * plays every track of the Synth pack (assets/audio) next to the Studio pack (assets/audio-studio)
 * with the track's id, title and where it plays, and a notes field per track that is kept in the
 * browser's local storage and can be exported as text.
 *
 * The data is written into the page (no fetch), and the players point at the packs with paths
 * relative to the page, so it works opened straight from disk (file://) as well as through a
 * server that serves the repository (the client's dev server serves it under /@fs/<repo path>/).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AudioManifest } from "../src/manifestTypes.js";
import { AMBIENCE, EFFECTS_IDS, MUSIC, STINGERS } from "../src/tracks.js";
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

function main() {
  const synth = read<AudioManifest>(join(repo, "assets", "audio", "manifest.json"));
  const studio = read<AudioManifest>(join(repo, "assets", "audio-studio", "manifest.json"));
  const sources = read<Sources>(join(repo, "assets", "audio-studio", "sources.json"));
  const where = (id: string) =>
    BRIEF.find((b) => b.id === id || b.id === `${id}.layer0`)?.where ?? "";
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
  writeFileSync(out, page(JSON.stringify(rows)));
  console.log(`wrote ${out} (${rows.length} tracks)`);
}

function page(data: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Funeral Quest Remastered: Synth and Studio sound packs, side by side</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body { font: 15px/1.45 system-ui, sans-serif; margin: 0; padding: 1rem 1.5rem 4rem; background: #f6f3ee; color: #222; }
  h1 { font-size: 1.35rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 .5rem; border-bottom: 1px solid #ccc; }
  p.lead { max-width: 60rem; margin: .25rem 0 1rem; }
  .bar { position: sticky; top: 0; background: #f6f3ee; padding: .5rem 0; z-index: 2; display: flex; gap: .75rem; flex-wrap: wrap; align-items: center; border-bottom: 1px solid #ddd; }
  .row { display: grid; grid-template-columns: 15rem 1fr 1fr 18rem; gap: .75rem; padding: .6rem 0; border-bottom: 1px solid #e3ded6; align-items: start; }
  .row:nth-child(even) { background: #fbf9f5; }
  .id { font-family: ui-monospace, monospace; font-weight: 600; }
  .title { font-style: italic; }
  .where { color: #555; font-size: .9em; }
  .pack h4 { margin: 0 0 .2rem; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: #666; }
  audio { width: 100%; height: 2rem; }
  .missing { color: #a33; font-size: .9em; }
  .note { font-size: .8em; color: #555; white-space: pre-wrap; max-height: 6.5em; overflow: auto; }
  textarea { width: 100%; min-height: 4.5rem; font: inherit; }
  .verdict label { margin-right: .6rem; font-size: .9em; white-space: nowrap; }
  .ok { color: #2a6; } .err { color: #a33; }
  #export { width: 100%; min-height: 12rem; display: none; margin-top: .5rem; }
  @media (max-width: 900px) { .row { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<h1>Synth and Studio sound packs, side by side</h1>
<p class="lead">Every track the game plays, the <b>Synth</b> pack (made by the game's own code) next to the <b>Studio</b> pack (generated with ElevenLabs from the prompt shown, then post-processed). Loops repeat between their loop points when "Loop" is ticked. Pick a verdict and write a note for each track; notes stay in this browser. When done, press <b>Export notes</b> and send the text back. Open this file straight from disk, or through the client dev server at <code>/@fs/&lt;path to the repository&gt;/docs/audio/listen.html</code>.</p>
<div class="bar">
  <label><input type="checkbox" id="loop" checked> Loop</label>
  <button type="button" id="stop">Stop all</button>
  <button type="button" id="exportBtn">Export notes</button>
  <a id="download" download="funeral-quest-audio-notes.txt" href="#" hidden>Download the notes</a>
  <span id="status"></span>
</div>
<textarea id="export" readonly></textarea>
<div id="list"></div>
<script>
const TRACKS = ${data};
const KEY = "fq.listen.notes.v1";
const SYNTH = "../../assets/audio/";
const STUDIO = "../../assets/audio-studio/";
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
  const ogg = document.createElement("source"); ogg.src = base + p.file; ogg.type = 'audio/ogg; codecs="opus"';
  const m4a = document.createElement("source"); m4a.src = base + p.file.replace(/\\.ogg$/, ".m4a"); m4a.type = "audio/mp4";
  a.append(ogg, m4a);
  a.dataset.file = base + p.file;
  total++;
  a.addEventListener("loadedmetadata", () => { loaded++; a.dataset.loaded = "1"; status(); }, { once: true });
  m4a.addEventListener("error", () => { failed++; a.dataset.loaded = "0"; status(); }, { once: true });
  a.addEventListener("play", () => { for (const o of players) if (o !== a) o.pause(); });
  a.addEventListener("timeupdate", () => {
    // the file holds a little of its own start after loopEnd, so jumping back here is seamless
    if (p.loop && document.getElementById("loop").checked && p.b && a.currentTime >= p.b) a.currentTime = p.a + (a.currentTime - p.b);
  });
  a.addEventListener("ended", () => { if (p.loop && document.getElementById("loop").checked) { a.currentTime = p.a || 0; a.play(); } });
  players.push(a); wrap.append(a);
  return wrap;
}
function cell(name, base, t, extra) {
  const c = document.createElement("div"); c.className = "pack";
  const h = document.createElement("h4"); h.textContent = name + (t ? " (" + t.d.toFixed(1) + " s file)" : ""); c.append(h);
  if (!t) { const m = document.createElement("div"); m.className = "missing"; m.textContent = "none: the game plays Synth"; c.append(m); }
  else t.files.forEach((f, i) => c.append(player(base, { ...t, file: f }, t.files.length > 1 ? ["calm", "uneasy", "angry"][i] + " stem" : "")));
  if (extra) { const n = document.createElement("div"); n.className = "note"; n.textContent = extra; c.append(n); }
  return c;
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
  for (const [val, lab] of [["studio", "Keep Studio"], ["synth", "Keep Synth"], ["redo", "Redo"], ["either", "Either"]]) {
    const l = document.createElement("label"); const r = document.createElement("input");
    r.type = "radio"; r.name = "v-" + t.id; r.value = val; r.checked = n.verdict === val;
    r.addEventListener("change", () => { n.verdict = val; save(); });
    l.append(r, " " + lab); v.append(l);
  }
  const ta = document.createElement("textarea"); ta.placeholder = "Notes on " + t.id; ta.value = n.text;
  ta.addEventListener("input", () => { n.text = ta.value; save(); });
  mine.append(v, ta);
  row.append(info, cell("Synth", SYNTH, t.synth, ""), cell("Studio", STUDIO, t.studio, t.studioNote), mine);
  list.append(row);
}
status();
document.getElementById("stop").addEventListener("click", () => { for (const a of players) a.pause(); });
document.getElementById("exportBtn").addEventListener("click", () => {
  const lines = ["Funeral Quest audio notes (" + new Date().toISOString().slice(0, 10) + ")", ""];
  for (const t of TRACKS) {
    const n = notes[t.id]; if (!n || (!n.verdict && !n.text.trim())) continue;
    lines.push(t.id + ": " + (n.verdict || "-") + (n.text.trim() ? " - " + n.text.trim().replace(/\\s+/g, " ") : ""));
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
