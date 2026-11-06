import { expandedPack } from "@fq/content";
import { expandedContext } from "@fq/core";
import { describe, expect, it } from "vitest";
import { ALL_PERSONALITY_IDS, DIFFICULTIES, type PersonalityId } from "../src/index.js";
import { scramblePack, scrambleText } from "./scramble.js";
import { playXTown } from "./xsupport.js";

describe("scrambled wording", () => {
  it("keeps placeholders, colour codes, digits and money, and changes the words", () => {
    const out = scrambleText("`wHello {name}, you owe $1,200 for 3 caskets.\\n");
    expect(out).toContain("`w");
    expect(out).toContain("{name}");
    expect(out).toContain("$1,200");
    expect(out).toContain(" 3 ");
    expect(out).toContain("\\n");
    expect(out).not.toMatch(/Hello|owe|caskets/);
    expect(scrambleText("casket casket")).toBe(
      `${scrambleText("casket")} ${scrambleText("casket")}`,
    );
  });

  it("rewords the pack but not its ids", () => {
    const scrambled = scramblePack(expandedPack);
    expect(scrambled.expanded?.softSell[0]?.name).not.toBe(
      expandedPack.expanded?.softSell[0]?.name,
    );
    expect(scrambled.text.desk.menu.wait).not.toBe(expandedPack.text.desk.menu.wait);
    expect(scrambled.expanded?.packages.map((p) => p.id)).toEqual(
      expandedPack.expanded?.packages.map((p) => p.id),
    );
    expect(scrambled.expanded?.town?.news.map((n) => n.id)).toEqual(
      expandedPack.expanded?.town?.news.map((n) => n.id),
    );
  });

  // The bots read the facts from the View's panels and button ids, and the pack's public rule
  // book (the guide) from the same scrambled pack the town plays with, so a season of reworded
  // text must still be played without a stuck bot-day, a rejected button or an error.
  for (const seed of [51, 52]) {
    it(`town ${seed}: eight bots play 30 days of scrambled text with no stuck day`, () => {
      const ctx = expandedContext(scramblePack(expandedPack), { now: 1_000_000 });
      const field = Array.from({ length: 8 }, (_, i) => ({
        personality: ALL_PERSONALITY_IDS[
          (seed * 3 + i) % ALL_PERSONALITY_IDS.length
        ] as PersonalityId,
        difficulty: DIFFICULTIES[(seed + i) % 3] ?? "hard",
      }));
      const labels = new Set<string>();
      const run = playXTown(seed, field, 30, {
        ctx,
        onStep: (e) => {
          for (const b of e.view.buttons) labels.add(b.label);
        },
      });
      // The views really carry the reworded text.
      expect(labels.has(scrambleText("Wait for Customer"))).toBe(true);
      expect(labels.has("Wait for Customer")).toBe(false);
      expect(run.stuck).toEqual([]);
      expect(run.errors).toEqual([]);
      expect(run.rejections.map((r) => `${r.reason} (offered ${r.offered})`)).toEqual([]);
      expect(run.fallbacks).toBeLessThan(run.steps * 0.02);
      for (const seat of run.seats) {
        expect(run.town.players[seat.playerId]?.bp).toBeGreaterThan(0);
        expect(seat.memory.days).toBe(30);
      }
    }, 300_000);
  }
});
