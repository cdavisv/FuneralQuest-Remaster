/**
 * The client's five plaque buttons and how `add_button` fills them
 * (legacy/source/funeral_util.cpp:10-31).
 *
 * A slot number counts from the right: slot 1 is the rightmost button and
 * slot 5 the leftmost. The client names its button clips by a key letter:
 * slot 1 is "3", slot 2 is "2", slot 3 is "1", slot 4 is "0" and slot 5 is
 * "a" (`st_option_<key>`, `i_command_<key>`, `i_command_sub_<key>`).
 */
export const MAX_BUTTONS = 5;

export type SlotKey = "3" | "2" | "1" | "0" | "a";

const KEYS: Readonly<Record<number, SlotKey>> = { 1: "3", 2: "2", 3: "1", 4: "0", 5: "a" };

/** The key letter for a slot (1 to 5). */
export function slotKey(slot: number): SlotKey {
  const key = KEYS[slot];
  if (!key) throw new RangeError(`There is no button slot ${slot}`);
  return key;
}

/** All five keys, rightmost slot first: the order the client script lists them in reverse. */
export const SLOT_KEYS: readonly SlotKey[] = ["3", "2", "1", "0", "a"];

/**
 * Where a row of buttons (left to right, as a View lists them) goes. The
 * rightmost button takes slot 1, the one beside it slot 2, and so on, so a
 * row of n fills slots n down to 1, as scripts that used slots 2 and 1 did.
 * More than five do not fit; the extras are returned in `dropped`.
 */
export function layoutButtons<T>(row: readonly T[]): {
  placed: { slot: number; key: SlotKey; item: T }[];
  dropped: T[];
} {
  const shown = row.slice(0, MAX_BUTTONS);
  const placed = shown.map((item, index) => {
    const slot = shown.length - index;
    return { slot, key: slotKey(slot), item };
  });
  return { placed, dropped: row.slice(MAX_BUTTONS) };
}

/**
 * `cbut` and `center_string_cst` (legacy/source/funeral.cpp:134-157): a label
 * shorter than ten characters is indented by (15 - length) / 2 spaces so it
 * sits in the middle of the plaque.
 */
export function centerLabel(label: string): string {
  if (label.length >= 10) return label;
  const spaces = Math.floor((15 - label.length) / 2);
  return " ".repeat(Math.max(0, spaces)) + label;
}
