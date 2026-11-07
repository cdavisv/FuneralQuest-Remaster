import { expect, type Page, test } from "@playwright/test";
import {
  createParlor,
  meetBuyer,
  newPlayer,
  plaque,
  reachDesk,
  sellWithACard,
  signUp,
} from "./helpers";

/**
 * The Expanded ruleset on the real server (a fresh server's two default towns: the Expanded
 * flagship and the Classic one) and the Daily Challenge. This project has its own server and
 * database (playwright.config.ts); the other specs' server has only the Classic town.
 */

const books = (page: Page) => page.getByRole("region", { name: "Your parlor's books" });

async function dismiss(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  for (let i = 0; i < 4 && (await dialog.isVisible()); i++) {
    await dialog.getByRole("button").first().click();
    await page.waitForTimeout(100);
  }
}

test("the lobby names each town's ruleset, and an Expanded town plays with its tour and new places", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/Connected to /)).toBeVisible();
  await page.getByRole("button", { name: /^Play online/ }).click();

  // The town chooser: each town with its ruleset badge, and a line on what the chosen one means.
  const towns = page.getByRole("group", { name: "Choose a town" });
  const expanded = towns.locator("label", { hasText: "Expanded" });
  const classic = towns
    .locator("label", { hasText: "Classic" })
    .filter({ hasText: "Dead Calm Classic" });
  await expect(expanded.locator(".fq-ruleset")).toHaveText("Expanded");
  await expect(classic.locator(".fq-ruleset")).toHaveText("Classic");
  await expect(page.locator(".fq-town-ruleset")).toContainText("The same game grown up");
  await classic.locator("input").check();
  await expect(page.locator(".fq-town-ruleset")).toContainText("The 2001 game");
  await expanded.locator("input").check();
  await expect(page.locator(".fq-town-ruleset")).toContainText("The same game grown up");

  // A new parlor in the Expanded town: the paper, the morning, the clerk's tour.
  const me = newPlayer("xs");
  await signUp(page, me);
  await createParlor(page, me);
  await plaque(page, "Continue").click();
  await dismiss(page);
  await plaque(page, "Continue").click();
  await expect(page.getByText(/Tour page 1 of/)).toBeVisible();
  await expect(books(page)).toContainText("Cash");
  await plaque(page, "Skip Tour").click();
  // A morning event (a found tag, a visitor) may come before the desk.
  await reachDesk(page);
  await expect(plaque(page, "Wait for Customer")).toBeVisible();
  await expect(books(page)).toContainText("$2,000");

  // A customer with a file: traits, a gauge, cards; one pitched, then Done.
  await sellWithACard(page);

  // Leave the paperwork and look at the map: the three new places are on it.
  if (await plaque(page, "Prepare the Body").isVisible()) {
    await plaque(page, "Prepare the Body").click();
    await page.locator(".fq-mb").first().click();
  }
  await plaque(page, "Continue").click();
  await plaque(page, "Town Map").click();
  for (const place of ["Town Graveyard", "City Hall", "The Reaper Club", "Your Parlor", "Bank"]) {
    await expect(page.getByRole("button", { name: `Go to ${place}`, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Go to City Hall" }).click();
  await expect(page.getByRole("region", { name: "City Hall's ballots" })).toBeVisible();
  await plaque(page, "Leave").click();
});

test("the Daily Challenge: a guest plays, then sees a result and no place; a member is on the board", async ({
  browser,
}) => {
  // Two whole challenge days through the front door: WebKit on a CI runner needs more than a minute.
  test.setTimeout(150_000);
  // A guest, from the front door.
  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/");
  await expect(guest.getByText(/Connected to /)).toBeVisible();
  await guest.getByRole("button", { name: /^Play online/ }).click();
  await guest.getByRole("button", { name: "Daily Challenge" }).click();
  await expect(guest.getByRole("heading", { name: "Daily Challenge" })).toBeVisible();
  await expect(guest.getByText(/Everyone starts with 20 turns/)).toBeVisible();
  await guest.getByRole("button", { name: "Play as a guest" }).click();
  // The board is public: the player names themselves first (a guest is not on it, but is asked too).
  await expect(guest.getByText("What should the board call you?")).toBeVisible();
  await guest.getByLabel("What's your name?", { exact: true }).fill("Guest Visitor");
  await guest.getByLabel("What is your parlor called?", { exact: true }).fill("Visitor Rest");
  await guest.getByRole("radio", { name: "Male", exact: true }).check({ force: true });
  await guest.getByRole("button", { name: "start the challenge" }).click();

  // The run: the tour is done, a customer, a sale, and out.
  await expect(plaque(guest, "Wait for Customer")).toBeVisible();
  await meetBuyer(guest);
  await plaque(guest, "Done").click();
  await expect(guest.getByRole("region", { name: "What is happening" })).toContainText(
    "The service is a success",
  );
  await guest.locator(".fq-exit").click();
  await guest.getByRole("button", { name: "Leave" }).click();

  // The results: a guest's score, and the plain truth that guests are not ranked.
  await expect(guest.getByRole("heading", { name: "Results" })).toBeVisible();
  await expect(guest.getByRole("region", { name: "Your result" })).toContainText("Score");
  await expect(guest.getByText("Guests are not on the board.")).toBeVisible();
  await guest.context().close();

  // A member plays the same day and is on the board, their row marked.
  const member = newPlayer("daily");
  const page = await (await browser.newContext()).newPage();
  await page.goto("/");
  await page.getByRole("button", { name: /^Play online/ }).click();
  await signUp(page, member);
  await createParlor(page, member);
  await plaque(page, "Continue").click();
  await dismiss(page);
  // The member is in a town now; go back to the door through Exit and play the challenge.
  await page.locator(".fq-exit").click();
  await page.getByRole("button", { name: "Leave" }).click();
  await page.getByRole("button", { name: "Daily Challenge" }).click();
  // The log-on name is not offered as the board name until the player says so and confirms.
  await expect(page.getByLabel("What's your name?", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("What is your parlor called?", { exact: true })).toHaveValue("");
  await expect(page.locator(".fq-daily")).not.toContainText(member.login);
  await page.getByLabel("What's your name?", { exact: true }).fill("Boardy McBoard");
  await page.getByLabel("What is your parlor called?", { exact: true }).fill("Public Name Rest");
  await page.getByRole("radio", { name: "Female", exact: true }).check({ force: true });
  await page.getByRole("button", { name: "start the challenge" }).click();
  await meetBuyer(page);
  await plaque(page, "Done").click();
  await page.locator(".fq-exit").click();
  await page.getByRole("button", { name: "Leave" }).click();
  await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
  const board = page.getByRole("region", { name: /Today's board/ });
  await expect(board.locator("tr[data-mine]")).toHaveCount(1);
  // The board shows the name the player chose, never the log-on name.
  await expect(board.locator("tr[data-mine]")).toContainText("Boardy McBoard");
  await expect(board.locator("tr[data-mine]")).toContainText("Public Name Rest");
  await expect(board).not.toContainText(member.login);

  // Playing it again is refused with the result, not with an error.
  await page.getByRole("button", { name: "Back to the front door" }).click();
  await page.getByRole("button", { name: "Daily Challenge" }).click();
  await expect(page.getByText("You have played today.")).toBeVisible();
  await expect(page.getByRole("button", { name: "start the challenge" })).toHaveCount(0);
  await page.context().close();
});
