/// <reference types="node" />
/**
 * Classic is walled off from Expanded (docs/expanded-rules.md section 1.3).
 *
 * classicRegression.test.ts proves that Classic playthroughs are unchanged.
 * This file guards the reasons they cannot change by accident when Expanded
 * content is added or rebalanced:
 *
 * 1. Classic's rule numbers are a recorded fixture, so no balance round can
 *    move one without the change being seen.
 * 2. The Classic rules carry no Expanded rules, and the Classic registry has
 *    only the original places, the original modules and no hooks.
 * 3. Neither ruleset's rules object is written to while a town is played, so
 *    the numbers the two share by reference cannot drift.
 * 4. A Classic town holds no Expanded state, and a Classic playthrough is the
 *    same after an Expanded town has been played in the same process.
 *
 * To re-record after a deliberate Classic change (never for Expanded work):
 * UPDATE_CLASSIC_TRANSCRIPTS=1 pnpm --filter @fq/core test classicIsolation
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CLASSIC_PLACES,
  CLASSIC_RULES,
  createClassicRegistry,
  createExpandedRegistry,
  EXPANDED_PLACES,
  EXPANDED_RULES,
  originalClassicRules,
  type TownState,
} from "../src/index.js";
import { makeXTown } from "./support/expanded.js";
import { recordTranscript, type Transcript } from "./support/transcript.js";
import { xwalk } from "./support/xwalk.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES_FIXTURE = resolve(HERE, "fixtures/classic-rules.json");
const TRANSCRIPTS = resolve(HERE, "fixtures/classic-transcripts.json");
const UPDATE = process.env.UPDATE_CLASSIC_TRANSCRIPTS === "1";

/** Freezes an object and everything it holds, so any write to it throws. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
}

/** The path of every `expanded` record in a saved town (the town's, a player's, a customer's). */
function expandedKeys(value: unknown, path = "town", found: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((inner, i) => {
      expandedKeys(inner, `${path}[${i}]`, found);
    });
  } else if (value !== null && typeof value === "object") {
    for (const [key, inner] of Object.entries(value)) {
      if (key === "expanded") found.push(`${path}.${key}`);
      expandedKeys(inner, `${path}.${key}`, found);
    }
  }
  return found;
}

describe("Classic rule numbers are locked", () => {
  const now = { classic: CLASSIC_RULES, original: originalClassicRules() };
  if (UPDATE) writeFileSync(RULES_FIXTURE, `${JSON.stringify(now, null, 2)}\n`);

  it("has a recorded fixture", () => {
    expect(existsSync(RULES_FIXTURE), "run with UPDATE_CLASSIC_TRANSCRIPTS=1 once").toBe(true);
  });

  const want = existsSync(RULES_FIXTURE)
    ? (JSON.parse(readFileSync(RULES_FIXTURE, "utf8")) as Record<string, unknown>)
    : {};

  it("CLASSIC_RULES equals the fixture, number for number", () => {
    // Through JSON, as the fixture was written (and so nothing is lost: see the next test).
    expect(JSON.parse(JSON.stringify(now.classic))).toEqual(want.classic);
  });

  it("the original rules (every gameplay fix off) equal the fixture", () => {
    expect(JSON.parse(JSON.stringify(now.original))).toEqual(want.original);
  });

  it("the rules are plain data, so the fixture misses nothing", () => {
    const check = (value: unknown, path: string): void => {
      if (value === null || typeof value === "string" || typeof value === "boolean") return;
      if (typeof value === "number") {
        expect(Number.isFinite(value), path).toBe(true);
        return;
      }
      expect(typeof value, path).toBe("object");
      for (const [key, inner] of Object.entries(value as object)) check(inner, `${path}.${key}`);
    };
    check(CLASSIC_RULES, "CLASSIC_RULES");
  });
});

describe("Classic carries nothing of Expanded", () => {
  it("the Classic rules have no Expanded rules", () => {
    expect(CLASSIC_RULES.ruleset).toBe("classic");
    expect(CLASSIC_RULES.expanded).toBeUndefined();
    expect(originalClassicRules().ruleset).toBe("classic");
    expect(originalClassicRules().expanded).toBeUndefined();
    // The other ruleset is the one that has them.
    expect(EXPANDED_RULES.ruleset).toBe("expanded");
    expect(EXPANDED_RULES.expanded).toBeDefined();
  });

  it("the Classic registry has only the original places and no hooks", () => {
    const classic = createClassicRegistry();
    expect(classic.places.map((p) => p.id)).toEqual(CLASSIC_PLACES.map((p) => p.id));
    expect(classic.maintenanceHooks).toHaveLength(0);
    expect(classic.playerNewDayHooks).toHaveLength(0);
    expect(classic.playerCreatedHooks).toHaveLength(0);
    expect(classic.viewHooks).toHaveLength(0);
  });

  it("no Expanded place or module is reachable from the Classic registry", () => {
    const classic = createClassicRegistry();
    const expanded = createExpandedRegistry();
    const original = new Set<string>(CLASSIC_PLACES.map((p) => p.id));
    const added = EXPANDED_PLACES.filter((p) => !original.has(p.id));
    // The Expanded map is the 9 original places plus the new ones.
    expect(added.length).toBe(EXPANDED_PLACES.length - CLASSIC_PLACES.length);
    expect(added.length).toBeGreaterThan(0);
    for (const place of added) {
      expect(classic.place(place.id), `place ${place.id}`).toBeUndefined();
      expect(expanded.module(place.module), `module ${place.module}`).toBeDefined();
      expect(classic.module(place.module), `module ${place.module}`).toBeUndefined();
    }
    // Body preparation, the parlor office and the guided first day.
    for (const id of ["prep", "parlor", "tutorial"]) {
      expect(expanded.module(id), id).toBeDefined();
      expect(classic.module(id), id).toBeUndefined();
    }
    // Where Expanded changes how an original place behaves, it does so with its
    // own module: the Classic registry still holds a different, Classic one.
    for (const id of ["desk", "neg", "stats", "store", "spirit-university", "competitors"]) {
      expect(classic.module(id), id).toBeDefined();
      expect(expanded.module(id), id).toBeDefined();
      expect(classic.module(id), id).not.toBe(expanded.module(id));
    }
  });
});

describe("Playing Expanded leaves Classic as it was", () => {
  const expected = JSON.parse(readFileSync(TRANSCRIPTS, "utf8")) as Record<string, Transcript>;
  const NAME = "seed 77, 5 players, 3 days";

  it("neither ruleset's rules are written to, and Classic plays the same afterwards", () => {
    // Any write to either rules object throws from here on (modules are strict).
    deepFreeze(CLASSIC_RULES);
    deepFreeze(EXPANDED_RULES);

    // An Expanded town first: every Expanded module, hook and place runs.
    const { town, ctx } = makeXTown(77, 4);
    const walked = xwalk(town, ctx, 4, { seed: 77, days: 3 });
    expect(walked.actions).toBeGreaterThan(600);
    expect(expandedKeys(walked.town).length).toBeGreaterThan(0);

    // Then a Classic town, in the same process, against the recorded fixture.
    let last: TownState | undefined;
    const got = recordTranscript({
      seed: 77,
      players: 5,
      days: 3,
      onStep: (_action, result) => {
        last = result.town;
      },
    });
    const want = expected[NAME];
    expect(want, "missing from the fixture").toBeDefined();
    expect(got.hash).toBe(want?.hash);
    // And the Classic town holds no Expanded state anywhere.
    expect(last).toBeDefined();
    expect(expandedKeys(last)).toEqual([]);
  });
});
