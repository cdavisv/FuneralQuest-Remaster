import type { PlayerState, SessionState, TownState } from "@fq/core";
import type { OraclePlayer, OracleTown } from "./oracle.js";

/** One player as both sides can report it: `player_struct` fields under the port's names. */
export interface PlayerSnap {
  id: number;
  name: string;
  parlor: string;
  active: boolean;
  male: boolean;
  online: boolean;
  turns: number;
  money: number;
  bp: number;
  bpToday: number;
  karma: number;
  rating: number;
  tags: number[];
  transportation: number;
  plots: number;
  dayLastLoggedOn: number;
  luck: number;
  yangsSent: number;
  psych: number;
  kickedOutOfYangs: boolean;
  strength: number;
  hpMax: number;
  hp: number;
  playerFights: number;
  canBeAttacked: boolean;
  policeProtected: boolean;
  tagsReceivedToday: number;
  /** `a_custom[0..4]`: fire alarm, safe, padlock, lockpicks, padlock strength. */
  custom: number[];
  customer: CustomerSnap | null;
}

/** The current customer (`communication_status`) while one is active. */
export interface CustomerSnap {
  customerMale: boolean;
  customerAge: number;
  deceasedMale: boolean;
  deceasedAge: number;
  relation: number;
  income: number;
  desiredCasket: number;
  bigUpgrade: number;
  deathMethod: number;
  deathObject: number;
  moneyToSpend: number;
  mood: number;
  cheapness: number;
  loved: boolean;
  options: number[];
}

export interface TownSnap {
  day: number;
  topYesterday: { name: string; bp: number } | null;
  players: PlayerSnap[];
}

export function fromOracle(t: OracleTown): TownSnap {
  return {
    day: t.day,
    topYesterday: t.topOldExists ? { name: t.topOldName, bp: t.topOldBp } : null,
    players: t.players.map(oraclePlayer),
  };
}

function oraclePlayer(p: OraclePlayer): PlayerSnap {
  const c = p.session?.customer;
  return {
    id: p.index,
    name: p.name,
    parlor: p.parlor,
    active: p.active,
    male: p.male,
    online: p.online,
    turns: p.turns,
    money: p.money,
    bp: p.exp,
    bpToday: p.sp,
    karma: p.karma,
    rating: p.rating,
    tags: [...p.tags],
    transportation: p.transportation,
    plots: p.plots,
    dayLastLoggedOn: p.dayLastLoggedOn,
    luck: p.luck,
    yangsSent: p.yangsSent,
    psych: p.psych,
    kickedOutOfYangs: p.kickedOutOfYangs,
    strength: p.strength,
    hpMax: p.hpMax,
    hp: p.hp,
    playerFights: p.playerFights,
    canBeAttacked: p.canBeAttacked,
    policeProtected: p.policeProtected,
    tagsReceivedToday: p.tagsReceivedToday,
    custom: p.custom.slice(0, 5),
    customer:
      c?.active && p.session
        ? {
            customerMale: c.customerMale,
            customerAge: c.customerAge,
            deceasedMale: c.deceasedMale,
            deceasedAge: c.deceasedAge,
            relation: c.relation,
            income: c.income,
            desiredCasket: c.desiredCasket,
            bigUpgrade: c.bigUpgrade,
            deathMethod: c.deathType,
            deathObject: c.deathObject,
            moneyToSpend: c.moneyToSpend,
            mood: Math.fround(c.mood),
            cheapness: Math.fround(c.cheapness),
            loved: c.loved,
            options: [...p.session.options],
          }
        : null,
  };
}

export function fromPort(t: TownState): TownSnap {
  return {
    day: t.day,
    topYesterday: t.topYesterday ? { name: t.topYesterday.name, bp: t.topYesterday.bp } : null,
    players: t.players.map((p) => portPlayer(p, t.sessions[String(p.id)])),
  };
}

function portPlayer(p: PlayerState, s: SessionState | undefined): PlayerSnap {
  const c = s?.customer;
  return {
    id: p.id,
    name: p.name,
    parlor: p.parlor,
    active: p.active,
    male: p.male,
    online: s !== undefined,
    turns: p.turns,
    money: p.money,
    bp: p.bp,
    bpToday: p.bpToday,
    karma: p.karma,
    rating: p.rating,
    tags: p.tags.slice(0, 3),
    transportation: p.transportation,
    plots: p.plots,
    dayLastLoggedOn: p.dayLastLoggedOn,
    luck: p.luck,
    yangsSent: p.yangsSent,
    psych: p.psych,
    kickedOutOfYangs: p.kickedOutOfYangs,
    strength: p.strength,
    hpMax: p.hpMax,
    hp: p.hp,
    playerFights: p.playerFights,
    canBeAttacked: p.canBeAttacked,
    policeProtected: p.policeProtected,
    tagsReceivedToday: p.tagsReceivedToday,
    custom: p.custom.slice(0, 5),
    customer: c?.active
      ? {
          customerMale: c.customerMale,
          customerAge: c.customerAge,
          deceasedMale: c.deceasedMale,
          deceasedAge: c.deceasedAge,
          relation: c.relation,
          income: c.income,
          desiredCasket: c.desiredCasket,
          bigUpgrade: c.bigUpgrade,
          deathMethod: c.deathMethod,
          deathObject: c.deathObject,
          moneyToSpend: c.moneyToSpend,
          mood: Math.fround(c.mood),
          cheapness: Math.fround(c.cheapness),
          loved: c.loved,
          options: [...c.options],
        }
      : null,
  };
}

export interface FieldDiff {
  path: string;
  original: unknown;
  port: unknown;
}

/** Every leaf that differs, by path ("players[1].money"). */
export function diffValues(a: unknown, b: unknown, path = ""): FieldDiff[] {
  if (typeof a === "number" && typeof b === "number") {
    return Math.fround(a) === Math.fround(b) ? [] : [{ path, original: a, port: b }];
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return a === b ? [] : [{ path, original: a, port: b }];
  }
  if (Array.isArray(a) !== Array.isArray(b)) return [{ path, original: a, port: b }];
  const out: FieldDiff[] = [];
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) out.push(...diffValues(a[i], b[i], `${path}[${i}]`));
    return out;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  for (const key of new Set([...Object.keys(ao), ...Object.keys(bo)])) {
    out.push(...diffValues(ao[key], bo[key], path ? `${path}.${key}` : key));
  }
  return out;
}
