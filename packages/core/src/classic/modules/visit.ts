import type { AssetId, Button, Overlay, View } from "@fq/protocol";
import type { LocationModule } from "../../engine/registry.js";
import type { Turn } from "../../engine/turn.js";
import { button, goButton, hud, legacy } from "../../engine/view.js";
import { bonusVisits } from "../../expanded/pvp.js";
import { Custom, type PlayerState } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import { enterLocation, makePicture } from "../location.js";
import { mailContinue, mailPicture, sendPacket } from "../mail.js";
import { type NameSearch, nameAnswer, namePrompt, readNameSearch } from "../nameSearch.js";
import { playerHis } from "../players.js";
import { isPresent } from "../presence.js";
import { startBattle } from "./battle.js";
import { rankingRows, rankingsView } from "./rankings.js";

/**
 * The row of rival parlors (legacy/source/commands_comp.cpp): Look, Visit by
 * name, the front door, padlocks and lockpicks, the view inside, Steal, and
 * Attack (which hands over to the battle module). The target is
 * `session.hisId`; `session.locked` is the original's `b_locked`, the
 * one-intruder lock (`get_player_who_locked_this_guy`, misc_utils.cpp:279-301).
 */
export const VISIT = "competitors";

/** Scene data: the name search in progress. */
type VisitData = NameSearch;

/** `play_he` / `play_him` (misc_utils.cpp:18-46). */
export function playerHe(p: PlayerState): string {
  return p.male ? "he" : "she";
}
export function playerHim(p: PlayerState): string {
  return p.male ? "him" : "her";
}
export function playerHeCap(p: PlayerState): string {
  return p.male ? "He" : "She";
}

/** `get_transportation` (transportation.cpp:6-10). */
export function rideName(turn: Turn, p: PlayerState): string {
  return turn.text.hearseNames[p.transportation] ?? turn.text.hearseNames[0] ?? "";
}

interface Screen {
  note?: string;
  bg?: AssetId;
  music?: string;
}

/** A screen of this module: `i_generic` with the note, background and buttons given. */
function screen(
  turn: Turn,
  text: string,
  buttons: Button[],
  look: Screen,
  overlay?: Overlay,
): View {
  const view: View = {
    scene: "location",
    title: turn.text.social.visit.location,
    text: legacy(text),
    picture: makePicture(null, look.bg),
    hud: hud(turn.player),
    buttons,
  };
  if (look.note !== undefined) view.note = legacy(look.note);
  if (look.music !== undefined) view.music = look.music;
  if (overlay) view.overlay = overlay;
  return view;
}

/** The look of the last screen, for handlers that only change the text (`c_command_generic`). */
function sameLook(turn: Turn): Screen {
  const v = turn.session.view;
  const look: Screen = {};
  if (v?.note) look.note = v.note.map((s) => s.text).join("");
  if (v?.picture?.bg) look.bg = v.picture.bg;
  return look;
}

const ROW_LOOK = (turn: Turn): Screen => ({
  note: turn.text.social.visit.note,
  bg: "places/palors",
});

function visitsLeft(turn: Turn): number {
  // Expanded cutthroat parlors get extra visits (docs/expanded-rules.md 9.3); Classic adds 0.
  const bonus = turn.rules.expanded ? bonusVisits(turn) : 0;
  return turn.settings.visitsPerDay + bonus - turn.player.playerFights;
}

/** `add_comp_menu` (commands_comp.cpp:106-128). */
function menuText(turn: Turn): string {
  const t = turn.text.social.visit;
  const left = visitsLeft(turn);
  if (left <= 0) return t.watchNone;
  return left === 1 ? t.watchOne : fill(t.watchMany, { visits: left });
}

function menuButtons(turn: Turn): Button[] {
  const b = turn.text.social.visit.buttons;
  return [
    goButton("map", b.leave),
    button(`${VISIT}:look`, b.look),
    button(`${VISIT}:visit`, b.visit),
  ];
}

/** `command_comp_menu` (:159-167): the menu again on the screen already shown. */
function menu(turn: Turn, overlay?: Overlay): View {
  return screen(turn, menuText(turn), menuButtons(turn), ROW_LOOK(turn), overlay);
}

