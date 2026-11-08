import type { Button, UpgradeRow, View } from "@fq/protocol";

/**
 * Expanded layouts (docs/expanded-rules.md 11.2, 11.3): the main row is the buttons without a
 * `group`, `more` is a smaller second row, `hand` is a row of cards. Every button keeps the
 * position it has in the whole View, because keys 1 to 9 follow the View's order.
 */
export interface Placed {
  button: Button;
  /** Index in `View.buttons`. */
  index: number;
}

export interface ButtonGroups {
  main: Placed[];
  more: Placed[];
  hand: Placed[];
}

export function groupButtons(buttons: Button[]): ButtonGroups {
  const out: ButtonGroups = { main: [], more: [], hand: [] };
  buttons.forEach((button, index) => {
    const where =
      button.group === "more" ? out.more : button.group === "hand" ? out.hand : out.main;
    where.push({ button, index });
  });
  return out;
}

/** True when any button uses an Expanded layout field. Classic Views never do. */
export function usesGroups(buttons: Button[]): boolean {
  return buttons.some((b) => b.group !== undefined);
}

/** True when any button carries a second line (`detail`). */
export function hasDetails(buttons: Button[]): boolean {
  return buttons.some((b) => b.detail !== undefined);
}

export type CardState = "ready" | "locked" | "short" | "owned" | "chosen" | "off";

/**
 * What a card is. The engine says what it can as data: `selected` marks the choice in force (the
 * markup, the rivalry, the ordinance or candidate voted for), and an upgrade's row says whether it
 * is owned, buyable, short of cash or locked. A disabled card with neither (a permit already held,
 * a place not yet unlocked) is sorted from its hint, the only thing the engine sends for it:
 * "Needs ..." is locked, "not enough cash" short, "Already have it" owned.
 */
export function cardState(button: Button, upgrade?: { state: UpgradeRow["state"] }): CardState {
  if (button.selected) return "chosen";
  if (upgrade) {
    return upgrade.state === "owned"
      ? "owned"
      : upgrade.state === "locked"
        ? "locked"
        : upgrade.state === "unaffordable"
          ? "short"
          : "ready";
  }
  if (button.enabled !== false) return "ready";
  const hint = (button.hint ?? "").trim().toLowerCase();
  if (/^(already|current|owned|you own|you have|have it|sold out|done)/.test(hint)) return "owned";
  if (/^needs?\b|requires?|locked|unlock/.test(hint)) return "locked";
  if (/not enough|can't afford|cannot afford|too expensive|cash|short of/.test(hint))
    return "short";
  return "off";
}

/** The ids of a card family that share a prefix up to the last colon: `reaper-club:draw:100`. */
export function cardFamily(id: string): { family: string; arg: string } {
  const at = id.lastIndexOf(":");
  return at < 0 ? { family: id, arg: "" } : { family: id.slice(0, at), arg: id.slice(at + 1) };
}

/**
 * Removes the original's backtick colour codes from a plain string (the rules of
 * `stripLegacyCodes` in @fq/core, legacy/source/funeral_util.cpp:499-575): a code is a backtick
 * and one character, `` `fN `` a backtick, `f` and a digit.
 */
export function stripCodes(text: string): string {
  if (!text.includes("`")) return text;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch !== "`" || i + 1 >= text.length) {
      out += ch;
      continue;
    }
    i += text.charAt(i + 1) === "f" && i + 2 < text.length ? 2 : 1;
  }
  return out;
}

/**
 * A button's `hint` and `detail` are plain strings (docs/expanded-rules.md 11.2, 26), drawn as
 * they come. Some reach the client with the original's colour codes still in them (the black
 * market's reward summaries, `rewardSummary` in packages/core/src/expanded/players.ts), which
 * would show as stray backticks; they are taken out here. Classic Views carry neither field.
 */
export function plainButtons(view: View): View {
  const dirty = view.buttons.some(
    (b) => (b.hint?.includes("`") ?? false) || (b.detail?.includes("`") ?? false),
  );
  if (!dirty) return view;
  return {
    ...view,
    buttons: view.buttons.map((b) => {
      const next: Button = { ...b };
      if (b.hint !== undefined) next.hint = stripCodes(b.hint);
      if (b.detail !== undefined) next.detail = stripCodes(b.detail);
      return next;
    }),
  };
}
