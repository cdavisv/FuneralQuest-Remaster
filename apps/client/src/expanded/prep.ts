import type { Button, PrepChoice, RewardFacts, View } from "@fq/protocol";

/**
 * Preparing the body (docs/expanded-rules.md 8.2): a karma moment. `View.prep.choices` says what
 * each choice gives (`effects`: karma, money, luck, reviews, rating...), whether it is the
 * dishonest one (`evil`), and whether it is a gamble (`risk`: the chance it works and what a
 * failure gives instead). The button supplies only the label (the joke) and its hint.
 */
export interface PrepOption {
  button: Button;
  /** Index in `View.buttons`, for the number keys. */
  index: number;
  choice: PrepChoice;
  /** Karma if it works, signed (0 when the choice moves none). */
  karma: number;
  /** Karma if a gamble fails, signed. */
  failKarma: number | undefined;
  tone: "good" | "evil" | "neutral";
}

export function isPrepChoice(view: View): boolean {
  return (view.prep?.choices.length ?? 0) >= 2;
}

/** The effects other than karma, in a stable order, as signed numbers by name. */
export const EFFECT_ORDER = ["money", "bp", "luck", "reviews", "rating", "gold"] as const;
export type EffectKey = (typeof EFFECT_ORDER)[number];

export function effectList(effects: RewardFacts): { key: EffectKey; amount: number }[] {
  const out: { key: EffectKey; amount: number }[] = [];
  for (const key of EFFECT_ORDER) {
    const amount = effects[key];
    if (typeof amount === "number" && amount !== 0) out.push({ key, amount });
  }
  return out;
}

export function prepOptions(view: View): PrepOption[] {
  const out: PrepOption[] = [];
  for (const choice of view.prep?.choices ?? []) {
    const index = view.buttons.findIndex((b) => b.id === choice.buttonId);
    const button = view.buttons[index];
    if (!button) continue;
    const karma = choice.effects.karma ?? 0;
    out.push({
      button,
      index,
      choice,
      karma,
      failKarma: choice.risk ? (choice.risk.fail.karma ?? 0) : undefined,
      tone: choice.evil ? "evil" : karma > 0 ? "good" : "neutral",
    });
  }
  return out;
}
