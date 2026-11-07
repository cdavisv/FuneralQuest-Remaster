import type { View } from "@fq/protocol";
import { cleanup, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { leader, rankedCandidates, totalVotes } from "../src/expanded/ballots.js";
import { bankFocus, percent } from "../src/expanded/bank.js";
import { bingoCells, cardsLeft, drawWhen } from "../src/expanded/bingo.js";
import { renderGame, ScriptedTransport } from "./helpers.js";
import { without, xview } from "./xviews.js";

const layouts = ["classic", "wide", "phone"] as const;

describe("Bingo Night, from View.bingo", () => {
  it("numbers the cards, marks the taken ones and the player's own", () => {
    const bingo = xview("bingoBought").bingo;
    if (!bingo) throw new Error("no bingo panel");
    const cells = bingoCells(bingo);
    expect(cells).toHaveLength(bingo.cards);
    expect(cells.filter((c) => c.state === "mine").map((c) => c.n)).toEqual(bingo.mine);
    expect(cells.filter((c) => c.state === "taken").map((c) => c.n)).toEqual(
      bingo.taken.filter((n) => !bingo.mine.includes(n)),
    );
    expect(cardsLeft(bingo)).toBe(bingo.cards - bingo.taken.length);
    expect(drawWhen(bingo)).toBe("tonight");
    expect(drawWhen({ ...bingo, open: false })).toBe("cancelled");
    expect(drawWhen({ ...bingo, daysLeft: 3 })).toBe("later");
  });

  for (const layout of layouts) {
    it(`draws the grid, pot, price, cards left and the draw (${layout})`, async () => {
      renderGame(new ScriptedTransport(xview("bingoBought")), { settings: { layout } });
      const sheet = await screen.findByRole("region", { name: "Bingo Night" });
      const cells = within(sheet).getByRole("list", { name: "The cards" });
      expect(within(cells).getAllByRole("listitem")).toHaveLength(12);
      expect(within(cells).getByText("Card 1, yours")).toBeInTheDocument();
      expect(sheet.querySelectorAll('.fq-bingo-cells [data-state="mine"]')).toHaveLength(3);
      expect(sheet).toHaveTextContent("Tonight's pot");
      expect(sheet).toHaveTextContent("Price");
      expect(sheet).toHaveTextContent("1 wood");
      expect(sheet).toHaveTextContent("9 / 12");
      expect(sheet).toHaveTextContent("3 / 6");
      expect(sheet).toHaveTextContent("Midnight");
    });
  }

  it("shows other players' cards as taken and a carry-over apart from the pot", async () => {
    const base = xview("bingoBought");
    const bingo = { ...(base.bingo as never as object), taken: [1, 2, 3, 4, 5], carry: 4 };
    renderGame(new ScriptedTransport({ ...base, bingo } as never));
    const sheet = await screen.findByRole("region", { name: "Bingo Night" });
    expect(within(sheet).getByText("Card 4, taken")).toBeInTheDocument();
    expect(within(sheet).getByText("Card 12, for sale")).toBeInTheDocument();
    expect(sheet).toHaveTextContent("4 carried over");
  });

  it("without View.bingo (an older server) the church draws as an ordinary screen", async () => {
    renderGame(new ScriptedTransport(without(xview("bingo"), "bingo")));
    await screen.findByRole("heading", { level: 1, name: xview("bingo").title });
    expect(screen.queryByRole("region", { name: "Bingo Night" })).toBeNull();
    expect(screen.getByRole("button", { name: /Buy a Card/ })).toBeInTheDocument();
  });
});

describe("City Hall's ballots, from View.ballots", () => {
  it("totals votes, finds the leader and ranks candidates", () => {
    const options = xview("lobbied").ballots?.ordinance?.options ?? [];
    expect(totalVotes(options)).toBe(2);
    expect(leader(options)?.id).toBe("open-carry");
    expect(leader([{ votes: 1 }, { votes: 1 }])).toBeUndefined();
    expect(leader([{ votes: 0 }])).toBeUndefined();
    const election = xview("filed").ballots?.election;
    if (!election) throw new Error("no election");
    expect(rankedCandidates(election).map((c) => c.name)).toEqual(["Ned Digger"]);
  });

  it("marks the player's vote as their vote, with the counts and the lobbying", async () => {
    renderGame(new ScriptedTransport(xview("voted")));
    const panel = await screen.findByRole("region", { name: "City Hall's ballots" });
    const mine = panel.querySelector("li[data-mine]") as HTMLElement;
    expect(mine).toHaveTextContent("Open Carry for Morticians");
    expect(mine).toHaveTextContent("Your vote");
    expect(mine).toHaveTextContent("1 vote");
    expect(panel.querySelectorAll("li[data-mine]")).toHaveLength(1);
    const others = within(panel).getByText("Bingo Hall Roof Levy").closest("li") as HTMLElement;
    expect(others).toHaveTextContent("0 votes");
    expect(others).not.toHaveTextContent("Your vote");
    expect(panel).toHaveTextContent("Closes in 1 day");
    expect(panel).toHaveTextContent("Lobbying: $2,500 a time, 0 of 2 bought today");
    // The card that is the vote is marked chosen too.
    const cards = screen.getByRole("navigation", { name: "Cards to pick from" });
    expect(within(cards).getByRole("button", { name: /Open Carry/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("says when the player has not voted yet, and counts a lobbied vote", async () => {
    renderGame(new ScriptedTransport(xview("ordinance")));
    const panel = await screen.findByRole("region", { name: "City Hall's ballots" });
    expect(panel).toHaveTextContent("You have not voted");
    cleanup();
    renderGame(new ScriptedTransport(xview("lobbied")));
    const after = await screen.findByRole("region", { name: "City Hall's ballots" });
    expect(after.querySelector("li[data-mine]")).toHaveTextContent("2 votes");
  });

  it("shows the ordinance in force with its days left", async () => {
    const base = xview("hall");
    const ballots = {
      ...(base.ballots as never as object),
      inForce: { id: "x", title: "Open Carry", effect: "fights pay more", until: 18, daysLeft: 3 },
    };
    renderGame(new ScriptedTransport({ ...base, ballots } as never));
    const panel = await screen.findByRole("region", { name: "City Hall's ballots" });
    const block = within(panel).getByRole("region", { name: "Ordinance in force" });
    expect(block).toHaveTextContent("Open Carry");
    expect(block).toHaveTextContent("3 more days");
    expect(within(panel).getAllByRole("heading", { level: 3 })[0]).toHaveTextContent(
      "Ordinance in force",
    );
  });

  it("the election: phase, filing state, candidates and the mayor", async () => {
    renderGame(new ScriptedTransport(xview("electionFiling")));
    const panel = await screen.findByRole("region", { name: "City Hall's ballots" });
    const election = within(panel).getByRole("region", { name: "The mayoral election" });
    expect(election).toHaveTextContent("Candidates are filing");
    expect(election).toHaveTextContent("Ends tonight");
    expect(election).toHaveTextContent("Filing costs $6,000, until day 7");
    expect(election).toHaveTextContent("Nobody has filed yet");
    expect(election).toHaveTextContent("Mayor: Mayor Hollis Grubb");
    // The election's own block comes first on its screen.
    expect(panel).toHaveAttribute("data-focus", "election");
    cleanup();
    renderGame(new ScriptedTransport(xview("filed")));
    const filed = await screen.findByRole("region", { name: "The mayoral election" });
    expect(filed).toHaveTextContent("You have filed");
    expect(filed.querySelector("li[data-me]")).toHaveTextContent("Ned Digger");
    expect(filed.querySelector("li[data-me]")).toHaveTextContent("You");
  });

  it("a Classic town and an older server have no ballots panel", async () => {
    renderGame(new ScriptedTransport(without(xview("ordinance"), "ballots")));
    await screen.findByRole("heading", { level: 1, name: xview("ordinance").title });
    expect(screen.queryByRole("region", { name: "City Hall's ballots" })).toBeNull();
  });
});

describe("the bank, from View.bank", () => {
  it("formats the engine's shares and finds the screen's subject", () => {
    expect(percent(0.002)).toBe("0.2");
    expect(percent(0.03)).toBe("3");
    expect(percent(0.1)).toBe("10");
    expect(bankFocus(["bank:borrow", "bank:repay", "go:bank"])).toBe("loan");
    expect(bankFocus(["bank:deposit", "bank:withdraw"])).toBe("savings");
    expect(bankFocus(["bank:transfer", "go:bank"])).toBe("transfers");
    expect(bankFocus(["bank:exchange", "bank:loan"])).toBe("all");
  });

  it("shows the loan's terms before borrowing: limit, rate, fee, term and due day", async () => {
    renderGame(new ScriptedTransport(xview("loans")));
    const panel = await screen.findByRole("region", { name: "The bank's books" });
    const terms = within(panel).getByLabelText("The loan's terms");
    expect(terms).toHaveTextContent("$3,000");
    expect(terms).toHaveTextContent("3% a day");
    expect(terms).toHaveTextContent("3% up front");
    expect(terms).toHaveTextContent("10 days");
    expect(terms).toHaveTextContent("due day 23 if taken today");
    expect(panel).toHaveAttribute("data-focus", "loan");
    expect(panel).not.toHaveTextContent("You owe");
  });

  it("shows the debt with the days left once there is one", async () => {
    renderGame(new ScriptedTransport(xview("borrowed")));
    const panel = await screen.findByRole("region", { name: "The bank's books" });
    const debt = within(panel).getByRole("status");
    expect(debt).toHaveTextContent("You owe $2,060");
    expect(debt).toHaveTextContent("Due in 10 days (day 23)");
    expect(panel).toHaveTextContent("takes no deposits while a loan is out");
    expect(panel).not.toHaveTextContent("due day 23 if taken today");
  });

  it("shows savings with tonight's interest and the transfer limits", async () => {
    renderGame(new ScriptedTransport(xview("savings")));
    const savings = await screen.findByRole("region", { name: "Savings" });
    expect(savings).toHaveTextContent("0.2% a day");
    expect(savings).toHaveTextContent("Tonight's interest");
    expect(savings).toHaveTextContent("$100,000");
    cleanup();
    renderGame(new ScriptedTransport(xview("transfers")));
    const transfers = await screen.findByRole("region", { name: "Sending tags" });
    expect(transfers).toHaveTextContent("Sent 0 of 10 wood-tag equivalents today");
    expect(transfers).toHaveTextContent("10%");
    expect(transfers).toHaveTextContent("wood 1, silver 2, gold 4");
    expect(within(transfers).getByRole("meter")).toHaveAttribute("max", "10");
  });

  it("no bank panel without View.bank", async () => {
    renderGame(new ScriptedTransport(without(xview("loans"), "bank")));
    await screen.findByRole("heading", { level: 1, name: xview("loans").title });
    expect(screen.queryByRole("region", { name: "The bank's books" })).toBeNull();
  });
});

describe("injuries, from Hud.injuryList", () => {
  it("lists each with its effects, days left and what treatment costs", async () => {
    renderGame(new ScriptedTransport(xview("hospital")));
    const list = await screen.findByRole("region", { name: "Your injuries" });
    expect(list).toHaveTextContent("Shovel-Shaped Face");
    expect(list).toHaveTextContent("-3 hit points in every fight");
    expect(list).toHaveTextContent("-1 patience with every customer");
    // An effect of 0 is not listed.
    expect(list).not.toHaveTextContent("turns each morning");
    expect(list).toHaveTextContent("Heals in 2 days");
    expect(list).toHaveTextContent("Treatment $700 today");
    // The ledger's injuries chip carries the same facts as its tooltip.
    const chip = document.querySelector('[data-chip="injuries"] [role="tooltip"]');
    expect(chip).toHaveTextContent("Shovel-Shaped Face");
    expect(chip).toHaveTextContent("$700");
  });

  it("a healed player sees no injury list", async () => {
    renderGame(new ScriptedTransport(xview("hospitalTreated")));
    await screen.findByRole("heading", { level: 1, name: xview("hospitalTreated").title });
    expect(screen.queryByRole("region", { name: "Your injuries" })).toBeNull();
  });
});

describe("warnings, from Hud.warnings (expanded-rules.md 20.4)", () => {
  const warned = (): View => {
    const view = xview("deskQuiet");
    if (!view.hud) throw new Error("no hud");
    return { ...view, hud: { ...view.hud, warnings: [{ kind: "hit-rumour", day: 4 }] } };
  };

  for (const layout of layouts) {
    it(`the ledger shows the hit-man rumour (${layout})`, async () => {
      renderGame(new ScriptedTransport(warned()), { settings: { layout } });
      const ledger = await screen.findByRole("region", { name: "Your parlor's books" });
      const alert = within(ledger).getByRole("alert");
      expect(alert).toHaveAttribute("data-warning", "hit-rumour");
      expect(alert).toHaveTextContent("hit man has been hired against you");
      expect(alert).toHaveTextContent("Peace Pledge");
      cleanup();
    });
  }

  it("draws nothing when the engine sends no warning", async () => {
    renderGame(new ScriptedTransport(xview("deskQuiet")), { settings: { layout: "phone" } });
    const ledger = await screen.findByRole("region", { name: "Your parlor's books" });
    expect(within(ledger).queryByRole("alert")).toBeNull();
    expect(ledger.querySelector(".fq-ledger-warning")).toBeNull();
  });
});

describe("karma, from Hud.karmaPath and View.karmaScale", () => {
  it("the ledger names the band the engine put the player in", async () => {
    renderGame(new ScriptedTransport(xview("deskQuiet")));
    const ledger = await screen.findByRole("region", { name: "Your parlor's books" });
    const band = xview("deskQuiet").hud?.karmaPath;
    expect(ledger.querySelector('[data-chip="karma"]')).toHaveTextContent(band?.name ?? "?");
  });

  it("the karma moment draws the axis's bands from karmaScale and previews the band", async () => {
    renderGame(new ScriptedTransport(xview("prep")));
    const scale = await screen.findByRole("region", { name: "Where this leaves your karma" });
    const bands = within(scale).getByRole("list", { name: "The karma paths, evil to angelic" });
    expect(within(bands).getAllByRole("listitem")).toHaveLength(5);
    const here = bands.querySelector("li[data-here]");
    expect(here).toHaveTextContent(xview("prep").hud?.karmaPath?.name ?? "?");
    expect(scale.querySelectorAll(".fq-karmaaxis-tick")).toHaveLength(4);
  });
});

describe("the graveyard's monuments", () => {
  it("draws the five tiers with their icons and the one on offer", async () => {
    renderGame(new ScriptedTransport(xview("monuments")));
    const panel = await screen.findByRole("region", { name: "The graveyard's monuments" });
    const tiers = within(panel).getByRole("list", { name: "The five monuments, cheapest first" });
    expect(within(tiers).getAllByRole("listitem")).toHaveLength(5);
    expect(tiers.querySelectorAll("img")).toHaveLength(5);
    expect(panel).toHaveTextContent("Next up:");
    expect(panel).toHaveTextContent("A Granite Bench With Your Name on the Seat");
    expect(panel).toHaveTextContent("$3,000");
  });
});

describe("the graveyard's monuments, from the engine's data", () => {
  const withData = (built: number) => ({
    ...xview("monuments"),
    monuments: {
      built,
      tiers: [
        { name: "A Wooden Cross", price: 500, bp: 10, rating: 1 },
        { name: "A Granite Bench", price: 3000, bp: 60, rating: 2 },
        { name: "A Stone Angel", price: 9000, bp: 150, rating: 3 },
        { name: "A Marble Obelisk", price: 20000, bp: 320, rating: 4 },
        { name: "A Mausoleum", price: 50000, bp: 800, rating: 5 },
      ],
    },
  });

  it("lights the tiers that stand and dims the rest", async () => {
    renderGame(new ScriptedTransport(withData(2)));
    const panel = await screen.findByRole("region", { name: "The graveyard's monuments" });
    const tiers = within(panel).getAllByRole("listitem");
    expect(tiers.map((li) => li.getAttribute("data-built"))).toEqual([
      "true",
      "true",
      "false",
      "false",
      "false",
    ]);
    expect(tiers[0]).toHaveTextContent("Built");
    expect(tiers[2]).toHaveTextContent("$9,000");
    expect(tiers[1]).toHaveAttribute("title", "A Granite Bench");
  });

  it("shows no stone lit when none is built, and every one when all are", async () => {
    const { unmount } = renderGame(new ScriptedTransport(withData(0)));
    let panel = await screen.findByRole("region", { name: "The graveyard's monuments" });
    expect(
      within(panel)
        .getAllByRole("listitem")
        .every((li) => li.getAttribute("data-built") === "false"),
    ).toBe(true);
    unmount();
    renderGame(new ScriptedTransport(withData(5)));
    panel = await screen.findByRole("region", { name: "The graveyard's monuments" });
    expect(
      within(panel)
        .getAllByRole("listitem")
        .every((li) => li.getAttribute("data-built") === "true"),
    ).toBe(true);
  });
});

describe("the same panels in every layout", () => {
  const names = [
    "office",
    "upgradesMixed",
    "bingoBought",
    "voted",
    "loans",
    "hospital",
    "monuments",
    "roundSlotsWin",
    "prep",
  ];
  for (const name of names) {
    for (const layout of layouts) {
      it(`${name} (${layout}) keeps every button the engine sent`, async () => {
        const view: View = xview(name);
        renderGame(new ScriptedTransport(view), { settings: { layout } });
        await screen.findByRole("heading", { level: 1, name: view.title });
        for (const b of view.buttons) {
          expect(
            document.querySelector(`[data-button-id="${CSS.escape(b.id)}"]`),
            `${name}: ${b.id}`,
          ).not.toBeNull();
        }
        cleanup();
      });
    }
  }
});
