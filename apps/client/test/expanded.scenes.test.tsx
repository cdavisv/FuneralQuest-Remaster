import type { View } from "@fq/protocol";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ALL_FIXTURES, FIXTURES } from "../src/mock/fixtures.js";
import { renderGame, ScriptedTransport } from "./helpers.js";
import { X, xview } from "./xviews.js";

const layouts = ["classic", "wide", "phone"] as const;

describe("every captured Expanded View renders", () => {
  for (const [name, view] of Object.entries(X)) {
    for (const layout of layouts) {
      it(`${name} in the ${layout} layout`, async () => {
        const error = vi.spyOn(console, "error").mockImplementation(() => {});
        renderGame(new ScriptedTransport(view), { settings: { layout } });
        expect(
          await screen.findByRole("heading", { level: 1, name: view.title }),
        ).toBeInTheDocument();
        // Every button the engine sent is on screen, whichever row it is drawn in.
        for (const b of view.buttons) {
          const el = document.querySelector(`[data-button-id="${CSS.escape(b.id)}"]`);
          expect(el, `${name}: ${b.id}`).not.toBeNull();
          // A stake at the Reaper Club's tables is a price on a game's row; its name is its label.
          if (el?.classList.contains("fq-stake")) {
            expect(el.getAttribute("aria-label")).toContain(
              b.detail ?? b.label.split(" ").pop() ?? "",
            );
          } else {
            expect(el).toHaveTextContent(b.label);
          }
        }
        expect(error).not.toHaveBeenCalled();
      });
    }
  }
});

describe("a Classic View has no Expanded chrome", () => {
  const chrome = [
    ".fq-ledger",
    ".fq-townstrip",
    ".fq-file",
    ".fq-deck",
    ".fq-cards",
    ".fq-npanel",
    ".fq-cliptip",
    ".fq-plaque-detail",
    ".fq-moral",
    '[data-size="small"]',
  ];
  for (const [name, view] of Object.entries(ALL_FIXTURES)) {
    if (view.overlay) continue;
    it(`${name}`, async () => {
      for (const layout of layouts) {
        const { unmount } = renderGame(new ScriptedTransport(view as View), {
          settings: { layout },
        });
        await screen.findByRole("heading", { level: 1, name: (view as View).title });
        for (const selector of chrome) {
          expect(document.querySelector(selector), `${selector} in ${layout}`).toBeNull();
        }
        unmount();
      }
    });
  }

  it("keeps the Classic stats parchment, luck meter and plaque row on the desk", async () => {
    renderGame(new ScriptedTransport(FIXTURES.desk));
    expect(await screen.findByRole("meter", { name: /Luck meter/ })).toBeInTheDocument();
    expect(screen.getByText("Bury Points earned today")).toBeInTheDocument();
    expect(document.querySelectorAll(".fq-plaques")).toHaveLength(
      document.querySelectorAll(".fq-plaques").length,
    );
    expect(document.querySelector(".fq-ledger")).toBeNull();
  });
});

