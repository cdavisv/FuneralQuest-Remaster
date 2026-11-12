import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { ADMIN_TOKEN, newPlayer, PASSWORD } from "./helpers";

/**
 * A closed beta (FQ_INVITE_REQUIRED): the front door asks for an invite code for a new account
 * and for a guest. This file starts a server of its own with the setting on (the same bundle,
 * its own temporary database and port), so the shared servers the other specs use stay open.
 */

let server: ChildProcess | null = null;
let base = "";

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const address = s.address();
      const port = typeof address === "object" && address ? address.port : 0;
      s.close(() => resolve(port));
    });
  });
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const port = await freePort();
  const dist = process.env.FQ_E2E_DIST_TMP ? join(process.env.FQ_E2E_DIST_TMP, "dist") : null;
  server = spawn(
    process.execPath,
    [
      join(import.meta.dirname, "..", "tools", "run-server.mjs"),
      "--test",
      "--no-build",
      "--port",
      String(port),
      ...(dist ? ["--out", dist] : []),
    ],
    { env: { ...process.env, FQ_INVITE_REQUIRED: "1" }, stdio: "ignore" },
  );
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 300; i++) {
    try {
      if ((await fetch(`${base}/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("the invite-only server did not start");
});

test.afterAll(() => {
  server?.kill("SIGTERM");
  server = null;
});

/** A page on the invite-only server, with the house rules agreed and the sound off. */
async function door(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    baseURL: base,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: base,
          localStorage: [
            { name: "fq.conduct", value: "2" },
            { name: "fq.settings.v1", value: JSON.stringify({ muted: true }) },
          ],
        },
      ],
    },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByText(/Connected to /)).toBeVisible();
  await page.getByRole("button", { name: /^Play online/ }).click();
  await expect(page.getByRole("button", { name: "Log on" })).toBeVisible();
  return page;
}

async function makeInvite(page: Page, uses: number): Promise<string> {
  const response = await page.request.post("/admin/invites", {
    headers: { authorization: `Bearer ${ADMIN_TOKEN}`, "content-type": "application/json" },
    data: JSON.stringify({ label: "e2e batch", uses }),
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { code: string }).code;
}

test("a new account needs an invite code, and a wrong one is said in words", async ({
  browser,
}) => {
  const page = await door(browser);
  const code = await makeInvite(page, 1);
  const me = newPlayer("inv");
  await page.getByRole("button", { name: "New user" }).click();
  const invite = page.getByLabel("Invite code");
  await expect(invite).toBeVisible();
  await page.getByLabel("Name", { exact: true }).fill(me.login);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await invite.fill("ZZZZZ-ZZZZZ");
  await page.getByRole("button", { name: "click to continue" }).click();
  await expect(page.getByText("That invite code is not recognised.")).toBeVisible();
  // Typed in lower case with a space instead of the dash: the same code.
  await invite.fill(code.toLowerCase().replace("-", " "));
  await page.getByRole("button", { name: "click to continue" }).click();
  await expect(page.getByLabel("What's your name?")).toBeVisible();

  // The code had one use: a guest cannot start with it.
  const other = await door(browser);
  await other.getByRole("button", { name: "Play as guest" }).click();
  await other.getByLabel("Invite code").fill(code);
  await other.getByRole("button", { name: "Start as guest" }).click();
  await expect(other.getByText("That invite code has already been used up.")).toBeVisible();
});
