/// <reference types="node" />
/**
 * Whole-town playthrough recorder for the Classic regression test
 * (test/classicRegression.test.ts). A deterministic random walker plays
 * several players over several days, touching every place, overlay and the
 * cafe, and every action's view, effects and rejection are fed into a hash.
 * It reads only Views, like a real client.
 */
import { createHash, type Hash } from "node:crypto";
import type { Action, View } from "@fq/protocol";
import {
  type ClassicRules,
  createPlayer,
  createTown,
  type EngineContext,
  enterGame,
  runDailyMaintenance,
  type StepResult,
  step,
  type TownState,
} from "../../src/index.js";
import { context, PLAYER_NAMES, policyRng } from "./harness.js";

const TEXTS = [
  "",
  "1",
  "2",
  "5",
  "12",
  "-3",
  "abc",
  "Skelly",
  "mort",
  "Hello there, rival.",
  "A fortune for you: you will die.",
  "Digby",
];
const CHAT = [
  "hello",
  "/me waves a femur",
  "/info",
  "/who",
  "/tv",
  "/give Skelly wood",
  "/?",
  "/all",
];

export interface DayRecord {
  hash: string;
  actions: number;
}

export interface Transcript {
  days: DayRecord[];
  /** Hash of everything, in order. */
  hash: string;
  actions: number;
}

/** One choice for the walker from what the view offers. */
function choose(view: View, rand: () => number, turnsLeft: number, negSteps: number): Action {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const o = view.overlay;
  if (o) {
    switch (o.kind) {
      case "message":
        return { type: "dismiss", overlayId: o.id };
      case "confirm":
        return {
          type: "confirm",
          overlayId: o.id,
          accepted: rand() < (o.id.endsWith(":namenext") ? 0.8 : 0.5),
        };
      case "textInput": {
        if (rand() < 0.12) return { type: "submitText", overlayId: o.id, text: null };
        if (o.id.endsWith(":getname") && rand() < 0.75) {
          return { type: "submitText", overlayId: o.id, text: pick(PLAYER_NAMES).slice(0, 4) };
        }
        const text = pick(TEXTS).slice(0, o.maxLength);
        return { type: "submitText", overlayId: o.id, text };
      }
      case "playerPicker": {
        if (rand() < 0.1 || o.players.length === 0) {
          return { type: "pickPlayer", overlayId: o.id, playerId: null };
        }
        return { type: "pickPlayer", overlayId: o.id, playerId: pick(o.players).id };
      }
    }
  }
  if (view.map && view.map.length > 0) {
    if (rand() < 0.3) return { type: "visit", placeId: "funeral-home" };
    return { type: "visit", placeId: pick(view.map).id };
  }
  if (view.scene === "cafe" && rand() < 0.4) return { type: "chat", text: pick(CHAT) };
  const ids = view.buttons.filter((b) => b.enabled !== false).map((b) => b.id);
  if (ids.length === 0) return { type: "exit" };
  if (ids.includes("neg:done")) {
    if (negSteps > 6 || rand() < 0.2) return { type: "press", buttonId: "neg:done" };
    return { type: "press", buttonId: pick(ids.filter((id) => id.startsWith("neg:"))) };
  }
  if (ids.includes("desk:wait")) {
    if (turnsLeft <= 0) return { type: "press", buttonId: "desk:quit" };
    if (rand() < 0.7) return { type: "press", buttonId: "desk:wait" };
    const others = ids.filter((id) => id !== "desk:quit" && id !== "desk:wait");
    return { type: "press", buttonId: pick(others.length > 0 ? others : ["desk:wait"]) };
  }
  return { type: "press", buttonId: pick(ids) };
}

interface Seat {
  id: number;
  view: View;
  negSteps: number;
  actions: number;
  done: boolean;
}

function feed(hash: Hash, day: Hash, value: unknown): void {
  const text = JSON.stringify(value);
  hash.update(text);
  day.update(text);
}

