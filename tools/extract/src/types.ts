export interface Rect {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Affine matrix [a, b, c, d, tx, ty]: x' = a*x + c*y + tx, y' = b*x + d*y + ty. Units: twips. */
export type Matrix = readonly [number, number, number, number, number, number];

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Colour transform: multiply terms are 256 = 1.0; add terms are 0..255 offsets. */
export interface CXForm {
  mul: readonly [number, number, number, number];
  add: readonly [number, number, number, number];
}

export interface GradStop {
  ratio: number;
  color: Color;
}

export type FillStyle =
  | { type: "solid"; color: Color }
  | { type: "grad"; radial: boolean; matrix: Matrix; stops: GradStop[] }
  | { type: "bitmap"; id: number; matrix: Matrix; clipped: boolean };

export interface LineStyle {
  width: number;
  color: Color;
}

/** One shape record, with deltas in twips. */
export type ShapeRec =
  | {
      k: "style";
      moveTo?: [number, number];
      f0?: number;
      f1?: number;
      ln?: number;
      newStyles?: { fills: FillStyle[]; lines: LineStyle[] };
    }
  | { k: "line"; dx: number; dy: number }
  | { k: "curve"; cx: number; cy: number; ax: number; ay: number };

export interface ShapeDef {
  bounds: Rect;
  fills: FillStyle[];
  lines: LineStyle[];
  recs: ShapeRec[];
}

export interface MorphDef {
  startBounds: Rect;
  endBounds: Rect;
  fills: [FillStyle, FillStyle][];
  lines: [LineStyle, LineStyle][];
  start: ShapeRec[];
  end: ShapeRec[];
}

export interface PlaceCmd {
  op: "place";
  depth: number;
  move: boolean;
  charId?: number;
  matrix?: Matrix;
  cx?: CXForm;
  ratio?: number;
  name?: string;
  clipDepth?: number;
  clipActions?: ClipAction[];
}

export interface ClipAction {
  events: string[];
  code: Uint8Array;
}

export interface RemoveCmd {
  op: "remove";
  depth: number;
}

export type Cmd = PlaceCmd | RemoveCmd;

export interface StartSound {
  soundId: number;
  loops: number | undefined;
  hasInPoint: boolean;
  hasOutPoint: boolean;
  inPoint: number | undefined;
  outPoint: number | undefined;
  stop: boolean;
  noMultiple: boolean;
}

export interface FrameData {
  cmds: Cmd[];
  label?: string;
  actions: Uint8Array[];
  startSounds: StartSound[];
}

export interface TimelineData {
  frames: FrameData[];
}

export interface ButtonRecord {
  states: number;
  charId: number;
  depth: number;
  matrix: Matrix;
  cx?: CXForm;
}

export interface ButtonAction {
  /** Condition flags (DefineButton2) or 0x0008 (release, DefineButton). */
  cond: number;
  code: Uint8Array;
}

export interface StaticTextRun {
  fontId?: number;
  color?: Color;
  x?: number;
  y?: number;
  height?: number;
  glyphs: { index: number; advance: number }[];
}

export interface EditTextDef {
  bounds: Rect;
  flags1: number;
  flags2: number;
  fontId?: number;
  fontHeight?: number;
  color?: Color;
  maxLength?: number;
  align?: number;
  leftMargin?: number;
  rightMargin?: number;
  indent?: number;
  leading?: number;
  variable: string;
  text?: string;
}

export interface FontDef {
  id: number;
  name: string;
  /** Glyph outlines, EM square of 1024 units. */
  glyphs: ShapeDef[];
  /** Glyph index to Unicode code point, when known. */
  codes: number[];
  bold: boolean;
  italic: boolean;
  kind: "DefineFont" | "DefineFont2";
}

export interface BitmapDef {
  id: number;
  kind: "jpeg" | "lossless";
  /** Encoded JPEG bytes, or raw decompressed lossless pixel data. */
  data: Uint8Array;
  width: number;
  height: number;
  /** Lossless: bitmap format (3 = 8-bit palette, 4 = 15-bit, 5 = 32-bit). */
  format?: number;
  hasAlpha: boolean;
  /** JPEG3 alpha plane (decompressed), if any. */
  alpha?: Uint8Array;
  /** Lossless: palette size minus one. */
  paletteSize?: number;
  tag: number;
}

export interface SoundDef {
  id: number;
  format: number;
  formatName: string;
  rate: number;
  sampleBits: number;
  stereo: boolean;
  sampleCount: number;
  bytes: number;
}

export interface StreamHead {
  format: number;
  formatName: string;
  playbackRate: number;
  streamRate: number;
  stereo: boolean;
  samplesPerBlock: number;
}

export type Character =
  | { type: "shape"; id: number; def: ShapeDef; tag: number }
  | { type: "morph"; id: number; def: MorphDef }
  | { type: "sprite"; id: number; timeline: TimelineData }
  | { type: "button"; id: number; records: ButtonRecord[]; actions: ButtonAction[] }
  | { type: "text"; id: number; bounds: Rect; matrix: Matrix; runs: StaticTextRun[] }
  | { type: "edit"; id: number; def: EditTextDef }
  | { type: "bitmap"; id: number; def: BitmapDef }
  | { type: "sound"; id: number; def: SoundDef };

export interface SwfHeader {
  signature: string;
  version: number;
  fileLength: number;
  frameSize: Rect;
  frameRate: number;
  frameCount: number;
}
