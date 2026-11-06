import { decompile } from "./as1.js";
import { allActionStrings } from "./reference.js";
import { parseHtmlText } from "./render.js";
import type { Swf } from "./swf.js";
import type { FontDef, TimelineData } from "./types.js";

const md = (s: string): string => s.replace(/\|/g, "\\|").replace(/\n/g, " ⏎ ");

function charOf(font: FontDef | undefined, glyph: number): string {
  const code = font?.codes[glyph];
  return code ? String.fromCharCode(code) : "?";
}

interface TextEntry {
  where: string;
  kind: "static" | "field";
  text: string;
  font: string;
  size: string;
  color: string;
  variable: string;
}

const hex = (c: { r: number; g: number; b: number }): string =>
  `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;

function placementMap(swf: Swf): Map<number, string[]> {
  const m = new Map<number, string[]>();
  const scan = (tl: TimelineData, parent: string): void => {
    tl.frames.forEach((f, fi) => {
      for (const c of f.cmds) {
        if (c.op !== "place" || c.charId === undefined) continue;
        const l = m.get(c.charId) ?? [];
        const w = `${parent} f${fi + 1}`;
        if (!l.includes(w)) l.push(w);
        m.set(c.charId, l);
      }
    });
  };
  scan(swf.root, "root");
  for (const [id, ch] of swf.characters)
    if (ch.type === "sprite") scan(ch.timeline, `sprite ${id}`);
  return m;
}

/** Static text runs and text fields, in character id order. */
export function collectTexts(swf: Swf): TextEntry[] {
  const where = placementMap(swf);
  const out: TextEntry[] = [];
  for (const [id, ch] of [...swf.characters].sort((a, b) => a[0] - b[0])) {
    const loc = `${id} (${(where.get(id) ?? ["unplaced"]).slice(0, 3).join(", ")})`;
    if (ch.type === "text") {
      let font: FontDef | undefined;
      let line = "";
      const lines: string[] = [];
      let lastY: number | undefined;
      let color = "";
      let size = "";
      for (const run of ch.runs) {
        if (run.fontId !== undefined) font = swf.fonts.get(run.fontId);
        if (run.color) color = hex(run.color);
        if (run.height !== undefined) size = `${run.height / 20}`;
        if (run.y !== undefined && lastY !== undefined && run.y !== lastY) {
          lines.push(line);
          line = "";
        }
        if (run.y !== undefined) lastY = run.y;
        for (const g of run.glyphs) line += charOf(font, g.index);
      }
      lines.push(line);
      const text = lines.join("\n");
      if (text.trim())
        out.push({
          where: loc,
          kind: "static",
          text,
          font: font?.name ?? "",
          size,
          color,
          variable: "",
        });
    } else if (ch.type === "edit") {
      const d = ch.def;
      const html = (d.flags2 & 2) !== 0 && d.text ? parseHtmlText(d.text) : undefined;
      const font = d.fontId !== undefined ? swf.fonts.get(d.fontId) : undefined;
      out.push({
        where: loc,
        kind: "field",
        text: html ? html.text : (d.text ?? ""),
        font: html?.face ?? font?.name ?? "(device font)",
        size:
          html?.size !== undefined
            ? String(html.size)
            : d.fontHeight
              ? String(d.fontHeight / 20)
              : "",
        color: html?.color ? hex(html.color) : d.color ? hex(d.color) : "",
        variable: d.variable,
      });
    }
  }
  return out;
}

const looksLikeMessage = (s: string): boolean =>
  s.length > 12 && /[a-z]/.test(s) && /\s/.test(s) && !/^[\w./:$]+$/.test(s);

export function textsDoc(swf: Swf, fileName: string): string {
  const texts = collectTexts(swf);
  const out: string[] = [];
  out.push(`# ${fileName}: text strings and fonts`, "");
  out.push(
    "Everything a player can read in the Flash client, extracted from the SWF. Static text is decoded from font glyph codes; text fields show their initial value and the variable they are bound to. Message strings pushed by the ActionScript are listed last. Text from the server arrives at run time and is not here.",
    "",
  );
  out.push("## Fonts", "");
  const faces = new Map<string, string[]>();
  const addFace = (n: string, how: string): void => {
    const l = faces.get(n) ?? [];
    if (!l.includes(how)) l.push(how);
    faces.set(n, l);
  };
  for (const f of swf.fonts.values()) {
    addFace(
      f.name || `(unnamed font ${f.id})`,
      `${f.kind} #${f.id}, ${f.glyphs.length} glyphs${f.bold ? ", bold" : ""}${f.italic ? ", italic" : ""}, outlines embedded`,
    );
  }
  for (const t of texts) if (t.kind === "field" && t.font) addFace(t.font, "named in a text field");
  out.push("| Font | Where it is used |", "|---|---|");
  for (const [n, h] of [...faces].sort()) out.push(`| ${md(n)} | ${md(h.join("; "))} |`);
  out.push(
    "",
    "The embedded fonts are outlines only, so the remaster must pick replacement typefaces; the lettering on the plaques, headings and tabs is a script face (Monotype Corsiva look) and the body text is a sans-serif such as Verdana or Arial.",
    "",
  );

  out.push(
    "## Static text",
    "",
    "| Character (placed in) | Font | Size | Colour | Text |",
    "|---|---|---|---|---|",
  );
  for (const t of texts.filter((x) => x.kind === "static"))
    out.push(`| ${t.where} | ${md(t.font)} | ${t.size} | ${t.color} | ${md(t.text)} |`);
  out.push(
    "",
    "## Text fields",
    "",
    "| Character (placed in) | Variable | Font | Size | Colour | Initial text |",
    "|---|---|---|---|---|---|",
  );
  for (const t of texts.filter((x) => x.kind === "field")) {
    out.push(
      `| ${t.where} | \`${t.variable}\` | ${md(t.font)} | ${t.size} | ${t.color} | ${md(t.text)} |`,
    );
  }
  out.push("", "## Messages in the ActionScript", "");
  const msgs = allActionStrings(swf).filter(looksLikeMessage).sort();
  for (const m of msgs) out.push(`- ${md(m)}`);
  out.push("");
  return out.join("\n");
}

