import type { Button, MonumentsPanel, View } from "@fq/protocol";
import { mailContinue, sendPacket } from "../../classic/mail.js";
import { addToNews } from "../../classic/news.js";
import { expModForceTotal, luckMod } from "../../classic/players.js";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton, hud } from "../../engine/view.js";
import type { PlayerState } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import { modValue } from "../modifiers.js";
import { hasPerk, refreshRating } from "../parlor.js";
import { clamp, karmaMod, moneyMod, pick, reviewsMod, xp, xr } from "../players.js";
import { isPeaceful } from "../pvp.js";
import { pvpGain } from "../scoring.js";
import {
  addInjury,
  arrive,
  card,
  cash,
  chainHit,
  chainSheltered,
  chooseInjury,
  injuryHp,
  life,
  lifeOf,
  line,
  off,
  sameChain,
  spent,
  TOWN_MODIFIER_KEYS,
  today,
  townScreen,
  tr,
  xt,
} from "./life.js";
import type { DuelState } from "./state.js";

/**
 * The Town Graveyard (docs/expanded-rules.md section 16), the authors' cut
 * "Town Graveyards": monuments bought with money, tending the graves (high
 * karma), robbing a fresh grave (low karma), and graveyard duels, a second
 * PvP venue with its own rules. Button ids: `graveyard:monuments`,
 * `graveyard:monument`, `graveyard:tend`, `graveyard:rob`, `graveyard:look`,
 * `graveyard:duel` (opens the picker `graveyard:pick`), `graveyard:swing`,
 * `graveyard:shove`, `graveyard:yield`.
 */
export const GRAVEYARD = "graveyard";

function pics(turn: Turn) {
  return xt(turn).pictures.graveyard;
}

function screen(turn: Turn, text: string, buttons: Button[]): View {
  const t = xt(turn).text.graveyard;
  const view = townScreen(turn, { title: t.title, note: t.note, text, buttons, ...pics(turn) });
  view.monuments = monumentsPanel(turn);
  return view;
}

/** Section 11.5: the monuments built and every tier, so the client can light the built ones. */
export function monumentsPanel(turn: Turn): MonumentsPanel {
  const names = xt(turn).monuments;
  return {
    built: life(turn).monuments,
    tiers: tr(turn).graveyard.monuments.map((m, i) => ({
      name: names[i] ?? `#${i + 1}`,
      price: m.price,
      bp: m.bp,
      rating: m.rating,
    })),
  };
}

function duelsLeft(turn: Turn): number {
  return Math.max(0, tr(turn).graveyard.duel.perDay - today(turn).duels);
}

function main(turn: Turn, message = ""): View {
  const t = xt(turn).text.graveyard;
  const g = tr(turn).graveyard;
  const hints = xt(turn).text.hints;
  const p = turn.player;
  const l = life(turn);
  const x = xp(turn);
  const rules = xr(turn);
  const monument = l.monuments > 0 ? (xt(turn).monuments[l.monuments - 1] ?? "") : t.noMonument;
  const intro = fill(t.intro, { plots: intToCash(p.plots), monument, duels: duelsLeft(turn) });
  const buttons: Button[] = [
    button(`${GRAVEYARD}:monuments`, t.buttons.monuments),
    button(`${GRAVEYARD}:duel`, t.buttons.duel),
  ];
  if (modValue(turn.town, TOWN_MODIFIER_KEYS.duels, 1) <= 0)
    buttons[1] = off(buttons[1] as Button, hints.closedToday);
  else if (duelsLeft(turn) <= 0) buttons[1] = off(buttons[1] as Button, hints.doneToday);
  else if (p.turns < g.duel.turns) buttons[1] = off(buttons[1] as Button, hints.noTurns);
  else if (isPeaceful(p)) buttons[1] = off(buttons[1] as Button, t.duel.selfPeaceful);
  // A free action shows no turn cost (section 16.2: tending and robbing cost no turn since tuning).
  const cost = (turns: number) => (turns > 0 ? { detail: fill(hints.costsTurns, { turns }) } : {});
  let tend: Button = {
    ...button(`${GRAVEYARD}:tend`, t.buttons.tend),
    group: "more",
    ...cost(g.tend.turns),
  };
  if (p.karma < g.tend.karmaAtLeast) tend = off(tend, hints.karmaTooLow);
  else if (today(turn).tended >= g.tend.perDay) tend = off(tend, hints.doneToday);
  else if (p.turns < g.tend.turns) tend = off(tend, hints.noTurns);
  let rob: Button = {
    ...button(`${GRAVEYARD}:rob`, t.buttons.rob),
    group: "more",
    ...cost(g.rob.turns),
  };
  if (p.karma > g.rob.karmaAtMost) rob = off(rob, hints.karmaTooHigh);
  else if (x.daily.dug >= rules.karma.dig.perDay) rob = off(rob, hints.doneToday);
  else if (p.turns < g.rob.turns) rob = off(rob, hints.noTurns);
  buttons.push(tend, rob, { ...button(`${GRAVEYARD}:look`, t.buttons.look), group: "more" });
  buttons.push(goButton("map", t.buttons.leave));
  return screen(turn, message === "" ? intro : `${message}\n\n${intro}`, buttons);
}

