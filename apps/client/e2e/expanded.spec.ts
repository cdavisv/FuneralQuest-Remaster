import { expect, type Page, test } from "@playwright/test";
import { plaque } from "./helpers";

/**
 * The Expanded ruleset in the browser, through the development town (`?expanded`, which runs the
 * engine's Expanded ruleset on the page itself: src/dev/ExpandedHost.ts). One long play: the guided
 * first day with its clerk, a sale with cards, Coffee, a package and a near-match finish, a
 * body-preparation choice, the office, every new place with one action in each, and a vote.
 */

const QUERY = "expanded&tour&seed=3&turns=90&money=120000&tags=10,8,6&karma=45&psych=2";

const card = (page: Page, name: RegExp | string) =>
  page.locator(".fq-card, .fq-stake, .fq-mb").filter({ hasText: name }).first();

/** The enabled cards of the screen, in order. */
const enabledCards = (page: Page) => page.locator('.fq-card:not([aria-disabled="true"])');

const text = (page: Page) => page.getByRole("region", { name: "What is happening" });
const books = (page: Page) => page.getByRole("region", { name: "Your parlor's books" });

async function dismissLetters(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  for (let i = 0; i < 4 && (await dialog.isVisible()); i++) {
    await dialog.getByRole("button").first().click();
    await page.waitForTimeout(80);
  }
}

/** Waits for a customer and returns with the file on screen (events are off in this town). */
async function meet(page: Page): Promise<void> {
  const file = page.getByRole("region", { name: "The customer's file" });
  for (let i = 0; i < 12 && !(await file.isVisible()); i++) {
    await dismissLetters(page);
    await plaque(page, "Wait for Customer").click();
    await page.waitForTimeout(150);
  }
  await expect(file).toBeVisible();
}

