import { expect, type Page, test } from "@playwright/test";
import { makeASale, plaque, reachDesk } from "./helpers";

/**
 * The solo-only build as GitHub Pages serves it (owner's decision 14): from a sub-path
 * (`/fq-pages/`, like https://<user>.github.io/<repo>/) on a plain file host that has nothing at
 * the root and no server behind it. The "pages" project builds it with
 * `tools/build-pages.mjs --base /fq-pages/` and serves it with `e2e/static-host.mjs --prefix`.
 * Every URL the page, the service worker and the manifest ask for must stay under that path, and
 * a solo day must play.
 */
const PREFIX = "/fq-pages/";

/**
 * The one request the Pages build knowingly cannot answer: the optional character-voice pack is
 * not bundled (its terms are unsettled, and the build ships only the default Synth pack), so the
 * client's best-effort fetch of its manifest is a 404 and the game stays silent for it.
 */
const unbundled = (r: { url: string }) =>
  new URL(r.url).pathname === `${PREFIX}voice/manifest.json`;

/** Everything the page asks for, with what the host answered. */
function watch(page: Page) {
  const requests: { url: string; status: number }[] = [];
  const failed: string[] = [];
  page.on("response", (response) => {
    requests.push({ url: response.url(), status: response.status() });
  });
  page.on("requestfailed", (request) => failed.push(request.url()));
  return { requests, failed };
}

const pathOf = (url: string) => new URL(url).pathname;

test("opens straight on the solo careers, with nothing online and nothing requested outside the sub-path", async ({
  page,
}) => {
  const seen = watch(page);
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Your solo careers" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New career" })).toBeVisible();
  for (const name of [/Play online/, /Log on/, /Play as guest/, /Daily Challenge/, /Rankings/]) {
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  }
  // The title screen's art and fonts arrived, from under the sub-path.
  await expect(page.locator(".fq-lobby-bg")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(seen.failed).toEqual([]);
  const outside = seen.requests.filter((r) => !pathOf(r.url).startsWith(PREFIX));
  expect(outside, "requests outside the sub-path").toEqual([]);
  const missing = seen.requests.filter((r) => r.status >= 400 && !unbundled(r));
  expect(missing, "requests the host could not answer").toEqual([]);
  expect(seen.requests.some((r) => pathOf(r.url).startsWith(`${PREFIX}api`))).toBe(false);
});

test("the root of the host has nothing, as on a project page", async ({ request }) => {
  const origin = new URL(test.info().project.use.baseURL ?? "").origin;
  expect((await request.get(`${origin}/`)).status()).toBe(404);
  expect((await request.get(`${origin}${PREFIX}api/towns`)).status()).toBe(404);
});

test("the manifest, icons, offline page, art and sound are all found under the sub-path", async ({
  page,
  request,
}) => {
  await page.goto("./");
  const href = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(href).toBe(`${PREFIX}manifest.webmanifest`);
  const manifest = await (await request.get(href as string)).json();
  expect(manifest.display).toBe("standalone");
  // The manifest's own relative URLs resolve against where it is.
  const manifestUrl = new URL(href as string, page.url());
  expect(new URL(manifest.start_url, manifestUrl).pathname).toBe(PREFIX);
  expect(new URL(manifest.scope, manifestUrl).pathname).toBe(PREFIX);
  for (const icon of manifest.icons) {
    const response = await request.get(new URL(icon.src, manifestUrl).href);
    expect(response.status(), icon.src).toBe(200);
  }
  const offline = await request.get(`${PREFIX}offline.html`);
  expect(offline.status()).toBe(200);
  expect(await offline.text()).toContain('href="./?solo"');
  expect((await request.get(`${PREFIX}classic/places/bank.svg`)).status()).toBe(200);
  expect((await request.get(`${PREFIX}audio/manifest.json`)).status()).toBe(200);
  // Only the default sound pack ships.
  expect((await request.get(`${PREFIX}audio-studio/manifest.json`)).status()).toBe(404);
});

