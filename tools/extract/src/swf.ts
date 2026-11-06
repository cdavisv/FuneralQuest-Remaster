import { inflateSync } from "node:zlib";
import { latin1, Reader } from "./reader.js";
import type {
  BitmapDef,
  ButtonAction,
  ButtonRecord,
  Character,
  ClipAction,
  Cmd,
  Color,
  CXForm,
  EditTextDef,
  FillStyle,
  FontDef,
  FrameData,
  GradStop,
  LineStyle,
  Matrix,
  MorphDef,
  Rect,
  ShapeDef,
  ShapeRec,
  SoundDef,
  StartSound,
  StaticTextRun,
  StreamHead,
  SwfHeader,
  TimelineData,
} from "./types.js";

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
export const ID_CX: CXForm = { mul: [256, 256, 256, 256], add: [0, 0, 0, 0] };

export const TAG = {
  End: 0,
  ShowFrame: 1,
  DefineShape: 2,
  PlaceObject: 4,
  RemoveObject: 5,
  DefineBits: 6,
  DefineButton: 7,
  JPEGTables: 8,
  SetBackgroundColor: 9,
  DefineFont: 10,
  DefineText: 11,
  DoAction: 12,
  DefineFontInfo: 13,
  DefineSound: 14,
  StartSound: 15,
  DefineButtonSound: 17,
  SoundStreamHead: 18,
  SoundStreamBlock: 19,
  DefineBitsLossless: 20,
  DefineBitsJPEG2: 21,
  DefineShape2: 22,
  DefineButtonCxform: 23,
  PlaceObject2: 26,
  RemoveObject2: 28,
  DefineShape3: 32,
  DefineText2: 33,
  DefineButton2: 34,
  DefineBitsJPEG3: 35,
  DefineBitsLossless2: 36,
  DefineEditText: 37,
  DefineSprite: 39,
  FrameLabel: 43,
  SoundStreamHead2: 45,
  DefineMorphShape: 46,
  DefineFont2: 48,
  ExportAssets: 56,
  ImportAssets: 57,
  DoInitAction: 59,
} as const;

export interface RawTag {
  code: number;
  data: Uint8Array;
}

export interface ActionBlock {
  /** Where the code lives, for the decompiler listing. */
  where: string;
  code: Uint8Array;
}

export interface SoundUse {
  /** Description of where the sound is started. */
  where: string;
  soundId: number;
  loops: number | undefined;
  stop: boolean;
  inPoint: number | undefined;
  outPoint: number | undefined;
}

export interface StreamInfo {
  head: StreamHead;
  blocks: number;
  /** Total samples across all blocks (per channel). */
  samples: number;
  bytes: number;
  firstFrame: number;
  lastFrame: number;
}

export interface Swf {
  header: SwfHeader;
  background: Color;
  characters: Map<number, Character>;
  fonts: Map<number, FontDef>;
  root: TimelineData;
  exports: { id: number; name: string }[];
  imports: { id: number; name: string }[];
  jpegTables: Uint8Array | undefined;
  initActions: { spriteId: number; code: Uint8Array }[];
  soundUses: SoundUse[];
  buttonSounds: { buttonId: number; sounds: { state: number; soundId: number }[] }[];
  streams: StreamInfo[];
  /** Tag codes seen anywhere, with counts, for diagnostics. */
  tagCounts: Map<number, number>;
}

export class SwfError extends Error {}

export function parseHeader(file: Uint8Array): {
  header: SwfHeader;
  body: Uint8Array;
  bodyStart: number;
} {
  const sig = latin1(file.subarray(0, 3));
  if (sig !== "FWS" && sig !== "CWS")
    throw new SwfError(`not an SWF (signature ${JSON.stringify(sig)})`);
  const version = file[3] ?? 0;
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const fileLength = dv.getUint32(4, true);
  let body: Uint8Array;
  if (sig === "CWS") {
    body = new Uint8Array(inflateSync(file.subarray(8)));
  } else {
    body = file.subarray(8);
  }
  const r = new Reader(body);
  const frameSize = readRect(r);
  r.align();
  const fr = r.u16();
  const frameRate = fr / 256;
  const frameCount = r.u16();
  return {
    header: { signature: sig, version, fileLength, frameSize, frameRate, frameCount },
    body,
    bodyStart: r.pos,
  };
}