const rate = (r: number): string => `${r} Hz`;

interface SoundRow {
  swf: string;
  kind: string;
  id: string;
  exportName: string;
  format: string;
  rate: string;
  channels: string;
  seconds: number;
  loops: string;
  usedAt: string;
}

export function soundRows(swf: Swf, fileName: string): SoundRow[] {
  const rows: SoundRow[] = [];
  const names = new Map(swf.exports.map((e) => [e.id, e.name]));
  const uses = new Map<number, string[]>();
  for (const u of swf.soundUses) {
    const l = uses.get(u.soundId) ?? [];
    l.push(
      `${u.where}${u.stop ? " (stop)" : ""}${u.loops !== undefined ? ` loops=${u.loops}` : ""}`,
    );
    uses.set(u.soundId, l);
  }
  for (const [id, ch] of swf.characters) {
    if (ch.type !== "sound") continue;
    const d = ch.def;
    const loops = swf.soundUses.filter((u) => u.soundId === id && !u.stop).map((u) => u.loops ?? 1);
    rows.push({
      swf: fileName,
      kind: "event sound",
      id: String(id),
      exportName: names.get(id) ?? "",
      format: d.formatName,
      rate: rate(d.rate),
      channels: d.stereo ? "stereo" : "mono",
      seconds: d.rate ? d.sampleCount / d.rate : 0,
      loops: loops.length ? [...new Set(loops)].join(", ") : "not started by the timeline",
      usedAt: (uses.get(id) ?? []).join("; ") || "attached by script",
    });
  }
  for (const s of swf.streams) {
    if (s.blocks === 0) continue;
    rows.push({
      swf: fileName,
      kind: "stream (synced to timeline)",
      id: `frames ${s.firstFrame}-${s.lastFrame}`,
      exportName: "",
      format: s.head.formatName,
      rate: rate(s.head.streamRate),
      channels: s.head.stereo ? "stereo" : "mono",
      seconds: s.head.streamRate ? s.samples / s.head.streamRate : 0,
      loops: "plays once per pass of the movie",
      usedAt: `root frames ${s.firstFrame} to ${s.lastFrame}`,
    });
  }
  return rows;
}

