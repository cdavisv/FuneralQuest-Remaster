import { expect, type Page } from "@playwright/test";

let counter = 0;

/** A login name nobody has used on this server: letters and digits, under 20 characters. */
export function uniqueLogin(prefix: string): string {
  counter++;
  const stamp = Date.now().toString(36).slice(-6);
  return `${prefix}${stamp}${counter}`.slice(0, 20);
}

export const PASSWORD = "correct-horse-1";

export interface Player {
  login: string;
  name: string;
  parlor: string;
}

export function newPlayer(prefix: string): Player {
  const login = uniqueLogin(prefix);
  return { login, name: `Ned ${login.slice(-4)}`, parlor: `${login} Rest` };
}

/**
 * The press-a-choice buttons of the game (not the front door's): the plaques, and the desk's
 * round icon buttons (map, paper, stats, rankings, letter), which are named by their label.
 */
export const plaque = (page: Page, name: string | RegExp) =>
  page.locator(".fq-plaque, .fq-orb").filter({ hasText: name });

/** Opens the front door, waits for the server's status, and chooses to play online. */
export async function openFrontDoor(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByText(/Connected to /)).toBeVisible();
  await page.getByRole("button", { name: /^Play online/ }).click();
  await expect(page.getByRole("button", { name: "Log on" })).toBeVisible();
}

/** New user, first form: log-on name and password. */
export async function signUp(page: Page, player: Player): Promise<void> {
  await page.getByRole("button", { name: "New user" }).click();
  await page.getByLabel("Name", { exact: true }).fill(player.login);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "click to continue" }).click();
}

/** New user, second form: your name, your parlor, a skull. Lands on the newspaper. */
export async function createParlor(page: Page, player: Player, male = true): Promise<void> {
  await page.getByLabel("What's your name?").fill(player.name);
  await page.getByLabel("What is your parlor called?").fill(player.parlor);
  await page
    .getByRole("radio", { name: male ? "Male" : "Female", exact: true })
    .check({ force: true });
  await page.getByRole("button", { name: "open the parlor" }).click();
}

export async function logOn(page: Page, player: Player): Promise<void> {
  await page.getByLabel("Name", { exact: true }).fill(player.login);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log on" }).click();
}

/** Signs up, makes the parlor, reads the paper and stands at the desk. */
export async function startGame(page: Page, player: Player): Promise<void> {
  await openFrontDoor(page);
  await signUp(page, player);
  await createParlor(page, player);
  await reachDesk(page);
}

/** Leaves through the Exit button and its confirmation. */
export async function exitGame(page: Page): Promise<void> {
  await page.locator(".fq-exit").click();
  await page.getByRole("button", { name: "Leave" }).click();
}

/**
 * Waits for a customer until one sits down. Whatever random event comes first (the Twins
 * offering a fire, a woman asking after a ring, a special event) is answered with its first
 * choice. Returns with the negotiation on screen.
 */
export async function meetCustomer(page: Page): Promise<void> {
  const customer = page.getByRole("region", { name: "The customer" });
  const text = page.locator(".fq-text").first();
  for (let step = 0; step < 30; step++) {
    if (await customer.isVisible()) return;
    const before = await text.textContent();
    const wait = plaque(page, "Wait for Customer");
    const next = (await wait.isVisible())
      ? wait
      : page.locator(".fq-plaque").filter({ hasNotText: /Exit/ }).first();
    await next.click();
    // The answer has arrived once the text changes.
    await expect(text).not.toHaveText(before ?? "");
  }
  throw new Error("no customer came in thirty steps");
}

/** Waits for a customer and finishes the sale with Done; returns with the result on screen. */
export async function makeASale(page: Page): Promise<void> {
  await meetCustomer(page);
  await plaque(page, "Done").click();
  await expect(
    page.getByRole("region", { name: "What is happening" }).getByText("The service is a success"),
  ).toBeVisible();
}