// ---------------------------------------------------------------- 16.1 monuments

function monumentsView(turn: Turn, message = ""): View {
  const t = xt(turn).text.graveyard;
  const tiers = tr(turn).graveyard.monuments;
  const names = xt(turn).monuments;
  const l = life(turn);
  const current = l.monuments > 0 ? (names[l.monuments - 1] ?? "") : t.noMonument;
  let text = message === "" ? fill(t.monumentsIntro, { current }) : `${message}\n\n`;
  const buttons: Button[] = [];
  const next = tiers[l.monuments];
  if (next) {
    const name = names[l.monuments] ?? `#${l.monuments + 1}`;
    text += fill(t.monumentLine, { name, price: intToCash(next.price), bp: next.bp });
    const b = card(`${GRAVEYARD}:monument`, name, cash(next.price));
    buttons.push(turn.player.money < next.price ? off(b, xt(turn).text.hints.notEnoughCash) : b);
  } else text += t.allBuilt;
  buttons.push(button(`${GRAVEYARD}:main`, t.buttons.back));
  return screen(turn, text, buttons);
}

/** Section 16.1: the next monument tier, for money; BP once, rating while it stands. */
function buyMonument(turn: Turn): View {
  const tiers = tr(turn).graveyard.monuments;
  const l = life(turn);
  const p = turn.player;
  const next = tiers[l.monuments];
  if (!next) throw new Error("Every monument is built");
  if (p.money < next.price) throw new Error("Not enough cash");
  moneyMod(p, -next.price);
  spent(turn, "monuments", next.price);
  l.monuments++;
  p.bp += next.bp;
  p.bpToday += next.bp;
  refreshRating(turn.rules, p);
  const name = xt(turn).monuments[l.monuments - 1] ?? "";
  return monumentsView(turn, fill(xt(turn).text.graveyard.monumentBought, { name, bp: next.bp }));
}

// ---------------------------------------------------------------- 16.2 tending, 16.3 robbing

function tend(turn: Turn): View {
  const g = tr(turn).graveyard.tend;
  const t = xt(turn).text.graveyard;
  const p = turn.player;
  const d = today(turn);
  if (p.karma < g.karmaAtLeast || d.tended >= g.perDay || p.turns < g.turns)
    throw new Error("Cannot tend the graves");
  p.turns -= g.turns;
  d.tended++;
  const rules = xr(turn);
  const rng = turn.rng;
  const luck = rng.randomRange(g.luck.min, g.luck.max);
  luckMod(turn.rules, p, luck);
  let reviews = g.reviews;
  let text = fill(line(turn, t.tended), { luck });
  if (hasPerk(rules, p, "church-associate")) {
    reviews += g.associateReviews;
    text += `\n${t.tendedAssociate}`;
  }
  reviewsMod(p, rules, reviews);
  const l = life(turn);
  if (rng.random(100) < g.leadChance && l.leads < tr(turn).hospital.lead.max) {
    l.leads++;
    text += `\n${t.tendedLead}`;
  }
  refreshRating(turn.rules, p);
  return main(turn, text);
}

function rob(turn: Turn): View {
  const g = tr(turn).graveyard.rob;
  const t = xt(turn).text.graveyard;
  const rules = xr(turn);
  const p = turn.player;
  const x = xp(turn);
  if (p.karma > g.karmaAtMost || x.daily.dug >= rules.karma.dig.perDay || p.turns < g.turns)
    throw new Error("Cannot rob a grave");
  p.turns -= g.turns;
  x.daily.dug++;
  const rng = turn.rng;
  const luck = clamp(Math.round(modValue(turn.town, TOWN_MODIFIER_KEYS.robLuck, p.luck)), 1, 100);
  let text: string;
  if (rng.randomYesNo(luck, g.luckWeight)) {
    if (rng.random(g.silverOneIn) === 0) {
      p.tags[1] = (p.tags[1] ?? 0) + 1;
      text = t.robSilver;
    } else {
      const money = rng.randomRange(g.money.min / 50, g.money.max / 50) * 50;
      moneyMod(p, money);
      text = fill(line(turn, t.robFound), { money: intToCash(money) });
    }
  } else {
    const fine = Math.min(p.money, g.fine);
    moneyMod(p, -fine);
    karmaMod(p, g.karma);
    reviewsMod(p, rules, g.reviews);
    text = fill(t.robCaught, { fine: intToCash(fine) });
    const hurt = addInjury(turn, p, chooseInjury(turn, "rob") ?? g.injury);
    if (hurt !== "") text += `\n${hurt}`;
  }
  refreshRating(turn.rules, p);
  return main(turn, text);
}

