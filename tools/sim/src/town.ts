import {
  ALL_PERSONALITY_IDS,
  BotRandom,
  type BotSeat,
  createBotPlayer,
  createMemory,
  DIFFICULTIES,
  type Difficulty,
  describeAction,
  fairBrain,
  guideFrom,
  mix,
  PERSONALITY_IDS,
  type PersonalityId,
  personality as personalityById,
  runBotDay,
  safeAction,
  setPlacesOff,
} from "@fq/bots";
import { createOraclePolicy } from "@fq/bots/oracle";
import {
  CLASSIC_RULES,
  type ClassicRules,
  type ContentPack,
  classicContext,
  createClassicRegistry,
  createDailyChallenge,
  createTown,
  dailyChallengeResult,
  type EngineContext,
  EXPANDED_RULES,
  expandedContext,
  originalClassicRules,
  runDailyMaintenance,
  startDailyChallenge,
  step,
  type TownState,
} from "@fq/core";
import { Collector, type TownReport } from "./metrics.js";
import { XCollector } from "./xmetrics.js";

export type RulesName = "classic" | "original" | "expanded";

export interface SimOptions {
  days: number;
  towns: number;
  players: number;
  rules: RulesName;
  /** Base seed; town i uses a seed derived from it. */
  seed: number;
  /** One difficulty for every bot, or "mixed" (a random one per seat). */
  difficulty: Difficulty | "mixed";
  /** Personalities to seat (round-robin from a shuffled list per town). Default: all. */
  personalities?: PersonalityId[];
  /** Seat the simulator-only oracle (reads the customer's hidden limit) instead of fair bots. */
  oracle?: boolean;
  /** Most actions per bot day before it counts as stuck. */
  stepCap?: number;
  /** Expanded: one more bot (hard, the next personality in the pool) joins on this game day. */
  lateJoin?: number;
  /** Expanded: Daily Challenge runs per difficulty and personality (default 6; 0 skips). */
  challenges?: number;
  /** Expanded: errands to the eight newer places left out for every bot (an ablation run). */
  placesOff?: string[];
  /**
   * Expanded: rule numbers changed for this run only (`--set`), by their dotted path from
   * `EXPANDED_RULES.expanded` (for example `town.placesA.police.aheadPerBp`), to measure a
   * number without editing the source.
   */
  set?: Record<string, number>;
}

/**
 * Writes the run's `set` numbers into this process's `EXPANDED_RULES` (the bots read the same
 * object, so they see the same rule book). The simulator's own process only: a town on a server
 * is tuned through a copy (`apps/server/src/game/tuning.ts`).
 */
export function applyRuleSet(set: Record<string, number> | undefined): void {
  for (const [path, value] of Object.entries(set ?? {})) {
    const keys = path.split(".");
    const leaf = keys.pop() as string;
    let node = EXPANDED_RULES.expanded as unknown as Record<string, unknown>;
    for (const key of keys) {
      const next = node[key];
      if (typeof next !== "object" || next === null) throw new Error(`--set: no rule ${path}`);
      node = next as Record<string, unknown>;
    }
    if (typeof node[leaf] !== "number") throw new Error(`--set: ${path} is not a rule number`);
    node[leaf] = value;
  }
}

export function rulesByName(name: RulesName): ClassicRules {
  if (name === "expanded") return EXPANDED_RULES;
  return name === "original" ? originalClassicRules() : CLASSIC_RULES;
}

/** The engine context a simulated town plays under. */
export function simContext(options: SimOptions, content: ContentPack): EngineContext {
  const rules = rulesByName(options.rules);
  if (rules.expanded) return expandedContext(content, { now: 1_000_000 });
  return classicContext(content, { rules, registry: createClassicRegistry(), now: 1_000_000 });
}

/**
 * A new town. Classic towns are endless (the tournament's last day, with no
 * turns, would distort day 30); Expanded towns are the 30-day season the
 * ruleset is designed around, ending with the run (section 21.3's loan dates,
 * 18.4's election calendar).
 */
function newTown(seed: number, options: SimOptions, ctx: EngineContext): TownState {
  if (ctx.rules.expanded) {
    return createTown(
      { seed, settings: { tournamentActive: true, tournamentDays: options.days } },
      ctx,
    ).town;
  }
  return createTown({ seed, settings: { tournamentActive: false } }, ctx).town;
}

export function townSeed(base: number, index: number): number {
  return mix(base, index, 0x51a);
}

/**
 * Plays one whole town of bots for `options.days` days (every bot's day in a
 * shuffled order, then maintenance) and returns its report.
 */
