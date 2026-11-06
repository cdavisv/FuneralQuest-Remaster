import {
  ALL_PERSONALITY_IDS,
  type BotSeat,
  createBotPlayer,
  describeAction,
  PERSONALITY_IDS,
  type Policy,
  runBotDay,
} from "@fq/bots";
import { expandedPack } from "@fq/content";
import {
  classicContext,
  createTown,
  type EngineContext,
  expandedContext,
  originalClassicRules,
  runDailyMaintenance,
} from "@fq/core";
import { describe, expect, it } from "vitest";
import { simContent } from "../src/index.js";

/**
 * An engine-bug hunt: three players press random offered buttons and answer
 * prompts with awkward text while two real bots play alongside, with rich
 * stocks so every shop and fight is reachable. Any offered action the engine
 * refuses, any thrown error and any broken invariant is a finding.
 */
const TEXTS = [
  "",
  "1",
  "0",
  "-3",
  "7",
  "abc",
  "Vera",
  "Grimsby Gloom",
  "/give Vera gold",
  "/tv off",
  "/me waves",
  "hello [x] world",
  "x".repeat(30),
];

const chaos: Policy = ({ view, rng }) => {
  const o = view.overlay;
  if (o?.kind === "message") return { type: "dismiss", overlayId: o.id };
  if (o?.kind === "confirm") return { type: "confirm", overlayId: o.id, accepted: rng.chance(0.6) };
  if (o?.kind === "textInput") {
    const text = rng.chance(0.1) ? null : (rng.pick(TEXTS) ?? "").slice(0, o.maxLength);
    return { type: "submitText", overlayId: o.id, text };
  }
  if (o?.kind === "playerPicker") {
    return {
      type: "pickPlayer",
      overlayId: o.id,
      playerId: rng.chance(0.85) ? (rng.pick(o.players)?.id ?? null) : null,
    };
  }
  const place = view.map && rng.chance(0.9) ? rng.pick(view.map) : undefined;
  if (place) return { type: "visit", placeId: place.id };
  if (view.scene === "cafe" && rng.chance(0.3))
    return { type: "chat", text: rng.pick(TEXTS) || "hi" };
  const buttons = view.buttons.filter(
    (b) => b.enabled !== false && (b.id !== "desk:quit" || rng.chance(0.02)),
  );
  const pick = rng.pick(buttons);
  return pick ? { type: "press", buttonId: pick.id } : { type: "exit" };
};

function hunt(seeds: number[], original: boolean, given?: EngineContext): string[] {
  const ctx =
    given ??
    classicContext(simContent(), {
      now: 1,
      ...(original ? { rules: originalClassicRules() } : {}),
    });
  const ids = given ? ALL_PERSONALITY_IDS : PERSONALITY_IDS;
  const findings: string[] = [];
  for (const seed of seeds) {
    let town = createTown({ seed }, ctx).town;
    const seats: BotSeat[] = [];
    for (let i = 0; i < 5; i++) {
      const made = createBotPlayer(
        town,
        {
          personality: (given ? ids[(i + seed) % ids.length] : ids[i]) ?? "shark",
          difficulty: "hard",
        },
        ctx,
      );
      town = made.town;
      seats.push(made.seat);
    }
    for (const p of town.players) {
      p.tags = [40, 20, 80];
      p.custom[3] = 5;
      if (given) p.money = 60_000;
    }
    for (let d = 0; d < 6; d++) {
      for (const [i, seat] of seats.entries()) {
        const brain = i < 3 ? { kind: "fair" as const, decide: chaos } : seat.brain;
        const r = runBotDay(town, { ...seat, brain }, ctx, { stepCap: 300 });
        town = r.town;
        for (const x of r.rejections) {
          if (x.offered)
            findings.push(
              `seed ${seed} day ${town.day}: ${describeAction(x.action)} on "${x.view.title}" rejected: ${x.reason}`,
            );
        }
        for (const e of r.errors) findings.push(`seed ${seed}: policy error ${e.split("\n")[0]}`);
        for (const p of town.players) {
          if (
            p.active &&
            (p.turns < 0 ||
              p.bp < 0 ||
              p.bpToday < 0 ||
              p.hp < 0 ||
              p.luck < 1 ||
              p.tags.some((t) => t < 0))
          ) {
            findings.push(`seed ${seed} day ${town.day}: invariant broken for ${p.name}`);
          }
        }
      }
      town = runDailyMaintenance(town, ctx).town;
    }
  }
  return findings;
}

describe("engine bug hunt", () => {
  it("random play under Classic rules finds no refused offered action or broken invariant", () => {
    expect(hunt([1, 2, 3, 4, 5, 6], false)).toEqual([]);
  }, 60_000);

  it("and none under the original rules (every fix off)", () => {
    expect(hunt([7, 8, 9], true)).toEqual([]);
  }, 60_000);

  it("and none under the Expanded rules with the Expanded pack", () => {
    const ctx = expandedContext(expandedPack, { now: 1 });
    expect(hunt([11, 12, 13, 14], false, ctx)).toEqual([]);
  }, 120_000);
});