function look(turn: Turn): View {
  const t = xt(turn).text.graveyard;
  const rows = turn.town.players
    .filter((p) => p.active)
    .sort((a, b) => b.plots - a.plots || a.id - b.id)
    .slice(0, 3)
    .map((p) => `${p.name} (${intToCash(p.plots)})`)
    .join(", ");
  return main(turn, `${line(turn, t.look)}\n${fill(t.lookRows, { list: rows })}`);
}

// ---------------------------------------------------------------- 16.4 duels

function rivalsFor(turn: Turn): { id: number; name: string }[] {
  return turn.town.players
    .filter((p) => p.active && p.id !== turn.player.id && p.expanded)
    .map((p) => ({ id: p.id, name: p.name }));
}

function pickRival(turn: Turn): View {
  const t = xt(turn).text.graveyard;
  const players = rivalsFor(turn);
  if (players.length === 0) return main(turn, t.duel.nobody);
  return {
    ...main(turn),
    buttons: [],
    overlay: { kind: "playerPicker", id: `${GRAVEYARD}:pick`, prompt: t.duel.prompt, players },
  };
}

/** Why `him` cannot be met in the graveyard today, or "" (section 16.4). */
export function duelRefusal(turn: Turn, him: PlayerState | undefined): string {
  const t = xt(turn).text.graveyard.duel;
  const hints = xt(turn).text.hints;
  const me = turn.player;
  const g = tr(turn).graveyard.duel;
  if (!him?.active || !him.expanded) return t.nobody;
  if (him.id === me.id) return t.self;
  if (modValue(turn.town, TOWN_MODIFIER_KEYS.duels, 1) <= 0) return hints.closedToday;
  if (isPeaceful(me)) return t.selfPeaceful;
  if (isPeaceful(him)) return fill(t.targetPeaceful, { name: him.name });
  if (sameChain(turn.town, me, him)) return fill(t.chainMate, { name: him.name });
  if (duelsLeft(turn) <= 0) return hints.doneToday;
  if (me.turns < g.turns) return hints.noTurns;
  if (lifeOf(turn.town, him).today.duelsLost >= g.perVictimPerDay)
    return fill(t.rivalTired, { name: him.name });
  if (chainSheltered(turn, him)) return fill(t.sheltered, { name: him.name });
  return "";
}

function duelState(turn: Turn): DuelState {
  const d = turn.session.sceneData as unknown as DuelState | null;
  if (!d || typeof d !== "object" || typeof d.rival !== "number") throw new Error("No duel");
  return d;
}

function rival(turn: Turn, d: DuelState): PlayerState {
  const him = turn.town.players[d.rival];
  if (!him) throw new Error("The rival is gone");
  return him;
}

/** A blow: `(strength + 1) / 2` plus up to as much again, as the parlor fight (section 9). */
function blow(turn: Turn, strength: number): number {
  const half = (strength + 1) / 2;
  return Math.trunc(turn.rng.frandom(half) + half);
}

/** Section 16.4: the chance (percent) a shove sends the other into an open grave. */
export function shoveChance(turn: Turn, mine: number, his: number): number {
  const s = tr(turn).graveyard.duel.shove;
  return clamp(s.base + s.perStrength * (mine - his), s.min, s.max);
}

function duelView(turn: Turn, d: DuelState, text: string): View {
  const t = xt(turn).text.graveyard;
  const him = rival(turn, d);
  const me = turn.player;
  const pictures = xt(turn).pictures.duel;
  const buttons: Button[] = d.over
    ? [goButton(GRAVEYARD, t.buttons.continue)]
    : [
        button(`${GRAVEYARD}:swing`, t.buttons.swing),
        {
          ...button(`${GRAVEYARD}:shove`, t.buttons.shove),
          detail: fill(t.duel.shoveDetail, {
            chance: shoveChance(turn, me.strength, him.strength),
          }),
        },
        button(`${GRAVEYARD}:yield`, t.buttons.yield),
      ];
  const view = townScreen(turn, { title: t.title, text, buttons, ...pictures });
  view.battle = {
    me: { name: me.name, hp: Math.max(0, d.me), hpMax: d.meMax },
    them: { name: him.name, hp: Math.max(0, d.him), hpMax: d.himMax },
  };
  view.hud = hud(me);
  return view;
}

