import { existsSync } from "node:fs";
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

/**
 * Playwright's WebKit on Linux plays and decodes sound through the system's GStreamer. Without
 * gst-plugins-good (the audio sink, and the MP4 demuxer the AAC files need; `playwright install
 * --with-deps webkit` installs it on Ubuntu, which is what CI does) an AudioContext never starts
 * and the AAC files cannot be decoded, so no sound can play. That is the host's gap, not the
 * page's, and Safari has neither: the test says so and skips. Asked of the plug-in files rather
 * than of the page, because a WebKit that lacks them can hang inside the call that would tell.
 */
function skipWithoutAudio(browserName: string): void {
  if (browserName !== "webkit" || process.platform !== "linux") return;
  const dirs = [
    "/usr/lib/gstreamer-1.0",
    "/usr/lib64/gstreamer-1.0",
    "/usr/lib/x86_64-linux-gnu/gstreamer-1.0",
    "/usr/lib/aarch64-linux-gnu/gstreamer-1.0",
  ];
  const has = (file: string) => dirs.some((dir) => existsSync(`${dir}/${file}`));
  test.skip(
    !(has("libgstisomp4.so") && has("libgstautodetect.so")),
    "this host's GStreamer has no gst-plugins-good (isomp4, autodetect): WebKit cannot decode AAC or open an audio output here",
  );
}

// Chromium is started with the autoplay policy of a real browser (sound only after a gesture) by
// playwright.config.ts; Firefox and WebKit enforce theirs by default.
test("music starts after the first click on the front door and changes on the map", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  skipWithoutAudio(browserName);
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

test("the front door's sound button mutes, and the mute suspends the audio", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  skipWithoutAudio(browserName);
  await expect(page.getByText(/Connected to /)).toBeVisible();
  await page.getByRole("button", { name: "Sound on" }).click();
  await expect.poll(async () => (await probe(page))?.context).toBe("running");
  await page.getByRole("button", { name: "Sound off" }).click();
  await expect.poll(async () => (await probe(page))?.context).toBe("suspended");
  // the choice persists
  await page.reload();
  await expect(page.getByRole("button", { name: "Sound on" })).toBeVisible();
});
