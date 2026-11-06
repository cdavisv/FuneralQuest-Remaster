import { decompile } from "./as1.js";
import { optimizeSvg } from "./optimize.js";
import { type Box, Renderer, type RenderResult, svgDocument } from "./render.js";
import type { Swf } from "./swf.js";
import { displayAt } from "./timeline.js";
import type { Matrix } from "./types.js";

/** Where a named UI piece comes from inside welcome.swf. */
export interface PieceSpec {
  /** File name under assets/classic/ui/, no extension. */
  name: string;
  kind: "shape" | "sprite" | "button";
  id: number;
  /** Frame label or 0-based index (sprites only). */
  frame?: string | number;
  /** Instance names to leave out. */
  hide?: string[];
  /** Character ids to leave out where nested. */
  hideChars?: number[];
  /** What the piece is and how the original game used it. */
  note: string;
}

const BUILDING_BUTTONS = [287, 293, 302, 309, 316, 320, 324, 328, 335];

/**
 * Named reusable pieces. Identified by rendering every character and reading the button
 * actions in the decompiled ActionScript (for example the nine map buttons call
 * contact_server(c_request_bank), ..._store, and so on).
 */
export const PIECES: PieceSpec[] = [
  { name: "logo", kind: "shape", id: 8, note: "Funeral Quest title lettering." },
  {
    name: "loader-bar",
    kind: "sprite",
    id: 7,
    note: "Yellow progress bar; its _xscale is set from frames loaded.",
  },
  {
    name: "cabinet",
    kind: "shape",
    id: 121,
    note: "Wooden arched cabinet frame that every main screen is built on.",
  },
  {
    name: "cabinet-main",
    kind: "sprite",
    id: 450,
    note: "m_main: cabinet with stats parchment, picture frame, text well and the capsule buttons (frame f_start).",
  },
  {
    name: "cabinet-generic",
    kind: "sprite",
    id: 374,
    note: "i_generic: cabinet with five plaque choice buttons, scrolling text and picture slot.",
  },
  {
    name: "cabinet-view",
    kind: "sprite",
    id: 380,
    note: "i_view: cabinet used for look/inventory text with plaque buttons.",
  },
  {
    name: "parchment-note",
    kind: "shape",
    id: 123,
    note: "Curled parchment used for the stats sheet.",
  },
  {
    name: "message-note",
    kind: "sprite",
    id: 88,
    note: "m_error: parchment note with '(click to close window)' and the round arrow button.",
  },
  {
    name: "picture-frame",
    kind: "sprite",
    id: 343,
    note: "Wooden frame with a black window; the game loads picture SWFs into it.",
  },
  {
    name: "plaque-button",
    kind: "button",
    id: 55,
    note: "Empty brass plaque button (text is an overlay).",
  },
  {
    name: "plaque-button-logon",
    kind: "button",
    id: 50,
    note: "LOGON plaque button of the login screen.",
  },
  {
    name: "plaque-button-new-user",
    kind: "button",
    id: 47,
    note: "NEW USER plaque button of the login screen.",
  },
  {
    name: "scroll-capsule",
    kind: "sprite",
    id: 426,
    note: "m_buttons: brass capsule with the five round icon buttons and a 'Wait for customers' scroll.",
  },
  {
    name: "scroll-capsule-alt",
    kind: "sprite",
    id: 427,
    note: "Second state of the capsule (same layout).",
  },
  {
    name: "capsule-button-mail",
    kind: "button",
    id: 396,
    note: "Mail icon button: writes a letter to another player.",
  },
  {
    name: "capsule-button-map",
    kind: "button",
    id: 401,
    note: "Scroll icon button: opens the Deathville map (c_request_map).",
  },
  {
    name: "capsule-button-news",
    kind: "button",
    id: 407,
    note: "Open book icon button: opens the newspaper (c_request_news).",
  },
  {
    name: "capsule-button-stats",
    kind: "button",
    id: 418,
    note: "Money bag icon button: stats screen (command 3).",
  },
  {
    name: "capsule-button-rankings",
    kind: "button",
    id: 425,
    note: "Ribbon icon button: rankings (c_request_ranking).",
  },
  {
    name: "capsule-button-wait",
    kind: "button",
    id: 412,
    note: "'Wait for customers' scroll button (command 2).",
  },
  { name: "button-exit", kind: "button", id: 390, note: "Copper Exit button on the main cabinet." },
  {
    name: "button-arrow-next",
    kind: "button",
    id: 65,
    note: "Round grey arrow button (continue).",
  },
  {
    name: "button-scroll-down",
    kind: "button",
    id: 357,
    note: "Brass down arrow that scrolls the text well.",
  },
  {
    name: "button-scroll-up",
    kind: "button",
    id: 358,
    note: "Brass up arrow that scrolls the text well.",
  },
  { name: "coffin-tag-wood", kind: "shape", id: 176, note: "Wooden casket tag icon." },
  { name: "coffin-tag-gold", kind: "shape", id: 177, note: "Gold casket tag icon." },
  { name: "coffin-tag-silver", kind: "shape", id: 178, note: "Silver casket tag icon." },
  {
    name: "coffin-tags",
    kind: "sprite",
    id: 372,
    note: "i_tags: the three casket tag icons with their counts (text field placeholders).",
  },
  {
    name: "deathville-map",
    kind: "sprite",
    id: 337,
    note: "i_map: the Deathville map with all nine building buttons (frame f_start).",
  },
  {
    name: "deathville-map-base",
    kind: "sprite",
    id: 337,
    hideChars: BUILDING_BUTTONS,
    note: "The map without the building buttons: roads, grass, graveyard and the map caption.",
  },
  {
    name: "building-bank",
    kind: "button",
    id: 287,
    note: "Map building: Bank (contact_server c_request_bank).",
  },
  {
    name: "building-store",
    kind: "button",
    id: 293,
    note: "Map building: Di-Mart store (c_request_store).",
  },
  {
    name: "building-cafe",
    kind: "button",
    id: 302,
    note: "Map building: Pale Horse Cafe, the chat room (c_request_chat_start).",
  },
  {
    name: "building-yangs",
    kind: "button",
    id: 309,
    note: "Map building: Yang's Chinese restaurant (c_request_yangs).",
  },
  {
    name: "building-competitors",
    kind: "button",
    id: 316,
    note: "Map building: row of houses, visits other players' parlors (c_request_comp).",
  },
  {
    name: "building-funeral-home",
    kind: "button",
    id: 320,
    note: "Map building: your own funeral home (c_request_main).",
  },
  {
    name: "building-church",
    kind: "button",
    id: 324,
    note: "Map building: the church (runs script church.c).",
  },
  {
    name: "building-hospital",
    kind: "button",
    id: 328,
    note: "Map building: hospital (c_request_hospital).",
  },
  {
    name: "building-spirit-university",
    kind: "button",
    id: 335,
    note: "Map building: Spirit University (c_request_spirit).",
  },
  {
    name: "newspaper",
    kind: "sprite",
    id: 255,
    frame: 1,
    hide: ["notepad"],
    note: "m_news: the Funeral Times with page curls, tabs and the notice boards (frame f_start).",
  },
  { name: "newspaper-page", kind: "shape", id: 196, note: "Blank newsprint page." },
  {
    name: "newspaper-page-curl-back",
    kind: "sprite",
    id: 195,
    note: "Page curl that turns to the previous page.",
  },
  {
    name: "newspaper-page-curl-next",
    kind: "sprite",
    id: 207,
    note: "Page curl that turns to the next page.",
  },
  { name: "newspaper-tab-yesterday", kind: "sprite", id: 227, note: "'Yesterday' tab button." },
  { name: "newspaper-tab-today", kind: "sprite", id: 231, note: "'Today' tab button." },
  {
    name: "notepad",
    kind: "sprite",
    id: 252,
    note: "Spiral notepad used for 'Make Announcement'.",
  },
  {
    name: "notepad-dialog",
    kind: "sprite",
    id: 456,
    note: "i_mail: spiral notepad letter dialog with Cancel and Send.",
  },
  {
    name: "quill-inkwell",
    kind: "shape",
    id: 250,
    note: "Quill and ink bottle drawn on the notepad.",
  },
  {
    name: "login-plaque",
    kind: "sprite",
    id: 57,
    note: "Login plaque: name and password fields, LOGON and NEW USER buttons (frame f_start).",
  },
  {
    name: "logon-screen",
    kind: "sprite",
    id: 114,
    frame: "f_start",
    note: "i_logon: title, graveyard backdrop and login plaque.",
  },
  {
    name: "new-user-screen",
    kind: "sprite",
    id: 113,
    note: "New-user form with the clerk, name field and skull icons.",
  },
  {
    name: "new-user-clerk",
    kind: "shape",
    id: 77,
    note: "The old clerk lady who registers new undertakers.",
  },
  {
    name: "skull-female",
    kind: "shape",
    id: 69,
    note: "Female skull icon (ponytail) for choosing gender.",
  },
  { name: "skull-male", kind: "shape", id: 71, note: "Male skull icon for choosing gender." },
  {
    name: "rankings-screen",
    kind: "sprite",
    id: 276,
    note: "Rankings cabinet with the running skeleton and page arrows (frame f_start).",
  },
  {
    name: "rankings-skeleton",
    kind: "shape",
    id: 274,
    note: "Running skeleton on the rankings screen.",
  },
  { name: "status-screen", kind: "sprite", id: 185, note: "Stats cabinet shown for f_status." },
  { name: "luck-meter", kind: "sprite", id: 354, note: "Luck meter gauge (Best to Worst)." },
  {
    name: "class-mood-label",
    kind: "sprite",
    id: 448,
    note: "i_stats: 'Class' and 'Mood' readout.",
  },
  {
    name: "battle-bars",
    kind: "sprite",
    id: 368,
    note: "i_battle: your and the enemy's health bars.",
  },
  { name: "chat-screen", kind: "sprite", id: 469, note: "i_chat: Pale Horse Cafe chat cabinet." },
  { name: "dialog-message", kind: "sprite", id: 476, note: "i_error: message dialog." },
  { name: "dialog-notice", kind: "sprite", id: 483, note: "i_message: notice dialog." },
  {
    name: "dialog-text-entry",
    kind: "sprite",
    id: 492,
    note: "i_get_text: single-line text entry dialog.",
  },
  {
    name: "dialog-name-entry",
    kind: "sprite",
    id: 498,
    note: "i_getname: partial name entry dialog.",
  },
  {
    name: "dialog-yes-no",
    kind: "sprite",
    id: 508,
    note: "i_namenext: Yes/No confirmation dialog.",
  },
  { name: "error-text", kind: "sprite", id: 120, note: "f_error: link-died message text." },
];

