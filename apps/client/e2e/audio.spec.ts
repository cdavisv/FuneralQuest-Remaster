import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

// Every other spec starts muted so a test run is silent (playwright.config.ts); these are the
// ones that listen, so they start as a new player does: sound on, saved choice none.
test.use({
  storageState: {
    cookies: [],
    origins: ["FQ_E2E_PORT", "FQ_E2E_MUSEUM_PORT", "FQ_E2E_EXPANDED_PORT"].map((name) => ({
      origin: `http://127.0.0.1:${process.env[name]}`,
      localStorage: [{ name: "fq.conduct", value: "2" }],
    })),
  },
});

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
/** True when this Linux host has somewhere to play sound: a sound server socket or an ALSA card. */
function hasAudioOutput(): boolean {
  const runtime = process.env.XDG_RUNTIME_DIR ?? `/run/user/${process.getuid?.() ?? 0}`;
  if (existsSync(`${runtime}/pulse/native`) || existsSync(`${runtime}/pipewire-0`)) return true;
  try {
    // A sound server started without a runtime directory (as on a CI runner) still answers here.
    execFileSync("pactl", ["info"], { stdio: "ignore", timeout: 3000 });
    return true;
  } catch {
    // no sound server; fall through to ALSA
  }
  try {
    return /^\s*\d+\s/m.test(readFileSync("/proc/asound/cards", "utf8"));
  } catch {
    return false;
  }
}

function skipWithoutAudio(browserName: string): void {
  if (process.platform !== "linux") return;
  // Firefox and WebKit leave an AudioContext suspended on a machine with no audio output at all
  // (a bare CI runner); Chromium falls back to a null sink. CI starts a silent PulseAudio sink
  // for these two (see .github/workflows/ci.yml), so the tests run there.
  test.skip(
    browserName !== "chromium" && !hasAudioOutput(),
    "this host has no audio output (no PulseAudio or PipeWire socket, no ALSA card): the browser cannot start an AudioContext here",
  );
  if (browserName !== "webkit") return;
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
test("music starts after the first click anywhere on the front door and changes on the map", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  skipWithoutAudio(browserName);
  // Nothing before an interaction: no AudioContext has been made.
  expect(await probe(page)).toBeNull();

  // Sound is on by default: the mute control says so before anything has been heard.
  await expect(page.getByRole("button", { name: "Mute sound" })).toBeVisible();
  // The first click anywhere starts the audio, not only a button made for it.
  await page.mouse.click(8, 8);
  await expect.poll(async () => (await probe(page))?.context).toBe("running");
  await expect.poll(async () => (await probe(page))?.music, { timeout: 15_000 }).toBe("main");
  // The analyser hears it: well above the silence floor.
  await expect
    .poll(async () => (await probe(page))?.level ?? -120, { timeout: 10_000 })
    .toBeGreaterThan(-50);
  await expect(page.getByRole("button", { name: "Mute sound" })).toBeVisible();

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

test("the mute button mutes, suspends the audio, and the choice is kept", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  skipWithoutAudio(browserName);
  await expect(page.getByText(/Connected to /)).toBeVisible();
  await page.mouse.click(8, 8);
  await expect.poll(async () => (await probe(page))?.context).toBe("running");
  await page.getByRole("button", { name: "Mute sound" }).click();
  await expect.poll(async () => (await probe(page))?.context).toBe("suspended");
  // the choice persists: after a reload it is still muted, and the first click does not undo it
  await page.reload();
  await expect(page.getByRole("button", { name: "Unmute sound" })).toBeVisible();
  await page.mouse.click(8, 8);
  await expect.poll(async () => (await probe(page))?.context).toBe("suspended");
  await expect(page.getByRole("button", { name: "Unmute sound" })).toBeVisible();
  // and unmuting brings it back
  await page.getByRole("button", { name: "Unmute sound" }).click();
  await expect.poll(async () => (await probe(page))?.context).toBe("running");
});

test("the mute control is on the game's own screens too, not only the front door", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText(/Connected to /)).toBeVisible();
  await page.getByRole("button", { name: /^Play online/ }).click();
  const me = newPlayer("mut");
  await signUp(page, me);
  await createParlor(page, me);
  await reachDesk(page);
  const mute = page.getByRole("button", { name: "Mute sound" });
  await expect(mute).toBeVisible();
  await mute.click();
  await expect(page.getByRole("button", { name: "Unmute sound" })).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByLabel("Mute all sound")).toBeChecked();
});
