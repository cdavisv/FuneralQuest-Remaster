import { type ContentPack, createPlayer, type EngineContext, step, type TownState } from "@fq/core";
import { guideFrom } from "./expanded/guide.js";
import { type BotMemory, createMemory } from "./memory.js";
import { type Difficulty, type PersonalityId, personality } from "./personalities.js";
import { createPolicy } from "./policy.js";
import type { BotSeat, Brain } from "./runner.js";

export interface NewBot {
  personality: PersonalityId;
  difficulty: Difficulty;
}

/** A name from the personality's list that nobody in the town has yet. */
export function botIdentity(
  town: TownState,
  id: PersonalityId,
): { name: string; parlor: string; male: boolean } {
  const taken = new Set(town.players.filter((p) => p.active).map((p) => p.name.toLowerCase()));
  const names = personality(id).names;
  for (const n of names) if (!taken.has(n.name.toLowerCase())) return n;
  const base = names[0] ?? { name: "Rival", parlor: "Rival Rest", male: true };
  for (let i = 2; ; i++) {
    const name = `${base.name.slice(0, 16)} ${i}`;
    if (!taken.has(name.toLowerCase())) return { ...base, name };
  }
}

/**
 * Creates a bot's parlor through the same new-player form a person fills in,
 * then logs it off. Returns the town and the bot's seat (fair brain).
 */
export function createBotPlayer(
  town: TownState,
  bot: NewBot,
  ctx: EngineContext,
): { town: TownState; seat: BotSeat } {
  const who = botIdentity(town, bot.personality);
  const logon = `bot${town.players.length}x${bot.personality}`.slice(0, 20);
  const made = createPlayer(
    town,
    {
      logon,
      name: who.name,
      parlor: who.parlor,
      password: "bot",
      passwordVerify: "bot",
      male: who.male,
      email: `${logon}@bots.invalid`.slice(0, 45),
    },
    ctx,
  );
  if (!made.ok) throw new Error(`Could not create bot ${who.name}: ${JSON.stringify(made.error)}`);
  const off = step(made.town, made.playerId, { type: "exit" }, ctx);
  const memory: BotMemory = createMemory({
    playerId: made.playerId,
    name: who.name,
    parlor: who.parlor,
    personality: bot.personality,
    difficulty: bot.difficulty,
  });
  return {
    town: off.town,
    seat: { playerId: made.playerId, memory, brain: fairBrain(ctx.content) },
  };
}

/**
 * The ordinary, fair brain: the policy sees only Views and its memory. With a
 * content pack that has an Expanded section it also knows that pack's public
 * rule book (what traits and extras do, expanded/guide.ts); Classic packs add
 * nothing, so Classic play is unchanged.
 */
export function fairBrain(content?: ContentPack): Brain {
  const guide = guideFrom(content);
  return { kind: "fair", decide: createPolicy(guide ? { guide } : {}) };
}
