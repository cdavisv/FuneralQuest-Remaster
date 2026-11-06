import type { RankingRow, StatLine, View } from "@fq/protocol";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { groupStats } from "../src/components/Sheets.js";
import { FIXTURES } from "../src/mock/fixtures.js";
import { moodTier, moodTierForLevel } from "../src/util/mood.js";
import { renderGame, ScriptedTransport, viewWith } from "./helpers.js";

const stats: StatLine[] = [
  { id: "turns", label: "Turns left", value: "14" },
  { id: "bpTotal", label: "Total Bury Points", value: "1,850" },
  { id: "money", label: "Money", value: "500" },
  { id: "wood", label: "Wood tags", value: "2" },
  { id: "silver", label: "Silver tags", value: "1" },
  { id: "gold", label: "Gold tags", value: "0" },
  { id: "plots", label: "Plots", value: "7" },
  { id: "rating", label: "Rating", value: "#2 - A respectable name in dying." },
  { id: "ride", label: "Ride", value: "Bicycle" },
  { id: "strength", label: "Strength", value: "3" },
  { id: "futureStat", label: "Cobwebs", value: "12" },
];

const rows: RankingRow[] = [
  {
    place: 1,
    playerId: 3,
    name: "Mylener",
    parlor: "Playin' God",
    male: false,
    bp: 12850,
    title: "The best in town.",
    status: "on now",
    online: true,
  },
  {
    place: 2,
    playerId: 5,
    name: "Gravy",
    parlor: "Six Feet Under Par",
    male: true,
    bp: 40,
    title: "",
    status: "",
    online: false,
  },
];

describe("the stats sheet", () => {
  it("groups the server's lines and keeps unknown ones", () => {
    const groups = groupStats(stats);
    expect(groups.map((g) => g.id)).toEqual(["standing", "inventory", "errands", "other"]);
    expect(groups[0]?.lines.map((l) => l.id)).toEqual(["turns", "bpTotal", "money"]);
    // The rating is a sentence with its own line, not a row in a group.
    expect(groups.flatMap((g) => g.lines).some((l) => l.id === "rating")).toBe(false);
    expect(groups[3]?.lines[0]?.label).toBe("Cobwebs");
  });

  it("draws labels and values from View.stats on the stats scene", async () => {
    const view: View = viewWith({
      scene: "stats",
      title: "Stats",
      text: [{ text: "Your stats." }],
      stats,
      buttons: [{ id: "back", label: "Back" }],
    });
    renderGame(new ScriptedTransport(view));
    const sheet = await screen.findByRole("region", { name: "Your stats and inventory" });
    expect(within(sheet).getByRole("heading", { name: "Inventory" })).toBeInTheDocument();
    const row = sheet.querySelector('[data-stat="bpTotal"]');
    expect(row).toHaveTextContent("Total Bury Points");
    expect(row).toHaveTextContent("1,850");
    expect(sheet.querySelector('[data-stat="rating"]')).toHaveTextContent("A respectable name");
    expect(within(sheet).getByText("Cobwebs")).toBeInTheDocument();
  });

  it("falls back to the plain text when the server sends no stat lines", async () => {
    const view = viewWith({
      scene: "stats",
      text: [{ text: "Bury Points today: 16" }],
      buttons: [{ id: "back", label: "Back" }],
    });
    renderGame(new ScriptedTransport(view));
    expect(await screen.findByText("Bury Points today: 16")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your stats and inventory" })).toBeNull();
  });
});

describe("the rankings table", () => {
  const view = viewWith({
    scene: "rankings",
    title: "Rankings",
    text: [{ text: "Mylener   F  Playin' God   12850\nGravy ...", color: "grey" }],
    rankings: rows,
    buttons: [{ id: "back", label: "Continue" }],
  });

  it("shows one row per player with place, parlor, points and status", async () => {
    renderGame(new ScriptedTransport(view));
    const table = await screen.findByRole("table");
    const body = within(table).getAllByRole("row").slice(1);
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveTextContent("1");
    expect(body[0]).toHaveTextContent("Mylener");
    expect(body[0]).toHaveTextContent("Playin' God");
    expect(body[0]).toHaveTextContent("12,850");
    expect(body[0]).toHaveTextContent("on now");
    expect(body[0]).toHaveTextContent("The best in town.");
    expect(body[1]).toHaveTextContent("Six Feet Under Par");
    expect(within(table).getByRole("columnheader", { name: "Bury Points" })).toBeInTheDocument();
  });

  it("marks who is online, and says male or female to screen readers", async () => {
    renderGame(new ScriptedTransport(view));
    const table = await screen.findByRole("table");
    const [first, second] = within(table).getAllByRole("row").slice(1);
    expect(first).toHaveAttribute("data-online");
    expect(second).not.toHaveAttribute("data-online");
    expect(first).toHaveTextContent("(female)");
    expect(second).toHaveTextContent("(male)");
  });

  it("does not repeat the fixed-width text listing next to the table", async () => {
    renderGame(new ScriptedTransport(view));
    await screen.findByRole("table");
    expect(screen.queryByText(/Playin' God {3}12850/)).toBeNull();
  });

  it("uses the text when there are no rows", async () => {
    renderGame(
      new ScriptedTransport(
        viewWith({ scene: "rankings", text: [{ text: "Nobody yet." }], rankings: [] }),
      ),
    );
    expect(await screen.findByText("Nobody yet.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("the mood face", () => {
  it("follows moodLevel when the server sends it", () => {
    expect(moodTierForLevel(0)).toBe(0);
    expect(moodTierForLevel(2.9)).toBe(0);
    expect(moodTierForLevel(3)).toBe(1);
    expect(moodTierForLevel(5)).toBe(2);
    expect(moodTierForLevel(7.9)).toBe(2);
    expect(moodTierForLevel(8)).toBe(3);
    expect(moodTierForLevel(10)).toBe(3);
    expect(moodTierForLevel(Number.NaN)).toBe(1);
    // The number wins over the word.
    expect(moodTier("Chipper", 9)).toBe(3);
    // Without it the word is still understood.
    expect(moodTier("Chipper")).toBe(0);
  });

  it("is drawn in the customer readout", async () => {
    const view = {
      ...FIXTURES.negotiation,
      customer: {
        incomeLabel: "Rich",
        moodLabel: "Natural",
        moodLevel: 8.4,
        total: 1200,
      },
    };
    renderGame(new ScriptedTransport(view));
    const region = await screen.findByRole("region", { name: "The customer" });
    expect(region.querySelector(".fq-face")).toHaveAttribute("data-tier", "3");
  });
});
