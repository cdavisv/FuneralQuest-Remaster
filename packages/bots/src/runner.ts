import {
  type CustomerState,
  type Effect,
  type EngineContext,
  enterGame,
  type StepResult,
  step,
  type TownState,
} from "@fq/core";
import type { Action, View } from "@fq/protocol";
import { type BotMemory, newSession } from "./memory.js";
import type { Policy } from "./policy.js";
import { BotRandom } from "./random.js";
import { describeAction, safeAction, signature } from "./read.js";

/**
 * A policy that may read the customer's hidden record. Only the simulator's
 * oracle is one; it lives in `@fq/bots/oracle` so a game host never wires it
 * in by accident.
 */
export type OraclePolicy = (input: {
  readonly view: View;
  readonly memory: BotMemory;
  readonly rng: BotRandom;
  readonly hidden: Readonly<CustomerState> | null;
}) => Action;

/** How a seat's decisions are made. */
export type Brain = { kind: "fair"; decide: Policy } | { kind: "oracle"; decide: OraclePolicy };

/** One bot in a town: its player slot, its memory and its brain. */
export interface BotSeat {
  playerId: number;
  memory: BotMemory;
  brain: Brain;
}

/** One action of a bot's day, for the simulator and for logs. */
export interface StepEvent {
  playerId: number;
  /** The town and view the action answered. */
  before: TownState;
  view: View;
  action: Action;
  result: StepResult;
  /** True when this action came from the safe fallback, not the policy. */
  fallback: boolean;
}

export interface Rejection {
  playerId: number;
  action: Action;
  reason: string;
  /** The view the action answered. */
  view: View;
  /** Whether the view offered the action (a button on screen, the overlay's id). */
  offered: boolean;
}

export interface BotDayOptions {
  /** Most actions in one day (default 800). */
  stepCap?: number;
  /** The bot's dice for the day; default `BotRandom.forDay(town.seed, playerId, town.day)`. */
  rng?: BotRandom;
  onStep?: (event: StepEvent) => void;
  /** Identical screens in a row that count as stuck (default 12). */
  stuckRepeats?: number;
}

export interface BotDayResult {
  town: TownState;
  effects: Effect[];
  steps: number;
  /** The step cap or the repeat guard ended the day. */
  stuck: boolean;
  /** Why it was stuck, with the last screen's signature. */
  stuckOn?: string;
  rejections: Rejection[];
  /** Errors thrown by the policy (the fallback answered instead). */
  errors: string[];
  memory: BotMemory;
}

/** Whether `action` is one the view offered (mirrors the engine's own check). */
export function offered(view: View, action: Action): boolean {
  const o = view.overlay;
  switch (action.type) {
    case "exit":
      return true;
    case "press":
      return !o && view.buttons.some((b) => b.id === action.buttonId && b.enabled !== false);
    case "visit":
      return !o && !!view.map?.some((p) => p.id === action.placeId);
    case "dismiss":
      return o?.kind === "message" && o.id === action.overlayId;
    case "confirm":
      return o?.kind === "confirm" && o.id === action.overlayId;
    case "submitText":
      return (
        o?.kind === "textInput" &&
        o.id === action.overlayId &&
        (action.text === null || action.text.length <= o.maxLength)
      );
    case "pickPlayer":
      return (
        o?.kind === "playerPicker" &&
        o.id === action.overlayId &&
        (action.playerId === null || o.players.some((p) => p.id === action.playerId))
      );
    case "chat":
      return view.scene === "cafe" && !o;
  }
}

function hiddenCustomer(town: TownState, playerId: number): CustomerState | null {
  const c = town.sessions[String(playerId)]?.customer;
  return c?.active && c.flow === "negotiation" ? structuredClone(c) : null;
}

/**
 * Plays one bot's whole day: logs on, answers every screen with its policy
 * until it logs off, and makes sure it is logged off at the end. It never
 * throws on an unfamiliar screen: a rejected or failed decision is answered
 * with the safest offered button. The day always ends (step cap).
 */
export function runBotDay(
  town: TownState,
  seat: BotSeat,
  ctx: EngineContext,
  options: BotDayOptions = {},
): BotDayResult {
  const cap = options.stepCap ?? 800;
  const stuckRepeats = options.stuckRepeats ?? 12;
  const id = seat.playerId;
  const rng = options.rng ?? BotRandom.forDay(town.seed, id, town.day);
  const memory = seat.memory;
  memory.session = newSession();
  const effects: Effect[] = [];
  const rejections: Rejection[] = [];
  const errors: string[] = [];
  const entered = enterGame(town, id, ctx);
  if (entered.rejected) {
    return { town, effects, steps: 0, stuck: false, rejections, errors, memory };
  }
  let current = entered.town;
  effects.push(...entered.effects);
  let view = entered.view;
  let steps = 0;
  let stuck = false;
  let stuckOn: string | undefined;
  let lastSig = "";
  let repeats = 0;

  const apply = (action: Action, fallback: boolean): StepResult => {
    const before = current;
    const result = step(before, id, action, ctx);
    options.onStep?.({ playerId: id, before, view, action, result, fallback });
    if (result.rejected) {
      rejections.push({
        playerId: id,
        action,
        reason: result.rejected,
        view,
        offered: offered(view, action),
      });
    }
    return result;
  };

  while (steps < cap) {
    if (!current.sessions[String(id)] || view.scene === "lobby") break;
    const sig = signature(view);
    repeats = sig === lastSig ? repeats + 1 : 0;
    lastSig = sig;
    if (repeats >= stuckRepeats) {
      stuck = true;
      stuckOn = `repeated screen ${sig}`;
      break;
    }
    let action: Action;
    try {
      action =
        seat.brain.kind === "fair"
          ? seat.brain.decide({ view, memory, rng })
          : seat.brain.decide({ view, memory, rng, hidden: hiddenCustomer(current, id) });
    } catch (error) {
      errors.push(error instanceof Error ? (error.stack ?? error.message) : String(error));
      action = safeAction(view);
    }
    steps++;
    let result = apply(action, false);
    if (result.rejected) {
      const fallback = safeAction(view);
      if (describeAction(fallback) !== describeAction(action)) {
        steps++;
        result = apply(fallback, true);
      }
      if (result.rejected) {
        result = apply({ type: "exit" }, true);
      }
    }
    current = result.town;
    effects.push(...result.effects);
    view = result.view;
  }
  if (steps >= cap && current.sessions[String(id)]) {
    stuck = true;
    stuckOn = `step cap ${cap} on ${signature(view)}`;
  }
  if (current.sessions[String(id)]) {
    const result = apply({ type: "exit" }, true);
    current = result.town;
    effects.push(...result.effects);
  }
  return {
    town: current,
    effects,
    steps,
    stuck,
    ...(stuckOn ? { stuckOn } : {}),
    rejections,
    errors,
    memory,
  };
}
