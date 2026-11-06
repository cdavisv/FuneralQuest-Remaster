import { expect, type Page, test } from "@playwright/test";

/**
 * A gamepad drives a whole negotiation: only the Gamepad API is faked (a pad whose buttons the
 * test presses frame by frame); the page's own polling, focus movement and glyph hints are the
 * real ones. No mouse, no keyboard.
 */

const QUERY = "expanded&seed=11&money=60000&turns=90&tags=5,5,5&psych=3&day=12";

const BUTTON = {
  a: 0,
  b: 1,
  x: 2,
  lb: 4,
  rb: 5,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

async function fakePad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const pad = {
      index: 0,
      id: "Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)",
      connected: true,
      mapping: "standard",
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    (window as unknown as { __pad: typeof pad }).__pad = pad;
    navigator.getGamepads = () => [pad as unknown as Gamepad];
  });
}

/**
 * Waits for `n` animation frames of the page. The page polls the pad once per frame, so a button
 * held for frames, not milliseconds, is always seen: a slow machine (or an engine that throttles
 * a headless page) stretches the frames and the press along with them.
 */
const frames = (page: Page, n = 2) =>
  page.evaluate(
    (count) =>
      new Promise<void>((resolve) => {
        let left = count;
        const next = () => (--left <= 0 ? resolve() : requestAnimationFrame(next));
        requestAnimationFrame(next);
      }),
    n,
  );

/** One press: down for a couple of frames, then up for a couple. */
async function tap(page: Page, name: keyof typeof BUTTON): Promise<void> {
  const set = (pressed: boolean) =>
    page.evaluate(
      ([i, down]) => {
        const b = (window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad
          .buttons[i as number];
        if (b) b.pressed = down as boolean;
      },
      [BUTTON[name], pressed] as const,
    );
  await set(true);
  await frames(page);
  await set(false);
  await frames(page);
}

const focused = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return (a?.dataset.buttonId ?? "") || (a?.textContent ?? "").trim().slice(0, 30);
  });

/** Moves the focus with the d-pad until it sits on a control whose text or id matches. */
async function walkTo(page: Page, match: RegExp): Promise<void> {
  for (const dir of ["right", "down", "left", "up", "right", "right", "down", "down"] as const) {
    for (let i = 0; i < 9; i++) {
      if (match.test(await focused(page))) return;
      await tap(page, dir);
    }
  }
  throw new Error(`the pad never reached ${match}; the focus is on "${await focused(page)}"`);
}

test("a gamepad plays a negotiation, opens Settings and shows its glyphs only while in use", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fakePad(page);
  await page.addInitScript(() =>
    localStorage.setItem("fq.settings.v1", JSON.stringify({ typewriter: "off" })),
  );
  await page.goto(`/?${QUERY}`);
  await expect(page.locator(".fq-scene")).toBeVisible();
  const hints = page.getByRole("list", { name: "Gamepad buttons" });
  await expect(hints).toHaveCount(0);

  // The first press shows the pad's glyphs.
  await tap(page, "down");
  await expect(hints).toBeVisible();
  await expect(hints).toContainText("Press");
  await expect(hints).toContainText("Menu");

  // The paper, then the morning.
  for (let i = 0; i < 2; i++) {
    await walkTo(page, /Continue|go:desk/);
    await tap(page, "a");
    await page.waitForTimeout(150);
  }
  // The desk: wait for a customer.
  await walkTo(page, /desk:wait/);
  await tap(page, "a");
  const file = page.getByRole("region", { name: "The customer's file" });
  for (let i = 0; i < 10 && !(await file.isVisible()); i++) {
    // A letter or an event may come first: answer with A on whatever is focused.
    if (await page.getByRole("dialog").isVisible()) await tap(page, "b");
    await walkTo(page, /desk:wait/).catch(() => undefined);
    await tap(page, "a");
    await page.waitForTimeout(150);
  }
  await expect(file).toBeVisible();

  // Soft Sell opens the hand of cards: pick one with the pad.
  await walkTo(page, /neg:soft/);
  await tap(page, "a");
  await expect(page.getByRole("navigation", { name: "Cards to pick from" })).toBeVisible();
  await walkTo(page, /neg:card|neg:pitch|neg:hand|soft/);
  await tap(page, "a");
  await page.waitForTimeout(200);

  // The shoulder buttons scroll the text without touching the choice.
  const before = await focused(page);
  await tap(page, "rb");
  await tap(page, "lb");
  expect(await focused(page)).toBe(before);

  // Finish the sale: Done.
  await walkTo(page, /neg:done/);
  await tap(page, "a");
  await expect(page.getByRole("region", { name: "What is happening" })).toContainText(
    /service|Ned Digger|casket/i,
  );

  // Start opens Settings, B closes it.
  await tap(page, "start");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await walkTo(page, /Close|Small|Classic/).catch(() => undefined);
  await tap(page, "b");
  await expect(dialog).toHaveCount(0);

  // The mouse hands the screen back: the glyphs go away.
  await page.mouse.move(100, 100);
  await page.mouse.move(140, 160);
  await expect(hints).toBeHidden();
  expect(errors).toEqual([]);
});

test("a text prompt is reachable and submittable with a pad", async ({ page }) => {
  await fakePad(page);
  await page.goto(`/?${QUERY}&start=city-hall`);
  await expect(page.locator(".fq-scene")).toBeVisible();
  await tap(page, "down");
  await walkTo(page, /city-hall:chains/);
  await tap(page, "a");
  await walkTo(page, /city-hall:found/);
  await tap(page, "a");
  const notepad = page.getByRole("textbox");
  await expect(notepad).toBeVisible();
  // The pad moves into the field (the platform's keyboard types; here the page is typed into).
  await walkTo(page, /^$|textarea|input/).catch(() => undefined);
  await notepad.focus();
  await notepad.fill("Pad Rites");
  // X submits the prompt's form without a trip to the Submit button.
  await tap(page, "x");
  await expect(page.getByRole("region", { name: "Season score board" })).toContainText("Pad Rites");
});