export function simulateTown(index: number, options: SimOptions, content: ContentPack): TownReport {
  setPlacesOff(options.placesOff ?? []);
  applyRuleSet(options.set);
  const rules = rulesByName(options.rules);
  const seed = townSeed(options.seed, index);
  const ctx = simContext(options, content);
  const expanded = !!rules.expanded;
  let town = newTown(seed, options, ctx);
  const dice = new BotRandom(mix(seed, 0x5ea7));
  const pool = dice.shuffle(
    options.personalities ?? (expanded ? ALL_PERSONALITY_IDS : PERSONALITY_IDS),
  );
  const seats: BotSeat[] = [];
  const joined = new Map<number, number>();
  const info = new Map<
    number,
    { personality: PersonalityId; difficulty: Difficulty; name: string }
  >();
  const seat = (personality: PersonalityId, difficulty: Difficulty) => {
    const made = createBotPlayer(town, { personality, difficulty }, ctx);
    town = made.town;
    if (options.oracle) {
      const guide = guideFrom(ctx.content);
      made.seat.brain = { kind: "oracle", decide: createOraclePolicy(guide ? { guide } : {}) };
    }
    seats.push(made.seat);
    joined.set(made.seat.playerId, town.day);
    info.set(made.seat.playerId, { personality, difficulty, name: made.seat.memory.self.name });
  };
  for (let i = 0; i < options.players; i++) {
    const personality = pool[i % pool.length] as PersonalityId;
    const difficulty =
      options.difficulty === "mixed" ? (dice.pick(DIFFICULTIES) as Difficulty) : options.difficulty;
    seat(personality, difficulty);
  }
  const seatOf = (id: number) =>
    info.get(id) ?? {
      personality: "shark" as PersonalityId,
      difficulty: "normal" as Difficulty,
      name: `#${id}`,
    };
  const collector = new Collector(seed, options.days, options.players, rules, content, seatOf);
  const xc = expanded
    ? new XCollector(rules, content, seatOf, (kind, detail, day, id) =>
        collector.issue(kind, detail, day, id),
      )
    : null;
  let late: number | null = null;
  for (let d = 0; d < options.days; d++) {
    if (expanded && options.lateJoin !== undefined && town.day === options.lateJoin) {
      const personality = pool[options.players % pool.length] as PersonalityId;
      seat(personality, options.difficulty === "mixed" ? "hard" : options.difficulty);
      late = seats[seats.length - 1]?.playerId ?? null;
    }
    const order = new BotRandom(mix(seed, town.day, 0x0dd)).shuffle(seats);
    for (const seat of order) {
      collector.beginDay(town, seat.playerId);
      xc?.beginDay(town, seat.playerId);
      const result = runBotDay(town, seat, ctx, {
        onStep: (e) => {
          collector.step(e);
          if (xc) xc.step(e, collector.currentTally(e.playerId));
        },
        ...(options.stepCap ? { stepCap: options.stepCap } : {}),
      });
      town = result.town;
      collector.endDay(town, seat.playerId);
      xc?.endDay(town, seat.playerId);
      if (result.stuck)
        collector.issue("stuck", result.stuckOn ?? "stuck", town.day, seat.playerId);
      for (const r of result.rejections) {
        if (r.offered) {
          collector.issue(
            "rejected",
            `offered ${describeAction(r.action)} rejected: ${r.reason}`,
            town.day,
            seat.playerId,
          );
        }
      }
      for (const err of result.errors)
        collector.issue("error", err.split("\n")[0] ?? err, town.day, seat.playerId);
    }
    xc?.beforeMaintenance(town);
    town = runDailyMaintenance(town, ctx).town;
    collector.afterMaintenance(town);
    xc?.afterMaintenance(town);
  }
  const report = collector.report;
  const regular = seats.filter((s) => s.playerId !== late);
  report.seats = regular.map((s) => ({
    playerId: s.playerId,
    personality: seatOf(s.playerId).personality,
    difficulty: seatOf(s.playerId).difficulty,
    bp: town.players[s.playerId]?.bp ?? 0,
  }));
  let winner = -1;
  report.seats.forEach((s, i) => {
    if (winner === -1 || s.bp > (report.seats[winner]?.bp ?? 0)) winner = i;
  });
  report.winner = winner;
  if (xc) {
    xc.finish(
      town,
      seats.map((s) => ({ playerId: s.playerId, joined: joined.get(s.playerId) ?? 1 })),
    );
    report.x = xc.report;
  }
  return report;
}

export interface ChallengeRun {
  id: string;
  personality: PersonalityId;
  difficulty: Difficulty;
  score: number;
  money: number;
  sales: number;
  exact: number;
  walkouts: number;
  steps: number;
  finished: boolean;
}

/**
 * Section 24: one bot plays one Daily Challenge run from the host's start
 * screen to its end (out of turns, or logged off), as a person would.
 */
export function runChallenge(
  id: string,
  personality: PersonalityId,
  difficulty: Difficulty,
  content: ContentPack,
): ChallengeRun {
  const ctx = expandedContext(content, { now: 1_000_000 });
  const challenge = createDailyChallenge(id, ctx);
  const who = personalityById(personality).names[0] ?? {
    name: "Rival",
    parlor: "Rest",
    male: true,
  };
  const start = startDailyChallenge(challenge, who, ctx);
  let town = start.town;
  let view = start.view;
  const memory = createMemory({
    playerId: start.playerId,
    name: who.name,
    parlor: who.parlor,
    personality,
    difficulty,
  });
  const brain = fairBrain(ctx.content);
  const rng = new BotRandom(mix(challenge.seed, start.playerId, 0xc4a1));
  let steps = 0;
  for (; steps < 1500; steps++) {
    if (!town.sessions[String(start.playerId)] || view.scene === "lobby") break;
    if (brain.kind !== "fair") break;
    let action = brain.decide({ view, memory, rng });
    let r = step(town, start.playerId, action, ctx);
    if (r.rejected) {
      action = safeAction(view);
      r = step(town, start.playerId, action, ctx);
      if (r.rejected) r = step(town, start.playerId, { type: "exit" }, ctx);
    }
    town = r.town;
    view = r.view;
    if (dailyChallengeResult(town).finished && !view.buttons.some((b) => b.id !== "desk:quit"))
      break;
  }
  const result = dailyChallengeResult(town);
  return {
    id,
    personality,
    difficulty,
    score: result.score,
    money: result.money,
    sales: result.sales,
    exact: result.exact,
    walkouts: result.walkouts,
    steps,
    finished: result.finished,
  };
}