/** Closes a message dialog (a morning event, a fortune cookie) if one is open. */
export async function closeDialogs(page: Page): Promise<void> {
  const dialog = page.getByRole("dialog");
  for (let i = 0; i < 4 && (await dialog.isVisible()); i++) {
    await dialog.getByRole("button").first().click();
    await page.waitForTimeout(100);
  }
}

/** From wherever the first screens leave you (the paper, the desk's welcome) to the desk menu. */
export async function reachDesk(page: Page): Promise<void> {
  const desk = plaque(page, "Wait for Customer");
  for (let step = 0; step < 6; step++) {
    await closeDialogs(page);
    await expect(plaque(page, /Wait for Customer|Continue/).first()).toBeVisible();
    if (await desk.isVisible()) {
      // A morning event (a fortune cookie, a visitor) opens over the desk as it appears.
      await closeDialogs(page);
      return;
    }
    // The screen may change between the look and the click (an earlier click still answering).
    await plaque(page, "Continue")
      .click({ timeout: 5_000 })
      .catch(() => undefined);
    await page.waitForTimeout(100);
  }
  await expect(desk).toBeVisible();
}

export const ADMIN_TOKEN = "e2e-admin-token-0123456789abcdef";

/** Calls the server's admin API (the test server is started with this token). */
export async function admin(
  page: Page,
  method: "POST" | "GET",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const response = await page.request.fetch(path, {
    method,
    headers: { authorization: `Bearer ${ADMIN_TOKEN}`, "content-type": "application/json" },
    ...(method === "POST" ? { data: JSON.stringify(body ?? {}) } : {}),
  });
  expect(response.status(), `${method} ${path}`).toBeLessThan(300);
  return response.json();
}

/** The id of the town every test plays in. */
export const TOWN = "main";

/** Goes from the desk to a place on the map. */
export async function goTo(page: Page, place: RegExp): Promise<void> {
  await plaque(page, "Town Map").click();
  await page.getByRole("button", { name: place }).click();
}

/**
 * Expanded: waits for a customer to haggle with (the customer's file and a Soft Sell button).
 * An offer that needs no haggling (the county's contract, Cousin Sal) is taken and the wait goes
 * on; a letter or a morning event is closed.
 */
export async function meetBuyer(page: Page): Promise<void> {
  const file = page.getByRole("region", { name: "The customer's file" });
  for (let step = 0; step < 24; step++) {
    await closeDialogs(page);
    if ((await file.isVisible()) && (await plaque(page, "Soft Sell").isVisible())) return;
    if (await file.isVisible()) {
      // An offer: two choices and no negotiation. Take the first.
      await page.locator(".fq-plaque").filter({ hasNotText: /Exit/ }).first().click();
    } else if (await plaque(page, "Wait for Customer").isVisible()) {
      await plaque(page, "Wait for Customer").click();
    } else {
      await page
        .locator(".fq-plaque")
        .filter({ hasNotText: /Exit/ })
        .first()
        .click({ timeout: 3000 })
        .catch(() => undefined);
    }
    await page.waitForTimeout(150);
  }
  throw new Error("no customer to haggle with came in twenty-four steps");
}

/**
 * Expanded: a sale with a card. Waits for a buyer, pitches the first card that can be pitched and
 * finishes with Done. A customer who walks out on the pitch (it happens) is followed by the next.
 */
export async function sellWithACard(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt++) {
    await meetBuyer(page);
    // A customer with a file: the estimate is a gauge, the hand is cards.
    await expect(page.getByRole("figure", { name: /close the bill is/ })).toBeVisible();
    await plaque(page, "Soft Sell").click();
    await page.locator('.fq-card:not([aria-disabled="true"])').first().click();
    const next = page
      .locator(".fq-plaque")
      .filter({ hasText: /Done|Continue/ })
      .first();
    await next.waitFor();
    if (await plaque(page, "Done").isVisible()) {
      await plaque(page, "Done").click();
      await expect(
        page
          .getByRole("region", { name: "What is happening" })
          .getByText("The service is a success"),
      ).toBeVisible();
      return;
    }
    await next.click();
    await reachDesk(page);
  }
  throw new Error("every customer walked out on the pitch");
}
