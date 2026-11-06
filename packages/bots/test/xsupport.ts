import { expandedPack } from "@fq/content";
import {
  createTown,
  type EngineContext,
  expandedContext,
  runDailyMaintenance,
  type TownState,
} from "@fq/core";
import {
  type BotSeat,
  createBotPlayer,
  type Difficulty,
  type PersonalityId,
  type Rejection,
  runBotDay,
  type StepEvent,
} from "../src/index.js";

/** The Expanded ruleset with the built-in Expanded content pack. */
export function xContext(): EngineContext {
  return expandedContext(expandedPack, { now: 1_000_000 });
}

export interface XTownRun {
  town: TownState;
  seats: BotSeat[];
  stuck: string[];
  rejections: Rejection[];
  errors: string[];
  steps: number;
  fallbacks: number;
}

/** An Expanded town of bots played for `days` days: every bot's day, then maintenance. */
export function playXTown(
  seed: number,
  bots: { personality: PersonalityId; difficulty: Difficulty }[],
  days: number,
  options: {
    ctx?: EngineContext;
    onStep?: (e: StepEvent) => void;
    stepCap?: number;
    /** Called with each seat as it is made (to replace its brain). */
    wrap?: (seat: BotSeat) => void;
  } = {},
): XTownRun {
  const ctx = options.ctx ?? xContext();
  let town = createTown({ seed }, ctx).town;
  const seats: BotSeat[] = [];
  for (const bot of bots) {
    const made = createBotPlayer(town, bot, ctx);
    town = made.town;
    options.wrap?.(made.seat);
    seats.push(made.seat);
  }
  const run: XTownRun = {
    town,
    seats,
    stuck: [],
    rejections: [],
    errors: [],
    steps: 0,
    fallbacks: 0,
  };
  for (let d = 0; d < days; d++) {
    for (const seat of seats) {
      const r = runBotDay(town, seat, ctx, {
        ...(options.stepCap ? { stepCap: options.stepCap } : {}),
        onStep: (e) => {
          if (e.fallback) run.fallbacks++;
          options.onStep?.(e);
        },
      });
      town = r.town;
      run.steps += r.steps;
      if (r.stuck) run.stuck.push(`${seat.memory.self.name} day ${town.day}: ${r.stuckOn}`);
      run.rejections.push(...r.rejections);
      run.errors.push(...r.errors);
    }
    town = runDailyMaintenance(town, ctx).town;
  }
  run.town = town;
  return run;
}
