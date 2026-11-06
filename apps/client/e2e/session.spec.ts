import { expect, test } from "@playwright/test";
import {
  createParlor,
  logOn,
  newPlayer,
  openFrontDoor,
  plaque,
  reachDesk,
  signUp,
} from "./helpers";

test("a second log-in elsewhere ends the first session cleanly", async ({ browser }) => {
  const me = newPlayer("twice");
  const first = await (await browser.newContext()).newPage();
  await openFrontDoor(first);
  await signUp(first, me);
  await createParlor(first, me);
  await reachDesk(first);

  // The same account logs on from another browser.
  const second = await (await browser.newContext()).newPage();
  await openFrontDoor(second);
  await logOn(second, me);
  await reachDesk(second);

  // The first window says why it stopped, and offers the way back.
  const ended = first.getByRole("alert").filter({ hasText: "Your session has ended" });
  await expect(ended).toBeVisible();
  await expect(ended).toContainText("logged on somewhere else");
  await expect(first.locator(".fq-plaque")).toHaveCount(0);

  // The second one is unaffected.
  await expect(plaque(second, "Wait for Customer")).toBeVisible();

  await first.getByRole("button", { name: "Back to the front door" }).click();
  await expect(first.getByText(`Welcome back, ${me.name}.`)).toBeVisible();

  await first.context().close();
  await second.context().close();
});

test("the desk's own Exit choice goes straight back to the front door", async ({ browser }) => {
  const me = newPlayer("leaver");
  const page = await (await browser.newContext()).newPage();
  await openFrontDoor(page);
  await signUp(page, me);
  await createParlor(page, me);
  await reachDesk(page);
  await plaque(page, "Exit").click();
  await expect(page.getByText(`Welcome back, ${me.name}.`)).toBeVisible();
  await expect(page.getByText("Your session has ended")).toBeHidden();
  await page.context().close();
});
