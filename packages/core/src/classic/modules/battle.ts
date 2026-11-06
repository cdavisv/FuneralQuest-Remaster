import type { BattlePanel, Button, View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton, hud, legacy } from "../../engine/view.js";
import { defenceStrength, expandedBattleBp } from "../../expanded/pvp.js";
import type { PlayerState } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import { stripLegacyCodes } from "../../text/legacyText.js";
import { isBlocking } from "../blocking.js";
import { makePicture } from "../location.js";
import { broadcastTv, mailContinue, mailPicture, sendPacket } from "../mail.js";
import { addToNews } from "../news.js";
import { expModForceTotal, playerHis } from "../players.js";
import { filterUserText } from "../userText.js";
import { enterHospitalRoom } from "./hospital.js";
import { playerHe, playerHeCap, playerHim, stealRandomCaskets, VISIT } from "./visit.js";

/**
 * Battle (legacy/source/commands_battle.cpp): the battle cry, first strike,
 * blows, Run, the BP and tag transfers, police protection, the quote the
 * winner or loser types for the Crime section, and the hospital. The rival is
 * `session.hisId`; the phase is in `session.sceneData`.
 */
export const BATTLE = "battle";

/**
 * - fight: Run / Attack on screen (`i_location_callback == c_request_battle_callback`).
 * - won, lost: the battle is over, Continue leads to the quote prompt.
 * - ran: the attacker ran away.
 */
type Phase = "fight" | "won" | "lost" | "ran";

const f32 = Math.fround;

function phaseOf(turn: Turn): Phase | null {
  const d = turn.session.sceneData;
  if (typeof d === "object" && d !== null && !Array.isArray(d) && typeof d.battle === "string") {
    return d.battle as Phase;
  }
  return null;
}

function setPhase(turn: Turn, phase: Phase): void {
  turn.session.sceneData = { battle: phase };
}

function rival(turn: Turn): PlayerState {
  const p = turn.town.players[turn.session.hisId];
  if (!p) throw new Error("No battle in progress");
  return p;
}

/** `add_battle_menu` (:91-114): the hit point meters. */
function panel(me: PlayerState, him: PlayerState): BattlePanel {
  return {
    me: { name: me.name, hp: me.hp, hpMax: me.hpMax },
    them: { name: him.name, hp: him.hp, hpMax: him.hpMax },
  };
}

function battleView(
  turn: Turn,
  text: string,
  buttons: Button[],
  pic: { fg?: string | null; bg?: string | null } = {},
): View {
  const t = turn.text.social.battle;
  const him = rival(turn);
  return {
    scene: "location",
    title: turn.session.location,
    text: legacy(text),
    note: legacy(t.note),
    picture: makePicture(pic.fg ?? null, pic.bg === undefined ? "places/funeral_enemy" : pic.bg),
    hud: hud(turn.player),
    battle: panel(turn.player, him),
    music: "music/music_fight",
    buttons,
  };
}

function fightButtons(turn: Turn): Button[] {
  const b = turn.text.social.battle.buttons;
  return [button(`${BATTLE}:run`, b.run), button(`${BATTLE}:attack`, b.attack)];
}

/** `get_hit_type_me` / `get_hit_type_him` (:59-87): damage 1-2, 3-4, ... 13-14, else the last word. */
function verb(words: readonly string[], hit: number): string {
  const band = hit >= 1 && hit <= 14 ? Math.ceil(hit / 2) - 1 : 7;
  return words[band] ?? words[words.length - 1] ?? "";
}

/**
 * A blow's damage, `int(frandom(float(str+1)/2) + float(str+1)/2)` in 32-bit
 * floats (:297, :340): from `(str+1)/2` up to `str+1`, the top value only
 * when the C runtime's `rand()` returns its maximum.
 */
export function blowDamage(turn: Turn, strength: number): number {
  const half = f32(f32(strength + 1) / 2);
  return Math.trunc(f32(turn.rng.frandom(half) + half));
}

/** `battle_get_hit` (:292-327): the rival swings; misses when `random(20) == 0`. */
function getHit(turn: Turn, out: string[]): void {
  const t = turn.text.social.battle;
  const him = rival(turn);
  // Expanded security adds to the defender's strength (docs/expanded-rules.md 9.2); Classic adds 0.
  const bonus = turn.rules.expanded ? defenceStrength(turn, him) : 0;
  let hit = blowDamage(turn, him.strength + bonus);
  // `random(20)` is drawn first and always (C evaluates the left operand first).
  if (turn.rng.random(turn.rules.pvp.defenderMissOneIn) === 0 || hit === 0) {
    out.push(fill(t.sidestep, { name: him.name }));
    hit = 0;
  } else {
    out.push(fill(t.hitsYou, { name: him.name, verb: verb(t.verbsHim, hit), damage: hit }));
  }
  turn.player.hp -= hit;
}

