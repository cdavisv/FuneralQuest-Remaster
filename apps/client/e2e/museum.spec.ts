import { expect, test } from "@playwright/test";

/**
 * Museum mode: this server runs with FQ_LEGACY_CLIENT=1 (the "museum" project's server), so its
 * front door links to the original 2001 client, which loads under Ruffle and starts talking to
 * the server's request.xp. The protocol itself, through sign-up, a sale and a quit, is covered
 * by apps/server/test/museum.test.ts; the Flash movie draws on a canvas, so this checks what a
 * page can see: the link, the movie, and its first answer.
 */
test("the front door links to the original client when the server has it on", async ({ page }) => {
  await page.goto("/");
  const link = page.locator("[data-museum-link]").first();
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/museum/");
  // And the online door's own links have it too.
  await page.getByRole("button", { name: /^Play online/ }).click();
  await expect(page.locator("[data-museum-link]")).toHaveCount(1);
});

test("the link opens the original 2001 client, which logs on to this server", async ({ page }) => {
  const answers: string[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.endsWith("request.xp")) answers.push(`${response.status()} ${url.search}`);
  });
  await page.goto("/");
  await page.locator("[data-museum-link]").first().click();
  await expect(page).toHaveURL(/\/museum\/$/);
  await expect(page.locator("ruffle-player")).toBeAttached();
  // The movie's first call is the log-on check; the server answers it.
  await expect
    .poll(() => answers.find((a) => a.includes("checklogon")), { timeout: 30_000 })
    .toMatch(/^200 /);
});