/** AS references to sounds: attachSound("name") and the loop count passed to start(). */
export function scriptSoundRefs(swf: Swf): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const scan = (code: Uint8Array, where: string): void => {
    const text = decompile(code);
    for (const line of text.split("\n")) {
      if (/attachSound|\.start\(|\.stop\(|setVolume|new Sound/.test(line)) {
        const l = `${where}: ${line.trim()}`;
        if (!seen.has(l)) {
          seen.add(l);
          out.push(l);
        }
      }
    }
  };
  const tl = (t: TimelineData, where: string): void => {
    t.frames.forEach((f, i) => {
      for (const a of f.actions) scan(a, `${where} f${i + 1}`);
    });
  };
  tl(swf.root, "root");
  for (const [id, ch] of swf.characters) {
    if (ch.type === "sprite") tl(ch.timeline, `sprite ${id}`);
    if (ch.type === "button") for (const a of ch.actions) scan(a.code, `button ${id}`);
  }
  return out;
}

export function soundsDoc(
  rows: SoundRow[],
  scriptRefs: string[],
  exportsByFile: Map<string, string[]>,
): string {
  const out: string[] = [];
  out.push("# Embedded sound inventory", "");
  out.push(
    "A brief for composing replacements. The original sounds and music are not licensed for reuse and no audio data is stored in this repository; this table is metadata only (which file, how long, how it loops).",
    "",
    "- *Event sounds* are started by a StartSound tag or by script (`attachSound`).",
    "- *Stream* sounds are laid along the timeline of a picture and play once as the picture plays.",
    "- Durations are computed from the sample counts in the file.",
    "",
  );
  out.push(
    "| SWF | Kind | Id | Export name | Format | Rate | Channels | Seconds | Loops | Started at |",
    "|---|---|---|---|---|---|---|---|---|---|",
  );
  for (const r of rows) {
    out.push(
      `| ${r.swf} | ${r.kind} | ${r.id} | ${r.exportName} | ${md(r.format)} | ${r.rate} | ${r.channels} | ${r.seconds.toFixed(2)} | ${md(r.loops)} | ${md(r.usedAt)} |`,
    );
  }
  out.push(
    "",
    `Total sounds: ${rows.length} in ${new Set(rows.map((r) => r.swf)).size} files.`,
    "",
  );
  out.push("## Export names", "");
  for (const [f, names] of exportsByFile) if (names.length) out.push(`- ${f}: ${names.join(", ")}`);
  out.push(
    "",
    "## Script references (welcome.swf)",
    "",
    "Sound calls found in the decompiled ActionScript. The second argument of `start()` is the loop count.",
    "",
    "```actionscript",
    ...scriptRefs,
    "```",
    "",
  );
  return out.join("\n");
}

export function structureDoc(swf: Swf, fileName: string): string {
  // Frame labels and named instances: a map of the movie for people rebuilding the UI.
  const out: string[] = [`# ${fileName}: structure`, ""];
  out.push("Root timeline frame labels (1-based) and the sprites each screen places.", "");
  swf.root.frames.forEach((f, i) => {
    if (f.label) out.push(`- frame ${i + 1}: \`${f.label}\``);
  });
  out.push("", "## Sprites with frame labels", "");
  for (const [id, ch] of [...swf.characters].sort((a, b) => a[0] - b[0])) {
    if (ch.type !== "sprite") continue;
    const labels = ch.timeline.frames
      .map((f, i) => (f.label ? `${i + 1}:${f.label}` : ""))
      .filter(Boolean);
    if (labels.length)
      out.push(`- sprite ${id} (${ch.timeline.frames.length} frames): ${labels.join(", ")}`);
  }
  out.push("");
  return out.join("\n");
}