/** `battle_hit` (:329-366): your swing; 1 in 10 is a soul smash for double damage. */
function hit(turn: Turn, out: string[]): void {
  const t = turn.text.social.battle;
  const him = rival(turn);
  let damage = blowDamage(turn, turn.player.strength);
  if (damage === 0) {
    out.push(fill(t.dodges, { name: him.name }));
  } else if (turn.rng.random(turn.rules.pvp.doubleDamageOneIn) === 0) {
    damage *= 2;
    out.push(fill(t.soulSmash, { name: him.name, damage }));
  } else {
    out.push(fill(t.youHit, { verb: verb(t.verbsMe, damage), name: him.name, damage }));
  }
  him.hp -= damage;
}

/**
 * `figure_battle_bp` (:522-543): the winner gains and the loser loses shares
 * of the loser's total BP (2% and 1% when the attacker wins, 1% and 0.5% in
 * self defence), with `exp_mod_force_total` so a loss may cut into the total.
 */
export function battleBp(
  turn: Turn,
  winner: PlayerState,
  loser: PlayerState,
  selfDefense: boolean,
): { won: number; lost: number } {
  // Expanded: a capped, less-than-linear curve (docs/expanded-rules.md 9.1).
  if (turn.rules.expanded) return expandedBattleBp(turn, winner, loser, selfDefense);
  const r = turn.rules.pvp;
  const won = Math.trunc(loser.bp * (selfDefense ? r.defenderWinGain : r.attackerWinGain));
  const lost = Math.trunc(loser.bp * (selfDefense ? r.defenderWinLoss : r.attackerWinLoss));
  expModForceTotal(loser, -lost);
  expModForceTotal(winner, won);
  return { won, lost };
}

/**
 * `somebody_died` (:384-519). Returns the screen when the battle ended, or
 * null when both still stand. `online` is false when the attacker's
 * connection is gone (the original's `lpReq->Socket == NULL`): the loser is
 * then mailed and the Crime section reports the fainting.
 */
function somebodyDied(turn: Turn, text: string[], online = true): View | null {
  const t = turn.text.social.battle;
  const me = turn.player;
  const him = rival(turn);
  if (him.hp < 1) {
    him.hp = 0;
    let mail = fill(t.attackedMail, { name: me.name }) + t.injuredMail;
    him.policeProtected = true;
    const { stolen, tier } = stealRandomCaskets(turn, turn.rules.pvp.battleStealMax, me, him);
    const type = turn.text.social.visit.tagTypes[tier] ?? "";
    const bp = battleBp(turn, me, him, false);
    const stolenText =
      stolen < 1
        ? t.nothingStolen
        : fill(stolen === 1 ? t.oneStolen : t.manyStolen, { count: stolen, type });
    broadcastTv(turn, fill(t.hospitalTv, { name: him.name }));
    mail += fill(t.loseBpMail, { bp: intToCash(bp.lost), stolen: stolenText });
    sendPacket(turn.town, him.id, { type: "text", text: mail });
    mailPicture(turn.town, him.id, "stuff/battle_lose");
    mailContinue(turn, him.id);
    setPhase(turn, "won");
    if (!online) return null;
    const his = playerHis(him);
    const pockets =
      stolen < 1
        ? fill(t.pocketsNothing, { his })
        : fill(stolen === 1 ? t.pocketsOne : t.pocketsMany, { his, count: stolen, type });
    text.push(fill(t.won, { name: him.name, bp: intToCash(bp.won), pockets }));
    return battleView(turn, text.join(""), [button(`${BATTLE}:yellwin`, t.buttons.continue)], {
      fg: "stuff/money_bag_2",
    });
  }
  if (me.hp < 1) {
    me.hp = 0;
    let mail =
      fill(t.attackedMail, { name: me.name }) + fill(t.kickedAssMail, { his: playerHis(me) });
    const bp = battleBp(turn, him, me, true);
    mail += fill(t.earnBpMail, { bp: intToCash(bp.won), day: turn.town.day });
    sendPacket(turn.town, him.id, { type: "text", text: mail });
    mailPicture(turn.town, him.id, "places/hospital_ambulance");
    mailContinue(turn, him.id);
    broadcastTv(turn, fill(t.hospitalTv, { name: me.name }));
    setPhase(turn, "lost");
    if (!online) {
      sendPacket(turn.town, me.id, {
        type: "text",
        text: fill(t.faintedMail, { name: him.name, bp: intToCash(bp.lost) }),
      });
      mailPicture(turn.town, me.id, "stuff/battle_lose");
      mailContinue(turn, me.id);
      addToNews(turn.town, fill(t.faintedCrime, { winner: him.name, loser: me.name }), "crime");
      return null;
    }
    text.push(fill(t.lost, { bp: intToCash(bp.lost) }));
    return battleView(turn, text.join(""), [button(`${BATTLE}:yelllost`, t.buttons.continue)], {
      fg: "stuff/battle_lose",
      bg: null,
    });
  }
  return null;
}