export function readTags(buf: Uint8Array, start: number, end: number): RawTag[] {
  const tags: RawTag[] = [];
  let p = start;
  while (p + 2 <= end) {
    const h = (buf[p] ?? 0) | ((buf[p + 1] ?? 0) << 8);
    p += 2;
    const code = h >> 6;
    let len = h & 63;
    if (len === 63) {
      len = new DataView(buf.buffer, buf.byteOffset + p, 4).getUint32(0, true);
      p += 4;
    }
    if (p + len > end) throw new SwfError(`tag ${code} overruns the file (len ${len} at ${p})`);
    tags.push({ code, data: buf.subarray(p, p + len) });
    p += len;
    if (code === 0) break;
  }
  return tags;
}

export function readRect(r: Reader): Rect {
  const n = r.ub(5);
  const xMin = r.sb(n);
  const xMax = r.sb(n);
  const yMin = r.sb(n);
  const yMax = r.sb(n);
  r.align();
  return { xMin, xMax, yMin, yMax };
}

export function readMatrix(r: Reader): Matrix {
  let a = 1;
  let d = 1;
  let b = 0;
  let c = 0;
  if (r.ub(1)) {
    const n = r.ub(5);
    a = r.fb(n);
    d = r.fb(n);
  }
  if (r.ub(1)) {
    const n = r.ub(5);
    b = r.fb(n);
    c = r.fb(n);
  }
  const n = r.ub(5);
  const tx = r.sb(n);
  const ty = r.sb(n);
  r.align();
  return [a, b, c, d, tx, ty];
}

export function readCXForm(r: Reader, alpha: boolean): CXForm {
  const hasAdd = r.ub(1);
  const hasMul = r.ub(1);
  const n = r.ub(4);
  const mul: [number, number, number, number] = [256, 256, 256, 256];
  const add: [number, number, number, number] = [0, 0, 0, 0];
  const k = alpha ? 4 : 3;
  if (hasMul) for (let i = 0; i < k; i++) mul[i] = r.sb(n);
  if (hasAdd) for (let i = 0; i < k; i++) add[i] = r.sb(n);
  r.align();
  return { mul, add };
}

function readColor(r: Reader, alpha: boolean): Color {
  const R = r.u8();
  const G = r.u8();
  const B = r.u8();
  const A = alpha ? r.u8() : 255;
  return { r: R, g: G, b: B, a: A };
}

function readStyles(r: Reader, shapeType: number): { fills: FillStyle[]; lines: LineStyle[] } {
  const alpha = shapeType === 3;
  let n = r.u8();
  if (n === 0xff && shapeType >= 2) n = r.u16();
  const fills: FillStyle[] = [];
  for (let i = 0; i < n; i++) {
    const t = r.u8();
    if (t === 0) fills.push({ type: "solid", color: readColor(r, alpha) });
    else if (t === 0x10 || t === 0x12) {
      const matrix = readMatrix(r);
      const ng = r.u8() & 15;
      const stops: GradStop[] = [];
      for (let k = 0; k < ng; k++) {
        const ratio = r.u8();
        stops.push({ ratio, color: readColor(r, alpha) });
      }
      fills.push({ type: "grad", radial: t === 0x12, matrix, stops });
    } else if (t >= 0x40 && t <= 0x43) {
      const id = r.u16();
      const matrix = readMatrix(r);
      fills.push({ type: "bitmap", id, matrix, clipped: t === 0x41 || t === 0x43 });
    } else {
      throw new SwfError(`unsupported fill style type 0x${t.toString(16)}`);
    }
  }
  let m = r.u8();
  if (m === 0xff && shapeType >= 2) m = r.u16();
  const lines: LineStyle[] = [];
  for (let i = 0; i < m; i++) {
    const width = r.u16();
    lines.push({ width, color: readColor(r, alpha) });
  }
  return { fills, lines };
}