test("an Expanded day in the browser", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`/?${QUERY}`);

  // The paper, then the morning, then the clerk's tour.
  await expect(page.getByRole("heading", { level: 1, name: "News" })).toBeAttached();
  await plaque(page, "Continue").click();
  await plaque(page, "Continue").click();
  await expect(page.getByText("Tour page 1 of 8")).toBeVisible();
  // The speaker is the View's own field (View.tutorial.speaker).
  await expect(page.locator(".fq-tour")).toContainText("Clerk");
  for (let i = 0; i < 7; i++) await plaque(page, "Next").click();
  await expect(page.getByText("Tour page 8 of 8")).toBeVisible();
  await plaque(page, "Meet Your Customer").click();

  // The practice sale: the clerk guides, the estimate is a gauge, a card is picked.
  const tip = page.getByRole("complementary", { name: "The clerk says" });
  await expect(tip).toContainText("Read the mood word");
  await expect(tip.locator("img")).toBeVisible();
  const gauge = page.getByRole("figure", { name: /close the bill is/ });
  await expect(gauge).toBeVisible();
  await expect(books(page)).toContainText("Cash");
  await plaque(page, "Soft Sell").click();
  await expect(page.getByRole("navigation", { name: "Cards to pick from" })).toBeVisible();
  await enabledCards(page).first().click();
  await expect(plaque(page, "Soft Sell")).toBeVisible();
  // The card was pitched: the hand closes, and the bill is a line longer or the customer refused.
  await expect(text(page)).toContainText(/Ned Digger:/);
  await plaque(page, "Done").click();
  await expect(text(page)).toContainText("The service is a success");

  // A body-preparation choice: the moral one feels like one, and either way karma moves.
  await plaque(page, "Prepare the Body").click();
  const choices = page.getByRole("navigation", { name: "A choice about the body" });
  await expect(choices).toBeVisible();
  const karmaBefore = await books(page)
    .locator('[data-chip="karma"] .fq-lchip-value')
    .textContent();
  await choices.locator('[data-tone="evil"]').hover();
  await expect(page.getByText("Karma would become")).toBeVisible();
  await choices.locator('[data-tone="good"]').click();
  await plaque(page, "Continue").click();
  await expect(text(page)).toContainText("Not bad for a first day");
  await expect(books(page).locator('[data-chip="karma"] .fq-lchip-value')).not.toHaveText(
    karmaBefore ?? "",
  );

  // The desk: the town strip, the new orb for the parlor.
  await expect(plaque(page, "Wait for Customer")).toBeVisible();
  await expect(page.getByRole("region", { name: "Today in Deathville" })).toBeVisible();

  // A full negotiation: Coffee, a card, a package and a near-match finish.
  await meet(page);
  await expect(page.getByRole("navigation", { name: "More choices" })).toBeVisible();
  await plaque(page, "Coffee").click();
  await expect(plaque(page, "Coffee")).toHaveAttribute("aria-disabled", "true");
  await plaque(page, "Soft Sell").click();
  await enabledCards(page).first().click();
  await plaque(page, "Packages").click();
  await expect(page.getByRole("navigation", { name: "Cards to pick from" })).toBeVisible();
  await enabledCards(page).first().click();
  const near = await page.evaluate(() =>
    (
      window as unknown as { __fqExpanded: { nearMatch(): number | null } }
    ).__fqExpanded.nearMatch(),
  );
  expect(near).not.toBeNull();
  await plaque(page, "Done").click();
  await expect(text(page)).toContainText("NICE! Within 8%");
  // The prep choice comes after some sales; take whichever is offered.
  if (await plaque(page, "Prepare the Body").isVisible()) {
    await plaque(page, "Prepare the Body").click();
    await page.locator(".fq-mb").first().click();
  }
  await plaque(page, "Continue").click();

  // The office: the building, the contractor's catalogue, an upgrade bought.
  await page.getByRole("button", { name: /Parlor/ }).click();
  await expect(page.getByRole("list", { name: "The building" })).toBeVisible();
  await plaque(page, "Upgrades").click();
  const shelf = page.getByRole("region", { name: "Catalogue" });
  await expect(shelf).toContainText("0 of 15 owned");
  const alarm = shelf.locator('.fq-up[data-state="locked"]').filter({ hasText: /^Alarm System/ });
  await expect(alarm).toContainText("Needs Guard Dog");
  const paint = shelf.getByRole("button", { name: /^Fresh Paint/ });
  await expect(paint).toContainText("Ready to buy");
  await paint.click();
  // The purchase moves the upgrade to Owned and the building up a level.
  await expect(shelf).toContainText("1 of 15 owned");
  await expect(shelf.locator('.fq-up[data-state="owned"]')).toContainText("Fresh Paint");
  await expect(shelf.getByRole("button", { name: /^Fresh Paint/ })).toHaveCount(0);
  await expect(shelf.getByRole("button", { name: /^Viewing Room/ })).toContainText(
    "You have: Fresh Paint",
  );
  await plaque(page, "Back").click();
  await plaque(page, "Back").click();

  // Di-Mart: a casket for the storeroom.
  await plaque(page, "Town Map").click();
  await page.getByRole("button", { name: "Go to Di-Mart" }).click();
  await plaque(page, "Caskets").click();
  const cashBefore = await books(page).locator('[data-chip="money"]').textContent();
  await card(page, "Wood").click();
  await expect(books(page).locator('[data-chip="money"]')).not.toHaveText(cashBefore ?? "");
  await plaque(page, "Back").click();
  await plaque(page, "Leave").click();

  // The graveyard: a monument, then a duel with Swing, Shove and Yield.
  await page.getByRole("button", { name: "Go to Town Graveyard" }).click();
  await plaque(page, "Monuments").click();
  await expect(card(page, /\$3,000/)).toBeVisible();
  await card(page, /\$3,000/).click();
  await plaque(page, "Back").click();
  await plaque(page, "Challenge a Rival").click();
  await page.getByLabel("Tilda Marsh").check({ force: true });
  await page.getByRole("button", { name: "Choose" }).click();
  const fight = page.getByRole("region", { name: "The fight" });
  await expect(fight).toContainText("Tilda Marsh");
  await expect(plaque(page, "Shove")).toContainText("chance");
  await plaque(page, "Yield").click();
  await plaque(page, "Continue").click();
  await plaque(page, "Leave").click();

  // The church: a bingo card.
  await page.getByRole("button", { name: "Go to Church" }).click();
  await plaque(page, "Bingo Night").click();
  const sheet = page.getByRole("region", { name: "Bingo Night" });
  await expect(sheet.locator('.fq-bingo-cells [data-state="mine"]')).toHaveCount(0);
  await card(page, "Buy a Card").click();
  // The grid marks the player's card, and the pot, price and draw come from View.bingo.
  await expect(sheet.locator('.fq-bingo-cells [data-state="mine"]')).toHaveCount(1);
  await expect(sheet).toContainText("Tonight's pot");
  await expect(sheet).toContainText("Midnight");
  await plaque(page, "Back").click();
  await plaque(page, "Leave").click();

  // City Hall: a permit, a chain on the board, and the vote.
  await page.getByRole("button", { name: "Go to City Hall" }).click();
  await plaque(page, "Permits").click();
  await card(page, /Signage Permit/).click();
  await expect(card(page, /Signage Permit/)).toHaveAttribute("data-state", "owned");
  await plaque(page, "Back").click();
  await plaque(page, "Parlor Chains").click();
  await plaque(page, "Found a Chain").click();
  await page.getByRole("textbox").fill("Last Rites Ltd");
  await page.getByRole("button", { name: /Submit/ }).click();
  const board = page.getByRole("region", { name: "Season score board" });
  await expect(board.getByRole("row", { name: /Last Rites Ltd/ })).toHaveAttribute(
    "data-mine",
    "true",
  );
  await plaque(page, "Back").click();
  await plaque(page, "Ordinance Vote").click();
  const ballot = page.getByRole("navigation", { name: "Cards to pick from" });
  await expect(ballot.getByRole("button")).toHaveCount(3);
  await expect(ballot).toContainText("0 votes");
  const panel = page.getByRole("region", { name: "City Hall's ballots" });
  await expect(panel.locator("li[data-mine]")).toHaveCount(0);
  await ballot.getByRole("button").first().click();
  await expect(page.getByRole("navigation", { name: "Cards to pick from" })).toContainText(
    "1 vote",
  );
  // The vote is the player's, marked on the panel and on its card.
  await expect(panel.locator("li[data-mine]")).toContainText("Your vote");
  await expect(ballot.locator('[aria-pressed="true"]')).toHaveCount(1);
  await plaque(page, "Back").click();
  await plaque(page, "Leave").click();

  // The Reaper Club: the cover, a round of Dead Man's Draw, the market.
  await page.getByRole("button", { name: "Go to The Reaper Club" }).click();
  await plaque(page, "Pay the Cover").click();
  await plaque(page, "The Back Tables").click();
  const tables = page.getByRole("region", { name: "The back tables" });
  await expect(tables.getByRole("button")).toHaveCount(12);
  await tables.getByRole("button", { name: /Dead Man's Draw, Stake \$100/ }).click();
  const round = page.getByRole("region", { name: "Last round" });
  await expect(round).toHaveAttribute("data-game", "draw");
  await expect(round).toContainText(/You won|You lost|Stake back|Part of the stake back/);
  await plaque(page, "Back").click();
  await plaque(page, "Black Market").click();
  await expect(page.getByRole("navigation", { name: "Cards to pick from" })).toBeVisible();
  await plaque(page, "Back").click();
  await plaque(page, "Leave").click();

  // The hospital: the nurse's lead, counted in the books.
  await page.getByRole("button", { name: "Go to Hospital" }).click();
  await plaque(page, "Bribe the Nurse").click();
  await expect(books(page).locator('[data-chip="leads"]')).toContainText("1");
  await plaque(page, "Leave").click();

  // The bank: a loan, and the debt as a warning in the books with its due day.
  await page.getByRole("button", { name: "Go to Bank" }).click();
  await plaque(page, "Loans").click();
  // The terms are on the sheet before anything is borrowed.
  const terms = page.getByLabel("The loan's terms");
  await expect(terms).toContainText("The most it lends you");
  await expect(terms).toContainText("if taken today");
  await plaque(page, "Borrow").click();
  await page.getByRole("textbox").fill("1000");
  await page.getByRole("button", { name: /Submit/ }).click();
  const debt = books(page).locator('[data-chip="debt"]');
  await expect(debt).toBeVisible();
  await expect(debt).toContainText(/Due/);
  await expect(page.getByRole("region", { name: "The bank's books" })).toContainText("You owe");
  await plaque(page, "Back").click();
  await plaque(page, "Leave").click();

  // Back at the desk, the vote is cast: no badge on the strip.
  await page.getByRole("button", { name: "Go to Your Parlor" }).click();
  await expect(plaque(page, "Wait for Customer")).toBeVisible();
  await expect(page.getByRole("region", { name: "Today in Deathville" })).not.toContainText("Vote");

  expect(errors.filter((e) => !/favicon|Failed to load resource/.test(e))).toEqual([]);
});