/**
 * The rival's move: a swing, or now and then a shove. A shove that lands
 * (section 16.4) puts the player in the grave: the rival swings while they
 * climb out, and the player's next move is lost (the rival swings again).
 */
function rivalMove(turn: Turn, d: DuelState, out: string[]): void {
  const t = xt(turn).text.graveyard.duel;
  const g = tr(turn).graveyard.duel;
  const him = rival(turn, d);
  const me = turn.player;
  const rng = turn.rng;
  if (rng.random(100) < g.aiShove) {
    if (rng.random(100) < shoveChance(turn, him.strength, me.strength)) {
      const damage = rng.randomRange(g.graveDamage.min, g.graveDamage.max);
      d.me -= damage;
      out.push(fill(t.theyShove, { name: him.name, damage }));
      if (d.me > 0) rivalSwing(turn, d, out);
      // The player's lost move.
      if (g.shoveCostsMove && d.me > 0) rivalSwing(turn, d, out);
    } else {
      out.push(fill(t.theyShoveFail, { name: him.name }));
      if (d.him > 0) mySwing(turn, d, out);
    }
    return;
  }
  rivalSwing(turn, d, out);
}

function rivalSwing(turn: Turn, d: DuelState, out: string[]): void {
  const t = xt(turn).text.graveyard.duel;
  const him = rival(turn, d);
  const damage = turn.rng.random(20) === 0 ? 0 : blow(turn, him.strength);
  if (damage === 0) out.push(fill(t.theyMiss, { name: him.name }));
  else out.push(fill(t.theyHit, { name: him.name, damage }));
  d.me -= damage;
}

function mySwing(turn: Turn, d: DuelState, out: string[]): void {
  const t = xt(turn).text.graveyard.duel;
  const him = rival(turn, d);
  const damage = turn.rng.random(20) === 0 ? 0 : blow(turn, turn.player.strength);
  if (damage === 0) out.push(fill(t.youMiss, { name: him.name }));
  else out.push(fill(t.youHit, { name: him.name, damage }));
  d.him -= damage;
}

/** Section 16.4: what the winner of a duel takes (the parlor curve x gainShare, no home advantage). */
export function duelStake(turn: Turn, winner: PlayerState, loser: PlayerState): number {
  const rules = xr(turn);
  const p = rules.pvp;
  let mult = rules.town.graveyard.duel.gainShare;
  if (winner.expanded?.rivalry === "cutthroat" && loser.expanded?.rivalry === "cutthroat")
    mult *= p.cutthroatMult;
  if (hasPerk(rules, winner, "necromancer")) mult *= p.necroMult;
  if (hasPerk(rules, loser, "church-associate")) mult *= p.sanctuaryMult;
  mult = modValue(turn.town, TOWN_MODIFIER_KEYS.pvpGain, mult);
  return Math.max(0, Math.floor(pvpGain(rules, loser.bp) * mult));
}

function settle(turn: Turn, d: DuelState, out: string[]): void {
  const t = xt(turn).text.graveyard.duel;
  const g = tr(turn).graveyard.duel;
  const me = turn.player;
  const him = rival(turn, d);
  if (d.him > 0 && d.me > 0) return;
  d.over = true;
  const iWon = d.him <= 0 && d.me > 0;
  const winner = iWon ? me : him;
  const loser = iWon ? him : me;
  const won = duelStake(turn, winner, loser);
  const lost = Math.floor(won * xr(turn).pvp.lossShare);
  expModForceTotal(loser, -lost);
  expModForceTotal(winner, won);
  const hurt = addInjury(turn, loser, chooseInjury(turn, "duel") ?? pick(turn.rng, g.injuries));
  if (iWon) {
    lifeOf(turn.town, him).today.duelsLost++;
    chainHit(turn, him);
    out.push(fill(t.won, { name: him.name, bp: won }));
    sendPacket(turn.town, him.id, {
      type: "text",
      text: `${fill(t.lostMail, { name: me.name, bp: lost })}${hurt === "" ? "" : `\n${hurt}`}`,
    });
  } else {
    out.push(fill(t.lost, { name: him.name, bp: lost }));
    if (hurt !== "") out.push(hurt);
    sendPacket(turn.town, him.id, {
      type: "text",
      text: fill(t.wonMail, { name: me.name, bp: won }),
    });
  }
  mailContinue(turn, him.id);
  addToNews(turn.town, fill(t.crime, { winner: winner.name, loser: loser.name }), "crime");
}

