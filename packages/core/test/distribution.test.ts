import { describe, expect, it } from "vitest";
import { waitForCustomer } from "../src/classic/wait.js";
import { Turn } from "../src/index.js";
import { makeTown } from "./support/harness.js";

/**
 * The Wait for Customer split (legacy/source/commands_customer.cpp:4-73):
 * 8% event; then 8% of the rest a risk (7.36%); then 5% of the rest a script
 * event (4.23%); otherwise a customer (80.4%).
 */
describe("Wait for Customer branching", () => {
  it("splits about 8% event, 7.4% risk, 4.2% script, 80.4% customer", () => {
    const { town, ctx } = makeTown(2024, 2);
    const counts = { event: 0, risk: 0, script: 0, customer: 0 };
    const n = 40000;
    for (let day = 0; day < 8; day++) {
      town.day += 1; // a fresh stream for each batch
      // One Turn per batch keeps the stream open (reopening replays every earlier draw).
      const turn = new Turn(town, ctx, 0);
      for (let i = 0; i < n / 8; i++) {
        const player = turn.player;
        player.turns = 15;
        turn.session.script = null;
        const view = waitForCustomer(turn);
        const ids = view.buttons.map((b) => b.id);
        if (ids.includes("neg:done")) {
          counts.customer++;
          expect(player.turns).toBe(14);
        } else if (ids.includes("risk:take")) counts.risk++;
        else if (turn.session.script) counts.script++;
        else counts.event++;
        if (!ids.includes("neg:done")) expect(player.turns).toBe(15);
      }
    }
    expect(counts.event / n).toBeCloseTo(0.08, 2);
    expect(counts.risk / n).toBeCloseTo(0.0736, 2);
    expect(counts.script / n).toBeCloseTo(0.0423, 2);
    expect(counts.customer / n).toBeCloseTo(0.804, 2);
  });
});
