import type { Difficulty, PersonalityId, StepEvent } from "@fq/bots";
import {
  type ClassicRules,
  type ContentPack,
  Custom,
  type PlayerState,
  priceOf,
  type TownState,
} from "@fq/core";
import type { XTownReport } from "./xmetrics.js";

/**
 * What one town contributes to the report. Everything is a sum or a count so
 * towns merge by adding. The simulator may read hidden state (the customer's
 * limit) to score what happened; the bots never do.
 */
export interface Tally {
  playerDays: number;
  bp: number;
  turns: number;
  customers: number;
  sales: number;
  walkouts: number;
  perfect: number;
  close50: number;
  close100: number;
  salesBp: number;
  bonusBp: number;
  /** Sum of sale price / spending limit over sales. */
  capture: number;
  risksTaken: number;
  risksDeclined: number;
  riskBp: number;
  /** BP the bot won or lost in fights it started. */
  battleBp: number;
  /** BP it lost as the victim of someone else's attack. */
  victimBp: number;
}

export function emptyTally(): Tally {
  return {
    playerDays: 0,
    bp: 0,
    turns: 0,
    customers: 0,
    sales: 0,
    walkouts: 0,
    perfect: 0,
    close50: 0,
    close100: 0,
    salesBp: 0,
    bonusBp: 0,
    capture: 0,
    risksTaken: 0,
    risksDeclined: 0,
    riskBp: 0,
    battleBp: 0,
    victimBp: 0,
  };
}

export function addTally(into: Tally, from: Tally): void {
  for (const key of Object.keys(into) as (keyof Tally)[]) into[key] += from[key];
}

export interface Pvp {
  visits: number;
  refused: number;
  steals: number;
  tagsStolen: number;
  battles: number;
  attackerWins: number;
  attackerLosses: number;
  battleBpWon: number;
  battleBpLost: number;
  arsonHired: number;
  arsonStopped: number;
  tigers: number;
  sparrows: number;
  dragons: number;
}

export function emptyPvp(): Pvp {
  return {
    visits: 0,
    refused: 0,
    steals: 0,
    tagsStolen: 0,
    battles: 0,
    attackerWins: 0,
    attackerLosses: 0,
    battleBpWon: 0,
    battleBpLost: 0,
    arsonHired: 0,
    arsonStopped: 0,
    tigers: 0,
    sparrows: 0,
    dragons: 0,
  };
}

export type WaitOutcome = "customer" | "event" | "risk" | "script" | "noTurns";

export interface Issue {
  kind: "invariant" | "rejected" | "exploit" | "stuck" | "error";
  detail: string;
  seed: number;
  day: number;
  player: string;
}

export interface TownReport {
  seed: number;
  days: number;
  players: number;
  steps: number;
  byPersonality: Record<string, Tally>;
  byDifficulty: Record<string, Tally>;
  /** Keyed by the psych level the stats sheet shows (internal + 1) at the start of the day. */
  byPsych: Record<string, Tally>;
  /** Gold-tag equivalents (wood 1/4, silver 1/2, gold 1) by source and by use. */
  tagIncome: Record<string, number>;
  tagSpend: Record<string, number>;
  spendByPersonality: Record<string, Record<string, number>>;
  pvp: Pvp;
  /** BP lost to other players' attacks, by the victim's personality. */
  victimBp: Record<string, number>;
  wait: Record<WaitOutcome, number>;
  /** Per day after maintenance: leader BP, runner-up, median, and the leader's personality. */
  daily: {
    day: number;
    leader: number;
    second: number;
    median: number;
    leaderId: number;
    leaderPersonality: string;
  }[];
  /** Personality and difficulty of each seat, and the winner's seat index. */
  seats: { playerId: number; personality: PersonalityId; difficulty: Difficulty; bp: number }[];
  winner: number;
  issues: Issue[];
  /** Expanded towns only (xmetrics.ts). */
  x?: XTownReport;
}

export function goldValue(tags: readonly number[]): number {
  return (tags[2] ?? 0) + (tags[1] ?? 0) / 2 + (tags[0] ?? 0) / 4;
}

const MAX_ISSUES = 40;

/**
 * Watches every step of a town's bot days and keeps the report. One per town.
 */
export class Collector {
  readonly report: TownReport;
  private dayStart = new Map<number, { bp: number; psych: number }>();
  private dayTally = new Map<number, Tally>();

