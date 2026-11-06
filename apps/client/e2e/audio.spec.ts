import { expect, type Page, test } from "@playwright/test";
import { createParlor, newPlayer, plaque, reachDesk, signUp } from "./helpers.js";

/**
 * Sound, checked through the Web Audio graph rather than by ear: `window.__fqAudio.debug()`
 * reports the AudioContext's state, the music and ambience the backend is playing, and the
 * output level from an analyser node. Headless Chromium plays to a null sink, so this runs in CI.
 */
interface Debug {
  context: string;
  music: string | null;
  ambience: string | null;
  level: number;
  missing: string[];
}

const probe = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __fqAudio?: { debug(): Debug } }).__fqAudio?.debug() ?? null,
  );

test.use({ launchOptions: { args: ["--autoplay-policy=user-gesture-required"] } });

test("music starts after the first click on the front door and changes on the map", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/Connected to /)).toBeVisible();
  // Nothing before an interaction: no AudioContext has been made.
  expect(await probe(page)).toBeNull();

  await page.getByRole("button", { name: "Sound on" }).click();
  await expect.poll(async () => (await probe(page))?.context).toBe("running");
  await expect.poll(async () => (await probe(page))?.music, { timeout: 15_000 }).toBe("main");
  // The analyser hears it: well above the silence floor.
  await expect
    .poll(async () => (await probe(page))?.level ?? -120, { timeout: 10_000 })
    .toBeGreaterThan(-50);
  await expect(page.getByRole("button", { name: "Sound off" })).toBeVisible();

  // Into the game, to the desk, then the map.
  await page.getByRole("button", { name: /^Play online/ }).click();
  const me = newPlayer("snd");
  await signUp(page, me);
  await createParlor(page, me);
  await reachDesk(page);
  await expect.poll(async () => (await probe(page))?.music, { timeout: 15_000 }).toBe("desk");
  await plaque(page, "Town Map").click();
  await expect.poll(async () => (await probe(page))?.music, { timeout: 15_000 }).toBe("town");
  await expect
    .poll(async () => (await probe(page))?.level ?? -120, { timeout: 10_000 })
    .toBeGreaterThan(-50);
  expect((await probe(page))?.missing).toEqual([]);
});

test("the front door's sound button mutes, and the mute suspends the audio", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Connected to /)).toBeVisible();
  await page.getByRole("button", { name: "Sound on" }).click();
  await expect.poll(async () => (await probe(page))?.context).toBe("running");
  await page.getByRole("button", { name: "Sound off" }).click();
  await expect.poll(async () => (await probe(page))?.context).toBe("suspended");
  // the choice persists
  await page.reload();
  await expect(page.getByRole("button", { name: "Sound on" })).toBeVisible();
});
