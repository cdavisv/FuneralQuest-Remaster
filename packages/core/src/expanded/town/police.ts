import type { Button, View } from "@fq/protocol";
import { mailContinue, sendPacket } from "../../classic/mail.js";
import { addToNews } from "../../classic/news.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton } from "../../engine/view.js";
import type { PlayerState } from "../../state/types.js";
import { fill } from "../../text/format.js";
import { refreshRating } from "../parlor.js";
import { karmaMod, moneyMod } from "../players.js";
import { arrive, cash, spent } from "./life.js";
import { pa, ra, tx } from "./placesAState.js";
import { gate, hintsOf, placeScreen } from "./placesAUi.js";

/**
 * The Police Station (docs/expanded-rules.md section 30): report or settle an
 * attack on your parlor, hire a patrol for the night, or use the back door.
 * Button ids: `police:report` (picker `police:reportpick`), `:settle` (picker
 * `police:settlepick`), `:patrol`, `:backdoor`, `:main`.
 */
export const POLICE = "police";

/** Attackers the player may still report: newest first, one row per rival. */
export function reportable(turn: Turn): { rival: PlayerState; day: number }[] {
  const state = pa(turn);
  const window = ra(turn).police.report.windowDays;
  const seen = new Set<number>();
  const out: { rival: PlayerState; day: number }[] = [];
  for (const a of [...state.attacks].reverse()) {
    if (a.day <= turn.town.day - window || seen.has(a.by)) continue;
    const rival = turn.town.players[a.by];
    if (!rival?.active || !rival.expanded || rival.id === turn.player.id) continue;
    seen.add(a.by);
    out.push({ rival, day: a.day });
  }
  return out;
}

function reportWhy(turn: Turn): string {
  const t = tx(turn).police;
  const hints = hintsOf(turn);
  if (pa(turn).today.reports >= ra(turn).police.report.perDay) return hints.doneToday;
  if (reportable(turn).length === 0) return t.noGrievances;
  return "";
}

/**
 * What tonight's car costs this parlor on top of the listed price (balance round 21): `aheadPerBp`
 * dollars for each BP it is ahead of the average of the town's other open parlors, rounded up to
 * $100. A parlor at or below that average, or alone in town, pays the listed price. A flat price
 * never reached the season's leader, whose money has no other use, and only shut out the poorer
 * parlors (docs/balance/expanded-tuning-log.md, round 20).
 */
export function patrolSurcharge(turn: Turn): number {
  const rate = ra(turn).police.aheadPerBp;
  if (rate <= 0) return 0;
  let sum = 0;
  let others = 0;
  for (const p of turn.town.players) {
    if (!p.active || !p.expanded || p.id === turn.player.id) continue;
    sum += p.bp;
    others++;
  }
  if (others === 0) return 0;
  const ahead = turn.player.bp - sum / others;
  return ahead > 0 ? Math.ceil((ahead * rate) / 100) * 100 : 0;
}

function patrolWhy(turn: Turn, price: number): string {
  const t = tx(turn).police;
  if (turn.player.expanded?.rivalry === "peaceful") return t.peacefulSafe;
  if (turn.player.policeProtected || pa(turn).today.patrol) return t.alreadyPatrolled;
  if (turn.player.money < price) return hintsOf(turn).notEnoughCash;
  return "";
}

function main(turn: Turn, message = ""): View {
  const t = tx(turn).police;
  const c = ra(turn).police;
  const extra = patrolSurcharge(turn);
  const patrolPrice = c.patrol.price + extra;
  const backdoorPrice = c.backdoor.price + extra;
  let text = fill(t.intro, { inspector: tx(turn).cast.sergeant });
  if (turn.player.policeProtected) text += t.introPatrolled;
  // The leader is told why the car costs more, while there is a car to hire.
  else if (extra > 0 && patrolWhy(turn, 0) === "")
    text += fill(t.introAhead, { inspector: tx(turn).cast.sergeant, extra: cash(extra) });
  const buttons: Button[] = [
    gate(button(`${POLICE}:report`, t.buttons.report), reportWhy(turn)),
    gate(button(`${POLICE}:settle`, t.buttons.settle), reportWhy(turn)),
    gate(
      { ...button(`${POLICE}:patrol`, t.buttons.patrol), detail: cash(patrolPrice) },
      patrolWhy(turn, patrolPrice),
    ),
    gate(
      { ...button(`${POLICE}:backdoor`, t.buttons.backdoor), detail: cash(backdoorPrice) },
      patrolWhy(turn, backdoorPrice),
    ),
    goButton("map", t.buttons.leave),
  ];
  return placeScreen(turn, "police", t.title, t.note, text, message, buttons);
}

