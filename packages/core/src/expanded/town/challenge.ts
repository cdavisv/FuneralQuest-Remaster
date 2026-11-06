import type { Button, View } from "@fq/protocol";
import { createPlayer, createTown, finalView } from "../../engine/engine.js";
import { type EngineContext, Turn } from "../../engine/turn.js";
import { button, hud, legacy } from "../../engine/view.js";
import { deriveSeed } from "../../rng/streams.js";
import type { ExpandedTownRules } from "../../rules/expandedTownRules.js";
import type { PlayerState, TownState } from "../../state/types.js";
import { fill, intToCash } from "../../text/format.js";
import { refreshRating } from "../parlor.js";
import { ensureExpanded } from "../players.js";
import { lifeOf } from "./life.js";

/**
 * The Daily Challenge (docs/expanded-rules.md section 24): every player gets
 * the identical seeded day. A challenge is a one-player Expanded town made
 * from the challenge's seed with a fixed loadout; every Wait for Customer
 * draws from its own stream keyed by its index (expanded/wait.ts), so the
 * same customers and events arrive in the same order whatever the player
 * did in between. The host creates the challenge once a day, starts one run
 * per player (and enforces "once"), plays it with `step` as usual, and
 * scores the town with `dailyChallengeResult`.
 */

export interface DailyChallenge {
  /** The host's name for the day, for example "2026-11-06". */
  id: string;
  seed: number;
  loadout: ExpandedTownRules["challenge"];
}

export interface DailyChallengeEntry {
  name: string;
  parlor: string;
  male: boolean;
}

export interface DailyChallengeResult {
  id: string;
  name: string;
  /** The run is over: out of turns with no customer, or logged off. */
  finished: boolean;
  /** BP earned in the run. The leaderboard sorts on this. */
  score: number;
  /** Money gained (or lost) in the run: the first tie-break. */
  money: number;
  sales: number;
  exact: number;
  walkouts: number;
}

const CHALLENGE_SALT = 0x46510da7;

/** A stable 32-bit seed from the challenge id (FNV-1a, then mixed). */
export function dailyChallengeSeed(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return deriveSeed(CHALLENGE_SALT, h);
}

/** Section 24.1: the day's challenge. Same id, same challenge, on every host. */
export function createDailyChallenge(id: string, ctx: EngineContext): DailyChallenge {
  const rules = ctx.rules.expanded;
  if (!rules) throw new Error("The Daily Challenge needs Expanded rules");
  return { id, seed: dailyChallengeSeed(id), loadout: { ...rules.town.challenge } };
}

/**
 * Section 24.2: a fresh run of `challenge` for one player. Returns the town
 * (player id 0, logged on, at the desk) and the view to show. The host keeps
 * the town as that player's run and calls `step(town, 0, action, ctx)`.
 */
export function startDailyChallenge(
  challenge: DailyChallenge,
  entry: DailyChallengeEntry,
  ctx: EngineContext,
): { town: TownState; playerId: number; view: View } {
  const l = challenge.loadout;
  let town = createTown(
    {
      seed: challenge.seed,
      settings: { tournamentActive: false, turnsPerDay: l.turns, maintDelete: false },
    },
    ctx,
  ).town;
  const created = createPlayer(
    town,
    {
      logon: "challenger",
      name: entry.name,
      parlor: entry.parlor,
      password: "daily-challenge",
      passwordVerify: "daily-challenge",
      male: entry.male,
      email: "daily@challenge.invalid",
    },
    ctx,
  );
  if (!created.ok) throw new Error(`Cannot start the challenge: ${JSON.stringify(created.error)}`);
  town = created.town;
  const turn = new Turn(town, ctx, created.playerId);
  const p = turn.player;
  const x = ensureExpanded(p, ctx.rules);
  p.money = l.money;
  p.turns = l.turns;
  p.psych = l.psych;
  p.transportation = l.hearse;
  p.tags = [...l.tags];
  p.karma = 50;
  p.luck = 50;
  p.dayLastLoggedOn = town.day;
  x.stock = [...l.stock];
  x.tutorial = { step: 99, done: true };
  lifeOf(town, p);
  refreshRating(ctx.rules, p);
  if (!town.expanded) town.expanded = { modifiers: [] };
  town.expanded.challenge = {
    id: challenge.id,
    waits: 0,
    finished: false,
    startBp: p.bp,
    startMoney: p.money,
    base: JSON.parse(JSON.stringify(p)) as PlayerState,
  };
  turn.session.scene = "desk";
  const desk = ctx.registry.module("desk")?.enter?.(turn, undefined);
  if (!desk) throw new Error("No desk");
  const intro = ctx.content.expanded?.town?.text.challenge.intro;
  if (intro) {
    desk.text = [
      ...legacy(`${fill(intro, { id: challenge.id, turns: p.turns })}\n\n`),
      ...desk.text,
    ];
  }
  const view = finalView(turn, desk);
  turn.session.view = view;
  turn.commit();
  return { town: turn.town, playerId: created.playerId, view };
}

/** Section 24.3: the run's score. */
export function dailyChallengeResult(town: TownState): DailyChallengeResult {
  const c = town.expanded?.challenge;
  if (!c) throw new Error("Not a Daily Challenge town");
  const p = town.players[0];
  if (!p) throw new Error("No challenger");
  const session = town.sessions["0"];
  // A sale still open, or its body-preparation choice still pending (free, and it can pay
  // BP), keeps the run going even with no turns left.
  const busy =
    (session?.customer.active === true && session.customer.flow !== "none") ||
    !!session?.expanded?.prep;
  const outOfTurns = p.turns <= 0 && !busy;
  const rec = p.expanded?.record;
  return {
    id: c.id,
    name: p.name,
    finished: c.finished || !session || outOfTurns,
    score: Math.max(0, p.bp - c.startBp),
    money: p.money - c.startMoney,
    sales: rec?.sales ?? 0,
    exact: rec?.exact ?? 0,
    walkouts: rec?.walkouts ?? 0,
  };
}

/** Section 24.3: the leaderboard order: score, then money, then fewer walkouts, then name. */
export function rankDailyChallenge(
  results: readonly DailyChallengeResult[],
): (DailyChallengeResult & { place: number })[] {
  const sorted = [...results].sort(
    (a, b) =>
      b.score - a.score ||
      b.money - a.money ||
      a.walkouts - b.walkouts ||
      a.name.localeCompare(b.name),
  );
  return sorted.map((r, i) => ({ ...r, place: i + 1 }));
}

/** The desk of a finished run: the score and a way out (section 24.2). */
export function challengeDesk(turn: Turn): View | null {
  const c = turn.town.expanded?.challenge;
  if (!c) return null;
  const text = turn.content.expanded?.town?.text.challenge;
  if (!text) return null;
  const result = dailyChallengeResult(turn.town);
  if (!c.finished && !(turn.player.turns <= 0)) return null;
  c.finished = true;
  const buttons: Button[] = [button("desk:quit", text.leave)];
  return {
    scene: "desk",
    title: text.title,
    text: legacy(
      fill(text.finished, {
        score: intToCash(result.score),
        sales: result.sales,
        money: intToCash(result.money),
      }),
    ),
    hud: hud(turn.player),
    buttons,
  };
}