function readShapeRecs(
  r: Reader,
  fillBits: number,
  lineBits: number,
  shapeType: number,
): ShapeRec[] {
  const recs: ShapeRec[] = [];
  for (;;) {
    if (r.ub(1) === 0) {
      const flags = r.ub(5);
      if (flags === 0) break;
      const rec: ShapeRec = { k: "style" };
      if (flags & 1) {
        const n = r.ub(5);
        rec.moveTo = [r.sb(n), r.sb(n)];
      }
      if (flags & 2) rec.f0 = r.ub(fillBits);
      if (flags & 4) rec.f1 = r.ub(fillBits);
      if (flags & 8) rec.ln = r.ub(lineBits);
      if (flags & 16) {
        r.align();
        rec.newStyles = readStyles(r, shapeType);
        fillBits = r.ub(4);
        lineBits = r.ub(4);
      }
      recs.push(rec);
    } else if (r.ub(1)) {
      const n = r.ub(4) + 2;
      const general = r.ub(1) === 1;
      const vertical = general ? false : r.ub(1) === 1;
      if (general) {
        const dx = r.sb(n);
        recs.push({ k: "line", dx, dy: r.sb(n) });
      } else if (vertical) {
        recs.push({ k: "line", dx: 0, dy: r.sb(n) });
      } else {
        recs.push({ k: "line", dx: r.sb(n), dy: 0 });
      }
    } else {
      const n = r.ub(4) + 2;
      const cx = r.sb(n);
      const cy = r.sb(n);
      const ax = r.sb(n);
      recs.push({ k: "curve", cx, cy, ax, ay: r.sb(n) });
    }
  }
  r.align();
  return recs;
}

function parseShape(data: Uint8Array, shapeType: number): { id: number; def: ShapeDef } {
  const r = new Reader(data);
  const id = r.u16();
  const bounds = readRect(r);
  const { fills, lines } = readStyles(r, shapeType);
  const fb = r.ub(4);
  const lb = r.ub(4);
  const recs = readShapeRecs(r, fb, lb, shapeType);
  return { id, def: { bounds, fills, lines, recs } };
}

function parseMorph(data: Uint8Array): { id: number; def: MorphDef } {
  const r = new Reader(data);
  const id = r.u16();
  const startBounds = readRect(r);
  const endBounds = readRect(r);
  const offset = r.u32();
  const edgesStart = r.pos + offset;
  let n = r.u8();
  if (n === 0xff) n = r.u16();
  const fills: [FillStyle, FillStyle][] = [];
  for (let i = 0; i < n; i++) {
    const t = r.u8();
    if (t === 0) {
      const a = readColor(r, true);
      const b = readColor(r, true);
      fills.push([
        { type: "solid", color: a },
        { type: "solid", color: b },
      ]);
    } else if (t === 0x10 || t === 0x12) {
      const m0 = readMatrix(r);
      const m1 = readMatrix(r);
      const ng = r.u8() & 15;
      const s0: GradStop[] = [];
      const s1: GradStop[] = [];
      for (let k = 0; k < ng; k++) {
        const r0 = r.u8();
        const c0 = readColor(r, true);
        const r1 = r.u8();
        const c1 = readColor(r, true);
        s0.push({ ratio: r0, color: c0 });
        s1.push({ ratio: r1, color: c1 });
      }
      fills.push([
        { type: "grad", radial: t === 0x12, matrix: m0, stops: s0 },
        { type: "grad", radial: t === 0x12, matrix: m1, stops: s1 },
      ]);
    } else if (t >= 0x40 && t <= 0x43) {
      const bid = r.u16();
      const m0 = readMatrix(r);
      const m1 = readMatrix(r);
      const clipped = t === 0x41 || t === 0x43;
      fills.push([
        { type: "bitmap", id: bid, matrix: m0, clipped },
        { type: "bitmap", id: bid, matrix: m1, clipped },
      ]);
    } else throw new SwfError(`unsupported morph fill style 0x${t.toString(16)}`);
  }
  let m = r.u8();
  if (m === 0xff) m = r.u16();
  const lines: [LineStyle, LineStyle][] = [];
  for (let i = 0; i < m; i++) {
    const w0 = r.u16();
    const w1 = r.u16();
    const c0 = readColor(r, true);
    const c1 = readColor(r, true);
    lines.push([
      { width: w0, color: c0 },
      { width: w1, color: c1 },
    ]);
  }
  const fb = r.ub(4);
  const lb = r.ub(4);
  const start = readShapeRecs(r, fb, lb, 3);
  r.pos = edgesStart;
  const fb2 = r.ub(4);
  const lb2 = r.ub(4);
  const end = readShapeRecs(r, fb2, lb2, 3);
  return { id, def: { startBounds, endBounds, fills, lines, start, end } };
}

function parseGlyph(data: Uint8Array): ShapeDef {
  const r = new Reader(data);
  const fb = r.ub(4);
  const lb = r.ub(4);
  const recs = readShapeRecs(r, fb, lb, 1);
  return {
    bounds: { xMin: 0, xMax: 0, yMin: 0, yMax: 0 },
    fills: [{ type: "solid", color: { r: 0, g: 0, b: 0, a: 255 } }],
    lines: [],
    recs,
  };
}