/** `command_comp` (:170-192): arrive at the row of parlors. */
function enterRow(turn: Turn): View {
  enterLocation(turn, turn.text.social.visit.location);
  turn.session.scene = VISIT;
  return menu(turn);
}

/** `command_comp_look` (:80-103): the rankings without police-protected players; Continue comes back here. */
function look(turn: Turn): View {
  return rankingsView(
    turn,
    rankingRows(turn, true),
    goButton(VISIT, turn.text.social.visit.buttons.continue),
  );
}

/** `command_comp_get_name` (:130-155). */
function getName(turn: Turn): View {
  const t = turn.text.social.visit;
  if (visitsLeft(turn) <= 0) {
    return screen(
      turn,
      t.noVisitsLeft,
      [button(`${VISIT}:menu`, t.buttons.continue)],
      sameLook(turn),
    );
  }
  return menu(turn, namePrompt(turn, VISIT, t.whoPrompt));
}

/** The player whose parlor this is, or null when the visit lost its target. */
function target(turn: Turn): PlayerState | null {
  const id = turn.session.hisId;
  const p = id >= 0 ? turn.town.players[id] : undefined;
  return p?.active ? p : null;
}

/** `get_player_who_locked_this_guy` (misc_utils.cpp:279-301): the last such slot wins, as there. */
export function lockedBy(turn: Turn, targetId: number): number {
  let found = -1;
  for (const [key, s] of Object.entries(turn.town.sessions)) {
    const id = Number(key);
    if (!turn.town.players[id]?.active) continue;
    if (s.hisId === targetId && s.locked && id > found) found = id;
  }
  return found;
}

const leave = (turn: Turn): Button => goButton(VISIT, turn.text.social.visit.buttons.leave);

/**
 * The online and police checks of `command_comp_in_front` (:224-251). Returns
 * the refusal screen, or null when the rival may be visited.
 */
function refusal(turn: Turn, him: PlayerState): View | null {
  const t = turn.text.social.visit;
  const front: Screen = {
    note: fill(t.frontNote, { parlor: him.parlor }),
    bg: "places/funeral_enemy",
    music: "music/music_sneak",
  };
  if (isPresent(turn.town, him.id)) {
    turn.session.locked = false;
    return screen(turn, fill(t.online, { name: him.name }), [leave(turn)], front);
  }
  if (him.policeProtected) {
    turn.session.locked = false;
    const text = fill(t.police, {
      ride: rideName(turn, turn.player),
      parlor: him.parlor,
      name: him.name,
    });
    return screen(turn, text, [leave(turn)], { ...front, bg: "places/funeral_enemy_police" });
  }
  return null;
}

/**
 * With `fixes.visitTargetRecheck`, the rival must still be offline and
 * unprotected at every step inside; the original checked only at the door.
 */
function recheck(turn: Turn, him: PlayerState): View | null {
  return turn.rules.fixes.visitTargetRecheck ? refusal(turn, him) : null;
}

/** `command_comp_in_front` (:194-296). */
function inFront(turn: Turn): View {
  const t = turn.text.social.visit;
  const me = turn.player;
  const him = target(turn);
  if (!him) return menu(turn);
  const front: Screen = {
    note: fill(t.frontNote, { parlor: him.parlor }),
    bg: "places/funeral_enemy",
    music: "music/music_sneak",
  };
  if (him.id === me.id) {
    return screen(turn, t.self, [goButton("desk", t.buttons.continue)], front);
  }
  const refused = refusal(turn, him);
  if (refused) return refused;
  const other = lockedBy(turn, him.id);
  const otherPlayer = turn.town.players[other];
  if (otherPlayer && other !== me.id) {
    const text = fill(t.locked, { other: otherPlayer.name, name: me.name, he: playerHe(him) });
    return screen(turn, text, [leave(turn)], front);
  }
  me.playerFights++;
  turn.session.locked = true;
  const text = fill(t.outside, { name: him.name, ride: rideName(turn, him) });
  return screen(turn, text, [leave(turn), button(`${VISIT}:trydoor`, t.buttons.tryDoor)], front);
}

