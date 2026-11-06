import type { View } from "@fq/protocol";
import { expect } from "vitest";
import { step, type TownState } from "../../src/index.js";
import { buttonIds, policyRng } from "./harness.js";
import { atDesk } from "./places.js";

/** The places this module set owns (ids of `CLASSIC_PLACES`). */
export const MY_PLACES = ["bank", "store", "spirit-university", "yangs", "church", "hospital"];

export interface WalkStats {
  /** Button ids that were accepted at least once. */
  accepted: Set<string>;
  /** Place ids entered from the map. */
  visited: Set<string>;
  /** Every picture id (foreground or background) of every view shown. */
  pictures: Set<string>;
  /** Overlay ids seen. */
  overlays: Set<string>;
  steps: number;
}

export function newStats(): WalkStats {
  return {
    accepted: new Set(),
    visited: new Set(),
    pictures: new Set(),
    overlays: new Set(),
    steps: 0,
  };
}

const TEXTS = [
  "",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "8",
  "12",
  "-1",
  "abc",
  "  7  ",
  "99999999999",
  "Bob",
  "Mort Dillon",
  "fuck off",
  "x".repeat(25),
  "Skelly",
  "morticia",
  "A fortune for you.",
];

export function checkInvariants(town: TownState): void {
  for (const p of town.players) {
    if (!p.active) continue;
    expect(p.turns).toBeGreaterThanOrEqual(0);
    for (const t of p.tags) expect(t).toBeGreaterThanOrEqual(0);
    expect(p.bp).toBeGreaterThanOrEqual(0);
    expect(p.bpToday).toBeGreaterThanOrEqual(0);
    expect(p.bpToday).toBeLessThanOrEqual(p.bp);
    expect(p.luck).toBeGreaterThanOrEqual(1);
    expect(p.luck).toBeLessThanOrEqual(100);
    expect(p.psych).toBeGreaterThanOrEqual(0);
    expect(p.strength).toBeGreaterThanOrEqual(3);
    expect(p.hpMax).toBeGreaterThanOrEqual(10);
    expect(p.yangsSent).toBeGreaterThanOrEqual(0);
    expect(p.yangsSent).toBeLessThanOrEqual(town.settings.yangsPerDay);
    expect(p.name.length).toBeGreaterThanOrEqual(3);
    expect(p.name.length).toBeLessThanOrEqual(20);
    expect(Number.isInteger(p.transportation)).toBe(true);
    expect(p.custom.slice(0, 3).every((v) => v === 0 || v === 1)).toBe(true);
    expect(p.custom[3]).toBeGreaterThanOrEqual(0);
  }
}

function recordPictures(view: View, stats: WalkStats): void {
  if (view.picture?.fg) stats.pictures.add(view.picture.fg);
  if (view.picture?.bg) stats.pictures.add(view.picture.bg);
}

/** Every offered action is accepted (on a copy); made-up ones are not. */
function checkGuard(
  town: TownState,
  view: View,
  ctx: Parameters<typeof step>[3],
  stats: WalkStats,
): void {
  for (const b of view.buttons) {
    const r = step(town, 0, { type: "press", buttonId: b.id }, ctx);
    expect(r.rejected, `${b.id} on ${view.title}`).toBeUndefined();
    stats.accepted.add(b.id);
    recordPictures(r.view, stats);
  }
  const o = view.overlay;
  if (o?.kind === "textInput") {
    for (const text of [null, ...TEXTS.filter((t) => t.length <= o.maxLength)]) {
      const r = step(town, 0, { type: "submitText", overlayId: o.id, text }, ctx);
      expect(r.rejected, `${o.id} with ${JSON.stringify(text)}`).toBeUndefined();
      recordPictures(r.view, stats);
    }
    expect(
      step(town, 0, { type: "submitText", overlayId: o.id, text: "x".repeat(o.maxLength + 1) }, ctx)
        .rejected,
    ).toBeDefined();
  }
  if (o?.kind === "playerPicker") {
    for (const playerId of [null, ...o.players.map((p) => p.id)]) {
      const r = step(town, 0, { type: "pickPlayer", overlayId: o.id, playerId }, ctx);
      expect(r.rejected, `${o.id} with ${playerId}`).toBeUndefined();
      recordPictures(r.view, stats);
    }
    expect(
      step(town, 0, { type: "pickPlayer", overlayId: o.id, playerId: 999 }, ctx).rejected,
    ).toBeDefined();
  }
  const offered = new Set(buttonIds(view));
  for (const bogus of [
    "desk:wait",
    "neg:done",
    "bank:all-gold",
    "store:buy",
    "yangs:tiger",
    "script:9",
    "nope",
  ]) {
    if (offered.has(bogus) && !view.overlay) continue;
    const r = step(town, 0, { type: "press", buttonId: bogus }, ctx);
    expect(r.rejected, bogus).toBeDefined();
    expect(r.town).toBe(town);
  }
}

/**
 * A simulated player with random resources walks the town: visits every
 * place of this module set, presses buttons, answers prompts with awkward
 * text, and at every screen checks that every offered action is accepted.
 */
export function walkPlaces(seed: number, stats: WalkStats, steps = 120): TownState {
  const rand = policyRng(seed * 977);
  const pickOne = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;
  const rich = (t: TownState) => {
    const p = t.players[0];
    if (!p) return;
    p.tags = [Math.floor(rand() * 30), Math.floor(rand() * 15), Math.floor(rand() * 45)];
    p.bpToday = Math.floor(rand() * 70);
    p.bp = p.bpToday + Math.floor(rand() * 100);
    p.luck = 1 + Math.floor(rand() * 100);
    p.psych = Math.floor(rand() * 3);
  };
  const start = atDesk({ seed, players: 3, setup: rich });
  const ctx = start.ctx;
  let town = start.town;
  let view = start.view;
  for (let i = 0; i < steps; i++) {
    stats.steps++;
    checkInvariants(town);
    recordPictures(view, stats);
    if (view.overlay) stats.overlays.add(view.overlay.id);
    checkGuard(town, view, ctx, stats);
    if (i % 25 === 24) {
      town = structuredClone(town);
      rich(town);
    }
    let action: Parameters<typeof step>[2];
    const o = view.overlay;
    if (o?.kind === "textInput") {
      const fits = TEXTS.filter((t) => t.length <= o.maxLength);
      action = { type: "submitText", overlayId: o.id, text: rand() < 0.1 ? null : pickOne(fits) };
    } else if (o?.kind === "playerPicker") {
      const choice = rand() < 0.1 ? null : (pickOne(o.players)?.id ?? null);
      action = { type: "pickPlayer", overlayId: o.id, playerId: choice };
    } else if (view.map) {
      const placeId = pickOne(MY_PLACES);
      stats.visited.add(placeId);
      action = { type: "visit", placeId };
    } else {
      const ids = buttonIds(view).filter((id) => id !== "desk:wait" && id !== "desk:quit");
      if (ids.length === 0) throw new Error(`Stuck on ${view.title}`);
      const forStats = rand() < 0.15 ? "go:stats" : "go:map";
      action = {
        type: "press",
        buttonId: ids.includes("go:map") && ids.includes("go:stats") ? forStats : pickOne(ids),
      };
    }
    const r = step(town, 0, action, ctx);
    expect(r.rejected, JSON.stringify(action)).toBeUndefined();
    town = r.town;
    view = r.view;
  }
  checkInvariants(town);
  return town;
}
