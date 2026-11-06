import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  admin,
  createParlor,
  meetCustomer,
  newPlayer,
  openFrontDoor,
  PASSWORD,
  plaque,
  reachDesk,
  signUp,
  TOWN,
} from "./helpers";

/**
 * Not a test: with FQ_SHOTS=<dir> it walks the game at three window sizes and saves a
 * screenshot of each screen, for looking at the real thing. `FQ_SHOTS=/tmp/shots pnpm e2e shots`.
 */
const dir = process.env.FQ_SHOTS;
const SIZES = [
  { name: "classic", width: 1024, height: 745 },
  { name: "wide", width: 1280, height: 720 },
  { name: "phone", width: 390, height: 844 },
];

for (const size of SIZES) {
  test(`screens at ${size.name}`, async ({ browser }) => {
    test.skip(!dir, "set FQ_SHOTS to a directory to save screenshots");
    mkdirSync(dir as string, { recursive: true });
    const context = await browser.newContext({ viewport: size });
    const page = await context.newPage();
    const shot = (name: string) =>
      page.screenshot({ path: `${dir}/${size.name}-${name}.png`, fullPage: size.name === "phone" });
    const me = newPlayer(`s${size.name[0]}`);

    await openFrontDoor(page);
    await shot("1-door");
    await page.getByRole("button", { name: "New user" }).click();
    await page.getByLabel("Name", { exact: true }).fill("ab");
    await page.getByRole("button", { name: "click to continue" }).click();
    await shot("2-signup-error");
    await page.getByLabel("Name", { exact: true }).fill(me.login);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "click to continue" }).click();
    await expect(page.getByLabel("What's your name?")).toBeVisible();
    await page.getByLabel("What's your name?").fill(me.name);
    await page.getByLabel("What is your parlor called?").fill(me.parlor);
    await shot("3-parlor");
    await createParlor(page, me);
    await expect(page.getByText(/has been opened/)).toBeVisible();
    await shot("4-news");
    await reachDesk(page);
    await shot("5-desk");
    await meetCustomer(page);
    await shot("5b-customer");
    await plaque(page, "Sympathy").click();
    await expect(page.getByRole("region", { name: "The customer" })).toBeVisible();
    await shot("5c-negotiation");
    await plaque(page, "Done").click();
    await expect(
      page.getByText(/The service is a success|walks? out|storms/).first(),
    ).toBeVisible();
    await shot("6-sale-done");
    await plaque(page, "Continue").click();
    await plaque(page, "Stats").click();
    await expect(page.getByRole("region", { name: "Your stats and inventory" })).toBeVisible();
    await shot("7-stats");
    await plaque(page, "Back").click();
    await plaque(page, "Rankings").click();
    await expect(page.getByRole("table")).toBeVisible();
    await shot("8-rankings");
    await plaque(page, "Continue").click();
    await plaque(page, "Town Map").click();
    await expect(page.getByRole("button", { name: "Go to Bank" })).toBeVisible();
    await shot("9-map");
    await page.getByRole("button", { name: "Go to Bank" }).click();
    await expect(plaque(page, "Exchange")).toBeVisible();
    await shot("10-bank");
    await context.close();
  });
}

for (const size of SIZES) {
  test(`pages, mail, toast and ended screens at ${size.name}`, async ({ browser }) => {
    test.skip(!dir, "set FQ_SHOTS to a directory to save screenshots");
    mkdirSync(dir as string, { recursive: true });
    const a = await (await browser.newContext({ viewport: size })).newPage();
    const b = await (await browser.newContext({ viewport: size })).newPage();
    const shot = (page: typeof a, name: string) =>
      page.screenshot({
        path: `${dir}/${size.name}-x-${name}.png`,
        fullPage: size.name === "phone",
      });
    const alice = newPlayer(`ma${size.name[0]}`);
    const bob = newPlayer(`mb${size.name[0]}`);

    await openFrontDoor(a);
    for (const route of ["intro", "gameplay", "rules", "credits", "rankings"]) {
      await a.goto(`/#/${route}`);
      await expect(a.getByRole("heading", { level: 1 })).toBeVisible();
      await shot(a, `page-${route}`);
    }
    await openFrontDoor(a);
    await signUp(a, alice);
    await createParlor(a, alice);
    await reachDesk(a);
    await openFrontDoor(b);
    await signUp(b, bob);
    await createParlor(b, bob);
    await reachDesk(b);

    await plaque(b, "Town Map").click();
    await plaque(a, "Write Letter").click();
    await a.getByRole("textbox").fill(bob.name);
    await a.getByRole("button", { name: "Submit" }).click();
    await a.getByRole("button", { name: "Yes" }).click();
    await a.getByRole("textbox").fill("Dear Bob,\nbusiness is dead, which is good for business.");
    await shot(a, "letter-compose");
    await a.getByRole("button", { name: "Submit" }).click();
    await expect(b.getByText(/letter is waiting/).first()).toBeVisible();
    await shot(b, "mail-indicator");
    await b.getByRole("button", { name: /Go to Your Parlor/ }).click();
    await expect(b.getByRole("dialog")).toBeVisible();
    await shot(b, "mail-overlay");
    await b.getByRole("button", { name: "Yes" }).click();
    await expect(b.getByRole("textbox")).toBeVisible();
    await shot(b, "reply-prefilled");
    await b.getByRole("button", { name: "Cancel" }).click();

    await admin(a, "POST", `/admin/towns/${TOWN}/broadcast`, { message: "The sysop says hello." });
    await expect(b.locator(".fq-toast")).toBeVisible();
    await admin(a, "POST", `/admin/towns/${TOWN}/new-day`);
    await expect(b.locator(".fq-banner-day")).toBeVisible();
    await shot(b, "toast-and-new-day");

    await plaque(a, "Rankings").click();
    const list = (await admin(a, "GET", `/admin/towns/${TOWN}/players?search=${bob.login}`)) as {
      players: { id: number; name: string }[];
    };
    await admin(a, "POST", `/admin/towns/${TOWN}/players/${list.players[0]?.id}/kick`);
    await expect(b.getByRole("alert").filter({ hasText: "Your session has ended" })).toBeVisible();
    await shot(b, "ended");
    await a.context().close();
    await b.context().close();
  });
}
