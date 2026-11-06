import type { RichText } from "@fq/protocol";

/**
 * Characters the engine silently removes from a player's name and parlor name, so a name that
 * contains one can collide with another name in a way the player cannot see (`Bo@b` becomes
 * `Bob`). The server refuses them up front instead.
 *
 * Source: `stripDangerous` in packages/core/src/classic/newPlayer.ts, a port of
 * `strip_dangerous_stuff` (legacy/source/shared_util.cpp:126-156): the characters
 * `?|=/\;:,{}@+` ` < > % $` and the codes 123 to 127 (`{ | } ~` and DEL). Core does not export
 * it, so it is mirrored here; `test/names.test.ts` checks the mirror against the engine.
 */
export const NAME_FORBIDDEN = "?|=/\\;:,{}@+`<>%$~\u007f";

/** The distinct forbidden characters in `text`, in the order they first appear. */
export function forbiddenNameChars(text: string): string[] {
  const found: string[] = [];
  for (const ch of text) {
    if (NAME_FORBIDDEN.includes(ch) && !found.includes(ch)) found.push(ch);
  }
  return found;
}

function show(ch: string): string {
  return ch === "\u007f" ? "DEL" : ch;
}

/** `@`, `@ and %`, `@, % and $`. */
function joinChars(chars: string[]): string {
  const shown = chars.map(show);
  if (shown.length === 1) return shown[0] as string;
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

export interface NameProblem {
  field: "name" | "parlor";
  message: string;
  richMessage: RichText;
}

/** The first problem with the typed names, or null. The message names the offending characters. */
export function checkNames(form: { name: string; parlor: string }): NameProblem | null {
  const fields = [
    ["name", "Names", form.name],
    ["parlor", "Parlor names", form.parlor],
  ] as const;
  for (const [field, label, text] of fields) {
    const bad = forbiddenNameChars(text);
    if (bad.length > 0) {
      const message = `${label} cannot contain ${joinChars(bad)}.`;
      return { field, message, richMessage: [{ text: message }] };
    }
  }
  return null;
}
