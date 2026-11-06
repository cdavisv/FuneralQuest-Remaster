import { classicPack } from "@fq/content";
import {
  classicContext,
  createTown,
  type EngineContext,
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
} from "../src/index.js";

/** The Classic ruleset with the built-in Classic content pack. */
export function testContext(): EngineContext {
  return classicContext(classicPack, { now: 1_000_000 });
}

export interface TownRun {
  town: TownState;
  seats: BotSeat[];
  stuck: string[];
  rejections: Rejection[];
  errors: string[];
  steps: number;
}

/** A town of bots played for `days` days: every bot's day, then maintenance. */
export function playTown(
  seed: number,
  bots: { personality: PersonalityId; difficulty: Difficulty }[],
  days: number,
  ctx: EngineContext = testContext(),
): TownRun {
  let town = createTown({ seed }, ctx).town;
  const seats: BotSeat[] = [];
  for (const bot of bots) {
    const made = createBotPlayer(town, bot, ctx);
    town = made.town;
    seats.push(made.seat);
  }
  const run: TownRun = { town, seats, stuck: [], rejections: [], errors: [], steps: 0 };
  for (let d = 0; d < days; d++) {
    for (const seat of seats) {
      const r = runBotDay(town, seat, ctx);
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