const toRect = (b: NonNullable<RenderResult["bounds"]>, pad = 1): Box => ({
  x: Math.floor(b.x0) - pad,
  y: Math.floor(b.y0) - pad,
  w: Math.ceil(b.x1 - b.x0) + 2 * pad,
  h: Math.ceil(b.y1 - b.y0) + 2 * pad,
});

/** Sprite ids whose first frame hides the clip itself (`this._visible = false`). */
export function selfHidingSprites(swf: Swf): Set<number> {
  const out = new Set<number>();
  for (const [id, ch] of swf.characters) {
    if (ch.type !== "sprite") continue;
    for (const a of ch.timeline.frames[0]?.actions ?? []) {
      if (/^this\._visible = false;/m.test(decompile(a))) out.add(id);
    }
  }
  return out;
}

export function frameIndex(swf: Swf, id: number, frame: string | number | undefined): number {
  if (frame === undefined) return 0;
  if (typeof frame === "number") return frame;
  const ch = swf.characters.get(id);
  if (ch?.type !== "sprite") throw new Error(`character ${id} is not a sprite`);
  const i = ch.timeline.frames.findIndex((f) => f.label === frame);
  if (i < 0) throw new Error(`sprite ${id} has no frame labelled ${frame}`);
  return i;
}

export interface PieceOutput {
  spec: PieceSpec;
  svg: string;
  width: number;
  height: number;
  usesBitmaps: boolean;
  paths: number;
}

