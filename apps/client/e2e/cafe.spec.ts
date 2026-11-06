import { expect, test } from "@playwright/test";
import { newPlayer, plaque, startGame } from "./helpers";

test("two players in the cafe: lines arrive without disturbing what is being typed", async ({
  browser,
}) => {
  const alice = newPlayer("alice");
  const bob = newPlayer("bob");
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await startGame(a, alice);
  await startGame(b, bob);

  for (const page of [a, b]) {
    await plaque(page, "Town Map").click();
    await page.getByRole("button", { name: /Go to Pale Horse Cafe/ }).click();
    await expect(page.getByRole("textbox", { name: "Say something" })).toBeVisible();
  }

  // Bob has started typing a line when Alice speaks.
  const bobBox = b.getByRole("textbox", { name: "Say something" });
  await bobBox.click();
  await bobBox.pressSequentially("I was about to say");

  const aliceBox = a.getByRole("textbox", { name: "Say something" });
  await aliceBox.fill("hello from Alice");
  await aliceBox.press("Enter");

  const bobLog = b.getByRole("list", { name: "Conversation" });
  await expect(bobLog).toContainText("hello from Alice");
  await expect(bobBox).toHaveValue("I was about to say");
  await expect(bobBox).toBeFocused();

  // Bob finishes his sentence; Alice sees it, and her own line stays in her transcript.
  await bobBox.pressSequentially(" that");
  await bobBox.press("Enter");
  await expect(a.getByRole("list", { name: "Conversation" })).toContainText(
    "I was about to say that",
  );
  await expect(a.getByRole("list", { name: "Conversation" })).toContainText("hello from Alice");
  await expect(bobBox).toHaveValue("");

  // A slash command is just text: it goes to the server like any line, and the cafe carries on.
  await aliceBox.fill("/who");
  await aliceBox.press("Enter");
  await expect(aliceBox).toHaveValue("");
  await expect(a.getByRole("textbox", { name: "Say something" })).toBeVisible();

  await a.context().close();
  await b.context().close();
});
