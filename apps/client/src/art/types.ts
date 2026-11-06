/**
 * Art packs. A pack is a folder under `src/art/packs/<id>/` holding a `pack.json` and, for
 * packs that draw the chrome from artwork, a `ui/` folder of SVG pieces named by role
 * (`cabinet-main.svg`, `plaque-button.svg`, ...). Drop a new folder in and it appears in
 * Settings; no code changes. A pack with no pieces (the hand-drawn one) draws the chrome
 * with CSS and inline SVG instead.
 *
 * Geometry is data too: each cabinet variant says, in the piece's own coordinates ("art
 * units"), where the picture, notes, text and buttons go. The client scales art units to the
 * screen with one number per layout (the fit).
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Layout = "classic" | "wide" | "phone";

/** The role names a pack may supply a piece for. Anything missing falls back to drawn chrome. */
export const PIECE_NAMES = [
  // Cabinets: one drawing per kind of screen (see `cabinets` in pack.json).
  "cabinet-main",
  "cabinet-generic",
  "cabinet-rankings",
  "cabinet-status",
  "cabinet-chat",
  // Chrome pieces used on their own (the phone layout, dialogs, the side panel).
  "cabinet-frame",
  "picture-frame",
  "parchment-note",
  "plaque-button",
  "plaque-button-wide",
  "button-exit",
  "button-arrow-next",
  "coffin-tag-wood",
  "coffin-tag-silver",
  "coffin-tag-gold",
  "logo",
  // The desk's fixed controls (round brass icon buttons).
  "capsule-map",
  "capsule-news",
  "capsule-stats",
  "capsule-rankings",
  "capsule-mail",
  "capsule-parlor",
  // Lobby.
  "logon-screen",
  "login-plaque",
  "new-user-clerk",
  "skull-male",
  "skull-female",
  // Map.
  "deathville-map-base",
  "building-funeral-home",
  "building-bank",
  "building-store",
  "building-cafe",
  "building-yangs",
  "building-competitors",
  "building-church",
  "building-hospital",
  "building-spirit-university",
  // Expanded places. The original art has no building for these: the pack's `placeholders/`
  // folder draws stand-ins, and the graveyard is already on the base map (no piece).
  "building-city-hall",
  "building-reaper-club",
  // Newspaper, notepad and dialogs.
  "newspaper",
  "brick-wall",
  "notepad",
  "dialog-panel",
] as const;

export type PieceName = (typeof PIECE_NAMES)[number];

/** Where things sit inside one cabinet piece, in that piece's art units. */
export interface CabinetRegions {
  /** Where text over the parchment goes (a room description). Absent on cabinets without one. */
  note?: Rect;
  /** The black picture window. Absent on cabinets without one (the cafe, the sheets). */
  frame?: Rect;
  /** The recessed text well, including its rim. */
  text: Rect;
  /** Extra insets of the text inside the well, in art units: left, top, right, bottom. */
  textInset: [number, number, number, number];
  /** Where the plaque row sits: the slots' common baseline rectangle. */
  buttons: Rect;
  /** Pitch between plaque slots and the plaque's own size. */
  plaque: { w: number; h: number; pitch: number };
  /** The scroll capsule's two round buttons (up, down). */
  capsule?: { up: Rect; down: Rect };
  exit?: Rect;
  gear?: Rect;
  /** The luck meter tube: the live fill is drawn inside it. */
  luck?: Rect;
  /** Live numbers drawn over the stats parchment. */
  spots?: {
    bpToday: Rect;
    turns: Rect;
    tags: [Rect, Rect, Rect];
  };
  /** The sheet for stats and rankings text (the text region, when a cabinet has no picture). */
  sheet?: Rect;
  /** Where the message box sits, for the cafe: below the text, beside the plaques. */
  chatBar?: Rect;
}

export interface CabinetSpec {
  /** Piece name without folder or extension. */
  piece: PieceName;
  /** Multiplies the layout's scale, for pieces drawn smaller than the main cabinet. */
  scaleMul?: number;
  /** The cropped drawing's viewBox: x, y, width, height. */
  viewBox: [number, number, number, number];
  regions: CabinetRegions;
}

/** How a layout places cabinet art: art units to design pixels, and where. */
export interface Fit {
  /** Design pixels per art unit. */
  scale: number;
  /** "center" or "left" in the layout's design stage. */
  align?: "center" | "left";
  /** Extra offset in design pixels from the aligned position. */
  dx?: number;
  dy?: number;
}

/** The newspaper screen: one drawing for the whole wall, with live text over its parts. */
export interface NewsSpec {
  viewBox: [number, number, number, number];
  regions: {
    noticeToday: { title: Rect; body: Rect };
    noticeYesterday: { title: Rect; body: Rect };
    bar: Rect;
    body: Rect;
    buttons: Rect;
  };
}

/**
 * Small icons a pack may draw for the Expanded ledger, town strip, office and karma moment
 * (`icons/<name>.svg`). Anything missing is drawn by the client's own inline glyphs.
 */
export const ICON_NAMES = [
  "turns",
  "money",
  "karma",
  "rating",
  "savings",
  "debt",
  "injuries",
  "leads",
  "clear",
  "rain",
  "fog",
  "thunderstorm",
  "scorcher",
  "snow",
  "weather",
  "news",
  "ordinance",
  "mayor",
  "story",
  "vote",
  "karma-balance",
  "parlor-1",
  "parlor-2",
  "parlor-3",
  "parlor-4",
  "parlor-5",
  "monument-1",
  "monument-2",
  "monument-3",
  "monument-4",
  "monument-5",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

export interface PackJson {
  id: string;
  name: string;
  description?: string;
  /**
   * Another pack this one builds on. Every piece, icon, cabinet, fit, map and newspaper this
   * pack leaves out is taken from it, and every picture it does not draw is the base pack's
   * (the Classic art). A pack that extends nothing stands alone.
   */
  extends?: string;
  /** Cabinet variants by name: main, generic, chat, rankings, status. */
  cabinets?: Record<string, CabinetSpec>;
  fits?: Partial<Record<"classic" | "wide", Fit>>;
  news?: NewsSpec;
  /** Where the map's buildings sit, in the base map's art units, keyed by place id. */
  map?: {
    viewBox: [number, number, number, number];
    buildings: Record<string, Rect>;
    /**
     * Where the places of an Expanded town sit: the three new ones, and a trimmed Cafe so that no
     * hot-spot covers another. Used instead of `buildings` for those ids when the town has any
     * of the new places, so a Classic town's map is exactly the original's.
     */
    expanded?: Record<string, Rect>;
  };
}

export interface ArtPack {
  id: string;
  name: string;
  description: string;
  /** URLs of the pack's SVG pieces, by role. Empty for the hand-drawn pack. */
  pieces: Partial<Record<PieceName, string>>;
  /**
   * Pieces that are stand-ins drawn for places and controls the original art does not have.
   * Dropping a piece of the same name into `ui/` replaces one (see the README).
   */
  placeholders?: PieceName[];
  /** The pack it builds on (already merged in: `pieces` holds the inherited pieces too). */
  extends?: string;
  /**
   * Picture overrides: asset id (`places/store`) to URL, from `assets/<pack id>/<id>.svg`. A
   * picture not listed is fetched from the asset base as before (the Classic art).
   */
  pictures?: Record<string, string>;
  /** URLs of the pack's icons, by name (own and inherited). */
  icons?: Partial<Record<IconName, string>>;
  cabinets: Record<string, CabinetSpec>;
  fits: Partial<Record<"classic" | "wide", Fit>>;
  map?: PackJson["map"];
  news?: NewsSpec;
}
