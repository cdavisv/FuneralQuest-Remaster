import type { View } from "@fq/protocol";
import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ALL_FIXTURES, FIXTURES, OVERLAY_FIXTURES } from "../src/mock/fixtures.js";
import { renderGame, ScriptedTransport } from "./helpers.js";

const layouts = ["classic", "wide", "phone"] as const;

describe("every fixture renders", () => {
  for (const [name, view] of Object.entries(ALL_FIXTURES)) {
    for (const layout of layouts) {
      it(`${name} in the ${layout} layout`, async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        renderGame(new ScriptedTransport(view), { settings: { layout } });
        expect(
          await screen.findByRole("heading", { level: 1, name: view.title }),
        ).toBeInTheDocument();
        // Each button the server sent is on screen, in order.
        const nav = screen.getByRole("navigation", { name: "Choices" });
        for (const b of view.buttons) {
          expect(nav).toHaveTextContent(b.label);
        }
        expect(error).not.toHaveBeenCalled();
      });
    }
  }
});

describe("scene specifics", () => {
  it("the desk shows stats on the note and a luck meter", async () => {
    renderGame(new ScriptedTransport(FIXTURES.desk));
    expect(
      await screen.findByRole("meter", { name: /Luck meter, 58 out of 100/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Bury Points earned today")).toBeInTheDocument();
    expect(screen.getByText("Turns left")).toBeInTheDocument();
    expect(screen.getByLabelText("Silver casket tags: 1")).toBeInTheDocument();
  });

  it("a location shows its room description on the note instead of the stats", async () => {
    renderGame(new ScriptedTransport(FIXTURES.shop));
    expect(await screen.findByText(/Di-Mart sells everything/)).toBeInTheDocument();
    expect(screen.queryByText("Bury Points earned today")).toBeNull();
    expect(screen.getByRole("meter", { name: /Luck meter/ })).toBeInTheDocument();
  });

  it("the negotiation shows class, mood, total and the resistance gauge when revealed", async () => {
    const view = ALL_FIXTURES.negotiation1 as View;
    renderGame(new ScriptedTransport(view));
    const group = await screen.findByRole("region", { name: "The customer" });
    expect(group).toHaveTextContent("Annoyed");
    expect(group).toHaveTextContent("$800");
    expect(screen.getByRole("meter", { name: "Resistance 45 percent" })).toHaveValue(45);
    expect(screen.getAllByText(/Class: Poor/).length).toBeGreaterThan(0);
  });

  it("hides the resistance gauge until the server reveals it", async () => {
    renderGame(new ScriptedTransport(FIXTURES.negotiation));
    await screen.findByRole("region", { name: "The customer" });
    expect(screen.queryByRole("meter", { name: /Resistance/ })).toBeNull();
  });

  it("the battle panel shows both health bars", async () => {
    renderGame(new ScriptedTransport(FIXTURES.battle));
    expect(await screen.findByRole("meter", { name: "You, 42 of 60 health" })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Skelly, 51 of 60 health" })).toBeInTheDocument();
  });

  it("the map has a hot-spot per place, and a list outside the classic layout", async () => {
    const { unmount } = renderGame(new ScriptedTransport(FIXTURES.map), {
      settings: { layout: "classic" },
    });
    expect(await screen.findAllByRole("button", { name: /^Go to / })).toHaveLength(
      FIXTURES.map.map.length,
    );
    expect(screen.queryByRole("navigation", { name: "Places in town" })).toBeNull();
    unmount();
    renderGame(new ScriptedTransport(FIXTURES.map), { settings: { layout: "wide" } });
    expect(await screen.findByRole("navigation", { name: "Places in town" })).toBeInTheDocument();
  });

  it("the map copes with a place it has no hot-spot for", async () => {
    const view: View = { ...FIXTURES.map, map: [{ id: "new-place", label: "Brand New Place" }] };
    renderGame(new ScriptedTransport(view));
    expect(
      await screen.findByRole("button", { name: "Go to Brand New Place" }),
    ).toBeInTheDocument();
  });

  it("the newspaper shows the masthead notices, section and day", async () => {
    renderGame(new ScriptedTransport(FIXTURES.news));
    expect(await screen.findByText("Top Seller Of The Day")).toBeInTheDocument();
    expect(screen.getByText("Yesterday's Top Seller")).toBeInTheDocument();
    expect(screen.getByText("Day 16")).toBeInTheDocument();
    const sections = within(screen.getByRole("list", { name: "Sections" }));
    expect(sections.getByText("Front Page")).toHaveAttribute("aria-current", "page");
    expect(sections.getByText("Crime")).not.toHaveAttribute("aria-current");
  });

  it("the newspaper survives a view without a news panel", async () => {
    const view: View = {
      scene: "news",
      title: "Funeral Times",
      text: [{ text: "Extra!" }],
      buttons: [],
    };
    renderGame(new ScriptedTransport(view));
    expect(await screen.findByText("Extra!")).toBeInTheDocument();
  });

  it("the cafe shows chat lines in order and a message box", async () => {
    renderGame(new ScriptedTransport(FIXTURES.cafe));
    const list = await screen.findByRole("list", { name: "Conversation" });
    expect(list.querySelectorAll("li")).toHaveLength(FIXTURES.cafe.chat.length);
    expect(screen.getByRole("textbox", { name: "Say something" })).toBeInTheDocument();
  });

  it("stats and rankings use the full-width sheet", async () => {
    renderGame(new ScriptedTransport(FIXTURES.rankings));
    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("every overlay kind opens as a modal dialog", async () => {
    for (const [name, view] of Object.entries(OVERLAY_FIXTURES)) {
      const { unmount } = renderGame(new ScriptedTransport(view));
      const dialog = await screen.findByRole("dialog");
      expect(dialog, name).toHaveAttribute("aria-modal", "true");
      unmount();
    }
  });
});