/** Each step's text ends with a blank line (`cst_temp + "\n\n"`, :325, :364). */
function blows(lines: string[]): string[] {
  return lines.map((l) => (l.endsWith("\n\n") ? l : `${l}\n\n`));
}

/**
 * `command_battle` (:215-289), from Attack in a rival's parlor (hit points
 * already full): the cry (`random(6)`), then whoever has more plots swings
 * first; otherwise the rival strikes before you can act.
 */
export function startBattle(turn: Turn): View {
  const t = turn.text.social.battle;
  const me = turn.player;
  const him = rival(turn);
  turn.session.scene = BATTLE;
  setPhase(turn, "fight");
  let cry = t.cries[turn.rng.random(t.cries.length)] ?? "";
  cry = fill(cry, {
    name: him.name,
    discount: him.male ? t.discountMale : t.discountFemale,
  });
  const text: string[] = [fill(t.scream, { cry, his: playerHis(him) })];
  if (me.plots > him.plots) {
    text.push(fill(t.firstSwing, { name: him.name }));
  } else {
    text.push(fill(t.theyKnew, { name: him.name, he: playerHe(him) }));
    const swings: string[] = [];
    getHit(turn, swings);
    text.push(...blows(swings));
    const ended = somebodyDied(turn, text);
    if (ended) return ended;
  }
  return battleView(turn, text.join(""), fightButtons(turn));
}

/** `command_battle_attack` (:173-212): your swing, then theirs if they still stand. */
function attack(turn: Turn): View {
  const text: string[] = [];
  const swings: string[] = [];
  hit(turn, swings);
  text.push(...blows(swings));
  const first = somebodyDied(turn, text);
  if (first) return first;
  const back: string[] = [];
  getHit(turn, back);
  text.push(...blows(back));
  const second = somebodyDied(turn, text);
  if (second) return second;
  return battleView(turn, text.join(""), fightButtons(turn));
}

/** `command_battle_run` (:117-152): the rival is told you ran. */
function run(turn: Turn): View {
  const t = turn.text.social.battle;
  const me = turn.player;
  const him = rival(turn);
  const mail =
    fill(t.attackedMail, { name: me.name }) + fill(t.ranOffMail, { HeCap: playerHeCap(me) });
  sendPacket(turn.town, him.id, { type: "text", text: mail });
  mailPicture(turn.town, him.id, "people/man_prowl");
  mailContinue(turn, him.id);
  setPhase(turn, "ran");
  return battleView(turn, t.run, [goButton(VISIT, t.buttons.continue)]);
}

/** `command_battle_yell_win` / `_lost` (:547-619): the `i_get_text` prompt on the last screen. */
function quotePrompt(turn: Turn, prompt: string): View {
  const last = turn.session.view;
  if (!last) throw new Error("No battle screen");
  return {
    ...last,
    overlay: {
      kind: "textInput",
      id: `${BATTLE}:quote`,
      prompt: stripLegacyCodes(prompt),
      maxLength: turn.rules.textLimits.battleQuote,
    },
  };
}

/** `cst_text == "12ABORT12" || cst_text.GetLength() < 2` (:576, :635). */
function noQuote(text: string | null): boolean {
  return text === null || text === "12ABORT12" || text.length < 2;
}

