import type { View } from "@fq/protocol";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FIXTURES } from "../src/mock/fixtures.js";
import { renderGame, ScriptedTransport } from "./helpers.js";
import { xview } from "./xviews.js";

describe("an Expanded customer's mood and total", () => {
  it("are on the portrait, not in the text well, so the well keeps its lines for what is said", async () => {
    const view = xview("negotiation");
    renderGame(new ScriptedTransport(view, () => view));
    const readout = await screen.findByRole("region", { name: "The customer" });
    expect(readout.closest(".fq-frame")).not.toBeNull();
    expect(readout.closest(".fq-textpanel")).toBeNull();
    expect(readout.getAttribute("data-variant")).toBe("picture");
    // Still read out whole: the mood's words stay for screen readers.
    expect(within(readout).getByText(view.customer?.moodLabel ?? "")).toBeInTheDocument();
  });

  it("stay in the well for a Classic customer, as before", async () => {
    renderGame(new ScriptedTransport(FIXTURES.negotiation, () => FIXTURES.negotiation));
    const readout = await screen.findByRole("region", { name: "The customer" });
    expect(readout.closest(".fq-frame")).toBeNull();
    expect(readout.getAttribute("data-variant")).toBeNull();
  });
});

describe("the list of places in the 1024 x 745 layout", () => {
  it("opens from a Places button over an Expanded town's map, and closes with Escape", async () => {
    const view = xview("map");
    const t = new ScriptedTransport(view, () => view);
    renderGame(t);
    const button = await screen.findByRole("button", { name: "Places" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("navigation", { name: "Places in town" });
    expect(within(list).getAllByRole("button")).toHaveLength((view.map ?? []).length);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Places in town" })).toBeNull();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    await userEvent.click(
      within(screen.getByRole("navigation", { name: "Places in town" })).getByRole("button", {
        name: "City Hall",
      }),
    );
    expect(t.sent).toEqual([{ type: "visit", placeId: "city-hall" }]);
  });

  it("is not there for a Classic town (its ten places are the buildings), nor beside a wide map", async () => {
    const full = xview("map");
    const classic: View = { ...full, map: (full.map ?? []).slice(0, 9) };
    renderGame(new ScriptedTransport(classic, () => classic));
    await screen.findByRole("list", { name: "Places in town" });
    expect(screen.queryByRole("button", { name: "Places" })).toBeNull();
  });

  it("the wide layout keeps its list beside the map, without the button", async () => {
    const view = xview("map");
    renderGame(new ScriptedTransport(view, () => view), { settings: { layout: "wide" } });
    await screen.findByRole("navigation", { name: "Places in town" });
    expect(screen.queryByRole("button", { name: "Places" })).toBeNull();
  });
});

describe("Settings in a short window", () => {
  it("keeps the note that no pack is the 2001 audio in view, the rest of the packs' story a click away", async () => {
    renderGame(new ScriptedTransport(FIXTURES.desk, () => FIXTURES.desk));
    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    expect(screen.getByText(/None of the three is the 2001 game's own audio/)).toBeVisible();
    const more = screen.getByText(/Synth is made by the game's own code/);
    expect(more.closest("details")).not.toBeNull();
    expect(more.closest("details")?.querySelector("summary")).toHaveTextContent(
      "More about the sound packs and voices",
    );
  });
});
