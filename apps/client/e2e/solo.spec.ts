import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { makeASale, plaque, reachDesk } from "./helpers";

/**
 * Solo mode in a real browser, with no game server at all: the build is served by a plain file
 * host (e2e/static-host.mjs, started by playwright.config.ts; the "solo" project) that answers
 * /api with 404.
 */
const STATIC = `http://127.0.0.1:${process.env.FQ_E2E_STATIC_PORT}`;

let counter = 0;
const unique = () => `${Date.now().toString(36).slice(-4)}${++counter}`;

interface CareerOptions {
  rivals?: number;
  difficulty?: "Easy" | "Normal" | "Hard";
  endless?: boolean;
}

/** From the front door to the first screen of a new career. */
async function startCareer(page: Page, name: string, options: CareerOptions = {}): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /^Play solo/ }).click();
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByLabel("What's your name?").fill(name);
  await page.getByLabel("What is your parlor called?").fill(`${name} Rest`);
  await page.getByRole("radio", { name: "Female", exact: true }).check({ force: true });
  if (options.rivals !== undefined) {
    await page
      .getByRole("group", { name: "How many rivals?" })
      .getByRole("radio", { name: String(options.rivals), exact: true })
      .check({ force: true });
  }
  if (options.difficulty) {
    await page.getByRole("radio", { name: options.difficulty, exact: true }).check({ force: true });
  }
  if (options.endless) await page.getByRole("radio", { name: "Endless" }).check({ force: true });
  await page.getByRole("button", { name: "open the parlor" }).click();
  await expect(page.getByText(/has been opened/)).toBeVisible();
}

const standings = async (page: Page): Promise<{ name: string; bp: number }[]> => {
  await plaque(page, "Rankings").click();
  const rows = page.locator("table.fq-rank-table tbody tr");
  await expect(rows.first()).toBeVisible();
  const out = await rows.evaluateAll((trs) =>
    trs.map((tr) => ({
      name: tr.querySelector(".fq-rank-who")?.textContent ?? "",
      bp: Number((tr.querySelector(".fq-rank-bp")?.textContent ?? "0").replace(/,/g, "")),
    })),
  );
  await plaque(page, "Continue").click();
  await expect(plaque(page, "Wait for Customer")).toBeVisible();
  return out;
};

test("there is no server behind this page", async ({ request }) => {
  expect((await request.get("/api/towns")).status()).toBe(404);
  expect((await request.get("/health")).status()).toBe(404);
});

test("the front door offers online or solo, and says so when the server is not there", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "How would you like to play?" })).toBeVisible();
  const online = page.getByRole("button", { name: /^Play online/ });
  await expect(online).toContainText("The server could not be reached.");
  // The solo choice has the focus when online is not possible.
  await expect(page.getByRole("button", { name: /^Play solo/ })).toBeFocused();
  // No museum link: the server did not say it is on.
  await expect(page.locator("[data-museum-link]")).toHaveCount(0);
});

