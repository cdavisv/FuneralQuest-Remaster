export const CREDIT = "Akiko Robinson";
export const LICENSE = "Proton SDK license";

export type AssetKind = "picture" | "audio-only" | "ui" | "ui-screen" | "ui-part" | "texture";

export interface ManifestAsset {
  id: string;
  kind: AssetKind;
  /** SWF the asset was converted from, relative to the repository root. */
  source: string;
  /** Which part of the SWF, for UI assets (for example `sprite 337`). */
  sourceRef?: string;
  category: string;
  /** SVG (or JPEG for textures) path relative to `assets/`; null for audio-only files. */
  file: string | null;
  /** Folder holding one SVG per frame, relative to `assets/`, when the movie has several frames. */
  framesDir: string | null;
  viewBox: string | null;
  /** Frames in the exported animation: root frames, or the longest sprite animation for one-frame movies. */
  frameCount: number;
  /** Frames on the SWF root timeline. */
  swfFrameCount?: number;
  frameRate: number;
  embedsBitmaps: boolean;
  /** Stage background colour of the SWF (the game ignores it when a picture is loaded into the frame). */
  background?: string;
  /** Extent of everything drawn in frame 1, in stage pixels. Differs from the viewBox when art bleeds off stage. */
  contentBounds?: { x: number; y: number; w: number; h: number } | null;
  /** The SWF carries sound (event or stream). The sound is not exported. */
  hasSound?: boolean;
  note?: string;
  needsRedraw?: boolean;
  needsRedrawReason?: string;
  credit: string;
  license: string;
}

export interface Manifest {
  generator: string;
  stage: { width: number; height: number };
  credit: string;
  license: string;
  assets: ManifestAsset[];
  /** Every picture URL the old server could send (both slash styles, original and lower case) to an asset id. */
  legacyUrl: Record<string, string>;
}

/**
 * Backgrounds that are auto-traced photographs: hundreds of small flat-colour polygons with
 * no drawn outlines. Confirmed by looking at the renders; the remaster redraws them in the
 * cartoon style of the portraits and map.
 */
export const NEEDS_REDRAW: Record<string, string> = {
  "places/store": "Auto-traced photograph of the store shelves: 386 flat polygons, no outlines.",
  "places/palors":
    "Auto-traced photograph of the parlor street, gradient-heavy; style does not match the cartoon portraits.",
  "places/bank":
    "Auto-traced photograph of the bank counter (the teller is traced too); outline-free polygon mosaic.",
  "places/fire": "Auto-traced photograph of a burning building: blotchy polygon mosaic.",
  "background/background_1":
    "Auto-traced photograph (cave/forest) used as a backdrop; polygon mosaic.",
  "background/background_2":
    "Auto-traced photograph (dark room) used as a backdrop; polygon mosaic.",
  "background/background_3":
    "Auto-traced photograph (ruined interior) used as a backdrop; polygon mosaic.",
  "background/background_4": "Auto-traced photograph (foliage) used as a backdrop; polygon mosaic.",
  "background/background_5":
    "Auto-traced photograph (red room) used as a backdrop; polygon mosaic.",
  "background/background_7":
    "Auto-traced photograph (graveyard) used as a backdrop; also the base of stuff/question.",
  "background/background_church":
    "Auto-traced photograph of a church interior (487 polygons); the largest trace in the set.",
  "background/background_celemony":
    "Auto-traced photograph of a cemetery for the ceremony scenes (filename misspells 'ceremony' in the original).",
};
