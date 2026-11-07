import { expect, type Page, test } from "@playwright/test";
import {
  createParlor,
  logOn,
  newPlayer,
  openFrontDoor,
  PASSWORD,
  plaque,
  reachDesk,
} from "./helpers";

/**
 * Decision 7 (2026-11-06): a guest plays, reads and visits, but typing for other people needs a
 * free account. The client shows those inputs as unavailable, the server refuses them, and a
 * guest can become a full account without losing the parlor.
 */

const token = (page: Page) => page.evaluate(() => localStorage.getItem("fq.token.v1"));

async function guestAtDesk(page: Page, me: ReturnType<typeof newPlayer>): Promise<void> {
  await openFrontDoor(page);
  await page.getByRole("button", { name: "Play as guest" }).click();
  await createParlor(page, me);
  await reachDesk(page);
}

test("a guest reads the cafe but cannot talk in it, and the server says the same", async ({
  browser,
}) => {
  const me = newPlayer("gst");
  const page = await (await browser.newContext()).newPage();
  await guestAtDesk(page, me);

  await plaque(page, "Town Map").click();
  await page.getByRole("button", { name: /Go to Pale Horse Cafe/ }).click();
  const box = page.getByRole("textbox", { name: "Say something" });
  await expect(box).toBeDisabled();
  await expect(box).toHaveAttribute("placeholder", "Sign up to chat");
  await expect(page.getByRole("button", { name: "Sign up free" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send" })).toHaveCount(0);
  // The transcript is there to read.
  await expect(page.getByRole("list", { name: "Conversation" })).toBeVisible();

  // The server refuses it whatever the client shows, with the reason and how to fix it.
  const towns = (await (await page.request.get("/api/towns")).json()) as {
    towns: { id: string }[];
  };
  const townId = towns.towns[0]?.id ?? "main";
  const refused = await page.request.post(`/api/towns/${townId}/action`, {
    headers: { authorization: `Bearer ${await token(page)}` },
    data: { action: { type: "chat", text: "hello" } },
  });
  expect(refused.status()).toBe(403);
  const body = (await refused.json()) as { error: string; message: string };
  expect(body.error).toBe("guest_text");
  expect(body.message).toContain("free account");
  expect(body.message).toContain("Make this a full account");
  await page.context().close();
});

test("a guest who tries to write a letter is told why, and the desk carries on", async ({
  browser,
}) => {
  const me = newPlayer("gml");
  const page = await (await browser.newContext()).newPage();
  await guestAtDesk(page, me);

  await plaque(page, "Write Letter").click();
  const dialog = page.getByRole("dialog", { name: "A free account is needed" });
  await expect(dialog).toContainText("Guests cannot write letters");
  await expect(dialog).toContainText("your parlor comes with you");
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Never mind" }).click();
  await expect(dialog).toBeHidden();
  await expect(plaque(page, "Wait for Customer")).toBeVisible();
  await page.context().close();
});

test("a guest can make a full account in place: same parlor, then chat works and the new log-on finds it", async ({
  browser,
}) => {
  const me = newPlayer("cnv");
  const page = await (await browser.newContext()).newPage();
  await guestAtDesk(page, me);

  // From Settings, to guests only.
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("button", { name: "Make this a full account" }).click();
  const form = page.getByRole("dialog", { name: "Make this a full account" });
  await form.getByLabel("Log-on name").fill(me.login);
  await form.getByLabel("Password").fill(PASSWORD);
  await form.getByRole("button", { name: "Make my account" }).click();
  const done = page.getByRole("dialog", { name: "You have a full account" });
  await expect(done).toContainText("You can now chat");
  await done.getByRole("button", { name: "Close" }).click();
  await settings.getByRole("button", { name: "Close" }).click();
  // The entry is gone for a full account.
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Settings" })
      .getByRole("button", { name: "Make this a full account" }),
  ).toHaveCount(0);
  await page
    .getByRole("dialog", { name: "Settings" })
    .getByRole("button", { name: "Close" })
    .click();

  // Chat is open now, in the same game.
  await plaque(page, "Town Map").click();
  await page.getByRole("button", { name: /Go to Pale Horse Cafe/ }).click();
  const box = page.getByRole("textbox", { name: "Say something" });
  await expect(box).toBeEnabled();
  await box.fill("hello from a new member");
  await box.press("Enter");
  await expect(page.getByRole("list", { name: "Conversation" })).toContainText(
    "hello from a new member",
  );

  // Leave, and log back on with the new name from a fresh browser: the same parlor is waiting.
  await page.context().close();
  const again = await (await browser.newContext()).newPage();
  await openFrontDoor(again);
  await logOn(again, me);
  await expect(again.getByRole("button", { name: "Settings" })).toBeVisible();
  await again.getByRole("button", { name: "Settings" }).click();
  const settingsAgain = again.getByRole("dialog", { name: "Settings" });
  await expect(settingsAgain.getByRole("button", { name: "Download my data" })).toBeVisible();
  await expect(settingsAgain.getByRole("button", { name: "Make this a full account" })).toHaveCount(
    0,
  );
  await again.context().close();
});
