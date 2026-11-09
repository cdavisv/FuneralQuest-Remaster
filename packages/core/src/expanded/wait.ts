import type { View } from "@fq/protocol";
import { enterLocation } from "../classic/location.js";
import { startRisk } from "../classic/modules/risk.js";
import { startScript } from "../classic/scripts/runtime.js";
import { freeEvent, noTurns } from "../classic/wait.js";
import type { Turn } from "../engine/turn.js";
import { legacy } from "../engine/view.js";
import { openStream } from "../rng/streams.js";
import type { PlayerState } from "../state/types.js";
import { generateCustomer } from "./customer.js";
import { MODIFIER_KEYS, modValue } from "./modifiers.js";
import { arriveX } from "./negotiation.js";
import { applyNextTip } from "./town/placesBLib.js";

/**
 * Wait for Customer under Expanded rules (docs/expanded-rules.md section
 * 3.1): Classic's order (no turns, free event, customer, risk, script, then
 * a turn and the negotiation) with Expanded customers and the odds read
 * through the rule modifiers. The practice customer of the guided first day
 * skips the events.
 */
export function waitX(turn: Turn, practice = false): View {
  const p = turn.player;
  if (p.turns < 1) return noTurns(turn);
  // Section 24: in a Daily Challenge every Wait for Customer draws from its own stream.
  const challenge = turn.town.expanded?.challenge;
  if (challenge && !practice) {
    const index = challenge.waits++;
    const rng = openStream(turn.town.seed, CHALLENGE_STREAM, CHALLENGE_DAY_BASE + index);
    return turn.withStream(rng, () => waitBody(turn, false, challenge.base));
  }
  return waitBody(turn, practice);
}

/** Stream key of the Daily Challenge's waits (section 24); the "day" is 1000 + the wait's index. */
export const CHALLENGE_STREAM = -7;
const CHALLENGE_DAY_BASE = 1000;

/**
 * `frozen` (the Daily Challenge): customers are generated against the
 * player as they started the run, so rating, luck, perks and families won
 * along the way never change who walks in (section 24.1).
 */
function waitBody(turn: Turn, practice: boolean, frozen?: PlayerState): View {
  const p = turn.player;
  const s = turn.settings;
  const town = turn.town;
  const rng = turn.rng;
  // Section 19.2: a lead from the nurse (or a seance, or a mourner) is a sure, richer customer.
  const life = p.expanded?.life;
  const lead = !practice && (life?.leads ?? 0) > 0;
  if (lead && life) life.leads--;
  if (
    !practice &&
    !lead &&
    rng.frandom(1) < modValue(town, MODIFIER_KEYS.eventOdds, s.normalOdds)
  ) {
    return freeEvent(turn);
  }
  const shift = lead ? (turn.rules.expanded?.town.hospital.lead.incomeShift ?? 0) : 0;
  if (frozen) {
    const real = town.players[p.id] as PlayerState;
    town.players[p.id] = JSON.parse(JSON.stringify(frozen)) as PlayerState;
    try {
      turn.session.customer = generateCustomer(turn, practice, shift);
    } finally {
      town.players[p.id] = real;
    }
  } else turn.session.customer = generateCustomer(turn, practice, shift);
  if (!practice && !lead && rng.frandom(1) < modValue(town, MODIFIER_KEYS.riskOdds, s.luckOdds)) {
    return startRisk(turn);
  }
  if (
    !practice &&
    !lead &&
    rng.frandom(1) < modValue(town, MODIFIER_KEYS.scriptOdds, s.scriptOdds)
  ) {
    enterLocation(turn, "Home");
    return startScript(turn, "script_event");
  }
  p.turns--;
  // Batch B: a tip from the coroner or the Mournes' price list reveals facts about this family.
  const tip = practice || frozen ? "" : applyNextTip(turn);
  const view = arriveX(turn);
  if (tip !== "") view.text = [...legacy(`${tip}\n`), ...view.text];
  if (lead) {
    const text = turn.content.expanded?.town?.text.hospital.leadArrives ?? "";
    if (text !== "") view.text = [...legacy(`${text}\n`), ...view.text];
  }
  return view;
}