  constructor(
    seed: number,
    days: number,
    players: number,
    private readonly rules: ClassicRules,
    private readonly content: ContentPack,
    private readonly seatOf: (playerId: number) => {
      personality: PersonalityId;
      difficulty: Difficulty;
      name: string;
    },
  ) {
    this.report = {
      seed,
      days,
      players,
      steps: 0,
      byPersonality: {},
      byDifficulty: {},
      byPsych: {},
      tagIncome: {},
      tagSpend: {},
      spendByPersonality: {},
      pvp: emptyPvp(),
      victimBp: {},
      wait: { customer: 0, event: 0, risk: 0, script: 0, noTurns: 0 },
      daily: [],
      seats: [],
      winner: -1,
      issues: [],
    };
  }

  issue(kind: Issue["kind"], detail: string, day: number, playerId: number): void {
    if (this.report.issues.length >= MAX_ISSUES) return;
    this.report.issues.push({
      kind,
      detail,
      seed: this.report.seed,
      day,
      player: this.seatOf(playerId).name,
    });
  }

  beginDay(town: TownState, playerId: number): void {
    const p = town.players[playerId];
    this.dayStart.set(playerId, { bp: p?.bp ?? 0, psych: (p?.psych ?? 0) + 1 });
    const tally = emptyTally();
    tally.playerDays = 1;
    this.dayTally.set(playerId, tally);
  }

  endDay(town: TownState, playerId: number): void {
    const start = this.dayStart.get(playerId);
    const tally = this.dayTally.get(playerId);
    if (!start || !tally) return;
    tally.bp = (town.players[playerId]?.bp ?? 0) - start.bp;
    const seat = this.seatOf(playerId);
    const add = (map: Record<string, Tally>, key: string) => {
      map[key] ??= emptyTally();
      addTally(map[key] as Tally, tally);
    };
    add(this.report.byPersonality, seat.personality);
    add(this.report.byDifficulty, seat.difficulty);
    add(this.report.byPsych, String(Math.min(start.psych, 12)));
  }

  afterMaintenance(town: TownState): void {
    const active = town.players.filter((p) => p.active);
    const sorted = [...active].sort((a, b) => b.bp - a.bp || a.id - b.id);
    const bps = sorted.map((p) => p.bp);
    const median = bps.length === 0 ? 0 : (bps[Math.floor((bps.length - 1) / 2)] ?? 0);
    this.report.daily.push({
      day: town.day - 1,
      leader: bps[0] ?? 0,
      second: bps[1] ?? 0,
      median,
      leaderId: sorted[0]?.id ?? -1,
      leaderPersonality: sorted[0] ? this.seatOf(sorted[0].id).personality : "",
    });
    for (const p of town.players) this.checkPlayer(p, town.day, "after maintenance");
  }

  private checkPlayer(p: PlayerState, day: number, where: string): void {
    if (!p.active) return;
    const bad: string[] = [];
    if (p.turns < 0) bad.push(`turns ${p.turns}`);
    if (p.bp < 0) bad.push(`bp ${p.bp}`);
    if (p.bpToday < 0) bad.push(`bpToday ${p.bpToday}`);
    if (p.hp < 0) bad.push(`hp ${p.hp}`);
    if (p.hpMax < 1) bad.push(`hpMax ${p.hpMax}`);
    if (p.luck < 1 || p.luck > 100) bad.push(`luck ${p.luck}`);
    if (p.tags.some((t) => t < 0)) bad.push(`tags ${p.tags.join("/")}`);
    if ((p.custom[Custom.Lockpick] ?? 0) < 0) bad.push("lockpicks below 0");
    if (bad.length > 0) this.issue("invariant", `${bad.join(", ")} (${where})`, day, p.id);
  }

  /** The tally of the bot whose day is running (Expanded sales are scored into it). */
  currentTally(id: number): Tally {
    return this.tally(id);
  }

  private tally(id: number): Tally {
    let t = this.dayTally.get(id);
    if (!t) {
      t = emptyTally();
      this.dayTally.set(id, t);
    }
    return t;
  }

  private spend(id: number, category: string, amount: number): void {
    if (amount === 0) return;
    const r = this.report;
    if (amount > 0) r.tagIncome[category] = (r.tagIncome[category] ?? 0) + amount;
    else {
      r.tagSpend[category] = (r.tagSpend[category] ?? 0) - amount;
      const p = this.seatOf(id).personality;
      r.spendByPersonality[p] ??= {};
      const row = r.spendByPersonality[p] as Record<string, number>;
      row[category] = (row[category] ?? 0) - amount;
    }
  }

