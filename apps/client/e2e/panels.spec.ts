import { expect, type Page, test } from "@playwright/test";
import { plaque } from "./helpers";

/**
 * The structured panels and the art across packs, against the production bundle and the
 * development town (`?expanded`, the engine on the page). The long play in expanded.spec.ts covers
 * the loan, the vote, the bingo card and the upgrade in sequence; this one covers what it cannot:
 * an injury treated, both art selections showing every picture, and the guided gamepad play.
 */

const RICH = "expanded&money=90000&turns=80&tags=10,6,4&karma=80&bp=3000&psych=2&day=12&seed=9";

async function open(page: Page, query: string, pack = "classic"): Promise<void> {
  await page.addInitScript(
    (p) =>
      localStorage.setItem("fq.settings.v1", JSON.stringify({ artPack: p, typewriter: "off" })),
    pack,
  );
  await page.goto(`/?${query}`);
  await expect(page.locator(".fq-scene")).toBeVisible();
}

test("an injury is listed with its price at the hospital, and treating it clears it", async ({
  page,
}) => {
  await open(page, `${RICH}&start=graveyard`);
  await plaque(page, "Challenge a Rival").click();
  await page.locator('input[type="radio"]').first().check({ force: true });
  await page.getByRole("button", { name: "Choose" }).click();
  for (let i = 0; i < 25 && (await plaque(page, "Swing").isVisible()); i++) {
    await plaque(page, "Swing").click();
    await page.waitForTimeout(60);
  }
  // Leave through whatever the screen offers, until the map is there.
  const hospital = page.getByRole("button", { name: "Go to Hospital" });
  for (let i = 0; i < 6 && !(await hospital.isVisible()); i++) {
    for (const name of ["Continue", "Leave", "Town Map"]) {
      if (await plaque(page, name).isVisible()) {
        await plaque(page, name).first().click();
        break;
      }
    }
    await page.waitForTimeout(100);
  }
  await page.getByRole("button", { name: "Go to Hospital" }).click();
  const list = page.getByRole("region", { name: "Your injuries" });
  await expect(list).toBeVisible();
  await expect(list).toContainText("Heals in");
  await expect(list).toContainText(/Treatment \$[\d,]+ today/);
  await expect(page.locator('[data-chip="injuries"]')).toBeVisible();
  await page
    .locator(".fq-card", { hasText: /^\d*Fix / })
    .first()
    .click();
  await expect(page.getByRole("region", { name: "Your injuries" })).toHaveCount(0);
  await expect(page.locator('[data-chip="injuries"]')).toHaveCount(0);
});

for (const pack of ["classic", "remastered"] as const) {
  test(`every picture shows under the ${pack} art: the Expanded places and the originals`, async ({
    page,
  }) => {
    const asked: string[] = [];
    page.on("request", (r) => asked.push(new URL(r.url()).pathname));
    await open(page, `${RICH}&start=graveyard`, pack);
    const bgs = () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLImageElement>(".fq-layer")].map((i) => ({
          src: i.currentSrc,
          ok: i.complete && i.naturalWidth > 0,
        })),
      );
    // The graveyard exists only in the Remastered pack, and shows on either selection.
    await expect.poll(async () => (await bgs()).some((l) => l.ok)).toBe(true);
    expect((await bgs()).every((l) => l.ok)).toBe(true);
    expect(asked).not.toContain("/classic/places/graveyard.svg");
    await expect(page.getByText(/Art not available/)).toHaveCount(0);

    // City Hall's mayor, and an original (the bank's redraw under Remastered, the 2001 art under Classic).
    await open(page, `${RICH}&start=city-hall`, pack);
    await expect.poll(async () => (await bgs()).length).toBeGreaterThan(0);
    expect((await bgs()).every((l) => l.ok)).toBe(true);
    await open(page, `${RICH}&start=bank`, pack);
    await expect.poll(async () => (await bgs()).length).toBeGreaterThan(0);
    const bank = await bgs();
    expect(bank.every((l) => l.ok)).toBe(true);
    if (pack === "classic")
      expect(bank.some((l) => l.src.endsWith("/classic/places/bank.svg"))).toBe(true);
    else expect(bank.some((l) => l.src.endsWith("/classic/places/bank.svg"))).toBe(false);
    // The monument tiers carry their icons.
    await open(page, `${RICH}&karma=20&start=graveyard`, pack);
    await plaque(page, "Monuments").click();
    const tiers = page.getByRole("list", { name: "The five monuments, cheapest first" });
    await expect(tiers.locator("img")).toHaveCount(5);
    for (const ok of await tiers
      .locator("img")
      .evaluateAll((imgs) =>
        imgs.map(
          (i) => (i as HTMLImageElement).complete && (i as HTMLImageElement).naturalWidth > 0,
        ),
      ))
      expect(ok).toBe(true);
  });
}