function parseFont1(data: Uint8Array): FontDef {
  const r = new Reader(data);
  const id = r.u16();
  const first = r.u16();
  const n = first / 2;
  const offs: number[] = [first];
  for (let i = 1; i < n; i++) offs.push(r.u16());
  offs.push(data.length - 2);
  const glyphs: ShapeDef[] = [];
  for (let i = 0; i < n; i++) {
    glyphs.push(parseGlyph(data.subarray(2 + (offs[i] ?? 0), 2 + (offs[i + 1] ?? 0))));
  }
  return { id, name: "", glyphs, codes: [], bold: false, italic: false, kind: "DefineFont" };
}

function parseFont2(data: Uint8Array, tag: number): FontDef {
  const r = new Reader(data);
  const id = r.u16();
  const flags = r.u8();
  r.u8(); // language code
  const nameLen = r.u8();
  const name = latin1(r.bytes(nameLen));
  const ng = r.u16();
  const wide = (flags & 8) !== 0;
  const offs: number[] = [];
  for (let i = 0; i <= ng; i++) offs.push(wide ? r.u32() : r.u16());
  const base = r.pos - (ng + 1) * (wide ? 4 : 2);
  const glyphs: ShapeDef[] = [];
  for (let i = 0; i < ng; i++) {
    glyphs.push(parseGlyph(data.subarray(base + (offs[i] ?? 0), base + (offs[i + 1] ?? 0))));
  }
  const codes: number[] = [];
  if (ng > 0) {
    r.pos = base + (offs[ng] ?? 0);
    const wideCodes = (flags & 4) !== 0 || tag === 75;
    for (let i = 0; i < ng; i++) codes.push(wideCodes ? r.u16() : r.u8());
  }
  return {
    id,
    name,
    glyphs,
    codes,
    bold: (flags & 1) !== 0,
    italic: (flags & 2) !== 0,
    kind: "DefineFont2",
  };
}

function parseText(data: Uint8Array, tag: number) {
  const r = new Reader(data);
  const id = r.u16();
  const bounds = readRect(r);
  const matrix = readMatrix(r);
  const gb = r.u8();
  const ab = r.u8();
  const runs: StaticTextRun[] = [];
  for (;;) {
    const fl = r.u8();
    if (fl === 0) break;
    if (!(fl & 0x80)) throw new SwfError("text record without style bit");
    const run: StaticTextRun = { glyphs: [] };
    if (fl & 8) run.fontId = r.u16();
    if (fl & 4) run.color = readColor(r, tag === TAG.DefineText2);
    if (fl & 1) run.x = r.s16();
    if (fl & 2) run.y = r.s16();
    if (fl & 8) run.height = r.u16();
    const count = r.u8();
    for (let i = 0; i < count; i++) {
      const index = r.ub(gb);
      const advance = r.sb(ab);
      run.glyphs.push({ index, advance });
    }
    r.align();
    runs.push(run);
  }
  return { id, bounds, matrix, runs };
}

function parseEditText(data: Uint8Array): { id: number; def: EditTextDef } {
  const r = new Reader(data);
  const id = r.u16();
  const bounds = readRect(r);
  const flags1 = r.u8();
  const flags2 = r.u8();
  const def: EditTextDef = { bounds, flags1, flags2, variable: "" };
  if (flags1 & 1) def.fontId = r.u16();
  if (flags1 & 1) def.fontHeight = r.u16();
  if (flags1 & 4) def.color = readColor(r, true);
  if (flags1 & 2) def.maxLength = r.u16();
  if (flags2 & 0x20) {
    def.align = r.u8();
    def.leftMargin = r.u16();
    def.rightMargin = r.u16();
    def.indent = r.u16();
    def.leading = r.s16();
  }
  def.variable = r.cstring();
  if (flags1 & 0x80) def.text = r.cstring();
  return { id, def };
}

