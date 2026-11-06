import { expect, test } from "@playwright/test";
import { admin, goTo, newPlayer, plaque, startGame, TOWN } from "./helpers";

test("a sysop message is a toast, a new day is a banner", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await startGame(page, newPlayer("notice"));

  await admin(page, "POST", `/admin/towns/${TOWN}/broadcast`, { message: "The sysop says hello." });
  const toast = page.locator(".fq-toast", { hasText: "The sysop says hello." });
  await expect(toast).toBeVisible();
  // It does not take over the screen: the desk is still usable under it.
  await expect(plaque(page, "Wait for Customer")).toBeVisible();
  await toast.getByRole("button", { name: "Dismiss" }).click();
  await expect(toast).toBeHidden();

  const before = (await (await page.request.get("/api/towns/main")).json()).day as number;
  await admin(page, "POST", `/admin/towns/${TOWN}/new-day`);
  await expect(page.getByText(`A new day has dawned. It is day ${before + 1}.`)).toBeVisible();
  await page.context().close();
});

test("letters: the indicator appears, and the desk reads them one overlay at a time", async ({
  browser,
}) => {
  const alice = newPlayer("mailer");
  const bob = newPlayer("reader");
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await startGame(a, alice);
  await startGame(b, bob);

  // Bob walks to the map so the letter waits for him.
  await plaque(b, "Town Map").click();

  // Alice writes to Bob: who, which Bob, then the letter itself.
  await plaque(a, "Write Letter").click();
  await a.getByRole("textbox").fill(bob.name);
  await a.getByRole("button", { name: "Submit" }).click();
  await a.getByRole("button", { name: "Yes" }).click();
  await a.getByRole("textbox").fill("Dear Bob, the funerals are slow this week.");
  await a.getByRole("button", { name: "Submit" }).click();
  await expect(plaque(a, "Wait for Customer")).toBeVisible();

  // Bob is told, without being interrupted.
  const indicator = b.getByRole("status").filter({ hasText: /letter/ });
  await expect(indicator).toContainText("1 letter is waiting at your desk");

  // At the desk the letter arrives as overlays: the server's news, then the letter with a reply question.
  await b.getByRole("button", { name: /Go to Your Parlor/ }).click();
  const dialog = b.getByRole("dialog");
  await expect(dialog).toContainText("Dear Bob, the funerals are slow this week.");
  await expect(dialog).toContainText("Reply to this letter?");
  await dialog.getByRole("button", { name: "No" }).click();
  await expect(dialog).toBeHidden();
  await expect(indicator).toBeHidden();
  await expect(plaque(b, "Wait for Customer")).toBeVisible();

  await a.context().close();
  await b.context().close();
});

test("being kicked shows why and offers the front door", async ({ browser }) => {
  const me = newPlayer("kicked");
  const page = await (await browser.newContext()).newPage();
  await startGame(page, me);
  await goTo(page, /Go to Bank/);

  const players = (await admin(page, "GET", `/admin/towns/${TOWN}/players?search=${me.login}`)) as {
    players: { id: number; name: string }[];
  };
  const mine = players.players.find((p) => p.name === me.name);
  expect(mine).toBeTruthy();
  await admin(page, "POST", `/admin/towns/${TOWN}/players/${mine?.id}/kick`);

  const ended = page.getByRole("alert").filter({ hasText: "Your session has ended" });
  await expect(ended).toContainText("asked you to leave");
  await page.getByRole("button", { name: "Back to the front door" }).click();
  await expect(page.getByText(`Welcome back, ${me.name}.`)).toBeVisible();
  await page.context().close();
});

test("a dropped push connection is shown calmly and repaired", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Sit between the page and the server's socket so the test can drop it.
  let drop: (() => void) | null = null;
  await page.routeWebSocket(/\/api\/ws/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => server.send(message));
    server.onMessage((message) => ws.send(message));
    drop = () => {
      void ws.close({ code: 1006, reason: "test drop" });
      void server.close();
    };
  });
  await startGame(page, newPlayer("flaky"));
  await expect.poll(() => drop !== null).toBe(true);

  (drop as unknown as () => void)();
  await expect(page.getByText("Connection lost. Trying to get back in touch...")).toBeVisible();
  // The game stays usable while it reconnects, and the banner clears by itself.
  await expect(plaque(page, "Wait for Customer")).toBeVisible();
  await expect(page.getByText("Back in touch with the server.")).toBeVisible({ timeout: 20_000 });
  await context.close();
});
