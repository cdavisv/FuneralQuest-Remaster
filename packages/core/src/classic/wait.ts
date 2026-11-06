import type { View } from "@fq/protocol";
import type { Turn } from "../engine/turn.js";
import { createRandomCustomer } from "./customer.js";
import { customerStateFrom } from "./customerText.js";
import { computeEvent, RewardText } from "./events.js";
import { currentBackground, deskScreen, enterLocation } from "./location.js";
import { arrive } from "./modules/negotiation.js";
import { startRisk } from "./modules/risk.js";
import { expMod, luckMod, turnsMod } from "./players.js";
import { startScript } from "./scripts/runtime.js";

const f32 = Math.fround;

/**
 * `command_wait_for_customer` (legacy/source/commands_customer.cpp:4-73),
 * the backbone of the game. In order: no turns; `frandom(1) < normal odds`
 * gives a free event; a customer is generated; `frandom(1) < luck odds`
 * turns it into a risk; `frandom(1) < script odds` runs script_event.c;
 * otherwise a turn is spent and the negotiation starts. Only the last costs
 * a turn.
 */
export function waitForCustomer(turn: Turn): View {
  const p = turn.player;
  const settings = turn.settings;
  if (p.turns < 1) return noTurns(turn);
  const rng = turn.rng;
  if (rng.frandom(1) < f32(settings.normalOdds)) return freeEvent(turn);

  turn.session.customer = customerStateFrom(createRandomCustomer(rng));

  if (rng.frandom(1) < f32(settings.luckOdds)) return startRisk(turn);

  if (rng.frandom(1) < f32(settings.scriptOdds)) {
    enterLocation(turn, "Home");
    return startScript(turn, "script_event");
  }

  p.turns--;
  return arrive(turn);
}

/**
 * `command_no_turns` (legacy/source/commands_misc.cpp:90-124). The line is
 * picked with the C runtime's `rand() % 3`, the only direct `rand()` call in
 * the day loop.
 */
export function noTurns(turn: Turn): View {
  const lines = turn.text.wait.noTurns;
  const index = turn.rng.crt.next() % lines.length;
  return deskScreen(turn, `\`$${lines[index] ?? ""}`, {
    fg: "closed",
    bg: currentBackground(turn) ?? null,
  });
}

/**
 * `command_random_event_free_bp` (legacy/source/command_random.cpp:6-60): an
 * entry of events.txt for the player's total BP. Draws: the entry, then luck,
 * BP and turns modifiers. The text lists BP, luck, turns.
 */
export function freeEvent(turn: Turn): View {
  const p = turn.player;
  const t = turn.text.wait;
  const rng = turn.rng;
  const event = computeEvent(rng, turn.content.events, p.bp, {
    message: t.noMessage,
    picture: "places/embalming-room",
  });
  const luck = rng.randomRange(event.modLuck[0], event.modLuck[1]);
  const bp = rng.randomRange(event.modBp[0], event.modBp[1]);
  const turns = rng.randomRange(event.modTurns[0], event.modTurns[1]);
  const reward = new RewardText(turn.text);
  reward.add(Math.abs(bp) === 1 ? t.words.bp : t.words.bps, bp);
  reward.add(t.words.luck, luck);
  reward.add(Math.abs(turns) === 1 ? t.words.turn : t.words.turns, turns);
  expMod(p, bp);
  luckMod(turn.rules, p, luck);
  turnsMod(p, turns);
  const text = `${t.eventHeader}\`$${event.message}${reward.finish()}`;
  return deskScreen(turn, text, { fg: event.picture, bg: currentBackground(turn) ?? null });
}
