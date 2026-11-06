import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExpandedHost, expandedOptions } from "../src/dev/ExpandedHost.js";
import { renderGame } from "./helpers.js";

/** A small seeded generator, so a failing walk can be run again. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The client against the real engine: a random player in a local Expanded town presses whatever
 * the screen offers, in all three layouts, and nothing may throw or log a React error. Every
 * View the engine produces on the way is drawn.
 */
describe("a random walk through the real Expanded engine", () => {
  for (const [layout, seed] of [
    ["classic", 3],
    ["wide", 8],
    ["phone", 21],
  ] as const) {
    it(`draws every screen it meets (${layout}, seed ${seed})`, { timeout: 120_000 }, async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      const user = userEvent.setup({ delay: null });
      const random = rng(seed);
      const host = new ExpandedHost(
        expandedOptions(`?seed=${seed}&money=90000&karma=${30 + seed}&turns=60&tags=8,6,4&day=6`),
      );
      renderGame(host, { settings: { layout } });
      const seen = new Set<string>();
      for (let step = 0; step < 140; step++) {
        await waitFor(() => expect(document.querySelector("h1")).not.toBeNull(), { timeout: 5000 });
        const title = document.querySelector("h1")?.textContent ?? "";
        const dialog = screen.queryByRole("dialog");
        if (dialog) {
          // A letter, a question or a list of players: answer it.
          const radios = dialog.querySelectorAll<HTMLInputElement>("input[type=radio]");
          const text = dialog.querySelector<HTMLTextAreaElement | HTMLInputElement>(
            "textarea, input[type=text]",
          );
          if (radios.length > 0) {
            await user.click(radios[Math.floor(random() * radios.length)] as HTMLInputElement);
          } else if (text) {
            await user.type(text, "1000");
          }
          const buttons = [...dialog.querySelectorAll<HTMLButtonElement>("button")].filter(
            (b) => b.getAttribute("aria-disabled") !== "true",
          );
          const pick = buttons[Math.floor(random() * buttons.length)];
          if (pick) await user.click(pick);
          continue;
        }
        const ids = [...document.querySelectorAll<HTMLElement>("[data-button-id]")].filter(
          (b) =>
            b.getAttribute("aria-disabled") !== "true" &&
            !/^(desk:quit|go:stats|go:rankings|go:mailbox)$/.test(b.dataset.buttonId ?? ""),
        );
        if (ids.length === 0) {
          // The map's hot-spots are not buttons with an id.
          const spots = [...document.querySelectorAll<HTMLElement>(".fq-hotspots button")];
          const spot = spots[Math.floor(random() * spots.length)];
          if (!spot) throw new Error(`nothing to press on "${title}"`);
          await user.click(spot);
          continue;
        }
        seen.add(`${title}:${ids.map((b) => b.dataset.buttonId).join(",")}`.slice(0, 80));
        // Prefer the choices that go somewhere new over Wait for Customer, half the time.
        const pick = ids[Math.floor(random() * ids.length)] as HTMLElement;
        await user.click(pick);
      }
      expect(seen.size).toBeGreaterThan(20);
      expect(error).not.toHaveBeenCalled();
    });
  }
});
