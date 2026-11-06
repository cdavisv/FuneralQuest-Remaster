import { expect, type Page, test } from "@playwright/test";
import { plaque, reachDesk, sellWithACard } from "./helpers";

/**
 * Solo mode with the Expanded ruleset, from a plain file host with no server: the setup form's
 * ruleset choice, the guided first day, a sale with a card, the ledger, End the Day, and the
 * Daily Challenge practice. (The Classic solo career is e2e/solo.spec.ts.)
 */

let counter = 0;
const unique = () => `${Date.now().toString(36).slice(-4)}${++counter}`;

async function openSetup(page: Page, name: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /^Play solo/ }).click();
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByLabel("What's your name?").fill(name);
  await page.getByLabel("What is your parlor called?").fill(`${name} Rest`);
  await page.getByRole("radio", { name: "Female", exact: true }).check({ force: true });
}

async function dismiss(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  for (let i = 0; i < 4 && (await dialog.isVisible()); i++) {
    await dialog.getByRole("button").first().click();
    await page.waitForTimeout(100);
  }
}

test("the setup form offers the ruleset, with a line on each", async ({ page }) => {
  await openSetup(page, `Xs${unique()}`);
  const rules = page.getByRole("group", { name: "Ruleset" });
  await expect(rules.getByRole("radio", { name: "Classic" })).toBeChecked();
  await expect(rules).toContainText("The 2001 game");
  // Classic has its wording choice and no tour question.
  await expect(page.getByRole("group", { name: "Which wording?" })).toBeVisible();
  await expect(page.getByRole("group", { name: "The guided first day?" })).toHaveCount(0);

  await rules.getByRole("radio", { name: "Expanded" }).check({ force: true });
  await expect(rules).toContainText("grown up");
  await expect(page.getByRole("group", { name: "Which wording?" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "The guided first day?" })).toBeVisible();
  const length = page.getByRole("group", { name: "How long is the career?" });
  await expect(length.getByRole("radio", { name: "Daily practice" })).toBeVisible();
  // Daily practice has no rivals to count.
  await length.getByRole("radio", { name: "Daily practice" }).check({ force: true });
  await expect(page.getByRole("group", { name: "How many rivals?" })).toHaveCount(0);
});

test("an Expanded solo career: the tour, a sale with a card, the books, a day's end", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const me = `Xo${unique()}`;
  await openSetup(page, me);
  await page
    .getByRole("group", { name: "Ruleset" })
    .getByRole("radio", { name: "Expanded" })
    .check({ force: true });
  await page
    .getByRole("group", { name: "How many rivals?" })
    .getByRole("radio", { name: "2", exact: true })
    .check({ force: true });
  await page.getByRole("button", { name: "open the parlor" }).click();
  await expect(page.getByText(/has been opened/)).toBeVisible();
  expect(page.workers().length).toBeGreaterThan(0);

  // The paper, the morning, and the clerk's tour (skipped).
  await plaque(page, "Continue").click();
  await dismiss(page);
  await plaque(page, "Continue").click();
  await expect(page.getByText(/Tour page 1 of/)).toBeVisible();
  await plaque(page, "Skip Tour").click();
  // A morning event (a found tag, a visitor) may come before the desk.
  await reachDesk(page);
  await expect(plaque(page, "Wait for Customer")).toBeVisible();
  const books = page.getByRole("region", { name: "Your parlor's books" });
  await expect(books).toContainText("Cash");
  await expect(books).toContainText("Karma");

  // A sale with a card.
  await sellWithACard(page);
  if (await plaque(page, "Prepare the Body").isVisible()) {
    await plaque(page, "Prepare the Body").click();
    await page.locator(".fq-mb").first().click();
  }
  await plaque(page, "Continue").click();

  // The parlor's own button, the town strip, and End the Day.
  await expect(page.getByRole("button", { name: /^Parlor/ })).toBeVisible();
  await plaque(page, "End the Day").click();
  await expect(page.getByText(/A new day has dawned/)).toBeVisible();
  await page.context().close();
});

test("the Daily Challenge practice: one seeded day, no rivals, no End the Day", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openSetup(page, `Xd${unique()}`);
  await page
    .getByRole("group", { name: "Ruleset" })
    .getByRole("radio", { name: "Expanded" })
    .check({ force: true });
  await page
    .getByRole("group", { name: "How long is the career?" })
    .getByRole("radio", { name: "Daily practice" })
    .check({ force: true });
  await page.getByRole("button", { name: "open the parlor" }).click();
  // The tour is done in a challenge: straight to the desk after the paper and the morning.
  for (let i = 0; i < 4 && !(await plaque(page, "Wait for Customer").isVisible()); i++) {
    await dismiss(page);
    await plaque(page, "Continue")
      .click({ timeout: 4000 })
      .catch(() => undefined);
    await page.waitForTimeout(150);
  }
  await expect(plaque(page, "Wait for Customer")).toBeVisible();
  await expect(plaque(page, "End the Day")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Your parlor's books" })).toContainText("$5,000");
});
