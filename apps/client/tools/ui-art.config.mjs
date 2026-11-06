/**
 * Which exported UI pieces the Classic art pack uses, and how each is cleaned.
 *
 * Source files live in assets/classic/ui/ (generated output, never edited). Each recipe names
 * a source, optionally crops it (`viewBox`, in the source's own sprite coordinates), and lists
 * rectangles whose shapes are removed because the client draws that thing live instead:
 * plaque buttons, gauge fills, labels that depend on the screen. All `<text>` (the exporter's
 * placeholders: "temptext", "test", sample numbers) is always removed.
 *
 * Add a piece here and it is derived into src/art/classic/ui/<name>.svg, bundled by Vite and
 * available to the pack in src/art/packs/classic.ts. Nothing else is bundled.
 */

/** Rectangle as [x, y, width, height]. */
const box = (x, y, w, h) => ({ x, y, w, h });

/** The walnut cabinet's drawn extent in cabinet-* sprite coordinates. */
export const CABINET_VIEWBOX = [-348, -254.5, 671, 488.5];

/** The five plaque button slots along the bottom of every cabinet. */
const PLAQUE_SLOTS = [-275.5, -167.1, -60.2, 46.9, 154.5].map((x) => box(x, 193.5, 101, 29));

/** The baked orange fill inside the luck meter tube; the client draws the level live. */
const LUCK_FILL = box(-264.6, -31.6, 8.4, 62.5);

/** "Class:" and "Mood:" captions on the picture, which belong only to a customer sale. */
const CLASS_MOOD = box(28.5, -13.5, 134, 42);

/** The baked Exit button of cabinet-main; the client draws button-exit live so it can react. */
const EXIT_BUTTON = box(259.5, -196.5, 41.5, 41.5);

/** The two health bars and casket tag clutter that the generic cabinet bakes into its note. */
const GENERIC_NOTE_CLUTTER = [box(-228, -31, 214, 15), box(-228, 13.5, 214, 18)];

/** The stats parchment of cabinet-status, whose baked English captions are drawn live instead. */
const STATUS_PARCHMENT = box(-274, -204, 550, 256);

