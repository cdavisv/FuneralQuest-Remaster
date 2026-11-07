import { expect, type Page, test } from "@playwright/test";
import { closeDialogs, plaque } from "./helpers";
import { inspect, type Problem } from "./layout-check";

/**
 * Every button of the Expanded screens that crowd the cabinet most must lie inside the cabinet,
 * overlap no other button (a price tag counts as part of its plaque and must not touch another
 * one), and hold its whole label. Run at the three layouts and in both art packs, on the
 * development town (`?expanded`), so a change to the rows cannot quietly push a button off the
 * cabinet's rim again.
 */

const SIZES = [
  { name: "classic", width: 1024, height: 745 },
  { name: "wide", width: 1280, height: 720 },
  { name: "phone", width: 390, height: 844 },
] as const;
const PACKS = ["classic", "handdrawn"] as const;

const BASE = "expanded&money=90000&turns=90&tags=10,8,6&seed=5&bp=3000&day=12";

async function open(page: Page, query: string, pack: string): Promise<void> {
  await page.addInitScript(
    (p) => localStorage.setItem("fq.settings.v1", JSON.stringify({ artPack: p })),
    pack,
  );
  await page.goto(`/?${query}`);
  await expect(page.locator(".fq-scene")).toBeVisible();
}

/** Adds the three buttons a negotiation only shows when unlocked, so the second row is full. */
async function fillSecondRow(page: Page): Promise<void> {
  await page.evaluate(() => {
    const host = (
      window as unknown as {
        __fqExpanded: { send(a: unknown): Promise<{ customer?: unknown; buttons: unknown[] }> };
      }
    ).__fqExpanded;
    const send = host.send.bind(host);
    host.send = async (action) => {
      const view = await send(action);
      const ids = (view.buttons as { id: string }[]).map((b) => b.id);
      if (view.customer && ids.includes("neg:packages") && !ids.includes("neg:cremate")) {
        view.buttons.push(
          { id: "neg:cremate", label: "Cremation", group: "more", detail: "$1,500" },
          { id: "neg:bless", label: "Bless", group: "more" },
          { id: "neg:mourners", label: "Raise Mourners", group: "more" },
        );
      }
      return view;
    };
  });
}

for (const pack of PACKS) {
  for (const size of SIZES) {
    test(`no button leaves the cabinet, overlaps another or clips its label (${pack} art, ${size.name})`, async ({
      browser,
    }) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      const phone = size.name === "phone";
      const problems: Problem[] = [];
      const check = async (screen: string) => {
        await page.waitForTimeout(250);
        problems.push(...(await inspect(page, `${screen} / ${pack} / ${size.name}`, phone)));
      };

      // A negotiation: five main buttons and the full second row.
      await open(page, `${BASE}&seed=11&psych=3`, pack);
      await fillSecondRow(page);
      await plaque(page, "Continue").click();
      await plaque(page, "Continue").click();
      await check("the desk");
      await plaque(page, "Wait for Customer").click();
      await expect(page.getByRole("region", { name: "The customer's file" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "More choices" })).toBeVisible();
      await check("a negotiation, seven in the second row");
      await plaque(page, "Soft Sell").click();
      await check("the soft-sell hand");
      await plaque(page, "Back").click();
      await plaque(page, "Packages").click();
      await check("the packages");

      // The places with the most plaques, each with a second row of its own.
      const places: [string, string, (() => Promise<void>) | null][] = [
        ["the graveyard", `${BASE}&karma=20&start=graveyard`, null],
        ["the church", `${BASE}&karma=90&start=church`, null],
        ["City Hall", `${BASE}&start=city-hall`, null],
        ["the bank", `${BASE}&start=bank`, null],
        ["the hospital", `${BASE}&start=hospital`, null],
        ["the office", `${BASE}&start=funeral-home`, null],
      ];
      for (const [name, query] of places) {
        await open(page, query, pack);
        if (name === "the office") await page.getByRole("button", { name: /Parlor/ }).click();
        await check(name);
      }

      // The Reaper Club inside, its tables and its market, and a place with cards.
      await open(page, `${BASE}&start=reaper-club`, pack);
      await check("the Reaper Club's door");
      await plaque(page, "Pay the Cover").click();
      await check("the Reaper Club");
      await plaque(page, "The Back Tables").click();
      await check("the back tables");
      await plaque(page, "Back").click();
      await plaque(page, "Black Market").click();
      await check("the black market");
      await open(page, `${BASE}&start=store`, pack);
      await plaque(page, "Caskets").click();
      await check("Di-Mart's caskets");

      expect(problems, JSON.stringify(problems, null, 1)).toEqual([]);
      await closeDialogs(page).catch(() => undefined);
      await context.close();
    });
  }
}