/**
 * Plays `days` days of a `players`-player town from `seed` and hashes the
 * transcript. Each day the first half of the players play alone (so the
 * others can be visited and attacked), then the rest play together, taking
 * turns action by action (so the cafe has company).
 */
export function recordTranscript(options: {
  seed: number;
  players: number;
  days: number;
  rules?: ClassicRules;
  cap?: number;
  makeContext?: (now: number) => EngineContext;
  /** Called after every action, for diagnostics. */
  onStep?: (action: Action, result: StepResult) => void;
}): Transcript {
  const cap = options.cap ?? 220;
  const ctxAt = (now: number): EngineContext =>
    options.makeContext ? options.makeContext(now) : context(options.rules, now);
  const all = createHash("sha256");
  const out: DayRecord[] = [];
  let total = 0;
  let now = 1_000_000_000;
  let dayHash = createHash("sha256");
  const made = createTown({ seed: options.seed }, ctxAt(now));
  let town: TownState = made.town;
  feed(all, dayHash, made.effects);
  for (let i = 0; i < options.players; i++) {
    const name = PLAYER_NAMES[i] ?? `Player ${i}`;
    const r = createPlayer(
      town,
      {
        logon: `login${i}`,
        name,
        parlor: `${name} Rest`,
        password: "pw",
        passwordVerify: "pw",
        male: i % 2 === 0,
        email: `p${i}@example.com`,
      },
      ctxAt(now),
    );
    if (!r.ok) throw new Error("createPlayer failed");
    town = r.town;
    feed(all, dayHash, { view: r.view, effects: r.effects });
    town = step(town, r.playerId, { type: "exit" }, ctxAt(now)).town;
  }

  for (let d = 0; d < options.days; d++) {
    const rand = policyRng(options.seed * 31 + d * 7 + 1);
    let actions = 0;
    const play = (seat: Seat): void => {
      if (seat.done) return;
      now += 1000;
      const ctx = ctxAt(now);
      const p = town.players[seat.id];
      const turns = seat.view.hud?.turns ?? p?.turns ?? 0;
      const action: Action =
        seat.actions >= cap ? { type: "exit" } : choose(seat.view, rand, turns, seat.negSteps);
      const r: StepResult = step(town, seat.id, action, ctx);
      feed(all, dayHash, {
        p: seat.id,
        action,
        rejected: r.rejected ?? null,
        view: r.view,
        effects: r.effects,
      });
      options.onStep?.(action, r);
      town = r.town;
      seat.view = r.view;
      seat.actions++;
      actions++;
      seat.negSteps = r.view.buttons.some((b) => b.id === "neg:done") ? seat.negSteps + 1 : 0;
      if (action.type === "exit" || !town.sessions[String(seat.id)]) seat.done = true;
    };
    const logOn = (id: number): Seat => {
      now += 1000;
      const r = enterGame(town, id, ctxAt(now));
      feed(all, dayHash, { logon: id, view: r.view, effects: r.effects });
      town = r.town;
      return { id, view: r.view, negSteps: 0, actions: 0, done: false };
    };
    const half = Math.ceil(options.players / 2);
    for (let id = 0; id < half; id++) {
      if (!town.players[id]?.active) continue;
      const seat = logOn(id);
      while (!seat.done) play(seat);
    }
    const together: Seat[] = [];
    for (let id = half; id < options.players; id++) {
      if (town.players[id]?.active) together.push(logOn(id));
    }
    while (together.some((s) => !s.done)) for (const seat of together) play(seat);
    now += 60_000;
    const m = runDailyMaintenance(town, ctxAt(now));
    town = m.town;
    feed(all, dayHash, { maintenance: m.effects, town });
    out.push({ hash: dayHash.digest("hex"), actions });
    total += actions;
    dayHash = createHash("sha256");
  }
  return { days: out, hash: all.digest("hex"), actions: total };
}
