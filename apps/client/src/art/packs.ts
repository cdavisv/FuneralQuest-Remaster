import {
  type ArtPack,
  ICON_NAMES,
  type IconName,
  type PackJson,
  PIECE_NAMES,
  type PieceName,
} from "./types.js";

/**
 * Every pack folder under ./packs is found at build time. `pack.json` is the manifest; the
 * `ui/*.svg` files are the pieces, `icons/*.svg` the small icons. Only the files that exist are
 * bundled, so a pack costs exactly what it ships.
 */
const manifests = import.meta.glob<PackJson>("./packs/*/pack.json", {
  eager: true,
  import: "default",
});
const pieceUrls = import.meta.glob<string>("./packs/*/ui/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

const placeholderUrls = import.meta.glob<string>("./packs/*/placeholders/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

const iconUrls = import.meta.glob<string>("./packs/*/icons/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});

/**
 * Picture overrides: `<repo>/assets/<pack id>/<asset id>.svg` for every pack but Classic (whose
 * art is the asset base itself, fetched by URL and never bundled). Only the URLs are bundled;
 * a file is fetched when a View names its id and the pack is in use.
 */
const pictureUrls = import.meta.glob<string>(
  [
    "../../../../assets/*/**/*.svg",
    "!../../../../assets/classic/**",
    // A pack's chrome and icons are bundled from its client folder (above), not as pictures.
    "!../../../../assets/*/ui/**",
    "!../../../../assets/*/icons/**",
  ],
  { eager: true, query: "?url", import: "default" },
);

const known = new Set<string>(PIECE_NAMES);
const knownIcons = new Set<string>(ICON_NAMES);

/** The pack used when nothing is stored and when a stored id no longer exists. */
export const DEFAULT_PACK_ID = "classic";
/** The pack that draws everything with CSS and inline SVG. Always available. */
export const DRAWN_PACK_ID = "handdrawn";

/** Asset id from a picture path `../../../../assets/<pack>/<id>.svg`, keyed by pack. */
export function pictureMap(urlMap: Record<string, string>): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [file, url] of Object.entries(urlMap)) {
    const m = /(?:^|\/)assets\/([^/]+)\/(.+)\.svg$/.exec(file);
    if (!m?.[1] || !m[2] || m[1] === "classic") continue;
    // The pack's own icons and UI pieces live in its folder too; only pictures are overrides.
    if (m[2].startsWith("ui/") || m[2].startsWith("icons/")) continue;
    const pack = out[m[1]] ?? {};
    pack[m[2]] = url;
    out[m[1]] = pack;
  }
  return out;
}

export function buildPacks(
  manifestMap: Record<string, PackJson>,
  urlMap: Record<string, string>,
  placeholderMap: Record<string, string> = {},
  iconMap: Record<string, string> = {},
  pictureUrlMap: Record<string, string> = {},
): ArtPack[] {
  const own: ArtPack[] = [];
  const pictures = pictureMap(pictureUrlMap);
  for (const [path, json] of Object.entries(manifestMap)) {
    const folder = /^\.\/packs\/([^/]+)\//.exec(path)?.[1];
    if (!folder || !json || typeof json.id !== "string") continue;
    const pieces: Partial<Record<PieceName, string>> = {};
    for (const [file, url] of Object.entries(urlMap)) {
      const m = /^\.\/packs\/([^/]+)\/ui\/([^/]+)\.svg$/.exec(file);
      if (m?.[1] === folder && m[2] && known.has(m[2])) pieces[m[2] as PieceName] = url;
    }
    // Stand-ins fill only the gaps: a real piece of the same name in ui/ wins.
    const placeholders: PieceName[] = [];
    for (const [file, url] of Object.entries(placeholderMap)) {
      const m = /^\.\/packs\/([^/]+)\/placeholders\/([^/]+)\.svg$/.exec(file);
      if (m?.[1] === folder && m[2] && known.has(m[2]) && !pieces[m[2] as PieceName]) {
        pieces[m[2] as PieceName] = url;
        placeholders.push(m[2] as PieceName);
      }
    }
    const icons: Partial<Record<IconName, string>> = {};
    for (const [file, url] of Object.entries(iconMap)) {
      const m = /^\.\/packs\/([^/]+)\/icons\/([^/]+)\.svg$/.exec(file);
      if (m?.[1] === folder && m[2] && knownIcons.has(m[2])) icons[m[2] as IconName] = url;
    }
    const pics = pictures[json.id] ?? pictures[folder];
    own.push({
      id: json.id,
      name: json.name ?? json.id,
      description: json.description ?? "",
      pieces,
      ...(placeholders.length > 0 ? { placeholders } : {}),
      ...(json.extends ? { extends: json.extends } : {}),
      ...(pics && Object.keys(pics).length > 0 ? { pictures: pics } : {}),
      ...(Object.keys(icons).length > 0 ? { icons } : {}),
      cabinets: json.cabinets ?? {},
      fits: json.fits ?? {},
      ...(json.map ? { map: json.map } : {}),
      ...(json.news ? { news: json.news } : {}),
    });
  }
  const packs = shareAcross(own.map((p) => inherit(p, own)));
  // The default first, the drawn fallback last, anything else (future packs) in between.
  const rank = (p: ArtPack) => (p.id === DEFAULT_PACK_ID ? 0 : p.id === DRAWN_PACK_ID ? 2 : 1);
  return packs.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/**
 * Art that only one pack draws is not locked to that pack. The Expanded places have no Classic
 * original, so their drawings (and the stage and monument icons) exist in the Remastered pack
 * alone; a player on any other pack should still see them instead of a stand-in. So a pack that
 * lacks an icon takes it from any other pack that has it, and a piece that is only a stand-in in
 * one pack is replaced by the real piece of another. A pack's own art always wins, and the
 * chrome (cabinets, geometry) is never borrowed.
 */
export function shareAcross(packs: ArtPack[]): ArtPack[] {
  return packs.map((pack) => {
    const others = packs.filter((p) => p.id !== pack.id);
    const icons = { ...pack.icons };
    for (const other of others) {
      for (const [name, url] of Object.entries(other.icons ?? {})) {
        if (!icons[name as IconName]) icons[name as IconName] = url;
      }
    }
    const pieces = { ...pack.pieces };
    const placeholders: PieceName[] = [];
    for (const name of pack.placeholders ?? []) {
      const real = others.find((o) => o.pieces[name] && !o.placeholders?.includes(name));
      if (real?.pieces[name]) pieces[name] = real.pieces[name];
      else placeholders.push(name);
    }
    const { placeholders: _dropped, ...rest } = pack;
    return {
      ...rest,
      pieces,
      ...(placeholders.length > 0 ? { placeholders } : {}),
      ...(Object.keys(icons).length > 0 ? { icons } : {}),
    };
  });
}

/**
 * Merges a pack over the pack it extends (and that one's base, and so on): what the pack
 * supplies wins, everything else is the base's. A placeholder the pack replaces with a real
 * piece stops being a placeholder. Unknown bases and cycles are ignored.
 */
function inherit(pack: ArtPack, all: ArtPack[], seen: Set<string> = new Set()): ArtPack {
  if (!pack.extends || seen.has(pack.id)) return pack;
  seen.add(pack.id);
  const baseRaw = all.find((p) => p.id === pack.extends && p.id !== pack.id);
  if (!baseRaw) return pack;
  const base = inherit(baseRaw, all, seen);
  const pieces = { ...base.pieces, ...pack.pieces };
  const placeholders = [
    ...(pack.placeholders ?? []),
    ...(base.placeholders ?? []).filter((name) => !pack.pieces[name]),
  ];
  const icons = { ...base.icons, ...pack.icons };
  const pictures = { ...base.pictures, ...pack.pictures };
  return {
    ...pack,
    pieces,
    ...(placeholders.length > 0 ? { placeholders } : {}),
    ...(Object.keys(icons).length > 0 ? { icons } : {}),
    ...(Object.keys(pictures).length > 0 ? { pictures } : {}),
    cabinets: { ...base.cabinets, ...pack.cabinets },
    fits: { ...base.fits, ...pack.fits },
    ...(pack.map || base.map ? { map: pack.map ?? base.map } : {}),
    ...(pack.news || base.news ? { news: pack.news ?? base.news } : {}),
  };
}

export const PACKS: ArtPack[] = buildPacks(
  manifests,
  pieceUrls,
  placeholderUrls,
  iconUrls,
  pictureUrls,
);

export function getPack(id: string | undefined, packs: ArtPack[] = PACKS): ArtPack {
  return (
    packs.find((p) => p.id === id) ??
    packs.find((p) => p.id === DEFAULT_PACK_ID) ??
    packs[0] ?? {
      id: DRAWN_PACK_ID,
      name: "Hand-drawn",
      description: "",
      pieces: {},
      cabinets: {},
      fits: {},
    }
  );
}

/**
 * Where a picture layer comes from, in the order to try: the selected pack's own drawing, then
 * `fallback` (the asset base's URL, the Classic art), then any other pack that draws the id. So
 * a player on Classic art still sees the Expanded places the Remastered pack alone draws, and a
 * player on Remastered still sees every original it did not redraw. `fallback` is left out when
 * the caller knows the Classic art has no such picture (no request that can only fail).
 */
export function pictureSources(
  pack: ArtPack | undefined,
  id: string,
  fallback: string | undefined,
  others: readonly ArtPack[] = [],
): string[] {
  const list = [
    pack?.pictures?.[id],
    fallback,
    ...others.filter((o) => o.id !== pack?.id).map((o) => o.pictures?.[id]),
  ].filter((u): u is string => typeof u === "string" && u !== "");
  return [...new Set(list)];
}
