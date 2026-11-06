import { type Browser, expect, type Page, test } from "@playwright/test";
import { ADMIN_TOKEN, newPlayer, PASSWORD, type Player, plaque, startGame } from "./helpers";

/**
 * Player safety against the real server: blocking in the cafe, a report reaching the moderators'
 * page, deleting an account, and the notice players agree to before online play.
 */

async function playerInCafe(browser: Browser, player: Player): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await startGame(page, player);
  await plaque(page, "Town Map").click();
  await page.getByRole("button", { name: /Go to Pale Horse Cafe/ }).click();
  await expect(page.getByRole("textbox", { name: "Say something" })).toBeVisible();
  return page;
}

async function say(page: Page, text: string): Promise<void> {
  const box = page.getByRole("textbox", { name: "Say something" });
  await box.fill(text);
  await box.press("Enter");
}

const log = (page: Page) => page.getByRole("list", { name: "Conversation" });

test("blocking a player in the cafe: their lines stop reaching you and keep reaching everyone else", async ({
  browser,
}) => {
  const alice = newPlayer("alice");
  const bob = newPlayer("bob");
  const carol = newPlayer("carol");
  const a = await playerInCafe(browser, alice);
  const b = await playerInCafe(browser, bob);
  const c = await playerInCafe(browser, carol);

  await say(b, "first words from bob");
  await expect(log(a)).toContainText("first words from bob");
  await expect(log(c)).toContainText("first words from bob");
  // Others' lines carry the menu; your own do not.
  await say(c, "hello from carol");
  await expect(log(b)).toContainText("hello from carol");
  await expect(b.getByRole("button", { name: `Report or block ${carol.name}` })).toBeVisible();
  await expect(log(b)).toContainText("first words from bob");
  await expect(b.getByRole("button", { name: `Report or block ${bob.name}` })).toHaveCount(0);

  // Alice blocks bob from his line.
  await a.getByRole("button", { name: `Report or block ${bob.name}` }).click();
  await a.getByRole("button", { name: "Block", exact: true }).click();
  const dialog = a.getByRole("dialog", { name: /^Block/ });
  await expect(dialog).toContainText("stop them visiting or fighting you");
  await dialog.getByRole("button", { name: "Block", exact: true }).click();
  await expect(dialog).toContainText("is blocked");
  await dialog.getByRole("button", { name: "Close" }).click();

  await say(b, "second words from bob");
  await expect(log(c)).toContainText("second words from bob");
  await a.waitForTimeout(500);
  await expect(log(a)).not.toContainText("second words from bob");
  // It is one way: bob still hears alice, and carol's talk reaches alice.
  await say(a, "alice speaking");
  await expect(log(b)).toContainText("alice speaking");
  await say(c, "carol speaking");
  await expect(log(a)).toContainText("carol speaking");

  // The block is listed in Settings, and lifting it brings bob's lines back.
  await a.getByRole("button", { name: "Settings" }).click();
  const settings = a.getByRole("dialog", { name: "Settings" });
  await expect(settings.getByText(bob.name)).toBeVisible();
  await settings.getByRole("button", { name: `Unblock ${bob.name}` }).click();
  await expect(settings.getByText("Nobody is blocked.")).toBeVisible();
  await settings.getByRole("button", { name: "Close" }).click();
  await say(b, "third words from bob");
  await expect(log(a)).toContainText("third words from bob");

  for (const p of [a, b, c]) await p.context().close();
});

test("a report filed in the cafe appears, with its evidence, on the moderators' page", async ({
  browser,
}) => {
  const alice = newPlayer("rptr");
  const bob = newPlayer("rptd");
  const a = await playerInCafe(browser, alice);
  const b = await playerInCafe(browser, bob);
  await say(a, "a line before");
  await say(b, "an unkind remark about funerals");
  await say(b, "a line after");
  await expect(log(a)).toContainText("a line after");

  await a
    .getByRole("button", { name: `Report or block ${bob.name}` })
    .first()
    .click();
  await a.getByRole("button", { name: "Report", exact: true }).click();
  const form = a.getByRole("dialog", { name: "Report to the moderators" });
  await expect(form).toContainText("an unkind remark about funerals");
  await form.getByRole("radio", { name: "Harassment or bullying" }).check({ force: true });
  await form.getByLabel(/Anything else/).fill("e2e: please look");
  await form.getByRole("button", { name: "Send report" }).click();
  await expect(form.getByRole("status")).toContainText("Thank you");
  await expect(form).toContainText(`Do you also want to block ${bob.name}?`);
  await form.getByRole("button", { name: "Close" }).click();

  // The moderators' page: plain, behind the admin token.
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/admin/");
  await expect(admin.getByRole("heading", { name: "Funeral Quest moderation" })).toBeVisible();
  await admin.getByPlaceholder("Admin token").fill("not the token at all, not at all");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await expect(admin.getByText("The admin token was refused.")).toBeVisible();
  await admin.getByPlaceholder("Admin token").fill(ADMIN_TOKEN);
  await admin.getByPlaceholder(/Your name/).fill("e2e moderator");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await admin.getByRole("button", { name: "Reports", exact: true }).click();
  const row = admin.getByRole("row").filter({ hasText: "an unkind remark about funerals" });
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(admin.getByRole("heading", { name: /^Report \d+/ })).toBeVisible();
  await expect(admin.getByText("e2e: please look")).toBeVisible();
  await expect(admin.getByText(alice.login)).toBeVisible(); // the reporter, for moderators only
  const evidence = admin.getByRole("heading", { name: "The cafe around that line" }).locator("..");
  await expect(evidence).toContainText("a line before");
  await expect(evidence).toContainText("an unkind remark about funerals");
  await expect(evidence).toContainText("a line after");

  // The reported player cannot see any of this.
  await expect(log(b)).not.toContainText("e2e: please look");

  for (const p of [a, b, admin]) await p.context().close();
});

