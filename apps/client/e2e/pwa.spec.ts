import { expect, test } from "@playwright/test";

test("the manifest and icons are served, and the page is installable", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe("/manifest.webmanifest");
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});

test.describe("offline", () => {
  test.use({ serviceWorkers: "allow" });

  test("a page load without a connection opens the app in solo mode, not a dead end", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    await expect(page.getByText(/Connected to /)).toBeVisible();
    // The worker installs after the first load; wait for it to control the page.
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.active?.state;
    });
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);

    await context.setOffline(true);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your solo careers" })).toBeVisible();
    await expect(page.getByText("You are offline.")).toBeVisible();
    // Online play says what it needs; the way back to the choice is still there.
    await page.getByRole("button", { name: "Online or solo" }).click();
    await expect(page.getByRole("button", { name: /^Play online/ })).toContainText(
      "You are offline.",
    );
    await context.setOffline(false);
  });

  test("the offline page is still there for a device that kept nothing", async ({ request }) => {
    const response = await request.get("/offline.html");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain("Play solo");
  });
});

test("the production bundle plays against the mock when asked", async ({ page }) => {
  await page.goto("/?mock");
  await expect(page.getByRole("button", { name: "Play As Guest" })).toBeVisible();
  await page.getByRole("button", { name: "Play As Guest" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
});

test("the art the game needs is in the bundle, the animation frames are not", async ({
  request,
}) => {
  expect((await request.get("/classic/places/bank.svg")).status()).toBe(200);
  expect((await request.get("/classic/wait.svg")).status()).toBe(200);
  const frame = await request.get("/classic/wait.frames/0001.svg");
  // The single-page fallback answers unknown paths with the app shell, never with a frame.
  expect(frame.headers()["content-type"]).not.toContain("image/svg");
});

test("the front door has no link to the original client when the server has it off", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/Connected to /)).toBeVisible();
  await expect(page.locator("[data-museum-link]")).toHaveCount(0);
  expect((await page.request.get("/api/features")).ok()).toBe(true);
  expect((await page.request.get("/museum/")).status()).toBe(404);
});