function parseButton(data: Uint8Array, tag: number): Character {
  const r = new Reader(data);
  const id = r.u16();
  const records: ButtonRecord[] = [];
  const actions: ButtonAction[] = [];
  if (tag === TAG.DefineButton) {
    for (;;) {
      const states = r.u8();
      if (states === 0) break;
      const charId = r.u16();
      const depth = r.u16();
      records.push({ states, charId, depth, matrix: readMatrix(r) });
    }
    actions.push({ cond: 0x0008, code: r.rest() });
  } else {
    r.u8(); // flags (track as menu)
    const actionOffset = r.u16();
    const actionsStart = r.pos - 2 + actionOffset;
    for (;;) {
      const states = r.u8();
      if (states === 0) break;
      const charId = r.u16();
      const depth = r.u16();
      const matrix = readMatrix(r);
      const cx = readCXForm(r, true);
      records.push({ states, charId, depth, matrix, cx });
    }
    if (actionOffset !== 0) {
      let p = actionsStart;
      for (;;) {
        const size = (data[p] ?? 0) | ((data[p + 1] ?? 0) << 8);
        const cond = (data[p + 2] ?? 0) | ((data[p + 3] ?? 0) << 8);
        const end = size === 0 ? data.length : p + size;
        actions.push({ cond, code: data.subarray(p + 4, end) });
        if (size === 0) break;
        p += size;
      }
    }
  }
  return { type: "button", id, records, actions };
}

/** Scan JPEG markers for the frame size. */
export function jpegSize(d: Uint8Array): { width: number; height: number } {
  let p = 2;
  while (p + 9 < d.length) {
    if (d[p] !== 0xff) {
      p++;
      continue;
    }
    const m = d[p + 1] ?? 0;
    if (m === 0xff) {
      p++;
      continue;
    }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      p += 2;
      continue;
    }
    const len = ((d[p + 2] ?? 0) << 8) | (d[p + 3] ?? 0);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return {
        height: ((d[p + 5] ?? 0) << 8) | (d[p + 6] ?? 0),
        width: ((d[p + 7] ?? 0) << 8) | (d[p + 8] ?? 0),
      };
    }
    p += 2 + len;
  }
  throw new SwfError("JPEG without SOF marker");
}

function stripJpegGarbage(d: Uint8Array): Uint8Array {
  // Old Flash wrote an erroneous EOI+SOI pair at the start of image data.
  let s = d;
  while (s.length > 4 && s[0] === 0xff && s[1] === 0xd9 && s[2] === 0xff && s[3] === 0xd8) {
    s = s.subarray(4);
  }
  return s;
}

function parseJpeg(tag: number, data: Uint8Array, tables: Uint8Array | undefined): BitmapDef {
  const r = new Reader(data);
  const id = r.u16();
  let jpeg: Uint8Array;
  let alpha: Uint8Array | undefined;
  if (tag === TAG.DefineBits) {
    const img = stripJpegGarbage(r.rest());
    const t = tables ? stripJpegGarbage(tables) : new Uint8Array();
    const tEnd =
      t.length >= 2 && t[t.length - 2] === 0xff && t[t.length - 1] === 0xd9
        ? t.length - 2
        : t.length;
    const iStart = img[0] === 0xff && img[1] === 0xd8 ? 2 : 0;
    jpeg = new Uint8Array(tEnd + img.length - iStart);
    jpeg.set(t.subarray(0, tEnd), 0);
    jpeg.set(img.subarray(iStart), tEnd);
  } else if (tag === TAG.DefineBitsJPEG2) {
    jpeg = stripJpegGarbage(r.rest());
  } else {
    const off = r.u32();
    const start = r.pos;
    jpeg = stripJpegGarbage(data.subarray(start, start + off));
    const z = data.subarray(start + off);
    if (z.length) alpha = new Uint8Array(inflateSync(z));
  }
  const { width, height } = jpegSize(jpeg);
  const def: BitmapDef = {
    id,
    kind: "jpeg",
    data: jpeg,
    width,
    height,
    hasAlpha: alpha !== undefined,
    tag,
  };
  if (alpha) def.alpha = alpha;
  return def;
}

function parseLossless(tag: number, data: Uint8Array): BitmapDef {
  const r = new Reader(data);
  const id = r.u16();
  const format = r.u8();
  const width = r.u16();
  const height = r.u16();
  let paletteSize: number | undefined;
  if (format === 3) paletteSize = r.u8();
  const raw = new Uint8Array(inflateSync(r.rest()));
  const def: BitmapDef = {
    id,
    kind: "lossless",
    data: raw,
    width,
    height,
    format,
    hasAlpha: tag === TAG.DefineBitsLossless2,
    tag,
  };
  if (paletteSize !== undefined) def.paletteSize = paletteSize;
  return def;
}