test("deleting an account from Settings: back at the front door, gone from the rankings, cannot log in", async ({
  browser,
}) => {
  const alice = newPlayer("seen");
  const bob = newPlayer("gone");
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await startGame(a, alice);
  await startGame(b, bob);

  await plaque(a, "Rankings").click();
  const table = a.getByRole("table", { name: "Rankings" });
  await expect(table).toContainText(bob.name);
  // The player's own row has no menu, another parlor's does.
  await expect(a.getByRole("button", { name: `Report or block ${alice.name}` })).toHaveCount(0);
  await expect(a.getByRole("button", { name: `Report or block ${bob.name}` })).toBeVisible();

  await b.getByRole("button", { name: "Settings" }).click();
  await b.getByRole("button", { name: "Delete my account" }).click();
  const confirm = b.getByRole("dialog", { name: "Delete your account?" });
  await confirm.getByLabel("Your password").fill("not my password");
  await confirm.getByRole("button", { name: "Delete for good" }).click();
  await expect(confirm.getByRole("alert")).toContainText("That password is not right.");
  await confirm.getByLabel("Your password").fill(PASSWORD);
  await confirm.getByRole("button", { name: "Delete for good" }).click();

  // The front door, with a word about it.
  await expect(b.getByText("Please enter your name and password")).toBeVisible();
  await expect(b.getByText("Your account has been deleted.")).toBeVisible();

  // The name is gone from the rankings the other player sees, and from the public lobby.
  await a.reload();
  await a
    .getByRole("button", { name: /Open the parlor|Continue/ })
    .first()
    .click();
  await plaque(a, "Rankings")
    .click({ timeout: 15_000 })
    .catch(async () => {
      await a
        .getByRole("button", { name: /Continue/ })
        .first()
        .click();
      await plaque(a, "Rankings").click();
    });
  await expect(a.getByRole("table", { name: "Rankings" })).toContainText(alice.name);
  await expect(a.getByRole("table", { name: "Rankings" })).not.toContainText(bob.name);
  const lobby = await a.request.get("/api/towns");
  expect(await lobby.text()).not.toContain(bob.name);

  // The account is gone: logging in fails.
  await b.getByLabel("Name", { exact: true }).fill(bob.login);
  await b.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await b.getByRole("button", { name: "Log on" }).click();
  await expect(b.getByText("Wrong name or password.")).toBeVisible();

  await a.context().close();
  await b.context().close();
});

test.describe("the notice before online play", () => {
  // A player who has not yet agreed to anything.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("is asked once, links to the rules, and is remembered", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Connected to /)).toBeVisible();
    await page.getByRole("button", { name: /^Play online/ }).click();
    const gate = page.getByTestId("conduct-gate");
    await expect(gate).toContainText("It is a comedy about death");
    await expect(gate).toContainText("[MINIMUM AGE - OWNER TO FILL IN]");
    await expect(page.getByRole("button", { name: "Log on" })).toHaveCount(0);

    // The rules are one click away, and back again.
    await gate.getByRole("button", { name: "Read the house rules" }).click();
    await expect(page.getByRole("heading", { name: "House rules for online play" })).toBeVisible();
    await page.getByRole("button", { name: "Back to the front door" }).click();
    await page
      .getByTestId("conduct-gate")
      .getByRole("button", { name: "I agree. Open the doors" })
      .click();
    await expect(page.getByRole("button", { name: "Log on" })).toBeVisible();

    await page.reload();
    await expect(page.getByText(/Connected to /)).toBeVisible();
    await page.getByRole("button", { name: /^Play online/ }).click();
    await expect(page.getByRole("button", { name: "Log on" })).toBeVisible();
    await expect(page.getByTestId("conduct-gate")).toHaveCount(0);
  });
});