test("a solo career: a sale, a day ends, the paper, the standings, reload, export and import", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const me = `Sol${unique()}`;
  await startCareer(page, me, { rivals: 3, difficulty: "Hard" });
  // The game's own code, and every rival's day, run in a worker.
  expect(page.workers().length).toBeGreaterThan(0);

  await reachDesk(page);
  const before = await standings(page);
  expect(before.length).toBe(4);
  expect(before.every((row) => row.bp === 0)).toBe(true);

  // A whole sale, as online.
  await makeASale(page);
  await reachDesk(page);

  // End the Day is a choice on the desk's row, beside the fixed controls.
  await plaque(page, "End the Day").click();
  await expect(page.getByText("A new day has dawned. It is day 2.")).toBeVisible();
  // The new day's paper is the first thing on screen.
  await expect(page.getByText("Day 2", { exact: true }).first()).toBeVisible();
  await reachDesk(page);

  // The rivals played their day: the standings are not what they were.
  const after = await standings(page);
  expect(after.length).toBe(4);
  expect(after.some((row) => row.bp > 0)).toBe(true);
  expect(after).not.toEqual(before);
  const mine = after.find((row) => row.name.includes(me));
  expect(mine?.bp).toBeGreaterThan(0);

  // Reload: the tab goes straight back into the career, on day 2, with the same standings.
  await page.reload();
  await expect(plaque(page, /Wait for Customer|Continue/).first()).toBeVisible();
  await reachDesk(page);
  expect(await standings(page)).toEqual(after);

  // Leave to the list: the career is there with its day and Bury Points; continue it.
  await page.locator(".fq-exit").click();
  await page.getByRole("button", { name: "Leave" }).click();
  const row = page.locator(".fq-save").filter({ hasText: me });
  await expect(row).toContainText("Day 2 of 30");
  await expect(row).toContainText(`${mine?.bp ?? 0} Bury Points`);

  // Export it as a file...
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    row.getByRole("button", { name: "Export" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.fqsave\.json$/);
  const file = testInfo.outputPath("career.fqsave.json");
  await download.saveAs(file);
  const saved = JSON.parse(readFileSync(file, "utf8"));
  expect(saved.format).toBe("fq-solo");
  expect(saved.town.day).toBe(2);

  // ...and import it into a fresh profile (a new browser context has its own storage).
  const fresh = await (await browser.newContext({ baseURL: STATIC })).newPage();
  await fresh.goto("/");
  await fresh.getByRole("button", { name: /^Play solo/ }).click();
  await expect(fresh.getByText("No careers yet")).toBeVisible();
  await fresh.getByTestId("solo-import").setInputFiles(file);
  await expect(fresh.getByText("Imported. It is in your list.")).toBeVisible();
  const imported = fresh.locator(".fq-save").filter({ hasText: me });
  await expect(imported).toContainText("Day 2 of 30");
  await imported.getByRole("button", { name: "Continue" }).click();
  await reachDesk(fresh);
  expect(await standings(fresh)).toEqual(after);
  await fresh.context().close();

  // A file that is not a save is refused with a reason, not a crash.
  await page.getByTestId("solo-import").setInputFiles({
    name: "nonsense.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"hello":"world"}'),
  });
  await expect(page.getByRole("alert")).toContainText("not a Funeral Quest Solo save");

  // Delete asks first.
  await row.getByRole("button", { name: "Delete" }).click();
  await row.getByRole("button", { name: "Keep it" }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Delete" }).click();
  await row.getByRole("button", { name: "Delete it" }).click();
  await expect(row).toHaveCount(0);
});

test("the form refuses what the engine would strip, and a closed tab keeps the day", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Play solo/ }).click();
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByLabel("What's your name?").fill("Bo@b");
  await page.getByLabel("What is your parlor called?").fill("Bob's Rest");
  await page.getByRole("radio", { name: "Male", exact: true }).check({ force: true });
  await page.getByRole("button", { name: "open the parlor" }).click();
  await expect(page.getByRole("alert")).toContainText("not allowed in names");
  await page.getByLabel("What's your name?").fill("Bob");
  await page.getByLabel("What is your parlor called?").fill("Bob Rest");
  await page.getByRole("button", { name: "open the parlor" }).click();
  await expect(page.getByText(/has been opened/)).toBeVisible();
  await reachDesk(page);
  // Hide the tab (the browser does this when it is switched away or backgrounded): saved at once.
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(300);
  const stored = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("funeral-quest-solo");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction("saves").objectStore("saves").getAll();
          all.onsuccess = () => resolve(all.result.length);
        };
      }),
  );
  expect(stored).toBe(1);
});

test("a day with seven rivals does not freeze the page", async ({ page }) => {
  test.setTimeout(180_000);
  await startCareer(page, `Sev${unique()}`, {
    rivals: 7,
    difficulty: "Hard",
    endless: true,
  });
  await reachDesk(page);
  // A heartbeat on the page's own thread: if the rivals' day ran here, it would stop.
  await page.evaluate(() => {
    const w = window as unknown as { __gaps: number[]; __last: number };
    w.__gaps = [];
    w.__last = performance.now();
    setInterval(() => {
      const now = performance.now();
      w.__gaps.push(now - w.__last);
      w.__last = now;
    }, 25);
  });
  for (let day = 2; day <= 3; day++) {
    await plaque(page, "End the Day").click();
    await expect(page.getByText(`A new day has dawned. It is day ${day}.`)).toBeVisible({
      timeout: 60_000,
    });
    await reachDesk(page);
  }
  const worst = await page.evaluate(() =>
    Math.max(...(window as unknown as { __gaps: number[] }).__gaps),
  );
  console.log(`longest pause of the page's own thread over two 8-parlor nights: ${worst} ms`);
  expect(worst).toBeLessThan(400);
  // Every rival is in the standings.
  expect((await standings(page)).length).toBe(8);
});

test.describe("offline", () => {
  test.use({ serviceWorkers: "allow" });

  test("an installed app with no connection opens in solo mode and plays", async ({
    page,
    context,
  }) => {
    test.setTimeout(120_000);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "How would you like to play?" })).toBeVisible();
    // The worker keeps the app on install; wait until it controls the page.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);

    await context.setOffline(true);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Not a dead end: the app is there and it is on the list of solo careers.
    await expect(page.getByRole("heading", { name: "Your solo careers" })).toBeVisible();
    await expect(page.getByText("You are offline.")).toBeVisible();

    const me = `Off${unique()}`;
    await page.getByRole("button", { name: "New career" }).click();
    await page.getByLabel("What's your name?").fill(me);
    await page.getByLabel("What is your parlor called?").fill(`${me} Rest`);
    await page.getByRole("radio", { name: "Male", exact: true }).check({ force: true });
    await page.getByRole("button", { name: "open the parlor" }).click();
    await expect(page.getByText(/has been opened/)).toBeVisible();
    await reachDesk(page);
    await plaque(page, "End the Day").click();
    await expect(page.getByText("A new day has dawned. It is day 2.")).toBeVisible();
    await context.setOffline(false);
  });
});
