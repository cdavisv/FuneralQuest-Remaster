import type { Turn } from "../engine/turn.js";
import { swearCheck } from "./swearFilter.js";

/**
 * Where player-typed text ends up. The original ran `swear_check` over
 * announcements (commands_news.cpp:180), chat lines, `/me` and `/yell`
 * (commands_bar.cpp:284, 291, 380) and battle quotes (commands_battle.cpp:571,
 * 630), but not over mail (commands_send_mail.cpp) or Yang's fortunes.
 */
export type UserTextKind = "announcement" | "chat" | "battleQuote" | "mail" | "fortune";

const ALWAYS_FILTERED: ReadonlySet<UserTextKind> = new Set(["announcement", "chat", "battleQuote"]);

/**
 * SWEAR-FILTER CALL SITE for every player-typed text. `swear_check`
 * (classic/swearFilter.ts) with the pack's word list, gated by the sysop's
 * `swearFilter` setting. Mail and fortunes are filtered only when
 * `rules.filterUserText` is on (off in Classic, as the original never
 * filtered them; the Expanded ruleset turns it on).
 */
export function filterUserText(turn: Turn, text: string, kind: UserTextKind): string {
  if (!ALWAYS_FILTERED.has(kind) && !turn.rules.filterUserText) return text;
  return swearCheck(text, turn.content.swearWords, turn.settings.swearFilter);
}

/** Control characters are dropped from typed text (the engine uses U+0001/U+0002 as link markers in news). */
export function stripControl(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 32 && ch !== "\n" && ch !== "\r" && ch !== "\t") continue;
    out += ch;
  }
  return out;
}