/** `command_comp_got_name` (:484-519). */
function gotName(turn: Turn, hisId: number): View {
  const p = turn.town.players[hisId];
  if (hisId === -1 || !p?.active || visitsLeft(turn) <= 0) return menu(turn);
  turn.session.hisId = hisId;
  return inFront(turn);
}

/** `DrawDoorMenu` (:298-303). */
function doorButtons(turn: Turn): Button[] {
  const b = turn.text.social.visit.buttons;
  return [leave(turn), button(`${VISIT}:picklock`, b.pickLock)];
}

/** `SendInsideMenu` (:306-367). */
function inside(turn: Turn): View {
  const t = turn.text.social.visit;
  const him = target(turn);
  if (!him) return menu(turn);
  const refused = recheck(turn, him);
  if (refused) return refused;
  let text = fill(t.inside, { name: him.name });
  const hasSafe = (him.custom[Custom.Safe] ?? 0) > 0;
  if (hasSafe) text += t.safe;
  text += fill(t.hitpoints, { name: him.name, hp: him.hpMax });
  turn.session.locked = true;
  const buttons = [button(`${VISIT}:attack`, t.buttons.attack)];
  if (!hasSafe) buttons.push(button(`${VISIT}:steal`, t.buttons.steal));
  return screen(turn, text, buttons, {
    note: fill(t.insideNote, { parlor: him.parlor }),
    bg: "places/desk_enemy",
  });
}

/** `command_comp_try_door` (:370-413). */
function tryDoor(turn: Turn): View {
  const t = turn.text.social.visit;
  const him = target(turn);
  if (!him) return menu(turn);
  const refused = recheck(turn, him);
  if (refused) return refused;
  if ((him.custom[Custom.Padlock] ?? 0) > 0) {
    turn.session.locked = true;
    const picks = turn.player.custom[Custom.Lockpick] ?? 0;
    const strength = him.custom[Custom.PadlockStrength] ?? 0;
    const text =
      picks > 0
        ? fill(t.padlockWithPicks, { strength, picks: intToCash(picks) })
        : fill(t.padlock, { strength });
    return screen(turn, text, doorButtons(turn), sameLook(turn));
  }
  return inside(turn);
}

/**
 * `CommandPickLock` (:416-480): one lockpick weakens the padlock by
 * `random_range(5, 10)` and breaks; below 1 the padlock falls off. Either
 * way the owner is told and Continue leads inside.
 */
function pickLock(turn: Turn): View {
  const t = turn.text.social.visit;
  const me = turn.player;
  const him = target(turn);
  if (!him) return menu(turn);
  const refused = recheck(turn, him);
  if (refused) return refused;
  if ((me.custom[Custom.Lockpick] ?? 0) < 1) {
    return screen(turn, t.noPick, doorButtons(turn), sameLook(turn));
  }
  const { min, max } = turn.rules.pvp.lockpickDamage;
  const damage = turn.rng.randomRange(min, max);
  him.custom[Custom.PadlockStrength] = (him.custom[Custom.PadlockStrength] ?? 0) - damage;
  let text: string;
  if ((him.custom[Custom.PadlockStrength] ?? 0) < 1) {
    him.custom[Custom.Padlock] = 0;
    him.custom[Custom.PadlockStrength] = 0;
    text = t.lockBroken;
    sendPacket(turn.town, him.id, { type: "text", text: t.lockBrokenMail });
  } else {
    text = fill(t.lockPicked, { damage });
    const strength = him.custom[Custom.PadlockStrength] ?? 0;
    sendPacket(turn.town, him.id, {
      type: "text",
      text: fill(t.lockPickedMail, { damage, strength }),
    });
  }
  me.custom[Custom.Lockpick] = (me.custom[Custom.Lockpick] ?? 0) - 1;
  return screen(turn, text, [button(`${VISIT}:inside`, t.buttons.continue)], sameLook(turn));
}

/**
 * `steal_random_caskets` (commands_comp.cpp:642-681): picks a tag type with
 * `random(3)`; if the victim has any of it, takes `random_range(0, max)`
 * (capped at what they have). Returns -1 when they have none (no second draw).
 */
