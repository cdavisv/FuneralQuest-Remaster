/// <reference types="node" />
/**
 * Classic regression lock (docs/expanded-rules.md section 1.3). Complete
 * Classic playthroughs (every View, effect and rejection, plus the town after
 * each midnight) are hashed per day and compared with the fixture recorded
 * before the Expanded ruleset was added. Any change to what a Classic player
 * sees, or to the saved town, fails here.
 *
 * To re-record after a deliberate Classic change (never for Expanded work):
 * UPDATE_CLASSIC_TRANSCRIPTS=1 pnpm --filter @fq/core test classicRegression
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { originalClassicRules } from "../src/index.js";
import { recordTranscript, type Transcript } from "./support/transcript.js";

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/classic-transcripts.json",
);

interface Case {
  name: string;
  seed: number;
  players: number;
  days: number;
  original?: boolean;
}

const CASES: Case[] = [
  { name: "seed 1, 4 players, 4 days", seed: 1, players: 4, days: 4 },
  { name: "seed 77, 5 players, 3 days", seed: 77, players: 5, days: 3 },
  { name: "seed 2024, 3 players, 5 days", seed: 2024, players: 3, days: 5 },
  { name: "seed 31337, 6 players, 3 days", seed: 31337, players: 6, days: 3 },
  {
    name: "seed 4242, 4 players, 3 days, original rules",
    seed: 4242,
    players: 4,
    days: 3,
    original: true,
  },
];

function run(c: Case): Transcript {
  return recordTranscript({
    seed: c.seed,
    players: c.players,
    days: c.days,
    ...(c.original ? { rules: originalClassicRules() } : {}),
  });
}

describe("Classic playthroughs are unchanged (expanded-rules.md 1.3)", () => {
  const update = process.env.UPDATE_CLASSIC_TRANSCRIPTS === "1";
  const results = Object.fromEntries(CASES.map((c) => [c.name, run(c)]));

  if (update) {
    writeFileSync(FIXTURE, `${JSON.stringify(results, null, 2)}\n`);
  }

  it("has a recorded fixture", () => {
    expect(existsSync(FIXTURE), "run with UPDATE_CLASSIC_TRANSCRIPTS=1 once").toBe(true);
  });

  const expected = existsSync(FIXTURE)
    ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, Transcript>)
    : {};

  for (const c of CASES) {
    it(c.name, () => {
      const got = results[c.name] as Transcript;
      const want = expected[c.name];
      expect(want, "missing from the fixture").toBeDefined();
      if (!want) return;
      // Day by day first, so a failure names the first day that changed.
      want.days.forEach((day, i) => {
        expect(got.days[i], `day ${i + 1}`).toEqual(day);
      });
      expect(got.hash).toBe(want.hash);
      // The walk must actually exercise the game.
      expect(got.actions).toBeGreaterThan(200 * c.days);
    });
  }
});