describe("the negotiation (docs 11.2)", () => {
  it("draws the five Classic buttons as plaques and the rest as a smaller second row", async () => {
    renderGame(new ScriptedTransport(xview("negotiation")));
    const main = await screen.findByRole("navigation", { name: "Choices" });
    expect(
      within(main)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["1Guilt", "2Sympathy", "3Hard Sell", "4Soft Sell", "5Done"]);
    const more = screen.getByRole("navigation", { name: "More choices" });
    expect(more).toHaveAttribute("data-size", "small");
    expect(
      within(more)
        .getAllByRole("button")
        .map((b) => b.getAttribute("data-button-id")),
    ).toEqual(["neg:packages", "neg:coffee", "neg:listen", "neg:discount"]);
    expect(within(more).getByRole("button", { name: /Discount/ })).toHaveTextContent("-$50");
  });

  it("shows name, who died, traits with their hints, patience and the track", async () => {
    renderGame(new ScriptedTransport(xview("negotiation")), { settings: { layout: "phone" } });
    const file = await screen.findByRole("region", { name: "The customer's file" });
    expect(within(file).getByRole("heading", { name: "Mildred Yokum" })).toBeInTheDocument();
    expect(file).toHaveTextContent("for her dad Chester");
    expect(within(file).getByRole("meter", { name: /Patience 8 of 8/ })).toBeInTheDocument();
    expect(file).toHaveTextContent("Burial");
    expect(within(file).getByText("Chester spent", { exact: false })).toBeInTheDocument();
    expect(within(file).getByText("Wood Casket")).toBeInTheDocument();
  });

  it("explains a trait by hover and by tap", async () => {
    const user = userEvent.setup();
    renderGame(new ScriptedTransport(xview("afterCoffee")), { settings: { layout: "classic" } });
    const traits = await screen.findAllByRole("button", {
      name: /Sentimental|Here for the Buffet/,
    });
    const trait = traits[0];
    if (!trait) throw new Error("no trait chips");
    const hint = xview("afterCoffee").customer?.traits?.[0]?.hint ?? "";
    expect(hint).not.toBe("");
    // The hint is always reachable to a screen reader, and shown on a tap.
    expect(trait).toHaveAccessibleDescription(hint);
    await user.click(trait);
    expect(trait).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText(hint).length).toBeGreaterThan(0);
  });

  it("reads the estimate against the bill, and how far there is to go", async () => {
    renderGame(new ScriptedTransport(xview("negotiation")));
    const gauge = await screen.findByRole("figure", { name: /close the bill is/ });
    expect(gauge).toHaveTextContent("$9,050");
    expect(gauge).toHaveTextContent("$14,300");
    expect(gauge).toHaveTextContent("$8,250 to go");
    expect(within(gauge).getByText(/Estimate \$9,050 to \$14,300/)).toBeInTheDocument();
  });

  it("offers the bonus rule behind the gauge instead of a line of its own", async () => {
    const user = userEvent.setup();
    renderGame(new ScriptedTransport(xview("negotiation")));
    await screen.findByRole("figure", { name: /close the bill is/ });
    expect(screen.queryByText(/Bonus if the bill lands/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Why the bands?" }));
    expect(screen.getByText(/Bonus if the bill lands within 8%/)).toBeInTheDocument();
  });

  it("keeps the picture frame and the mood readout", async () => {
    renderGame(new ScriptedTransport(xview("negotiation")));
    const readout = await screen.findByRole("region", { name: "The customer" });
    expect(readout).toHaveTextContent("Dazed");
    expect(readout).toHaveTextContent("$800");
    expect(screen.getAllByText(/Class: Super Rich/).length).toBeGreaterThan(0);
  });

  it("lists the bill line by line, a discount as a minus", async () => {
    const user = userEvent.setup();
    renderGame(new ScriptedTransport(xview("afterDiscount")));
    await user.click(await screen.findByRole("tab", { name: /The bill/ }));
    const table = screen.getByRole("table");
    expect(within(table).getByText("Discount").closest("tr")).toHaveTextContent("-$50");
    expect(within(table).getByText("Total").closest("tr")).toHaveTextContent("$750");
  });

  it("presses a card to pitch it, with the price on the card", async () => {
    const user = userEvent.setup();
    const hand = xview("hand");
    const transport = new ScriptedTransport(hand, () => hand);
    renderGame(transport);
    const cards = await screen.findByRole("navigation", { name: "Cards to pick from" });
    const first = within(cards).getAllByRole("button")[0];
    if (!first) throw new Error("no cards");
    expect(first).toHaveTextContent(/\$\d+/);
    await user.click(first);
    expect(transport.sent).toEqual([{ type: "press", buttonId: "neg:hand:0" }]);
    // Back is the main row.
    expect(
      within(screen.getByRole("navigation", { name: "Choices" })).getByRole("button", {
        name: /Back/,
      }),
    ).toBeInTheDocument();
  });

  it("keeps a disabled button on screen with its hint", async () => {
    renderGame(new ScriptedTransport(xview("afterCoffee")));
    const coffee = await screen.findByRole("button", { name: /Coffee/ });
    expect(coffee).toHaveAttribute("aria-disabled", "true");
    expect(coffee).toHaveAccessibleDescription("Already had coffee");
  });

  it("does not send a disabled card or button", async () => {
    const user = userEvent.setup();
    const transport = new ScriptedTransport(xview("afterCoffee"));
    renderGame(transport);
    await user.click(await screen.findByRole("button", { name: /Coffee/ }));
    expect(transport.sent).toEqual([]);
  });

  it("the tutorial hint comes from the clerk, with her portrait", async () => {
    renderGame(new ScriptedTransport(xview("practiceSale")));
    const tip = await screen.findByRole("complementary", { name: "The clerk says" });
    // The speaker is the View's own field, not the client's idea of who talks.
    expect(tip).toHaveTextContent("Clerk:");
    expect(tip).toHaveTextContent("Read the mood word");
    expect(tip.querySelector("img")).not.toBeNull();
  });

  it("a tour page shows how far along the tour is, from View.tutorial", async () => {
    renderGame(new ScriptedTransport(xview("tourPage")));
    expect(await screen.findByText("Tour page 1 of 8")).toBeInTheDocument();
    // Not from the note's "1 / 8".
    const v = xview("tourPage");
    const { tutorial: _t, ...rest } = v;
    cleanup();
    renderGame(new ScriptedTransport(rest as View));
    await screen.findByRole("heading", { level: 1, name: v.title });
    expect(screen.queryByText("Tour page 1 of 8")).toBeNull();
  });

  it("a flat offer (haggle: false) gets no estimate gauge, and a haggle gets the engine's bands", async () => {
    const sale = xview("negotiation");
    const offer: View = {
      ...sale,
      customer: { ...(sale.customer as never as object), haggle: false } as never,
    };
    renderGame(new ScriptedTransport(offer));
    await screen.findByRole("region", { name: "The customer's file" });
    expect(screen.queryByRole("figure", { name: /close the bill is/ })).toBeNull();
    cleanup();
    const est = sale.customer?.estimate ?? { low: 0, high: 0 };
    const mid: View = {
      ...sale,
      customer: {
        ...(sale.customer as never as object),
        total: Math.round((est.low + est.high) / 2),
      } as never,
    };
    renderGame(new ScriptedTransport(mid));
    const gauge = await screen.findByRole("figure", { name: /close the bill is/ });
    expect(gauge.querySelectorAll(".fq-gauge2-band").length).toBeGreaterThan(0);
    // No bands from the engine: the bar and the pin, no bonus bands.
    cleanup();
    const bare: View = {
      ...mid,
      customer: { ...(mid.customer as never as object), bands: undefined } as never,
    };
    renderGame(new ScriptedTransport(bare));
    const plain = await screen.findByRole("figure", { name: /close the bill is/ });
    expect(plain.querySelectorAll(".fq-gauge2-band").length).toBe(0);
  });

  it("an offer-type special customer with no estimate still draws", async () => {
    const view: View = {
      ...xview("negotiation"),
      customer: {
        incomeLabel: "Rich",
        moodLabel: "Natural",
        moodLevel: 1,
        total: 0,
        name: "Cousin Sal",
      },
    };
    renderGame(new ScriptedTransport(view));
    expect(await screen.findByRole("region", { name: "The customer" })).toBeInTheDocument();
    expect(screen.queryByRole("figure", { name: /close the bill is/ })).toBeNull();
  });
});

describe("the HUD and the town strip (docs 11.1, 26)", () => {
  it("shows cash, karma with its path, and rating on the ledger, besides the Classic parchment", async () => {
    renderGame(new ScriptedTransport(xview("deskQuiet")));
    const ledger = await screen.findByRole("region", { name: "Your parlor's books" });
    expect(ledger).toHaveTextContent("$60,000");
    expect(ledger).toHaveTextContent("Neutral");
    expect(screen.getByText("Bury Points earned today")).toBeInTheDocument();
    expect(within(ledger).queryByText("Debt")).toBeNull();
  });

  it("shows a debt as a warning with its due day", async () => {
    renderGame(new ScriptedTransport(xview("deskInDebt")));
    const debt = (await screen.findByRole("region", { name: "Your parlor's books" })).querySelector(
      '[data-chip="debt"]',
    );
    expect(debt).toHaveTextContent("$2,060");
    expect(debt).toHaveTextContent("Due in 10 days");
    expect(debt).toHaveAttribute("data-tone", "warn");
  });

  it("turns the debt red when the engine's days left run low, without knowing the day", async () => {
    const base = xview("deskInDebt");
    const near: View = {
      ...base,
      hud: {
        ...(base.hud as never as object),
        debt: { owed: 2060, due: 23, daysLeft: 1 },
      } as never,
    };
    renderGame(new ScriptedTransport(near));
    const debt = (await screen.findByRole("region", { name: "Your parlor's books" })).querySelector(
      '[data-chip="debt"]',
    );
    expect(debt).toHaveAttribute("data-tone", "bad");
    expect(debt).toHaveTextContent("Due in 1 day");
  });

  it("counts injuries when there are some", async () => {
    renderGame(new ScriptedTransport(xview("hospital")));
    const ledger = await screen.findByRole("region", { name: "Your parlor's books" });
    expect(ledger.querySelector('[data-chip="injuries"]')).toHaveTextContent("1");
  });

  it("on a phone the books are one line that unfolds", async () => {
    const user = userEvent.setup();
    renderGame(new ScriptedTransport(xview("deskInDebt")), { settings: { layout: "phone" } });
    const ledger = await screen.findByRole("region", { name: "Your parlor's books" });
    const toggle = within(ledger).getByRole("button", { name: /Show all of your books/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(ledger).toHaveTextContent("$");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(ledger.querySelector('[data-chip="debt"]')).toHaveTextContent("Due in 10 days");
  });

  it("the desk's town strip: weather and story with their effects as tooltips, and a vote badge", async () => {
    const town = xview("desk").town;
    renderGame(new ScriptedTransport(xview("desk")));
    const strip = await screen.findByRole("region", { name: "Today in Deathville" });
    expect(strip).toHaveTextContent(town?.weather?.label ?? "?");
    expect(strip).toHaveTextContent(town?.story ?? "?");
    expect(within(strip).getByRole("button", { name: /Vote/ })).toBeInTheDocument();
    const weather = within(strip).getByRole("button", {
      name: new RegExp(town?.weather?.label ?? "?"),
    });
    expect(weather).toHaveAccessibleDescription(/Weather/);
    // A tap opens the tooltip, for touch.
    fireEvent.click(weather);
    expect(weather).toHaveAttribute("aria-expanded", "true");
  });

  it("the desk repeats nothing in its status line once the strip says it", async () => {
    renderGame(new ScriptedTransport(xview("desk")));
    await screen.findByRole("region", { name: "Today in Deathville" });
    expect(screen.queryByRole("status", { name: "" })?.textContent ?? "").not.toMatch(/Rain \(/);
  });

  it("the Parlor is a round brass button with the others", async () => {
    renderGame(new ScriptedTransport(xview("desk")));
    const orbs = await screen.findByRole("navigation", { name: "Places" });
    expect(
      within(orbs)
        .getAllByRole("button")
        .map((b) => b.getAttribute("data-button-id")),
    ).toEqual(["go:map", "go:news", "go:stats", "go:rankings", "go:mailbox", "go:parlor"]);
  });
});

describe("cards, shelves and moral choices", () => {
  it("the contractor's fifteen upgrades come from View.office, with their state, reason and needs", async () => {
    renderGame(new ScriptedTransport(xview("upgrades")));
    const shelf = await screen.findByRole("region", { name: "Catalogue" });
    expect(shelf).toHaveTextContent("0 of 15 owned");
    const alarm = shelf.querySelector('[data-state="locked"] .fq-up-card') as HTMLElement;
    expect(alarm).toHaveTextContent("Alarm System");
    expect(alarm).toHaveTextContent("Needs Guard Dog");
    expect(alarm).toHaveTextContent("You need: Guard Dog");
    const paint = within(shelf).getByRole("button", { name: /^Fresh Paint/ });
    expect(paint).toHaveAttribute("data-button-id", "parlor:buy:paint");
    expect(paint).not.toHaveAttribute("aria-disabled");
    // The catalogue leaves only Back in the plaque row.
    expect(
      within(screen.getByRole("navigation", { name: "Choices" })).getAllByRole("button"),
    ).toHaveLength(1);
  });

  it("buying an upgrade presses the engine's own buy card; locked and short ones do nothing", async () => {
    const user = userEvent.setup();
    const view = xview("upgradesMixed");
    const transport = new ScriptedTransport(view, () => view);
    renderGame(transport);
    const shelf = await screen.findByRole("region", { name: "Catalogue" });
    await user.click(within(shelf).getByRole("button", { name: /^Guard Dog/ }));
    expect(transport.sent).toEqual([{ type: "press", buttonId: "parlor:buy:guard-dog" }]);
    const florist = within(shelf).getByRole("button", { name: /^Florist Cooler/ });
    expect(florist).toHaveAttribute("aria-disabled", "true");
    expect(florist).toHaveTextContent(/Need \$\d/);
    await user.click(florist);
    expect(transport.sent).toHaveLength(1);
    // An owned upgrade is listed, with its state, and has no buy card.
    const owned = shelf.querySelector('[data-state="owned"]') as HTMLElement;
    expect(owned).toHaveTextContent("Fresh Paint");
    expect(owned).toHaveTextContent("Owned");
    expect(owned.querySelector("button")).toBeNull();
  });

  it("an owned upgrade stays on the list as owned", async () => {
    renderGame(new ScriptedTransport(xview("upgradesAfterPaint")));
    const shelf = await screen.findByRole("region", { name: "Catalogue" });
    expect(shelf).toHaveTextContent("1 of 15 owned");
    expect(within(shelf).queryByRole("button", { name: /^Fresh Paint/ })).toBeNull();
    expect(shelf.querySelector('[data-state="owned"]')).toHaveTextContent("Fresh Paint");
    // Viewing Room needed Paint: it is now ready, and says it has it.
    expect(within(shelf).getByRole("button", { name: /^Viewing Room/ })).toHaveTextContent(
      "You have: Fresh Paint",
    );
  });

  it("markup and rivalry are a row of cards with the current choice marked by Button.selected", async () => {
    renderGame(new ScriptedTransport(xview("rivalrySet")));
    const cards = await screen.findByRole("navigation", { name: "Cards to pick from" });
    const chosen = within(cards).getByRole("button", { name: /Cutthroat/ });
    expect(chosen).toHaveAttribute("data-state", "chosen");
    expect(chosen).toHaveAttribute("aria-pressed", "true");
    expect(chosen).toHaveTextContent("Your choice");
    expect(within(cards).getByRole("button", { name: /Standard/ })).not.toHaveAttribute(
      "data-state",
      "chosen",
    );
    expect(within(cards).getByRole("button", { name: /Standard/ })).not.toHaveAttribute(
      "aria-pressed",
    );
    expect(within(cards).getAllByRole("button")).toHaveLength(3);
    cleanup();
    renderGame(new ScriptedTransport(xview("markupSet")));
    const markup = await screen.findByRole("navigation", { name: "Cards to pick from" });
    expect(within(markup).getByRole("button", { name: /\+20%/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("the body-preparation choice is two heavy cards, the dishonest one marked, with a preview of karma", async () => {
    const user = userEvent.setup();
    const prep = xview("prep");
    const transport = new ScriptedTransport(prep, () => prep);
    renderGame(transport);
    const choices = await screen.findByRole("navigation", { name: "A choice about the body" });
    const take = within(choices).getByRole("button", { name: /Take It/ });
    const leave = within(choices).getByRole("button", { name: /Leave It/ });
    expect(take).toHaveAttribute("data-tone", "evil");
    expect(take).toHaveTextContent("+$400");
    expect(take).toHaveTextContent("-2 karma");
    // A gamble says its odds and what a failure costs, from View.prep, not from the joke text.
    expect(take).toHaveTextContent("51% it works");
    expect(take).toHaveTextContent("-3 karma");
    expect(take.querySelector('[data-dir="down"]')).not.toBeNull();
    expect(leave).toHaveAttribute("data-tone", "good");
    expect(leave).toHaveTextContent("+1 karma");
    expect(leave.querySelector('[data-dir="up"]')).not.toBeNull();
    expect(leave.querySelector(".fq-mb-risk")).toBeNull();
    const scale = screen.getByRole("region", { name: "Where this leaves your karma" });
    await user.hover(take);
    expect(scale).toHaveTextContent("Karma would become");
    expect(scale).toHaveTextContent(String((prep.hud?.karma ?? 0) - 2));
    await user.unhover(take);
    expect(scale).not.toHaveTextContent("Karma would become");
    await user.click(leave);
    expect(transport.sent).toEqual([{ type: "press", buttonId: "prep:opt:1" }]);
  });

  it("the office shows its building's growth, stock, markup, rivalry and security from View.office", async () => {
    renderGame(new ScriptedTransport(xview("office")));
    const ladder = await screen.findByRole("list", { name: "The building" });
    const steps = within(ladder).getAllByRole("listitem");
    expect(steps.map((s) => s.getAttribute("data-state"))).toEqual([
      "now",
      "ahead",
      "ahead",
      "ahead",
      "ahead",
    ]);
    expect(steps.map((s) => s.textContent)).toEqual(xview("office").office?.levelNames ?? []);
    const panel = screen.getByRole("region", { name: "The building" });
    expect(panel).toHaveTextContent("Shack");
    expect(panel).toHaveTextContent("Level 1 of 5");
    expect(panel).toHaveTextContent("Caskets in stock");
    expect(panel).toHaveTextContent("Standard");
    expect(panel).toHaveTextContent("2/6");
    expect(panel).toHaveTextContent("Security");
    // The stage pictures are the pack's icons (Classic borrows the Remastered ones).
    expect(ladder.querySelectorAll("img.fq-bglyph-art")).toHaveLength(5);
  });

  it("a later level lights the later stage", async () => {
    const base = xview("office");
    const office = { ...(base.office as never as object), level: 3, levelName: "Chapel House" };
    renderGame(new ScriptedTransport({ ...base, office } as never));
    const ladder = await screen.findByRole("list", { name: "The building" });
    expect(
      within(ladder)
        .getAllByRole("listitem")
        .map((s) => s.getAttribute("data-state")),
    ).toEqual(["built", "built", "built", "now", "ahead"]);
  });

  it("a duel is the battle readout with Swing, Shove and Yield, the chance on Shove", async () => {
    renderGame(new ScriptedTransport(xview("duel")));
    const battle = await screen.findByRole("region", { name: "The fight" });
    expect(battle).toHaveTextContent("Ned Digger");
    const nav = screen.getByRole("navigation", { name: "Choices" });
    expect(
      within(nav)
        .getAllByRole("button")
        .map((b) => b.getAttribute("data-button-id")),
    ).toEqual(["graveyard:swing", "graveyard:shove", "graveyard:yield"]);
    expect(within(nav).getByRole("button", { name: /Shove/ })).toHaveTextContent("chance");
  });

  it("the Reaper Club's tables: stakes by game", async () => {
    const user = userEvent.setup();
    const view = xview("clubGames");
    const transport = new ScriptedTransport(view, () => view);
    renderGame(transport);
    const board = await screen.findByRole("region", { name: "The back tables" });
    expect(within(board).getAllByRole("button")).toHaveLength(12);
    expect(
      within(board).getByRole("button", { name: /Formaldehyde Roulette, Stake \$5,000/ }),
    ).toBeInTheDocument();
    await user.click(within(board).getByRole("button", { name: /Dead Man's Draw, Stake \$500/ }));
    expect(transport.sent).toEqual([{ type: "press", buttonId: "reaper-club:draw:500" }]);
  });

  const rounds = [
    ["roundSlotsWin", "slots", "win", "You won", "+$300"],
    ["roundSlotsLose", "slots", "lose", "You lost", "-$100"],
    ["roundDrawWin", "draw", "win", "You won", "+$100"],
    ["roundDrawPush", "draw", "push", "Part of the stake back", "-$50"],
    ["roundShotsWin", "shots", "win", "You won", "+$19"],
    ["roundShotsLose", "shots", "lose", "You lost", "-$100"],
  ] as const;
  for (const [name, game, outcome, verdict, net] of rounds) {
    it(`the last round of ${game}, ${outcome}: its own result from View.club.lastRound`, async () => {
      renderGame(new ScriptedTransport(xview(name)));
      const result = await screen.findByRole("region", { name: "Last round" });
      expect(result).toHaveAttribute("data-game", game);
      expect(result).toHaveAttribute("data-result", outcome);
      expect(result).toHaveTextContent(verdict);
      expect(result).toHaveTextContent(net);
      expect(result.querySelector("svg.fq-round-art")).not.toBeNull();
    });
  }

  it("no round yet, no result banner; a changed text changes nothing about the result", async () => {
    const view = xview("clubGames");
    const { club: _c, ...noRound } = view;
    renderGame(new ScriptedTransport(noRound as View));
    await screen.findByRole("region", { name: "The back tables" });
    expect(screen.queryByRole("region", { name: "Last round" })).toBeNull();
    cleanup();
    renderGame(new ScriptedTransport({ ...view, text: [{ text: "You win everything!" }] }));
    expect(await screen.findByRole("region", { name: "Last round" })).toHaveTextContent("You lost");
  });

  it("the chains' board is a table with the player's row highlighted", async () => {
    renderGame(new ScriptedTransport(xview("chains")));
    const board = await screen.findByRole("region", { name: "Season score board" });
    const row = within(board).getByRole("row", { name: /Last Rites Ltd/ });
    expect(row).toHaveAttribute("data-mine");
    expect(row).toHaveAttribute("aria-current", "true");
    expect(board).toHaveTextContent("Your chain");
  });

  it("price tags hang off plaques that carry a cost", async () => {
    renderGame(new ScriptedTransport(xview("church")));
    const confess = await screen.findByRole("button", { name: /Confession/ });
    expect(confess).toHaveTextContent("$400");
    expect(confess.querySelector(".fq-plaque-detail")).not.toBeNull();
  });

  it("ballot options are cards with their votes, and the lobby a plaque with its price", async () => {
    renderGame(new ScriptedTransport(xview("ordinance")));
    const cards = await screen.findByRole("navigation", { name: "Cards to pick from" });
    expect(within(cards).getAllByRole("button")).toHaveLength(3);
    expect(cards).toHaveTextContent("0 votes");
    expect(screen.getByRole("button", { name: /Lobby for It/ })).toHaveTextContent("$2,500");
  });

  it("scrolls a long catalogue: its list is its own scroller", async () => {
    renderGame(new ScriptedTransport(xview("upgrades")));
    const shelf = await screen.findByRole("region", { name: "Catalogue" });
    const scroller = shelf.querySelector(".fq-up-scroll");
    expect(scroller).not.toBeNull();
    expect(scroller?.querySelectorAll("li.fq-up")).toHaveLength(15);
  });
});
