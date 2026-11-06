import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import {
  ALL_PERSONALITY_IDS,
  type BotSeat,
  createPolicy,
  DIFFICULTIES,
  guideFrom,
  type PersonalityId,
  type Policy,
} from "../src/index.js";
import { playXTown, xContext } from "./xsupport.js";

/** The View as an older engine would send it: no structured panels. */
function withoutPanels(view: View): View {
  const out: View = { ...view };
  delete out.office;
  delete out.bingo;
  delete out.ballots;
  delete out.bank;
  delete out.club;
  delete out.prep;
  if (out.hud) {
    out.hud = { ...out.hud };
    delete out.hud.injuryList;
  }
  if (out.customer) {
    out.customer = { ...out.customer };
    delete out.customer.bands;
    delete out.customer.haggle;
  }
  return out;
}

describe("structured panels", () => {
  it("the engine sends the panels the bots read", () => {
    let seen = new Set<string>();
    playXTown(
      71,
      Array.from({ length: 8 }, (_, i) => ({
        personality: ALL_PERSONALITY_IDS[i] as PersonalityId,
        difficulty: "hard" as const,
      })),
      12,
      {
        onStep: (e) => {
          for (const k of ["office", "bingo", "ballots", "bank", "club", "prep"] as const)
            if (e.view[k]) seen.add(k);
          if (e.view.customer?.bands) seen.add("bands");
        },
      },
    );
    expect([...seen].sort()).toEqual([
      "ballots",
      "bands",
      "bank",
      "bingo",
      "club",
      "office",
      "prep",
    ]);
    seen = new Set();
  }, 240_000);

  it("a season without any panel is still played with no stuck day, error or rejection", () => {
    const ctx = xContext();
    const guide = guideFrom(ctx.content);
    const run = playXTown(
      72,
      Array.from({ length: 8 }, (_, i) => ({
        personality: ALL_PERSONALITY_IDS[(i * 5 + 2) % ALL_PERSONALITY_IDS.length] as PersonalityId,
        difficulty: DIFFICULTIES[i % 3] ?? "hard",
      })),
      30,
      {
        ctx,
        // Wrap every seat's brain once it exists (the seats are created inside playXTown).
        wrap: (seat: BotSeat) => {
          const inner: Policy = createPolicy(guide ? { guide } : {});
          seat.brain = {
            kind: "fair",
            decide: (input) => inner({ ...input, view: withoutPanels(input.view) }),
          };
        },
      },
    );
    expect(run.stuck).toEqual([]);
    expect(run.errors).toEqual([]);
    expect(run.rejections.map((r) => `${r.reason} (offered ${r.offered})`)).toEqual([]);
  }, 300_000);
});