export const CLASSIC_UI = {
  "cabinet-status": {
    from: "status-screen",
    viewBox: CABINET_VIEWBOX,
    // The plaques, and the icon row at the foot of the parchment (captions are removed above).
    removeInside: [...PLAQUE_SLOTS, box(-258, 0, 368, 50)],
    removeCaptionsInside: [STATUS_PARCHMENT],
  },
  "cabinet-chat": {
    from: "chat-screen",
    // The baked Exit plaque and message field: both are drawn live (plaques, input).
    removeInside: [box(-244.5, 150.5, 55, 22.5), box(-181.5, 151, 417, 21.5)],
  },
  "cabinet-rankings": {
    from: "rankings-screen",
    viewBox: CABINET_VIEWBOX,
    // The column headings (Name, Sex Parlor, Bury Points) and the Continue plaque.
    removeInside: [box(-314, -157, 386, 19), box(169.5, 163.5, 77, 28)],
  },
  "cabinet-main": {
    from: "cabinet-main",
    viewBox: CABINET_VIEWBOX,
    removeInside: [...PLAQUE_SLOTS, LUCK_FILL, CLASS_MOOD, EXIT_BUTTON],
  },
  "cabinet-generic": {
    from: "cabinet-generic",
    viewBox: CABINET_VIEWBOX,
    removeInside: [...PLAQUE_SLOTS, LUCK_FILL, CLASS_MOOD, ...GENERIC_NOTE_CLUTTER],
  },

  // Plain pieces: only the placeholder text (if any) is removed.
  "plaque-button": { from: "plaque-button" },
  // The same plaque drawn to stretch, for Expanded rows whose plaques are as wide as their labels.
  "plaque-button-wide": { from: "plaque-button", stretch: true },
  "picture-frame": { from: "picture-frame" },
  "parchment-note": { from: "parchment-note" },
  "coffin-tag-wood": { from: "coffin-tag-wood" },
  "coffin-tag-silver": { from: "coffin-tag-silver" },
  "coffin-tag-gold": { from: "coffin-tag-gold" },
  "button-exit": { from: "button-exit" },
  "button-arrow-next": { from: "button-arrow-next" },
  logo: { from: "logo" },

  // The desk's fixed controls, as the original's capsule menu: round brass icon buttons. The
  // names are drawn live under them.
  "capsule-map": { from: "capsule-button-map" },
  "capsule-news": { from: "capsule-button-news" },
  "capsule-stats": { from: "capsule-button-stats" },
  "capsule-rankings": { from: "capsule-button-rankings" },
  "capsule-mail": { from: "capsule-button-mail" },

  // The map and its buildings stretch to fill the screen, as the original did.
  "deathville-map-base": { from: "deathville-map-base", stretch: true },
  "building-funeral-home": { from: "building-funeral-home", stretch: true },
  "building-bank": { from: "building-bank", stretch: true },
  "building-store": { from: "building-store", stretch: true },
  "building-cafe": { from: "building-cafe", stretch: true },
  "building-yangs": { from: "building-yangs", stretch: true },
  "building-competitors": { from: "building-competitors", stretch: true },
  "building-church": { from: "building-church", stretch: true },
  "building-hospital": { from: "building-hospital", stretch: true },
  "building-spirit-university": { from: "building-spirit-university", stretch: true },

  // The empty walnut cabinet, used as a nine-slice frame for the wide layout's side panel.
  "cabinet-frame": { from: "cabinet", viewBox: [-336, -246, 672, 489.5] },

  // The Funeral Times on its brick wall. The two notice titles (glyph outlines) and the
  // bottom-row captions are drawn live, so they can be translated and can change per View.
  newspaper: {
    from: "newspaper",
    viewBox: [-422, -318, 828, 603],
    removeCaptionsInside: [box(-380, -238, 236, 281), box(-80, 186, 330, 30)],
    // The "Front Page" and "Crime" captions: live text shows which section is open.
    removeInside: [box(-5, -194, 225, 13)],
  },
  // One brick, repeated behind the newspaper where the 4:3 drawing does not reach.
  "brick-wall": { from: "newspaper", extractImage: "d1", stripText: false },

  // The spiral notepad: its prompt, Cancel and Submit lettering are drawn live (they change
  // with the prompt and the language). The quill and the ruled paper stay.
  notepad: {
    from: "notepad",
    viewBox: [-170, -173, 258, 293],
    removeInside: [box(-155, -131.5, 125, 18)],
    removeCaptionsInside: [box(-153, 90, 231, 18)],
  },

  // One olive panel serves every dialog; it is cut into nine slices so it fits any text.
  "dialog-panel": {
    from: "dialog-message",
    viewBox: [-173.5, -70.5, 347, 141],
    removeInside: [box(116.5, 34.5, 30.5, 30.5)],
  },

  // The lobby: backdrop with the title, the clerk, and the golden login plaque with its
  // captions, name and password fields and LOGON / NEW USER buttons removed (the View's text
  // and buttons go there instead).
  "logon-screen": {
    from: "logon-screen",
    // "Connecting to server..." and the row of links under the title are lettering outlines.
    removeInside: [box(-87, 10, 182, 19), box(-100, -23, 218, 10)],
  },
  "new-user-clerk": { from: "new-user-clerk" },
  // The two skull icons of the new-user screen's "What's your sex?" choice.
  "skull-male": { from: "skull-male" },
  "skull-female": { from: "skull-female" },
  "login-plaque": {
    from: "login-plaque",
    viewBox: [-171, -124.5, 340, 169.5],
    removeInside: [box(-140, -104, 290, 134)],
  },
};
