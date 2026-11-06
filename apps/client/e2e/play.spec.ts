import { expect, test } from "@playwright/test";
import {
  createParlor,
  exitGame,
  logOn,
  makeASale,
  newPlayer,
  openFrontDoor,
  plaque,
  reachDesk,
  signUp,
} from "./helpers";

test("sign up, open a parlor, make a sale, visit town, log out and back in", async ({ page }) => {
  const me = newPlayer("solo");
  await openFrontDoor(page);

  // The title screen shows the server's state and links.
  await expect(page.getByText("Server news")).toBeVisible();
  await expect(page.getByText(/Game Info:/)).toBeVisible();

  await signUp(page, me);
  await createParlor(page, me);

  // The newspaper first, with the news of the new parlor.
  await expect(page.getByRole("heading", { level: 1, name: "News" })).toBeAttached();
  await expect(
    page.getByText(`A new parlor (${me.parlor}) run by ${me.name} has been opened!`),
  ).toBeVisible();
  await plaque(page, "Continue").click();

  // The desk.
  await expect(page.getByText(`Welcome to Funeral Quest, ${me.name}`)).toBeVisible();
  await plaque(page, "Continue").click();
  await expect(plaque(page, "Wait for Customer")).toBeVisible();

  // A complete sale.
  await makeASale(page);
  await plaque(page, "Continue").click();
  await expect(plaque(page, "Wait for Customer")).toBeVisible();

  // The map: the bank and the store.
  await plaque(page, "Town Map").click();
  await page.getByRole("button", { name: "Go to Bank" }).click();
  await expect(page.getByText(/city bank/)).toBeVisible();
  await plaque(page, "Leave").click();
  await page.getByRole("button", { name: /Go to Di-Mart/ }).click();
  await expect(page.getByText(/official DuraRest/)).toBeVisible();
  await expect(plaque(page, "Supplies")).toBeVisible();
  await plaque(page, "Leave").click();
  await page.getByRole("button", { name: /Go to Your Parlor/ }).click();
  await expect(plaque(page, "Wait for Customer")).toBeVisible();

  // Stats, as a sheet.
  await plaque(page, "Stats").click();
  const stats = page.getByRole("region", { name: "Your stats and inventory" });
  await expect(stats.getByText("Total Bury Points")).toBeVisible();
  const bp = (await stats.locator('[data-stat="bpTotal"] dd').textContent()) ?? "";
  expect(Number(bp.replace(/,/g, ""))).toBeGreaterThan(0);
  await plaque(page, "Back").click();

  // Rankings, as a table with this parlor in it.
  await plaque(page, "Rankings").click();
  const table = page.getByRole("table");
  await expect(table.getByText(me.parlor)).toBeVisible();
  await plaque(page, "Continue").click();

  // Log out, log back in: the same parlor, the same Bury Points.
  await exitGame(page);
  await expect(page.getByText(`Welcome back, ${me.name}.`)).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByText("Please enter your name and password")).toBeVisible();
  await logOn(page, me);
  await reachDesk(page);
  await plaque(page, "Stats").click();
  const again = page.getByRole("region", { name: "Your stats and inventory" });
  await expect(again.locator('[data-stat="bpTotal"] dd')).toHaveText(bp);
});