  /** Classifies and checks one action. */
  step(e: StepEvent): void {
    this.report.steps++;
    const { before, result, action, playerId: id } = e;
    const after = result.town;
    const day = before.day;
    const was = before.players[id];
    const now = after.players[id];
    if (!was || !now) return;
    const session = before.sessions[String(id)];
    const button = action.type === "press" ? action.buttonId : "";
    const scene = session?.scene ?? "";
    const tally = this.tally(id);
    for (const p of after.players) this.checkPlayer(p, day, describe(e));

    // Wait for Customer: what came through the door.
    if (button === "desk:wait") {
      const s = after.sessions[String(id)];
      let outcome: WaitOutcome = "event";
      if (was.turns < 1) outcome = "noTurns";
      else if (s?.customer.flow === "negotiation" && now.turns === was.turns - 1)
        outcome = "customer";
      else if (s?.customer.flow === "risk") outcome = "risk";
      else if (s?.script) outcome = "script";
      this.report.wait[outcome]++;
      if (outcome === "customer") {
        tally.turns++;
        tally.customers++;
      }
    }

    // The negotiation, scored against the hidden limit (Expanded sales are scored by XCollector).
    const c = session?.customer;
    if (
      !this.rules.expanded &&
      c?.active &&
      c.flow === "negotiation" &&
      button.startsWith("neg:")
    ) {
      const cAfter = after.sessions[String(id)]?.customer;
      if (button === "neg:done") {
        const price = priceOf(c, this.rules, this.content);
        tally.sales++;
        tally.capture += c.moneyToSpend > 0 ? price / c.moneyToSpend : 0;
        const gain = now.bp - was.bp;
        tally.salesBp += gain;
        const base = Math.trunc(
          Math.fround(Math.fround(price) * Math.fround(this.rules.bpMultiplier)),
        );
        tally.bonusBp += gain - base;
        if (price === c.moneyToSpend) tally.perfect++;
        else if (c.moneyToSpend - price <= this.rules.closeness / 2) tally.close50++;
        else if (c.moneyToSpend - price <= this.rules.closeness) tally.close100++;
      } else if (cAfter?.flow !== "negotiation") {
        tally.walkouts++;
      }
    }
    if (button === "risk:take" || button === "risk:decline") {
      if (button === "risk:take") tally.risksTaken++;
      else tally.risksDeclined++;
      tally.riskBp += now.bp - was.bp;
    }

    // PvP.
    const pvp = this.report.pvp;
    if (now.playerFights > was.playerFights) pvp.visits++;
    if (button === "competitors:trydoor" && result.view.buttons.length === 1) pvp.refused++;
    if (button === "competitors:steal") {
      pvp.steals++;
      pvp.tagsStolen += sum(now.tags) - sum(was.tags);
    }
    if (button === "competitors:attack") pvp.battles++;
    if (button === "competitors:attack" || button.startsWith("battle:")) {
      tally.battleBp += now.bp - was.bp;
      for (const other of after.players) {
        const prev = before.players[other.id];
        if (other.id !== id && prev && other.bp < prev.bp) {
          const key = this.seatOf(other.id).personality;
          this.report.victimBp[key] = (this.report.victimBp[key] ?? 0) + (prev.bp - other.bp);
        }
      }
    }
    const ids = result.view.buttons.map((b) => b.id);
    if (!session?.view?.buttons.some((b) => b.id.startsWith("battle:yell"))) {
      if (ids.includes("battle:yellwin")) {
        pvp.attackerWins++;
        pvp.battleBpWon += now.bp - was.bp;
      }
      if (ids.includes("battle:yelllost")) {
        pvp.attackerLosses++;
        pvp.battleBpLost += was.bp - now.bp;
      }
    }
    if (button === "yangs:dragon" && now.luck > was.luck) pvp.dragons++;
    if (action.type === "pickPlayer" && action.playerId !== null) {
      if (action.overlayId === "yangs:tiger-target") pvp.tigers++;
      if (action.overlayId === "yangs:sparrow-target") pvp.sparrows++;
    }

    // Tags: where they came from and where they went.
    const delta = goldValue(now.tags) - goldValue(was.tags);
    let category = "other";
    const xb = action.type === "press" ? button : "overlayId" in action ? action.overlayId : "";
    if (this.rules.expanded && /^church:card:/.test(xb)) category = "bingo";
    else if (this.rules.expanded && xb === "reaper-club:pay") category = "club cover";
    else if (this.rules.expanded && /^bank:(tcount|tpick|ttier)/.test(xb)) category = "transfers";
    else if (this.rules.expanded && /^reaper-club:buy:/.test(xb)) category = "black market";
    else if (this.rules.expanded && /^neg:offer:/.test(xb)) category = "special offers";
    else if (button === "neg:done") category = "sales";
    else if (now.transportation !== was.transportation) category = "hearse";
    else if (now.psych > was.psych) category = "psych";
    else if (now.strength > was.strength) category = "strength";
    else if (now.hpMax > was.hpMax) category = "hp";
    else if ((now.custom[Custom.Padlock] ?? 0) > (was.custom[Custom.Padlock] ?? 0))
      category = "padlock";
    else if ((now.custom[Custom.FireAlarm] ?? 0) > (was.custom[Custom.FireAlarm] ?? 0))
      category = "smoke";
    else if ((now.custom[Custom.Safe] ?? 0) > (was.custom[Custom.Safe] ?? 0)) category = "safe";
    else if ((now.custom[Custom.Lockpick] ?? 0) > (was.custom[Custom.Lockpick] ?? 0))
      category = "lockpicks";
    else if (
      button === "competitors:steal" ||
      button.startsWith("battle:") ||
      button === "competitors:attack"
    )
      category = "theft";
    else if (button.startsWith("bank:") || scene === "bank") category = "exchange";
    else if (session?.script || after.sessions[String(id)]?.script || button.startsWith("script:"))
      category = delta < 0 ? "arson" : "bonus tag";
    else if (scene === "desk" || scene === "mailbox" || action.type === "dismiss")
      category = "mail";
    else if (action.type === "chat") category = "cafe give";
    if (category === "arson" && delta < 0) pvp.arsonHired++;
    this.spend(id, category, delta);
    for (const other of after.players) {
      if (other.id === id) continue;
      const prev = before.players[other.id];
      if (!prev) continue;
      const d = goldValue(other.tags) - goldValue(prev.tags);
      if (d < 0) this.spend(other.id, category === "arson" ? "burned" : "stolen", d);
      if (d > 0) {
        if (category === "arson") pvp.arsonStopped++;
        this.spend(other.id, category === "arson" ? "smoke detector reward" : "received", d);
      }
    }

    this.checkExploits(e, scene);
  }

