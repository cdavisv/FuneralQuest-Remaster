import type { ServerConfig } from "../config.js";
import type { GameHost } from "../game/host.js";
import type { TownRuntime } from "../game/town.js";

/**
 * Which town the original client joins, or why it cannot join one. The original client only
 * understands Classic screens (the engine's Classic button ids, the 2001 `request.xp` scenes), so
 * museum mode plays a Classic town only: it never touches an Expanded one.
 */
export type MuseumTarget =
  | { kind: "town"; town: TownRuntime }
  | { kind: "refused"; reason: string; townId: string | null };

export function museumTarget(
  games: GameHost,
  config: Pick<ServerConfig, "legacyTown">,
): MuseumTarget {
  if (config.legacyTown !== "") {
    const town = games.get(config.legacyTown);
    if (!town) {
      return {
        kind: "refused",
        townId: config.legacyTown,
        reason: `There is no town "${config.legacyTown}" (FQ_LEGACY_TOWN).`,
      };
    }
    if (town.rulesetName !== "classic") {
      return {
        kind: "refused",
        townId: town.id,
        reason: `The town "${town.id}" runs the ${town.rulesetDef.label} ruleset, and the original client only understands Classic screens.`,
      };
    }
    return { kind: "town", town };
  }
  const towns = [...games.towns.values()];
  const classic = towns.find((t) => t.rulesetName === "classic");
  if (classic) return { kind: "town", town: classic };
  return {
    kind: "refused",
    townId: null,
    reason:
      towns.length === 0
        ? "This server has no town for the original client to join."
        : "Every town on this server runs the Expanded ruleset, and the original client only understands Classic screens.",
  };
}

/** Plain-language status for `GET /api/features`. */
export function museumStatus(
  games: GameHost,
  config: Pick<ServerConfig, "legacyTown">,
): { available: boolean; reason: string | null } {
  const target = museumTarget(games, config);
  return target.kind === "town"
    ? { available: true, reason: null }
    : { available: false, reason: target.reason };
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The page a browser gets at `/museum/` when there is no Classic town to play. */
export function refusalPage(reason: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Museum mode: Classic towns only</title>
<style>
body{font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;line-height:1.5;color:#222;background:#fafafa}
h1{font-size:1.4rem}
code{background:#eee;padding:0 .25rem}
</style>
</head>
<body>
<h1>Museum mode plays Classic towns only</h1>
<p>${escapeHtml(reason)}</p>
<p>Museum mode runs the original 2001 client, which knows nothing about the Expanded ruleset's customers, parlor, church, City Hall or bank. Play the Expanded town in the <a href="/">web client</a>, or ask the sysop for a Classic town and set <code>FQ_LEGACY_TOWN</code> to its id.</p>
</body>
</html>
`;
}