const SOUND_FORMATS = [
  "uncompressed (native endian)",
  "ADPCM",
  "MP3",
  "uncompressed (little endian)",
  "",
  "Nellymoser 8 kHz",
  "Nellymoser",
];
const RATES = [5512.5, 11025, 22050, 44100];

function parseSound(data: Uint8Array): SoundDef {
  const r = new Reader(data);
  const id = r.u16();
  const format = r.ub(4);
  const rate = RATES[r.ub(2)] ?? 0;
  const sampleBits = r.ub(1) ? 16 : 8;
  const stereo = r.ub(1) === 1;
  const sampleCount = r.u32();
  return {
    id,
    format,
    formatName: SOUND_FORMATS[format] || `format ${format}`,
    rate,
    sampleBits,
    stereo,
    sampleCount,
    bytes: data.length - 7,
  };
}

function parseStreamHead(data: Uint8Array): StreamHead {
  const r = new Reader(data);
  r.ub(4);
  const playbackRate = RATES[r.ub(2)] ?? 0;
  r.ub(2);
  r.u8();
  const format = r.ub(4);
  const streamRate = RATES[r.ub(2)] ?? 0;
  r.ub(1);
  const stereo = r.ub(1) === 1;
  const samplesPerBlock = r.u16();
  return {
    format,
    formatName: SOUND_FORMATS[format] || `format ${format}`,
    playbackRate,
    streamRate,
    stereo,
    samplesPerBlock,
  };
}

function readSoundInfo(r: Reader): Omit<StartSound, "soundId"> {
  const f = r.u8();
  const info: Omit<StartSound, "soundId"> = {
    loops: undefined,
    hasInPoint: (f & 1) !== 0,
    hasOutPoint: (f & 2) !== 0,
    inPoint: undefined,
    outPoint: undefined,
    stop: (f & 0x20) !== 0,
    noMultiple: (f & 0x10) !== 0,
  };
  if (f & 1) info.inPoint = r.u32();
  if (f & 2) info.outPoint = r.u32();
  if (f & 4) info.loops = r.u16();
  if (f & 8) {
    const n = r.u8();
    for (let i = 0; i < n; i++) {
      r.u32();
      r.u16();
      r.u16();
    }
  }
  return info;
}

function parsePlace(data: Uint8Array, tag: number, version: number): Cmd {
  const r = new Reader(data);
  if (tag === TAG.PlaceObject) {
    const charId = r.u16();
    const depth = r.u16();
    const matrix = readMatrix(r);
    const cmd: Cmd = { op: "place", depth, move: false, charId, matrix };
    if (r.pos < data.length) cmd.cx = readCXForm(r, false);
    return cmd;
  }
  const f = r.u8();
  const depth = r.u16();
  const cmd: Cmd = { op: "place", depth, move: (f & 1) !== 0 };
  if (f & 2) cmd.charId = r.u16();
  if (f & 4) cmd.matrix = readMatrix(r);
  if (f & 8) cmd.cx = readCXForm(r, true);
  if (f & 0x10) cmd.ratio = r.u16();
  if (f & 0x20) cmd.name = r.cstring();
  if (f & 0x40) cmd.clipDepth = r.u16();
  if (f & 0x80) {
    r.u16();
    if (version >= 6) r.u32();
    else r.u16();
    const actions: ClipAction[] = [];
    const names = [
      "load",
      "enterFrame",
      "unload",
      "mouseMove",
      "mouseDown",
      "mouseUp",
      "keyDown",
      "keyUp",
      "data",
    ];
    for (;;) {
      const flags = version >= 6 ? r.u32() : r.u16();
      if (flags === 0) break;
      const size = r.u32();
      let key = 0;
      let len = size;
      if (version >= 6 && flags & 0x20000) {
        key = r.u8();
        len -= 1;
      }
      const code = r.bytes(len);
      const events: string[] = [];
      names.forEach((n, i) => {
        if (flags & (1 << i)) events.push(n);
      });
      if (key) events.push(`keyPress ${key}`);
      actions.push({ events, code });
    }
    cmd.clipActions = actions;
  }
  return cmd;
}

interface Ctx {
  swf: Swf;
  version: number;
  /** Frame indexes for sound inventory. */
  where: string;
}