function picker(turn: Turn, id: string, prompt: string): View {
  const t = tx(turn).police;
  if (reportWhy(turn) !== "") throw new Error("Nothing to report");
  const players = reportable(turn).map(({ rival, day }) => ({
    id: rival.id,
    name: fill(t.grievanceRow, { rival: rival.name, day }),
  }));
  return {
    ...main(turn),
    buttons: [],
    overlay: {
      kind: "playerPicker",
      id: `${POLICE}:${id}`,
      prompt: fill(prompt, { inspector: tx(turn).cast.sergeant }),
      players,
    },
  };
}

/** Uses up the attacker's entries so one attack is reported once. */
function consume(turn: Turn, rivalId: number): void {
  const state = pa(turn);
  state.attacks = state.attacks.filter((a) => a.by !== rivalId);
  state.today.reports++;
}

function resolve(turn: Turn, mode: "report" | "settle", id: number | null): View {
  if (id === null) return main(turn);
  if (reportWhy(turn) !== "") throw new Error("Cannot report");
  const entry = reportable(turn).find((r) => r.rival.id === id);
  if (!entry) throw new Error("No such attack");
  const rival = entry.rival;
  const t = tx(turn).police;
  const c = ra(turn).police;
  const me = turn.player;
  consume(turn, rival.id);
  if (mode === "report") {
    const fine = Math.min(rival.money, c.report.fine);
    const share = Math.floor(fine * c.report.share);
    moneyMod(rival, -fine);
    moneyMod(me, share);
    karmaMod(me, c.report.karma);
    if (fine > 0) {
      sendPacket(turn.town, rival.id, {
        type: "text",
        text: fill(t.fineMail, { name: me.name, fine: cash(fine) }),
      });
      mailContinue(turn, rival.id);
      addToNews(turn.town, fill(t.fineNews, { name: rival.name, fine: cash(fine) }), "crime");
    }
    refreshRating(turn.rules, me);
    return main(
      turn,
      fine > 0
        ? fill(t.reported, { name: rival.name, fine: cash(fine), share: cash(share) })
        : fill(t.reportedBroke, { name: rival.name }),
    );
  }
  const amount = Math.min(rival.money, c.settle.amount);
  moneyMod(rival, -amount);
  moneyMod(me, amount);
  karmaMod(me, c.settle.karma);
  if (amount > 0) {
    sendPacket(turn.town, rival.id, {
      type: "text",
      text: fill(t.settleMail, { name: me.name, amount: cash(amount) }),
    });
    mailContinue(turn, rival.id);
  }
  return main(
    turn,
    amount > 0
      ? fill(t.settled, { name: rival.name, amount: cash(amount) })
      : fill(t.settledBroke, { name: rival.name }),
  );
}

function buyPatrol(turn: Turn, sure: boolean): View {
  const t = tx(turn).police;
  const c = ra(turn).police;
  const price = (sure ? c.patrol.price : c.backdoor.price) + patrolSurcharge(turn);
  if (patrolWhy(turn, price) !== "") throw new Error("Cannot hire");
  const me = turn.player;
  moneyMod(me, -price);
  spent(turn, "police", price);
  const inspector = tx(turn).cast.sergeant;
  if (sure) {
    me.policeProtected = true;
    pa(turn).today.patrol = true;
    return main(turn, fill(t.patrolBought, { inspector }));
  }
  karmaMod(me, c.backdoor.karma);
  if (turn.rng.random(100) < c.backdoor.chance) {
    me.policeProtected = true;
    pa(turn).today.patrol = true;
    return main(turn, fill(t.backdoorWorked, { inspector }));
  }
  // Failed: the money is gone, and trying again today is allowed.
  return main(turn, fill(t.backdoorFailed, { inspector }));
}

export const policeModule: LocationModule = {
  id: POLICE,
  enter(turn) {
    arrive(turn, tx(turn).police.title, POLICE);
    return main(turn);
  },
  press(turn, command) {
    switch (command) {
      case "main":
        return main(turn);
      case "report":
        return picker(turn, "reportpick", tx(turn).police.reportPrompt);
      case "settle":
        return picker(turn, "settlepick", tx(turn).police.settlePrompt);
      case "patrol":
        return buyPatrol(turn, true);
      case "backdoor":
        return buyPatrol(turn, false);
    }
    throw new Error(`Unknown police command ${command}`);
  },
  pickPlayer(turn, overlayId, playerId) {
    if (overlayId === `${POLICE}:reportpick`) return resolve(turn, "report", playerId);
    if (overlayId === `${POLICE}:settlepick`) return resolve(turn, "settle", playerId);
    throw new Error(`Unknown overlay ${overlayId}`);
  },
};