export function renderPiece(
  swf: Swf,
  spec: PieceSpec,
  hiddenSprites: Set<number>,
): PieceOutput | undefined {
  const opts = {
    hide: new Set(spec.hide ?? []),
    hideChars: new Set([...hiddenSprites, ...(spec.hideChars ?? [])].filter((i) => i !== spec.id)),
  };
  const ch = swf.characters.get(spec.id);
  if (!ch) throw new Error(`piece ${spec.name}: no character ${spec.id}`);
  if (ch.type !== spec.kind && !(ch.type === "morph" && spec.kind === "shape"))
    throw new Error(`piece ${spec.name}: character ${spec.id} is a ${ch.type}, not a ${spec.kind}`);
  const r = new Renderer(swf, opts).renderCharacter(spec.id, frameIndex(swf, spec.id, spec.frame));
  if (!r.bounds || (r.paths === 0 && !r.body)) return undefined;
  const box = toRect(r.bounds);
  const svg = optimizeSvg(svgDocument(r, box.w, box.h, { box, title: `ui/${spec.name}` }));
  return { spec, svg, width: box.w, height: box.h, usesBitmaps: r.usesBitmaps, paths: r.paths };
}

export interface ScreenOutput {
  id: string;
  label: string;
  svg: string;
  usesBitmaps: boolean;
  source: string;
}

