import type { SwearWord } from "../content/types.js";

/**
 * Lower-cases one UTF-16 unit at a time and keeps the string length, so match
 * positions found in the folded copy are valid in the original (the original
 * `ReplaceNoCase` lower-cased both strings and used the positions found there).
 */
function fold(text: string): string {
  let out = "";
  for (const unit of text) {
    const lower = unit.toLowerCase();
    out += lower.length === unit.length ? lower : unit;
  }
  return out;
}

/**
 * `ReplaceNoCase` (legacy/source/FakeCStringEx.cpp:7-28): replaces every
 * non-overlapping, case-insensitive occurrence of `bad`, scanning left to
 * right over the original text (a replacement is never re-scanned for the
 * same word). An empty `bad` is skipped; the original looped forever on it.
 */
export function replaceNoCase(text: string, bad: string, good: string): string {
  if (bad === "") return text;
  const haystack = fold(text);
  const needle = fold(bad);
  let out = "";
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) break;
    out += text.slice(from, at) + good;
    from = at + needle.length;
  }
  return out + text.slice(from);
}

/**
 * `swear_check` (legacy/source/security.cpp:28-40): substring replacement, not
 * whole-word, so "Scunthorpe" style hits happen exactly as in the original.
 * Each `addword` line is applied in file order to the result of the previous
 * one, so a replacement can itself be matched by a later word. Pure: the word
 * list comes from `ContentPack.swearWords`. `enabled` is `sys.b_swear_filter`
 * (`GameSettings.swearFilter`); when off the text is returned unchanged.
 *
 * The original is also called on chat, battle messages and posted
 * announcements (commands_bar.cpp:284-291, :380, commands_battle.cpp:571,
 * :630, commands_news.cpp:180); this function is meant for those callers too.
 */
export function swearCheck(text: string, words: readonly SwearWord[], enabled = true): string {
  if (!enabled) return text;
  let out = text;
  for (const word of words) out = replaceNoCase(out, word.bad, word.good);
  return out;
}
