import { expect, type Page, test } from "@playwright/test";
import { closeDialogs, plaque } from "./helpers";

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

interface Problem {
  screen: string;
  what: string;
}

/** Looks at the page and returns everything wrong with the buttons on it. */
async function inspect(page: Page, screen: string, phone: boolean): Promise<Problem[]> {
  return page.evaluate(
    ({ screen, phone }) => {
      const problems: { screen: string; what: string }[] = [];
      const fail = (what: string) => problems.push({ screen, what });
      const rectOf = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
      };
      const named = (el: Element) =>
        `${(el as HTMLElement).dataset.buttonId ?? el.className} "${(el.textContent ?? "").trim().slice(0, 24)}"`;
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      };
      const buttons = [...document.querySelectorAll("[data-button-id], .fq-stake")].filter(visible);
      if (buttons.length === 0) fail("no buttons on the screen");

      // The cabinet: the drawing itself (the art piece, or the hand-drawn cabinet), else the page.
      const cabinetEl =
        document.querySelector(".fq-cabinet-piece") ??
        document.querySelector(".fq-cabinet-art") ??
        document.querySelector(".fq-cabinet");
      const cab = cabinetEl ? rectOf(cabinetEl) : null;
      const margin = 4;
      for (const el of buttons) {
        const r = rectOf(el);
        if (phone) {
          if (r.x < 0 || r.r > window.innerWidth + 0.5)
            fail(`${named(el)} leaves the screen sideways`);
        } else if (cab) {
          if (
            r.x < cab.x + margin ||
            r.r > cab.r - margin ||
            r.y < cab.y + margin ||
            r.b > cab.b - margin
          ) {
            fail(
              `${named(el)} is outside the cabinet (${Math.round(r.x)},${Math.round(r.y)}-${Math.round(r.r)},${Math.round(r.b)} in ${Math.round(cab.x)},${Math.round(cab.y)}-${Math.round(cab.r)},${Math.round(cab.b)})`,
            );
          }
        }
        // The whole label (and price) inside its button, nothing cut off.
        for (const part of el.querySelectorAll(
          ".fq-plaque-label, .fq-card-label, .fq-card-detail, .fq-card-hint",
        )) {
          const p = rectOf(part);
          if (p.x < r.x - 1.5 || p.r > r.r + 1.5 || p.y < r.y - 1.5 || p.b > r.b + 1.5) {
            fail(`${named(el)} clips its ${part.className}`);
          }
        }
      }
      // No button over another, and no price tag over a button that is not its own.
      for (let i = 0; i < buttons.length; i++) {
        for (let j = i + 1; j < buttons.length; j++) {
          const a = rectOf(buttons[i] as Element);
          const b = rectOf(buttons[j] as Element);
          const w = Math.min(a.r, b.r) - Math.max(a.x, b.x);
          const h = Math.min(a.b, b.b) - Math.max(a.y, b.y);
          if (w > 1 && h > 1)
            fail(`${named(buttons[i] as Element)} overlaps ${named(buttons[j] as Element)}`);
        }
      }
      for (const tag of document.querySelectorAll(".fq-plaque-detail")) {
        const own = tag.closest("[data-button-id]");
        const t = rectOf(tag);
        for (const el of buttons) {
          if (el === own) continue;
          const r = rectOf(el);
          const w = Math.min(t.r, r.r) - Math.max(t.x, r.x);
          const h = Math.min(t.b, r.b) - Math.max(t.y, r.y);
          if (w > 1 && h > 1) fail(`the tag ${named(tag)} touches ${named(el)}`);
        }
      }
      return problems;
    },
    { screen, phone },
  );
}

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
