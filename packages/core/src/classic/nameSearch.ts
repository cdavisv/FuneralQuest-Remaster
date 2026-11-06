import type { Overlay } from "@fq/protocol";
import type { Turn } from "../engine/turn.js";
import { legacy } from "../engine/view.js";
import type { TownState } from "../state/types.js";
import { fill } from "../text/format.js";
import { stripLegacyCodes } from "../text/legacyText.js";

/**
 * The name-search flow shared by visits and letters: the Flash `i_getname`
 * prompt, the server's `command_getname` (legacy/source/commands_getname.cpp)
 * and the `i_namenext` "Do you mean X?" box, whose Yes accepts and whose No
 * searches again from the next slot. As overlays: a text input
 * `<module>:getname`, a confirm `<module>:namenext`, and a message
 * `<module>:noname` when nothing (more) matches.
 */
export interface NameSearch {
  search: string;
  /** The player offered last, -1 for none. */
  hisId: number;
}

/**
 * `get_id_from_full_or_partial_handle` (legacy/source/misc_utils.cpp:222-259):
 * the first active player from slot `start` whose name contains `search`,
 * case-insensitive, yourself included. An empty search is replaced by
 * "skljdskljdslkj" (commands_getname.cpp:15) so it matches nobody.
 */
export function findName(town: TownState, start: number, search: string): number {
  if (start < 0 || start >= town.players.length) return -1;
  const wanted = (search === "" ? "skljdskljdslkj" : search).toLowerCase();
  for (let i = start; i < town.players.length; i++) {
    const p = town.players[i];
    if (p?.active && p.name.toLowerCase().includes(wanted)) return i;
  }
  return -1;
}

/** The `i_getname` prompt. */
export function namePrompt(turn: Turn, module: string, prompt: string): Overlay {
  return {
    kind: "textInput",
    id: `${module}:getname`,
    prompt: `${stripLegacyCodes(prompt)}\n${turn.text.social.mail.nameHint}`,
    maxLength: turn.rules.textLimits.nameSearch,
  };
}

/** Searches from `start` and returns the next box: "Do you mean X?" or "nobody by that name". */
export function nameAnswer(
  turn: Turn,
  module: string,
  search: string,
  start: number,
): { overlay: Overlay; state: NameSearch } {
  const t = turn.text.social.mail;
  const hisId = findName(turn.town, start, search);
  const found = turn.town.players[hisId];
  if (!found) {
    return {
      overlay: { kind: "message", id: `${module}:noname`, text: legacy(t.noName) },
      state: { search, hisId: -1 },
    };
  }
  return {
    overlay: {
      kind: "confirm",
      id: `${module}:namenext`,
      text: legacy(fill(t.doYouMean, { name: found.name })),
    },
    state: { search, hisId },
  };
}

/** Reads a `NameSearch` kept in scene data. */
export function readNameSearch(data: unknown): NameSearch {
  if (typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;
    if (typeof d.search === "string" && typeof d.hisId === "number") {
      return { search: d.search, hisId: d.hisId };
    }
  }
  return { search: "", hisId: -1 };
}