export function stealRandomCaskets(
  turn: Turn,
  max: number,
  me: PlayerState,
  him: PlayerState,
): { stolen: number; tier: number } {
  const tier = turn.rng.random(3);
  const have = him.tags[tier] ?? 0;
  if (have <= 0) return { stolen: -1, tier };
  const stolen = Math.min(turn.rng.randomRange(0, max), have);
  him.tags[tier] = have - stolen;
  me.tags[tier] = (me.tags[tier] ?? 0) + stolen;
  return { stolen, tier };
}

/** `command_comp_steal` (:521-613). The victim is always told. */
function steal(turn: Turn): View {
  const t = turn.text.social.visit;
  const me = turn.player;
  const him = target(turn);
  if (!him) return menu(turn);
  if ((him.custom[Custom.Safe] ?? 0) > 0) throw new Error("This parlor has a safe");
  const refused = recheck(turn, him);
  if (refused) return refused;
  const { stolen, tier } = stealRandomCaskets(turn, turn.rules.pvp.stealMax, me, him);
  const type = t.tagTypes[tier] ?? "";
  let text: string;
  if (stolen === -1) text = t.stealNone;
  else if (stolen === 0) text = t.stealNothing;
  else if (stolen === 1) text = fill(t.stealOne, { type });
  else text = fill(t.stealMany, { count: stolen, type });
  const clothes = me.male && !him.male ? t.lingerie : t.pajamas;
  text += fill(t.caught, { name: him.name, his: playerHis(him), clothes });

  let mail = fill(t.stealMail, { name: me.name });
  if (stolen === 1) mail += fill(t.stealMailOne, { him: playerHim(me), count: stolen, type });
  else if (stolen > 1) mail += fill(t.stealMailMany, { him: playerHim(me), count: stolen, type });
  else mail += fill(t.stealMailNothing, { him: playerHim(me), he: playerHe(me) });
  sendPacket(turn.town, him.id, { type: "text", text: mail });
  mailPicture(turn.town, him.id, "people/man_prowl");
  mailContinue(turn, him.id);
  return screen(turn, text, [leave(turn)], sameLook(turn));
}

/** `command_comp_attack` (:616-635): both at full hit points, then the battle. */
function attack(turn: Turn): View {
  const him = target(turn);
  if (!him) return menu(turn);
  const refused = recheck(turn, him);
  if (refused) return refused;
  turn.player.hp = turn.player.hpMax;
  him.hp = him.hpMax;
  return startBattle(turn);
}

function data(turn: Turn): VisitData {
  return readNameSearch(turn.session.sceneData);
}

export const visitModule: LocationModule = {
  id: VISIT,
  enter: (turn) => enterRow(turn),
  press(turn, command) {
    switch (command) {
      case "look":
        return look(turn);
      case "menu":
        return menu(turn);
      case "visit":
        return getName(turn);
      case "trydoor":
        return tryDoor(turn);
      case "picklock":
        return pickLock(turn);
      case "inside":
        return inside(turn);
      case "steal":
        return steal(turn);
      case "attack":
        return attack(turn);
    }
    throw new Error(`Unknown visit command ${command}`);
  },
  submitText(turn, overlayId, text) {
    if (overlayId !== `${VISIT}:getname`) throw new Error(`Unknown overlay ${overlayId}`);
    // The Abort button sends i_his_id -1 (welcome.swf button 496).
    if (text === null) return gotName(turn, -1);
    const answer = nameAnswer(turn, VISIT, text, 0);
    turn.session.sceneData = { ...answer.state };
    return menu(turn, answer.overlay);
  },
  confirm(turn, overlayId, accepted) {
    if (overlayId !== `${VISIT}:namenext`) throw new Error(`Unknown overlay ${overlayId}`);
    const state = data(turn);
    if (accepted) return gotName(turn, state.hisId);
    const answer = nameAnswer(turn, VISIT, state.search, state.hisId + 1);
    turn.session.sceneData = { ...answer.state };
    return menu(turn, answer.overlay);
  },
  dismiss(turn, overlayId) {
    if (overlayId !== `${VISIT}:noname`) throw new Error(`Unknown overlay ${overlayId}`);
    return gotName(turn, -1);
  },
};