function buildTimeline(tags: RawTag[], ctx: Ctx, spriteId: number | undefined): TimelineData {
  const frames: FrameData[] = [];
  let cur: FrameData = { cmds: [], actions: [], startSounds: [] };
  for (const t of tags) {
    switch (t.code) {
      case TAG.ShowFrame:
        frames.push(cur);
        cur = { cmds: [], actions: [], startSounds: [] };
        break;
      case TAG.PlaceObject:
      case TAG.PlaceObject2:
        cur.cmds.push(parsePlace(t.data, t.code, ctx.version));
        break;
      case TAG.RemoveObject:
        cur.cmds.push({ op: "remove", depth: (t.data[2] ?? 0) | ((t.data[3] ?? 0) << 8) });
        break;
      case TAG.RemoveObject2:
        cur.cmds.push({ op: "remove", depth: (t.data[0] ?? 0) | ((t.data[1] ?? 0) << 8) });
        break;
      case TAG.FrameLabel:
        cur.label = new Reader(t.data).cstring();
        break;
      case TAG.DoAction:
        cur.actions.push(t.data);
        break;
      case TAG.StartSound: {
        const r = new Reader(t.data);
        const soundId = r.u16();
        const info = { soundId, ...readSoundInfo(r) };
        cur.startSounds.push(info);
        ctx.swf.soundUses.push({
          where: `${spriteId === undefined ? "root" : `sprite ${spriteId}`} frame ${frames.length + 1}${cur.label ? ` (${cur.label})` : ""}`,
          soundId,
          loops: info.loops,
          stop: info.stop,
          inPoint: info.inPoint,
          outPoint: info.outPoint,
        });
        break;
      }
      default:
        break;
    }
  }
  return { frames };
}