function startDuel(turn: Turn, id: number | null): View {
  const t = xt(turn).text.graveyard;
  if (id === null) return main(turn);
  const him = turn.town.players[id];
  const why = duelRefusal(turn, him);
  if (why !== "" || !him) return main(turn, why);
  const me = turn.player;
  const g = tr(turn).graveyard.duel;
  me.turns -= g.turns;
  today(turn).duels++;
  const meMax = Math.max(1, me.hpMax - injuryHp(turn, me));
  const himMax = Math.max(1, him.hpMax - injuryHp(turn, him));
  const d: DuelState = { rival: him.id, me: meMax, him: himMax, meMax, himMax, over: false };
  turn.session.hisId = him.id;
  const out: string[] = [];
  // The Design Doc: "First attack is decided by who has more plots."
  if (me.plots > him.plots) out.push(fill(t.duel.youFirst, { name: him.name }));
  else {
    out.push(fill(t.duel.theyFirst, { name: him.name }));
    rivalMove(turn, d, out);
    settle(turn, d, out);
  }
  turn.session.sceneData = { ...d };
  return duelView(turn, d, out.join("\n"));
}

function exchange(turn: Turn, move: "swing" | "shove" | "yield"): View {
  const d = duelState(turn);
  if (d.over) throw new Error("The duel is over");
  const t = xt(turn).text.graveyard.duel;
  const g = tr(turn).graveyard.duel;
  const me = turn.player;
  const him = rival(turn, d);
  const out: string[] = [];
  if (move === "yield") {
    const stake = duelStake(turn, him, me);
    const lost = Math.floor(stake * xr(turn).pvp.lossShare * g.yieldShare);
    const gain = Math.floor(stake * g.yieldShare);
    expModForceTotal(me, -lost);
    expModForceTotal(him, gain);
    d.over = true;
    out.push(fill(t.yielded, { name: him.name, bp: lost }));
    sendPacket(turn.town, him.id, {
      type: "text",
      text: fill(t.yieldMail, { name: me.name, bp: gain }),
    });
    mailContinue(turn, him.id);
  } else if (move === "shove") {
    // Section 16.4: a shove that lands costs the rival their next move (they are climbing out
    // of the grave while the player swings); one that fails gives them a free swing first.
    const rng = turn.rng;
    let lands = false;
    if (rng.random(100) < shoveChance(turn, me.strength, him.strength)) {
      lands = true;
      const damage = rng.randomRange(g.graveDamage.min, g.graveDamage.max);
      d.him -= damage;
      out.push(fill(t.shoveIn, { name: him.name, damage }));
      if (d.him > 0) mySwing(turn, d, out);
    } else {
      out.push(fill(t.shoveFail, { name: him.name }));
      rivalSwing(turn, d, out);
    }
    settle(turn, d, out);
    if (!d.over && !(lands && g.shoveCostsMove)) {
      rivalMove(turn, d, out);
      settle(turn, d, out);
    }
  } else {
    mySwing(turn, d, out);
    settle(turn, d, out);
    if (!d.over) {
      rivalMove(turn, d, out);
      settle(turn, d, out);
    }
  }
  turn.session.sceneData = { ...d };
  return duelView(turn, d, out.join("\n"));
}

export const graveyardModule: LocationModule = {
  id: GRAVEYARD,
  enter(turn) {
    arrive(turn, xt(turn).text.graveyard.title, GRAVEYARD);
    return main(turn);
  },
  press(turn, command) {
    switch (command) {
      case "main":
        return main(turn);
      case "monuments":
        return monumentsView(turn);
      case "monument":
        return buyMonument(turn);
      case "tend":
        return tend(turn);
      case "rob":
        return rob(turn);
      case "look":
        return look(turn);
      case "duel":
        return pickRival(turn);
      case "swing":
      case "shove":
      case "yield":
        return exchange(turn, command);
    }
    throw new Error(`Unknown graveyard command ${command}`);
  },
  pickPlayer(turn, overlayId, playerId) {
    if (overlayId !== `${GRAVEYARD}:pick`) throw new Error(`Unknown overlay ${overlayId}`);
    return startDuel(turn, playerId);
  },
  /** A duel left open counts as a yield (section 16.4). */
  sessionEnd(turn) {
    const d = turn.session.sceneData as unknown as DuelState | null;
    if (d && typeof d === "object" && typeof d.rival === "number" && !d.over) {
      exchange(turn, "yield");
    }
  },
};