  private checkExploits(e: StepEvent, scene: string): void {
    const { before, result, action, playerId: id } = e;
    const was = before.players[id] as PlayerState;
    const now = result.town.players[id] as PlayerState;
    const button = action.type === "press" ? action.buttonId : "";
    const where = describe(e);
    const day = before.day;
    const atStore = scene === "store" || button.startsWith("store:");
    if (atStore && (now.tags[2] ?? 0) > (was.tags[2] ?? 0)) {
      this.issue("exploit", `gold tags gained at the store (${where})`, day, id);
    }
    if (atStore && now.turns > was.turns) {
      const bonus = this.rules.hearses[now.transportation]?.bonusTurns ?? 0;
      if (now.transportation <= was.transportation || now.turns - was.turns !== bonus) {
        this.issue(
          "exploit",
          `turns gained at the store: ${was.turns} to ${now.turns} (${where})`,
          day,
          id,
        );
      }
    }
    // Expanded BP and money checks are XCollector's (xmetrics.ts).
    if (this.rules.expanded) return;
    if (now.bp > was.bp) {
      const earned =
        button === "neg:done" ||
        button.startsWith("risk:") ||
        button === "desk:wait" ||
        button.startsWith("battle:") ||
        button === "competitors:attack" ||
        button === "go:desk" ||
        action.type === "exit" ||
        (action.type === "dismiss" && action.overlayId.startsWith("mailbox:")) ||
        (action.type === "confirm" && action.overlayId.startsWith("mailbox:")) ||
        now.mail.length < was.mail.length;
      if (!earned)
        this.issue(
          "exploit",
          `BP gained without a turn or event: ${was.bp} to ${now.bp} (${where})`,
          day,
          id,
        );
    }
    for (const other of result.town.players) {
      if (other.id === id) continue;
      const prev = before.players[other.id];
      if (
        prev &&
        other.bp > prev.bp &&
        !button.startsWith("battle:") &&
        button !== "competitors:attack" &&
        action.type !== "exit"
      ) {
        this.issue(
          "exploit",
          `${other.name} gained BP during someone else's action (${where})`,
          day,
          id,
        );
      }
    }
  }
}

function sum(tags: readonly number[]): number {
  return tags.reduce((a, b) => a + b, 0);
}

function describe(e: StepEvent): string {
  const a = e.action;
  const what =
    a.type === "press"
      ? `press ${a.buttonId}`
      : a.type === "visit"
        ? `visit ${a.placeId}`
        : "overlayId" in a
          ? `${a.type} ${a.overlayId}`
          : a.type;
  return `${what} on "${e.view.title}"`;
}
