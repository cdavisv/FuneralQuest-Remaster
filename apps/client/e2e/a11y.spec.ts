import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { measureContrast } from "./contrast";
import { plaque } from "./helpers";

/**
 * An automated accessibility check (axe-core, WCAG 2.0 and 2.1 A and AA) of the main screens, under
 * both art packs, with no serious or critical finding allowed. Contrast is part of it: the text
 * well, the parchment panels, the ledger, the cards and the front door are all measured as drawn.
 */

const RICH = "expanded&money=90000&turns=80&tags=10,6,4&karma=80&bp=3000&psych=2&day=12&seed=9";
const PACKS = ["classic", "remastered"] as const;
const SIZES = [
  { name: "1024x745", width: 1024, height: 745 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "390x844", width: 390, height: 844 },
] as const;

async function open(page: Page, query: string, pack: string): Promise<void> {
  await page.addInitScript(
    (p) =>
      localStorage.setItem("fq.settings.v1", JSON.stringify({ artPack: p, typewriter: "off" })),
    pack,
  );
  await page.goto(query.startsWith("/") ? query : `/?${query}`);
  await expect(page.locator(".fq-scene, .fq-door").first()).toBeVisible();
  await page.waitForTimeout(300);
}

interface Screen {
  name: string;
  query: string;
  steps?: (page: Page) => Promise<void>;
}

const SCREENS: Screen[] = [
  { name: "the front door", query: "/" },
  { name: "Solo: the career list", query: "/?solo" },
  {
    name: "the desk",
    query: RICH,
    steps: async (p) => {
      await plaque(p, "Continue").click();
      await plaque(p, "Continue").click();
    },
  },
  {
    name: "a negotiation",
    query: `${RICH}&seed=11`,
    steps: async (p) => {
      await plaque(p, "Continue").click();
      await plaque(p, "Continue").click();
      await plaque(p, "Wait for Customer").click();
      await expect(p.getByRole("region", { name: "The customer's file" })).toBeVisible();
    },
  },
  {
    name: "the town map",
    query: `${RICH}&start=funeral-home`,
    steps: async (p) =>
      void (await p
        .getByRole("button", { name: /^Go to|Town Map/ })
        .first()
        .isVisible()),
  },
  {
    name: "the office",
    query: `${RICH}&start=funeral-home`,
    steps: async (p) => void (await p.getByRole("button", { name: /Parlor/ }).click()),
  },
  {
    name: "the contractor's catalogue",
    query: `${RICH}&start=funeral-home`,
    steps: async (p) => {
      await p.getByRole("button", { name: /Parlor/ }).click();
      await plaque(p, "Upgrades").click();
    },
  },
  { name: "the bank", query: `${RICH}&start=bank` },
  {
    name: "the loan terms",
    query: `${RICH}&start=bank`,
    steps: async (p) => void (await plaque(p, "Loans").click()),
  },
  {
    name: "bingo night",
    query: `${RICH}&start=church`,
    steps: async (p) => void (await plaque(p, "Bingo Night").click()),
  },
  { name: "City Hall", query: `${RICH}&start=city-hall` },
  {
    name: "the ordinance vote",
    query: `${RICH}&start=city-hall`,
    steps: async (p) => void (await plaque(p, "Ordinance Vote").click()),
  },
  {
    name: "the Reaper Club's tables",
    query: `${RICH}&start=reaper-club`,
    steps: async (p) => {
      await plaque(p, "Pay the Cover").click();
      await plaque(p, "The Back Tables").click();
      await p.getByRole("button", { name: /Dead Man's Draw, Stake \$100/ }).click();
    },
  },
  {
    name: "the graveyard's monuments",
    query: `${RICH}&karma=20&start=graveyard`,
    steps: async (p) => void (await plaque(p, "Monuments").click()),
  },
  {
    name: "the stats sheet",
    query: RICH,
    steps: async (p) => {
      await plaque(p, "Continue").click();
      await plaque(p, "Continue").click();
      await p.getByRole("button", { name: "Stats" }).click();
    },
  },
  {
    name: "Settings",
    query: RICH,
    steps: async (p) => void (await p.getByRole("button", { name: "Settings" }).click()),
  },
];

for (const pack of PACKS) {
  for (const size of SIZES) {
    test(`axe finds nothing serious or critical (${pack} art, ${size.name})`, async ({
      browser,
    }) => {
      test.setTimeout(240_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      const page = await context.newPage();
      const found: string[] = [];
      for (const screen of SCREENS) {
        await open(page, screen.query, pack);
        if (screen.steps) await screen.steps(page);
        await page.waitForTimeout(250);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        if (process.env.A11Y_REPORT) {
          for (const v of results.incomplete.filter((i) => i.id === "color-contrast")) {
            console.log(
              `INCOMPLETE ${screen.name} [${pack}] ${v.nodes.length}: ${v.nodes
                .slice(0, 6)
                .map(
                  (n) =>
                    `${n.target.join(" ")} (${(n.any[0]?.data as { fgColor?: string; bgColor?: string; contrastRatio?: number } | undefined)?.contrastRatio ?? "?"})`,
                )
                .join(" | ")}`,
            );
          }
        }
        // axe cannot judge text over art, so the contrast is measured from the painted page.
        for (const f of await measureContrast(page)) {
          found.push(
            `${screen.name} [${pack} ${size.name}] contrast ${f.ratio} < ${f.need}: ${f.selector} "${f.text}" ${f.fg} on ${f.bg}`,
          );
        }
        for (const v of results.violations) {
          if (v.impact !== "serious" && v.impact !== "critical") continue;
          for (const n of v.nodes.slice(0, 4)) {
            found.push(
              `${screen.name} [${pack} ${size.name}] ${v.impact} ${v.id}: ${n.target.join(" ")} :: ${(n.any[0]?.message ?? n.failureSummary ?? "").split("\n")[0]?.slice(0, 160)}`,
            );
          }
        }
      }
      expect(found, found.join("\n")).toEqual([]);
      await context.close();
    });
  }
}
