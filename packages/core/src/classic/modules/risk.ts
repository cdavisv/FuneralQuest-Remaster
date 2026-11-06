import type { View } from "@fq/protocol";
import type { RiskEntry } from "../../content/types.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, hud, legacy } from "../../engine/view.js";
import { fill, replaceAll } from "../../text/format.js";
import { continueButton, currentBackground, makePicture } from "../location.js";
import { expMod, playerSir } from "../players.js";

/** Risks (legacy/source/commands_customer_risk.cpp, risks.txt). */
export const RISK = "risk";

/** `replace_words` (commands_customer_risk.cpp:3-17). */
function replaceWords(turn: Turn, text: string): string {
  const p = turn.player;
  let out = replaceAll(text, "*SIR*", playerSir(p));
  out = replaceAll(out, "*NAME*", p.name);
  out = replaceAll(out, "*PARLOR*", p.parlor);
  return replaceAll(out, "\\n", "\n");
}

function riskView(
  turn: Turn,
  text: string,
  fg: string | undefined,
  bg: string | undefined,
  buttons: View["buttons"],
): View {
  return {
    scene: "location",
    title: turn.session.location,
    text: legacy(text),
    // An empty background in risks.txt leaves the one on screen (:70, :109, :155, :176).
    picture: makePicture(fg, bg ?? currentBackground(turn)),
    hud: hud(turn.player),
    buttons,
  };
}

function currentRisk(turn: Turn): RiskEntry {
  const c = turn.session.customer;
  const risk = turn.content.risks[c.riskType];
  if (!c.active || c.flow !== "risk" || !risk) throw new Error("No risk is open");
  return risk;
}

/** `command_risk_start` (:79-116): one `random(count)` picks the risk. */
export function startRisk(turn: Turn): View {
  const c = turn.session.customer;
  c.flow = "risk";
  c.riskType = turn.rng.random(turn.content.risks.length);
  const risk = turn.content.risks[c.riskType];
  if (!risk) throw new Error("The content pack has no risks");
  turn.session.scene = RISK;
  return riskView(
    turn,
    replaceWords(turn, risk.startMessage),
    risk.startPicture,
    risk.startBackground,
    [button(`${RISK}:take`, risk.riskLabel), button(`${RISK}:decline`, risk.normalLabel)],
  );
}

/** `command_risk_accept` (:20-75): the safe choice pays `random_range(4, 10)` BP. */
function decline(turn: Turn): View {
  const risk = currentRisk(turn);
  const r = turn.rules.riskDecline;
  const amount = turn.rng.randomRange(r.min, r.max);
  const t = turn.text.risk;
  const earned = amount === 1 ? t.earnedOne : fill(t.earned, { amount });
  const text = `${replaceWords(turn, risk.normalMessage)}\n\n${earned}`;
  expMod(turn.player, amount);
  turn.session.customer.active = false;
  return riskView(turn, text, risk.normalPicture, risk.normalBackground, [continueButton(turn)]);
}

/**
 * `command_reaction` (:126-206): the gamble passes on
 * `get_random_yes_no(luck, 0.90)` and wins or loses the Game Settings risk
 * amount. A loss is limited by `exp_mod` to today's BP, but the text shows
 * the full amount, as the original did.
 */
function take(turn: Turn): View {
  const risk = currentRisk(turn);
  const p = turn.player;
  const amount = turn.settings.risk;
  const t = turn.text.risk;
  let text: string;
  let fg: string | undefined;
  let bg: string | undefined;
  if (!turn.rng.randomYesNo(p.luck, turn.rules.riskLuckWeight)) {
    text = replaceWords(turn, risk.failMessage);
    fg = risk.failPicture;
    bg = risk.failBackground;
    text += `\n\n${fill(t.lost, { amount })}`;
    expMod(p, -amount);
  } else {
    text = replaceWords(turn, risk.successMessage);
    fg = risk.successPicture;
    bg = risk.successBackground;
    text += `\n\n${fill(t.won, { amount })}`;
    expMod(p, amount);
  }
  turn.session.customer.active = false;
  return riskView(turn, text, fg, bg, [continueButton(turn)]);
}

export const riskModule: LocationModule = {
  id: RISK,
  press(turn, command) {
    if (command === "take") return take(turn);
    if (command === "decline") return decline(turn);
    throw new Error(`Unknown risk command ${command}`);
  },
};