test("a solo day plays from the sub-path: a sale, the day ends, the next one starts", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const seen = watch(page);
  await page.goto("./");
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByLabel("What's your name?").fill("Paige Sub");
  await page.getByLabel("What is your parlor called?").fill("Subpath Rest");
  await page.getByRole("radio", { name: "Female", exact: true }).check({ force: true });
  await page
    .getByRole("group", { name: "How many rivals?" })
    .getByRole("radio", { name: "2", exact: true })
    .check({ force: true });
  await page.getByRole("button", { name: "open the parlor" }).click();
  await expect(page.getByText(/has been opened/)).toBeVisible();
  // The game's code and the rivals' days run in a worker loaded from under the sub-path.
  await expect.poll(() => page.workers().length).toBeGreaterThan(0);
  for (const worker of page.workers())
    expect(pathOf(worker.url())).toMatch(/^\/fq-pages\/assets\//);

  await reachDesk(page);
  await makeASale(page);
  await reachDesk(page);
  await plaque(page, "End the Day").click();
  await expect(page.getByText("A new day has dawned. It is day 2.")).toBeVisible();
  await reachDesk(page);

  // Reload: straight back into the career, from IndexedDB, still under the sub-path.
  await page.reload();
  await expect(plaque(page, /Wait for Customer|Continue/).first()).toBeVisible();

  // The art of the whole game came from under the sub-path, and nothing asked for anything else.
  const outside = seen.requests.filter((r) => !pathOf(r.url).startsWith(PREFIX));
  expect(outside, "requests outside the sub-path").toEqual([]);
  const missing = seen.requests.filter((r) => r.status >= 400 && !unbundled(r));
  expect(missing, "requests the host could not answer").toEqual([]);
  expect(seen.requests.some((r) => pathOf(r.url).startsWith(`${PREFIX}classic/`))).toBe(true);
  testInfo.annotations.push({ type: "requests", description: String(seen.requests.length) });
});

test.describe("service worker and sound", () => {
  // These two start as a new player does (sound on, not muted) and let the worker run.
  test.use({
    serviceWorkers: "allow",
    storageState: { cookies: [], origins: [] },
  });

  test("the service worker takes the sub-path as its scope and keeps the game for offline play", async ({
    page,
    context,
  }) => {
    await page.goto("./");
    await expect(page.getByRole("heading", { name: "Your solo careers" })).toBeVisible();
    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return new URL(registration.scope).pathname;
    });
    expect(scope).toBe(PREFIX);
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);
    // The install kept the whole app under the sub-path.
    const kept = await page.evaluate(async () => {
      const names = await caches.keys();
      const keys: string[] = [];
      for (const name of names) {
        for (const request of await (await caches.open(name)).keys()) keys.push(request.url);
      }
      return keys;
    });
    expect(kept.length).toBeGreaterThan(50);
    expect(kept.every((url) => new URL(url).pathname.startsWith(PREFIX))).toBe(true);
    expect(kept.some((url) => new URL(url).pathname === PREFIX)).toBe(true);

    await context.setOffline(true);
    await page.goto("./", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your solo careers" })).toBeVisible();
    await context.setOffline(false);
  });

  test("the first click anywhere starts the sound, loaded from under the sub-path", async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === "webkit",
      "WebKit on this host may have no audio output (e2e/audio.spec.ts)",
    );
    const seen = watch(page);
    await page.goto("./");
    await expect(page.getByRole("button", { name: "Mute sound" })).toBeVisible();
    expect(seen.requests.some((r) => pathOf(r.url).startsWith(`${PREFIX}audio/`))).toBe(false);
    await page.mouse.click(8, 8);
    await expect
      .poll(() => seen.requests.some((r) => pathOf(r.url).startsWith(`${PREFIX}audio/`)), {
        timeout: 15_000,
      })
      .toBe(true);
    expect(
      seen.requests.filter(
        (r) => pathOf(r.url).startsWith(PREFIX) && r.status >= 400 && !unbundled(r),
      ),
    ).toEqual([]);
  });
});
