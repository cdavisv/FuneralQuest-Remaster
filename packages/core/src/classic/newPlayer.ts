import type { Turn } from "../engine/turn.js";
import { CUSTOM_SIZE, type PlayerState, type TownState } from "../state/types.js";
import { fill } from "../text/format.js";
import { forgetBlocks } from "./blocking.js";
import { findPlayerByLogon, findPlayerByName, validPlayerCount } from "./players.js";
import { swearCheck } from "./swearFilter.js";

/** The new-user form (`process_new_user` tokens, legacy/source/new_user.cpp:14-20). */
export interface NewPlayerInput {
  logon: string;
  name: string;
  parlor: string;
  password: string;
  passwordVerify: string;
  male: boolean;
  email: string;
}

/** Which new-user screen the original sent the player back to (`i_sent` 3 or 4). */
export type NewPlayerField = "town" | "name" | "logon" | "parlor" | "password" | "email";

export interface NewPlayerError {
  field: NewPlayerField;
  /** Legacy markup; the engine returns it as RichText. */
  message: string;
}

/**
 * `strip_dangerous_stuff` (legacy/source/shared_util.cpp:126-156), used on
 * the display name and the parlor name. Characters 123 to 127 also go;
 * non-ASCII letters stay (the original's signed char kept them).
 */
export function stripDangerous(text: string): string {
  let out = "";
  for (const ch of text) {
    if ("?|=/\\;:,{}@+`<>%$".includes(ch)) continue;
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 123 && code <= 127) continue;
    out += ch;
  }
  return out;
}

/**
 * Validation of `process_new_user` (new_user.cpp:22-191) in the original
 * order. Inputs are trimmed first, as `get_token_st` did. The per-IP check
 * and the license cap are gone; the swear filter is `swearCheck`.
 */
export function validateNewPlayer(
  turn: Turn,
  raw: NewPlayerInput,
): { input: NewPlayerInput } | { error: NewPlayerError } {
  const t = turn.text.newPlayer;
  const r = turn.rules.newPlayer;
  const town = turn.town;
  const input: NewPlayerInput = {
    ...raw,
    logon: raw.logon.trim(),
    // new_user.cpp:22-25: strip, then the swear filter, before any length check.
    name: swearCheck(
      stripDangerous(raw.name.trim()),
      turn.content.swearWords,
      town.settings.swearFilter,
    ),
    parlor: swearCheck(
      stripDangerous(raw.parlor.trim()),
      turn.content.swearWords,
      town.settings.swearFilter,
    ),
    password: raw.password.trim(),
    passwordVerify: raw.passwordVerify.trim(),
    email: raw.email.trim(),
  };
  const fail = (field: NewPlayerField, message: string) => ({ error: { field, message } });
  const max = town.settings.maxPlayers;
  if (validPlayerCount(town) >= max) return fail("town", fill(t.townFull, { max }));
  if (input.name.length < r.nameMin) return fail("name", t.nameShort);
  if (input.name.length > r.nameMax) return fail("name", t.nameLong);
  if (findPlayerByName(town, input.name) !== -1)
    return fail("name", fill(t.nameTaken, { name: input.name }));
  if (input.logon.length < r.logonMin) return fail("logon", t.logonShort);
  if (input.logon.length > r.logonMax) return fail("logon", t.logonLong);
  if (findPlayerByLogon(town, input.logon) !== -1) {
    return fail("logon", fill(t.logonTaken, { logon: input.logon }));
  }
  if (input.parlor.length < r.parlorMin) return fail("parlor", t.parlorShort);
  if (input.parlor.length > r.parlorMax) return fail("parlor", t.parlorLong);
  if (input.password.length > r.passwordMax) return fail("password", t.passwordLong);
  if (input.password.length < r.passwordMin) return fail("password", t.passwordShort);
  if (input.password !== input.passwordVerify) return fail("password", t.passwordMismatch);
  if (input.email.length < r.emailMin) return fail("email", t.emailShort);
  if (input.email.length > r.emailMax) return fail("email", t.emailLong);
  return { input };
}

/** `empty_slot` (legacy/source/online_util.cpp:179-194): reuse a deleted player's slot. */
function emptySlot(town: TownState): number {
  const found = town.players.find((p) => !p.active);
  return found ? found.id : town.players.length;
}

/**
 * `create_new_player` and the record set-up of `process_new_user`
 * (online_util.cpp:197-235, new_user.cpp:206-232). Everything not listed
 * starts at zero, as after the original's memset; the new day sets turns.
 */
export function addPlayer(turn: Turn, input: NewPlayerInput): PlayerState {
  const town = turn.town;
  const s = town.settings;
  const id = emptySlot(town);
  // A reused slot starts with no block list and is on nobody's (classic/blocking.ts).
  forgetBlocks(town, id);
  const player: PlayerState = {
    id,
    active: true,
    name: input.name,
    logon: input.logon,
    parlor: input.parlor,
    email: input.email,
    wantEmail: false,
    male: input.male,
    lastLogon: 0,
    lastPacket: 0,
    accountCreated: turn.engine.now,
    dayCreated: town.day,
    turns: 0,
    money: s.startingMoney,
    bp: 0,
    bpToday: 0,
    karma: s.startingKarma,
    rating: s.startingRating,
    tags: [0, 0, 0],
    incinerator: false,
    transportation: 0,
    plots: 0,
    dayLastLoggedOn: 0,
    luck: s.startingLuck,
    yangsSent: 0,
    psych: 0,
    kickedOutOfYangs: false,
    strength: s.startingStrength,
    hpMax: s.startingHp,
    hp: s.startingHp,
    playerFights: 0,
    canBeAttacked: true,
    policeProtected: false,
    custom: new Array<number>(CUSTOM_SIZE).fill(0),
    tagsReceivedToday: 0,
    // :226-228 deletes any old mail file for the slot.
    mail: [],
  };
  town.players[id] = player;
  // A reused slot belongs to someone new: forget the old player's stream and session.
  delete town.streams[String(id)];
  delete town.sessions[String(id)];
  return player;
}