/** Instances placed on the root timeline, with their first placement matrix. */
function rootInstances(swf: Swf): Map<string, { id: number; matrix: Matrix }> {
  const m = new Map<string, { id: number; matrix: Matrix }>();
  swf.root.frames.forEach((f, fi) => {
    for (const it of displayAt(swf.root, fi)) {
      if (it.name && !m.has(it.name) && swf.characters.get(it.charId)?.type === "sprite") {
        m.set(it.name, { id: it.charId, matrix: it.matrix });
      }
    }
    void f;
  });
  return m;
}

const safe = (s: string): string => s.replace(/[^A-Za-z0-9_-]+/g, "-");

/** Dialog and overlay instances that the ActionScript creates on demand; hidden in composed screens. */
const OVERLAYS = [
  "i_error",
  "i_message",
  "i_get_text",
  "i_getname",
  "i_namenext",
  "i_screenlock",
  "i_sender",
  "notepad",
  "m_error",
];
const MAIN_VARIANTS = ["i_map", "i_generic", "i_view", "m_main", "i_mail", "i_chat"];

export function renderScreens(swf: Swf, hiddenSprites: Set<number>): ScreenOutput[] {
  const out: ScreenOutput[] = [];
  const stage = {
    w: (swf.header.frameSize.xMax - swf.header.frameSize.xMin) / 20,
    h: (swf.header.frameSize.yMax - swf.header.frameSize.yMin) / 20,
  };
  const finish = (id: string, label: string, r: RenderResult, source: string): void => {
    if (r.paths === 0 && !r.body) return;
    const svg = optimizeSvg(
      svgDocument(r, stage.w, stage.h, { background: swf.background, title: `ui/screens/${id}` }),
    );
    out.push({ id, label, svg, usesBitmaps: r.usesBitmaps, source });
  };
  // Root frames with labels.
  swf.root.frames.forEach((f, fi) => {
    if (!f.label) return;
    const items = displayAt(swf.root, fi);
    if (items.length === 0) return;
    const names = new Set(items.map((i) => i.name).filter((n): n is string => !!n));
    if (MAIN_VARIANTS.some((n) => names.has(n))) {
      // f_main stacks every sub-screen on top of each other; show them one at a time.
      for (const only of MAIN_VARIANTS) {
        const hide = new Set([...MAIN_VARIANTS.filter((n) => n !== only), ...OVERLAYS]);
        const r = new Renderer(swf, { hide, hideChars: hiddenSprites }).renderFrame(swf.root, fi);
        finish(
          `root-${safe(f.label)}-${only.replace(/^[im]_/, "")}`,
          `${f.label}: ${only}`,
          r,
          `root frame ${fi + 1} [${f.label}], only ${only}`,
        );
      }
      return;
    }
    const r = new Renderer(swf, { hide: new Set(OVERLAYS), hideChars: hiddenSprites }).renderFrame(
      swf.root,
      fi,
    );
    finish(`root-${safe(f.label)}`, f.label, r, `root frame ${fi + 1} [${f.label}]`);
  });
  // Labelled frames of sprites that sit on the root timeline.
  for (const [name, inst] of rootInstances(swf)) {
    const ch = swf.characters.get(inst.id);
    if (ch?.type !== "sprite") continue;
    ch.timeline.frames.forEach((f, fi) => {
      if (!f.label) return;
      const hc = new Set([...hiddenSprites].filter((i) => i !== inst.id));
      const r = new Renderer(swf, { hide: new Set(OVERLAYS), hideChars: hc }).renderCharacter(
        inst.id,
        fi,
        inst.matrix,
      );
      finish(
        `${safe(name)}-${safe(f.label)}`,
        `${name}: ${f.label}`,
        r,
        `sprite ${inst.id} (${name}) frame ${fi + 1} [${f.label}]`,
      );
    });
  }
  return out;
}

/** Everything not named above, dumped by id so no art in welcome.swf is lost. */
export function renderParts(
  swf: Swf,
  named: Set<string>,
  hiddenSprites: Set<number>,
): PieceOutput[] {
  const out: PieceOutput[] = [];
  const used = new Set(PIECES.map((p) => `${p.kind}:${p.id}`));
  for (const [id, ch] of [...swf.characters].sort((a, b) => a[0] - b[0])) {
    if (ch.type !== "shape" && ch.type !== "sprite" && ch.type !== "button" && ch.type !== "morph")
      continue;
    const kind = ch.type === "morph" ? "shape" : ch.type;
    if (used.has(`${kind}:${id}`)) continue;
    const spec: PieceSpec = {
      name: `parts/${ch.type}-${String(id).padStart(3, "0")}`,
      kind,
      id,
      note: `Unnamed ${ch.type} ${id} from welcome.swf.`,
    };
    if (named.has(spec.name)) continue;
    const o = renderPiece(swf, spec, hiddenSprites);
    if (o) out.push(o);
  }
  return out;
}