/** `command_battle_got_yell_win` (:562-602): the Crime entry, then the row of parlors. */
function gotYellWin(turn: Turn, raw: string | null): View {
  const t = turn.text.social.battle;
  const me = turn.player;
  const him = rival(turn);
  const quote = raw === null ? null : filterUserText(turn, raw, "battleQuote");
  let news: string;
  if (noQuote(quote)) {
    news = fill(t.crimeWin, { winner: me.name, loser: him.name });
  } else {
    news = fill(t.crimeWinQuote, { winner: me.name, loser: him.name, quote: quote ?? "" });
    // The quote is not mailed to a victim who blocked the winner (classic/blocking.ts).
    if (!isBlocking(turn.town, him.id, me.id)) {
      sendPacket(turn.town, him.id, {
        type: "text",
        text: fill(t.winQuoteMail, { name: me.name, quote: quote ?? "" }),
      });
      mailPicture(turn.town, him.id, "places/hospital_room");
      mailContinue(turn, him.id);
    }
  }
  addToNews(turn.town, news, "crime");
  const row = turn.registry.module(VISIT);
  if (!row?.enter) throw new Error("No parlors module");
  turn.session.scene = VISIT;
  return row.enter(turn, undefined);
}

/** `command_battle_got_yell_lost` (:621-662): the Crime entry, then the hospital bed. */
function gotYellLost(turn: Turn, raw: string | null): View {
  const t = turn.text.social.battle;
  const me = turn.player;
  const him = rival(turn);
  const quote = raw === null ? null : filterUserText(turn, raw, "battleQuote");
  let news: string;
  if (noQuote(quote)) {
    news = fill(t.crimeLost, { winner: him.name, loser: me.name });
  } else {
    news = fill(t.crimeLostQuote, { winner: him.name, loser: me.name, quote: quote ?? "" });
    if (!isBlocking(turn.town, him.id, me.id)) {
      mailPicture(turn.town, him.id, "places/hospital_ambulance");
      sendPacket(turn.town, him.id, {
        type: "text",
        text: fill(t.lostQuoteMail, { name: me.name, him: playerHim(me), quote: quote ?? "" }),
      });
      mailContinue(turn, him.id);
    }
  }
  addToNews(turn.town, news, "crime");
  // command_hospital_room: the hospital module's bed (modules/hospital.ts).
  return enterHospitalRoom(turn);
}

/** Whether the acting player is in the middle of a fight (Run / Attack on screen). */
export function inBattle(turn: Turn): boolean {
  return turn.session.scene === BATTLE && phaseOf(turn) === "fight";
}

/**
 * The connection dropped or the player logged off. The original let a player
 * escape a losing battle this way; its fix is commented out in
 * `online_delete_guy` (online_util.cpp:135-156): set the attacker's hit points
 * to 0 and run `somebody_died` without a socket. With `fixes.battleDisconnect`
 * that is what happens; a quote prompt left unanswered files the quote-less
 * Crime entry (the original filed none).
 */
export function battleOnDisconnect(turn: Turn): void {
  if (!turn.rules.fixes.battleDisconnect || turn.session.scene !== BATTLE) return;
  const phase = phaseOf(turn);
  const him = turn.town.players[turn.session.hisId];
  if (!him) return;
  if (phase === "fight") {
    turn.player.hp = 0;
    somebodyDied(turn, [], false);
  } else if (phase === "won") {
    addToNews(
      turn.town,
      fill(turn.text.social.battle.crimeWin, { winner: turn.player.name, loser: him.name }),
      "crime",
    );
  } else if (phase === "lost") {
    addToNews(
      turn.town,
      fill(turn.text.social.battle.crimeLost, { winner: him.name, loser: turn.player.name }),
      "crime",
    );
  }
}

export const battleModule: LocationModule = {
  id: BATTLE,
  press(turn, command) {
    const phase = phaseOf(turn);
    // BattleAlreadyEnded (:156-171): both must still stand to run or swing.
    if ((command === "run" || command === "attack") && phase === "fight") {
      if (turn.player.hp <= 0 || rival(turn).hp <= 0) throw new Error("The battle is over");
      return command === "run" ? run(turn) : attack(turn);
    }
    if (command === "yellwin" && phase === "won") {
      return quotePrompt(turn, turn.text.social.battle.yellWinPrompt);
    }
    if (command === "yelllost" && phase === "lost") {
      return quotePrompt(turn, turn.text.social.battle.yellLostPrompt);
    }
    throw new Error(`Unknown battle command ${command}`);
  },
  submitText(turn, overlayId, text) {
    if (overlayId !== `${BATTLE}:quote`) throw new Error(`Unknown overlay ${overlayId}`);
    const phase = phaseOf(turn);
    if (phase === "won") return gotYellWin(turn, text);
    if (phase === "lost") return gotYellLost(turn, text);
    throw new Error("No quote is due");
  },
};