export function parseSwf(file: Uint8Array): Swf {
  const { header, body, bodyStart } = parseHeader(file);
  const tags = readTags(body, bodyStart, body.length);
  const swf: Swf = {
    header,
    background: { r: 255, g: 255, b: 255, a: 255 },
    characters: new Map(),
    fonts: new Map(),
    root: { frames: [] },
    exports: [],
    imports: [],
    jpegTables: undefined,
    initActions: [],
    soundUses: [],
    buttonSounds: [],
    streams: [],
    tagCounts: new Map(),
  };
  const ctx: Ctx = { swf, version: header.version, where: "root" };
  const fontInfo: { id: number; name: string; flags: number; codes: number[] }[] = [];
  const count = (c: number) => swf.tagCounts.set(c, (swf.tagCounts.get(c) ?? 0) + 1);

  const define = (tag: RawTag, inSprite: boolean): void => {
    const d = tag.data;
    count(tag.code);
    switch (tag.code) {
      case TAG.DefineShape:
      case TAG.DefineShape2:
      case TAG.DefineShape3: {
        const type = tag.code === TAG.DefineShape ? 1 : tag.code === TAG.DefineShape2 ? 2 : 3;
        const { id, def } = parseShape(d, type);
        swf.characters.set(id, { type: "shape", id, def, tag: tag.code });
        break;
      }
      case TAG.DefineMorphShape: {
        const { id, def } = parseMorph(d);
        swf.characters.set(id, { type: "morph", id, def });
        break;
      }
      case TAG.DefineBits:
      case TAG.DefineBitsJPEG2:
      case TAG.DefineBitsJPEG3: {
        const def = parseJpeg(tag.code, d, swf.jpegTables);
        swf.characters.set(def.id, { type: "bitmap", id: def.id, def });
        break;
      }
      case TAG.DefineBitsLossless:
      case TAG.DefineBitsLossless2: {
        const def = parseLossless(tag.code, d);
        swf.characters.set(def.id, { type: "bitmap", id: def.id, def });
        break;
      }
      case TAG.DefineButton:
      case TAG.DefineButton2: {
        const c = parseButton(d, tag.code);
        swf.characters.set((c as { id: number }).id, c);
        break;
      }
      case TAG.DefineFont: {
        const f = parseFont1(d);
        swf.fonts.set(f.id, f);
        break;
      }
      case TAG.DefineFont2: {
        const f = parseFont2(d, tag.code);
        swf.fonts.set(f.id, f);
        break;
      }
      case TAG.DefineFontInfo: {
        const r = new Reader(d);
        const id = r.u16();
        const name = latin1(r.bytes(r.u8()));
        const flags = r.u8();
        const codes: number[] = [];
        while (r.pos < d.length) codes.push(flags & 1 ? r.u16() : r.u8());
        fontInfo.push({ id, name, flags, codes });
        break;
      }
      case TAG.DefineText:
      case TAG.DefineText2: {
        const t = parseText(d, tag.code);
        swf.characters.set(t.id, { type: "text", ...t });
        break;
      }
      case TAG.DefineEditText: {
        const { id, def } = parseEditText(d);
        swf.characters.set(id, { type: "edit", id, def });
        break;
      }
      case TAG.DefineSprite: {
        const id = (d[0] ?? 0) | ((d[1] ?? 0) << 8);
        const inner = readTags(d, 4, d.length);
        for (const it of inner) {
          if (
            it.code !== TAG.ShowFrame &&
            it.code !== TAG.PlaceObject &&
            it.code !== TAG.PlaceObject2 &&
            it.code !== TAG.RemoveObject &&
            it.code !== TAG.RemoveObject2 &&
            it.code !== TAG.FrameLabel &&
            it.code !== TAG.DoAction &&
            it.code !== TAG.StartSound &&
            it.code !== TAG.End &&
            it.code !== TAG.SoundStreamHead &&
            it.code !== TAG.SoundStreamHead2 &&
            it.code !== TAG.SoundStreamBlock
          ) {
            throw new SwfError(`unexpected tag ${it.code} inside sprite ${id}`);
          }
          count(1000 + it.code);
        }
        swf.characters.set(id, { type: "sprite", id, timeline: buildTimeline(inner, ctx, id) });
        break;
      }
      case TAG.DefineSound: {
        const def = parseSound(d);
        swf.characters.set(def.id, { type: "sound", id: def.id, def });
        break;
      }
      case TAG.DefineButtonSound: {
        const r = new Reader(d);
        const buttonId = r.u16();
        const sounds: { state: number; soundId: number }[] = [];
        for (let st = 0; st < 4; st++) {
          const soundId = r.u16();
          if (soundId) {
            readSoundInfo(r);
            sounds.push({ state: st, soundId });
          }
        }
        swf.buttonSounds.push({ buttonId, sounds });
        break;
      }
      default:
        break;
    }
    void inSprite;
  };

  let rootFrame = 0;
  const rootTags: RawTag[] = [];
  for (const t of tags) {
    switch (t.code) {
      case TAG.SetBackgroundColor:
        swf.background = { r: t.data[0] ?? 0, g: t.data[1] ?? 0, b: t.data[2] ?? 0, a: 255 };
        break;
      case TAG.JPEGTables:
        swf.jpegTables = t.data;
        break;
      case TAG.ExportAssets: {
        const r = new Reader(t.data);
        const n = r.u16();
        for (let i = 0; i < n; i++) {
          const id = r.u16();
          swf.exports.push({ id, name: r.cstring() });
        }
        break;
      }
      case TAG.ImportAssets: {
        const r = new Reader(t.data);
        r.cstring();
        const n = r.u16();
        for (let i = 0; i < n; i++) {
          const id = r.u16();
          swf.imports.push({ id, name: r.cstring() });
        }
        break;
      }
      case TAG.DoInitAction:
        swf.initActions.push({
          spriteId: (t.data[0] ?? 0) | ((t.data[1] ?? 0) << 8),
          code: t.data.subarray(2),
        });
        break;
      case TAG.SoundStreamHead:
      case TAG.SoundStreamHead2:
        swf.streams.push({
          head: parseStreamHead(t.data),
          blocks: 0,
          samples: 0,
          bytes: 0,
          firstFrame: rootFrame + 1,
          lastFrame: rootFrame + 1,
        });
        break;
      case TAG.SoundStreamBlock: {
        const s = swf.streams[swf.streams.length - 1];
        if (s) {
          s.blocks++;
          s.bytes += t.data.length;
          s.samples +=
            s.head.format === 2
              ? (t.data[0] ?? 0) | ((t.data[1] ?? 0) << 8)
              : s.head.samplesPerBlock;
          s.lastFrame = rootFrame + 1;
        }
        break;
      }
      case TAG.ShowFrame:
        rootFrame++;
        break;
      default:
        break;
    }
    define(t, false);
    rootTags.push(t);
  }
  // Attach font info (codes) to DefineFont fonts.
  for (const fi of fontInfo) {
    const f = swf.fonts.get(fi.id);
    if (f) {
      f.name = fi.name;
      f.codes = fi.codes;
      f.bold = (fi.flags & 1) !== 0;
      f.italic = (fi.flags & 2) !== 0;
    }
  }
  swf.root = buildTimeline(rootTags, ctx, undefined);
  return swf;
}
