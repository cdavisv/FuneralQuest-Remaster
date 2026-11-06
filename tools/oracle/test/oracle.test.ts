/**
 * The differential oracle's own checks. They need the compiled original
 * (`pnpm --filter @fq/oracle run build`); without it every test is skipped,
 * so a machine without g++ stays green.
 */
import { Mt19937 } from "@fq/core";
import { describe, expect, it } from "vitest";
import { compareCustomers } from "../src/customers.js";
import { oracleAvailable, runOracle } from "../src/oracle.js";
import { runWalk } from "../src/run.js";
import { FAMILIES } from "../src/suite.js";
import { parseOriginal } from "../src/vars.js";

const built = oracleAvailable();

describe.skipIf(!built)("the compiled original", () => {
  it("starts a new game: server_init runs init.c and the first maintenance (day 1)", () => {
    const { lines } = runOracle(["clock 978307200", "seed 1 1", "init"]);
    const init = lines[2] as { town: { day: number; players: unknown[] }; rng: { mt: number } };
    expect(init.town.day).toBe(1);
    expect(init.town.players).toEqual([]);
    // The news blurb of day 1 is the only draw (maint.cpp:115-171).
    expect(init.rng.mt).toBe(1);
  });

  it("answers a log-on screen request like the server did (funeral.cpp:211-292)", () => {
    const { lines } = runOracle(["seed 1 1", "init", "req 10.0.0.1 checklogon"]);
    const reply = lines[2] as { responses: string[] };
    const vars = parseOriginal(reply.responses[0] ?? "");
    expect(vars.find(([k]) => k === "i_sent")?.[1]).toBe("1");
  });

  it("the shim's rand() is Microsoft's: srand(1) gives 41, 18467, 6334, 26500", () => {
    const { lines } = runOracle(["seed 4357 1", "crt 4"]);
    expect((lines[1] as { values: number[] }).values).toEqual([41, 18467, 6334, 26500]);
  });

  it("the twister is the 1998 sgenrand MT19937 the port reproduces", () => {
    const { lines } = runOracle(["seed 4357 1", "peek"]);
    const next = (lines[1] as { nextMt: number[] }).nextMt;
    const mt = new Mt19937(4357);
    // Random(0xffffffff) is y % 0xffffffff.
    expect(next).toEqual(Array.from({ length: 4 }, () => mt.nextUint32() % 0xffffffff));
  });
});

describe.skipIf(!built)("original against port", () => {
  it("create_random_customer matches for 2,000 seeds, field by field and draw by draw", () => {
    const r = compareCustomers(1, 2000);
    expect(r.mismatches).toEqual([]);
    expect(r.exact).toBe(2000);
  });

  // Every family, a few seeds: the draws and records after every step, and the
  // words of every text the player reads (st_main, st_message, st_news, ...),
  // must be the original's. The only exemption is the source release's "/?"
  // answer (run.ts exemptHelp, docs/classic-fidelity.md D5).
  for (const family of FAMILIES) {
    it(`${family.name}: identical draws, records, screens and words`, async () => {
      for (const seed of [1, 2]) {
        const r = await runWalk(family.spec(seed));
        expect(r.divergence, `${family.name} ${seed}`).toBeNull();
        expect(r.transients, `${family.name} ${seed}`).toEqual([]);
        expect(
          r.flowDiffs.map((f) => f.step),
          `${family.name} ${seed}`,
        ).toEqual([]);
        expect(
          r.textDiffs.map((t) => ({
            step: t.index,
            name: t.name,
            original: t.original,
            port: t.port,
          })),
          `${family.name} ${seed}`,
        ).toEqual([]);
        expect(r.steps).toBeGreaterThan(50);
      }
    }, 120_000);
  }
});
