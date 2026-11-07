import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { admin, createParlor, newPlayer, openFrontDoor, plaque, reachDesk, signUp, PASSWORD } from "./helpers";

export async function dump(page: Page, label = ""): Promise<string> {
  await page.waitForTimeout(400);
  const out = await page.evaluate(() => {
    const txt = (el: Element | null) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
    const lines: string[] = [];
    const sc = document.querySelector(".fq-app")?.getAttribute("data-scene");
    lines.push(`scene=${sc}`);
    const t = document.querySelector(".fq-textpanel .fq-text") ?? document.querySelector(".fq-text");
    if (t) lines.push(`TEXT: ${txt(t)}`);
    const st = document.querySelector(".fq-status");
    if (st) lines.push(`STATUS: ${txt(st)}`);
    const dlg = document.querySelector("[role=dialog]");
    if (dlg) lines.push(`DIALOG: ${txt(dlg)} || buttons=${[...dlg.querySelectorAll("button")].map((b) => txt(b)).join(" | ")}`);
    lines.push(`BUTTONS: ${[...document.querySelectorAll(".fq-plaque, .fq-orb")].map((b) => txt(b) + (b.getAttribute("aria-disabled") ? "(x)" : "")).join(" | ")}`);
    const regions = [...document.querySelectorAll("[role=region]")].map((r) => r.getAttribute("aria-label"));
    lines.push(`REGIONS: ${regions.join(", ")}`);
    return lines.join("\n");
  });
  console.log(`--- ${label}\n${out}`);
  return out;
}


const TOWN = "audit";
async function openTown(page: Page) {
  await page.goto("/");
  await expect(page.getByText(/Connected to /)).toBeVisible();
  await page.getByRole("button", { name: /^Play online/ }).click();
  const towns = page.getByRole("group", { name: "Choose a town" });
  if (await towns.isVisible()) await towns.locator("label", { hasText: "Audit Town" }).locator("input").check();
}
async function mk(page: Page, prefix: string) {
  const me = newPlayer(prefix);
  await openTown(page);
  await signUp(page, me);
  await createParlor(page, me);
  await reachDesk(page);
  return me;
}
async function click(page: Page, name: string | RegExp) {
  await plaque(page, name).first().click().catch(() => console.log("!! no plaque", String(name)));
  await page.waitForTimeout(400);
}
async function go(page: Page, place: RegExp) {
  await plaque(page, "Town Map").click();
  await page.getByRole("button", { name: place }).click();
  await page.waitForTimeout(400);
}




test("explore3", async ({ browser }) => {
  const S = JSON.parse(readFileSync(process.env.AUDIT_RESUME as string, "utf8"));
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: /^Play online/ }).click();
  await page.getByRole("group", { name: "Choose a town" }).locator("label", { hasText: "Audit Main" }).locator("input").check();
  await page.getByLabel("Name", { exact: true }).fill(S.bob.login);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log on" }).click();
  await page.waitForTimeout(1500);
  await dump(page, "bob after login");
  await page.screenshot({ path: "/tmp/claude-1000/-home-davisc-Repos-FuneralQuest/1295e39c-34a9-4593-a2a7-2a4a88ac06fb/scratchpad/bob.png" });
});
