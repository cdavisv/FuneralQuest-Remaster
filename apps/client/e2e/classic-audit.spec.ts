import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CLASSIC_TEXT } from "@fq/core";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { admin, createParlor, newPlayer, PASSWORD, type Player, signUp } from "./helpers";
import { inspect, type Problem } from "./layout-check";

/**
 * The Classic audit (docs/ALPHA.md, criterion A1): every player-facing feature of the Classic
 * ruleset (docs/classic-rules.md and the original manual), driven through the real web client
 * against the real server, with the original text as the oracle. Expected strings come from the
 * Classic pack (`CLASSIC_TEXT`, which is `packages/core/src/content/classicText.ts`, the
 * untouched original wording) and are matched as patterns with the placeholders left open.
 *
 * The specs share a few towns the audit creates through the admin API (and removes again, so the
 * other specs' town list is as it was). Random draws are handled by trying again until the
 * outcome wanted comes up, within a bound; an outcome the original produces only rarely is
 * reached by turning the town's odds up through the sysop's Game Settings.
 */

const T = CLASSIC_TEXT;
const S = T.social;

// ------------------------------------------------------------------ text patterns

/** The original's colour codes (a backtick and one character, or `f` and a digit) are not text. */
const stripCodes = (text: string): string => text.replace(/`f\d|`./g, "");

const escapeRx = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A pack template as a pattern: placeholders match anything, any run of space matches any space. */
function rx(template: string, flags = ""): RegExp {
  const source = stripCodes(template)
    .split(/(\{[A-Za-z]+\})/)
    .map((part) => (/^\{[A-Za-z]+\}$/.test(part) ? ".*?" : escapeRx(part)))
    .join("")
    .replace(/\s+/g, "\\s*");
  return new RegExp(source, flags);
}

type Line = string | { loved: string; notLoved: string };
const lineTemplates = (line: Line): string[] =>
  typeof line === "string" ? [line] : [line.loved, line.notLoved];

/** Any one of a list of templates (a line of the original that is picked at random). */
function anyOf(...lists: (Line | readonly Line[])[]): RegExp {
  const all = lists.flatMap((l) => (Array.isArray(l) ? (l as readonly Line[]) : [l as Line]));
  return new RegExp(
    all
      .flatMap(lineTemplates)
      .map((t) => `(?:${rx(t).source})`)
      .join("|"),
  );
}

const norm = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

// ------------------------------------------------------------------ driving the client

/** The main text of whatever screen is up (the parlor's text well, or the paper's body). */
const well = (page: Page): Locator => page.locator(".fq-textpanel .fq-text").first();
const paper = (page: Page): Locator => page.locator(".fq-paper-body, .fq-paper-art .fq-paper-body");
const dialog = (page: Page): Locator => page.getByRole("dialog");
const chatLog = (page: Page): Locator => page.getByRole("list", { name: "Conversation" });

/** A plaque or desk icon by its exact label. */
const btn = (page: Page, label: string): Locator =>
  page.locator(".fq-plaque, .fq-orb").filter({
    has: page.locator(".fq-plaque-label, .fq-orb-label").getByText(label, { exact: true }),
  });

/** Waits until no action is in flight (a button pressed meanwhile would be dropped). */
const settle = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
};

/**
 * Clicks, and if a letter was pushed to an idle desk and now covers the page (the original's
 * desk polled for mail), reads it away and clicks again.
 */
const clickClear = async (page: Page, target: Locator): Promise<void> => {
  for (let attempt = 0; ; attempt++) {
    try {
      await target.click({ timeout: attempt < 3 ? 3_000 : 10_000 });
      return;
    } catch (error) {
      if (attempt >= 3 || !(await dialog(page).isVisible())) throw error;
      await dialog(page).getByRole("button").first().click();
      await settle(page);
    }
  }
};

/** Presses a plaque and waits for the server's answer to be drawn. */
const press = async (page: Page, label: string): Promise<void> => {
  await clickClear(page, btn(page, label));
  await settle(page);
};

/** The main text after pressing a plaque, whitespace made plain. */
const pressText = async (page: Page, label: string): Promise<string> => {
  await press(page, label);
  return norm(await well(page).textContent());
};

/** Waits until the screen's main text matches. */
async function seeText(page: Page, pattern: RegExp | string, timeout?: number): Promise<void> {
  await expect(well(page)).toContainText(pattern, timeout ? { timeout } : undefined);
}

async function seeDialog(page: Page, pattern: RegExp | string): Promise<void> {
  await expect(dialog(page)).toContainText(pattern);
}

/** Types into the open notepad and submits it. */
async function submitNotepad(page: Page, text: string): Promise<void> {
  const pad = dialog(page);
  await pad.getByRole("textbox").fill(text);
  await pad.getByRole("button", { name: "Submit" }).click();
  await settle(page);
}

async function answer(page: Page, choice: "Yes" | "No"): Promise<void> {
  await dialog(page).getByRole("button", { name: choice, exact: true }).click();
  await settle(page);
}

/** Closes any message dialog and goes through Continue and Leave buttons until the desk is up. */
async function toDesk(page: Page): Promise<void> {
  const wait = btn(page, "Wait for Customer");
  for (let i = 0; i < 12; i++) {
    if (await wait.isVisible()) {
      if (!(await dialog(page).isVisible())) return;
    }
    if (await dialog(page).isVisible()) {
      await dialog(page).getByRole("button").first().click();
    } else if (await page.getByRole("button", { name: /Go to Your Parlor/ }).isVisible()) {
      await page
        .getByRole("button", { name: /Go to Your Parlor/ })
        .click({ timeout: 2_000 })
        .catch(() => undefined);
    } else {
      const next = page
        .locator(".fq-plaque")
        .filter({ has: page.locator(".fq-plaque-label").getByText(/^(Continue|Leave|Back)$/) })
        .first();
      if (await next.isVisible()) await next.click();
      else if (await btn(page, "Town Map").isVisible()) await btn(page, "Town Map").click();
    }
    await page.waitForTimeout(150);
  }
  await expect(wait).toBeVisible();
}

/** From any screen with the map reachable: to the desk's map and into a place. */
async function goTo(page: Page, place: RegExp): Promise<void> {
  // A letter can be pushed to an idle desk between the look and the click: close it and go on.
  for (let attempt = 0; ; attempt++) {
    await toDesk(page);
    try {
      await btn(page, "Town Map").click({ timeout: 3_000 });
      break;
    } catch (error) {
      if (attempt >= 3) throw error;
      await closeAnything(page);
    }
  }
  // The map's building on the cabinet layouts, its list of places on the phone.
  const spot = page.getByRole("button", { name: place });
  if (await spot.first().isVisible()) await spot.first().click();
  else
    await page
      .getByRole("button", { name: place.source.replace(/^Go to /, ""), exact: true })
      .click();
}

const PLACE = {
  bank: /Go to Bank/,
  store: /Go to Di-Mart/,
  cafe: /Go to Pale Horse Cafe/,
  yangs: /Go to Yang's/,
  rivals: /Go to Rival Parlors/,
  church: /Go to Church/,
  hospital: /Go to Hospital/,
  university: /Go to Spirit University/,
} as const;

/** The stats sheet as a map of stat id to value; leaves with Back. */
async function readStats(page: Page): Promise<Record<string, string>> {
  await toDesk(page);
  await btn(page, "Stats").click();
  const sheet = page.getByRole("region", { name: "Your stats and inventory" });
  await expect(sheet).toBeVisible();
  const stats = await sheet
    .locator("[data-stat]")
    .evaluateAll((rows) =>
      Object.fromEntries(
        rows.map((row) => [
          row.getAttribute("data-stat") ?? "",
          (row.querySelector("dd")?.textContent ?? row.textContent ?? "").trim(),
        ]),
      ),
    );
  await press(page, "Back");
  await expect(btn(page, "Wait for Customer")).toBeVisible();
  return stats;
}

const num = (s: string | undefined): number => Number((s ?? "0").replace(/[^0-9-]/g, ""));

// ------------------------------------------------------------------ the audit towns

interface Who {
  page: Page;
  context: BrowserContext;
  player: Player;
}

const TOWNS = {
  main: { id: "audit-main", name: "Audit Main" },
  limits: { id: "audit-limits", name: "Audit Limits" },
  cup: { id: "audit-cup", name: "Audit Cup" },
} as const;

const created: string[] = [];

async function makeTown(
  page: Page,
  town: { id: string; name: string },
  settings: Record<string, unknown>,
): Promise<void> {
  await admin(page, "POST", "/admin/towns", { id: town.id, name: town.name, settings });
  created.push(town.id);
}

const ADMIN = "Bearer e2e-admin-token-0123456789abcdef";

/** The sysop's Game Settings for a town, changed while the game runs. */
async function setSettings(
  page: Page,
  town: { id: string },
  patch: Record<string, unknown>,
): Promise<void> {
  const res = await page.request.fetch(`/admin/towns/${town.id}/settings`, {
    method: "PATCH",
    headers: { authorization: ADMIN, "content-type": "application/json" },
    data: JSON.stringify(patch),
  });
  expect(res.status(), `PATCH settings ${JSON.stringify(patch)}`).toBeLessThan(300);
}

async function dropTowns(page: Page): Promise<void> {
  for (const id of created.splice(0)) {
    await page.request
      .fetch(`/admin/towns/${id}`, {
        method: "DELETE",
        headers: { authorization: "Bearer e2e-admin-token-0123456789abcdef" },
      })
      .catch(() => undefined);
  }
}

/** The front door, with the audit town chosen, up to the log-on plaque. */
async function openDoor(page: Page, town: { name: string }): Promise<void> {
  await page.goto("/");
  await expect(page.getByText(/Connected to /)).toBeVisible();
  await page.getByRole("button", { name: /^Play online/ }).click();
  await expect(page.getByRole("button", { name: "Log on" })).toBeVisible();
  const towns = page.getByRole("group", { name: "Choose a town" });
  await towns.locator("label", { hasText: town.name }).locator("input").check();
}

async function logOn(page: Page, player: Player): Promise<void> {
  await page.getByLabel("Name", { exact: true }).fill(player.login);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Log on" }).click();
}

/** A new player in a town, on the first screen after the parlor form (the paper). */
async function join(
  browser: import("@playwright/test").Browser,
  town: { id: string; name: string },
  prefix: string,
  options: { male?: boolean } = {},
): Promise<Who> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const player = newPlayer(prefix);
  await openDoor(page, town);
  await signUp(page, player);
  await createParlor(page, player, options.male ?? true);
  return { page, context, player };
}

/** Reads the paper and the welcome, and stands at the desk. */
async function sitDown(page: Page): Promise<void> {
  await expect(page.locator(".fq-news")).toBeVisible();
  await btn(page, "Continue").click();
  await toDesk(page);
}

// ------------------------------------------------------------------ the sale

type Outcome = "customer" | "event" | "risk" | "script" | "noTurns";

/**
 * Presses Wait for Customer once and says what came: a customer (the negotiation is up), or a
 * random event, a risk, a script, or the out-of-turns line.
 */
async function waitOnce(page: Page): Promise<Outcome> {
  const customer = page.getByRole("region", { name: "The customer" });
  const before = norm(await well(page).textContent());
  await press(page, "Wait for Customer");
  await expect
    .poll(
      async () =>
        (await customer.isVisible()) ||
        norm(await well(page).textContent()) !== before ||
        (await dialog(page).isVisible()),
    )
    .toBe(true);
  if (await customer.isVisible()) return "customer";
  return "event";
}

/** Every outcome of one Wait except a customer is closed with its first choice. */
async function meet(page: Page): Promise<void> {
  const customer = page.getByRole("region", { name: "The customer" });
  for (let step = 0; step < 40; step++) {
    if (await customer.isVisible()) return;
    await closeAnything(page);
    if (await customer.isVisible()) return;
    if (await btn(page, "Wait for Customer").isVisible()) {
      await waitOnce(page);
    }
  }
  throw new Error("no customer came in forty steps");
}

/** Dialogs and Continue buttons, answered with the first choice, until a plain screen. */
async function closeAnything(page: Page): Promise<void> {
  for (let i = 0; i < 5; i++) {
    if (await dialog(page).isVisible()) {
      await dialog(page).getByRole("button").first().click();
      await page.waitForTimeout(100);
      continue;
    }
    const cont = btn(page, "Continue");
    if (await cont.isVisible()) {
      await cont.click();
      await page.waitForTimeout(100);
      continue;
    }
    return;
  }
}

const totalOf = async (page: Page): Promise<number> => {
  const text = await page
    .getByRole("region", { name: "The customer" })
    .locator(".fq-readout-total strong")
    .textContent();
  return num(text ?? "0");
};

/** The sale's own Done, whatever the casket: returns the success text. */
async function finishSale(page: Page): Promise<string> {
  await press(page, "Done");
  const success = rx(T.negotiation.done.success);
  await expect(well(page)).toContainText(success);
  const text = norm(await well(page).textContent());
  await press(page, "Continue");
  await expect(btn(page, "Wait for Customer")).toBeVisible();
  return text;
}

/**
 * Sells until the parlor holds `gold` gold tags' worth (4 wood or 2 silver to the gold), by Hard
 * Sell up to Gold while the customer takes it, then Done; the bank turns the tags into gold at
 * the end ("All to gold"). Returns how many sales it took.
 */
async function farmGold(page: Page, gold: number): Promise<number> {
  const start = await readStats(page);
  let worth = num(start.gold) * 4 + num(start.silver) * 2 + num(start.wood);
  const customer = page.getByRole("region", { name: "The customer" });
  let sales = 0;
  for (let step = 0; worth < gold * 4 && step < 1500; step++) {
    await meet(page);
    for (let i = 0; i < 2; i++) {
      const before = await totalOf(page);
      await press(page, "Hard Sell");
      if (!(await customer.isVisible())) break;
      if ((await totalOf(page)) === before) break;
    }
    if (await customer.isVisible()) {
      const text = await finishSale(page);
      sales++;
      worth += /Gold sales tag/.test(text) ? 4 : /Silver sales tag/.test(text) ? 2 : 1;
    }
    await closeAnything(page);
    await toDesk(page);
  }
  await goTo(page, PLACE.bank);
  await press(page, "All to gold");
  await closeAnything(page);
  await toDesk(page);
  return sales;
}

test.describe.configure({ mode: "serial" });

let alice!: Who;
let bob!: Who;

/**
 * Development aid: with `AUDIT_RESUME=<file>` the run keeps the server and the audit town between
 * runs, and after the (slow) selling that earns the gold it writes the two players and a snapshot
 * of the town there; the next run logs the two players on and rolls the town back to the
 * snapshot, so a test further down can be tried again without selling again. Not used in CI.
 */
const RESUME = process.env.AUDIT_RESUME;
interface Saved {
  alice: Player;
  bob: Player;
  snapshot: number;
}
const saved = (): Saved | null => {
  if (!RESUME || !existsSync(RESUME)) return null;
  return JSON.parse(readFileSync(RESUME, "utf8")) as Saved;
};

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  if (saved()) {
    created.push(TOWNS.main.id);
    await context.close();
    return;
  }
  await makeTown(page, TOWNS.main, {
    turnsPerDay: 400,
    normalOdds: 0,
    luckOdds: 0,
    scriptOdds: 0,
    tagsReceivablePerDay: 100,
    visitsPerDay: 8,
  });
  await context.close();
});

test.afterAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  if (!RESUME) await dropTowns(page);
  await alice?.context.close().catch(() => undefined);
  await bob?.context.close().catch(() => undefined);
  await context.close();
});

test("a new parlor: the paper, the welcome and the desk", async ({ browser }) => {
  test.skip(saved() !== null, "resumed");
  alice = await join(browser, TOWNS.main, "alice");
  const { page, player } = alice;
  // The newspaper first, with the news of the new parlor and both top-seller notices.
  await expect(page.getByRole("heading", { level: 1, name: "News" })).toBeAttached();
  await expect(paper(page)).toContainText(
    `A new parlor (${player.parlor}) run by ${player.name} has been opened!`,
  );
  await expect(page.getByText(T.news.noTopToday)).toBeVisible();
  await expect(page.getByText("No one died yesterday.")).toBeVisible();
  await btn(page, "Continue").click();
  // The desk's welcome for a new player.
  await seeText(page, rx(T.desk.newDayFirst));
  await seeText(page, player.name);
  await press(page, "Continue");
  // The town's own notice that this player moved in, with the server's clock in front (the
  // original queued it for every player online, the newcomer included).
  await seeText(page, rx(`{time}:${T.newPlayer.movedIn.replace("{name}", player.name)}`));
  for (const label of [
    "Wait for Customer",
    "Town Map",
    "Read Paper",
    "Stats",
    "Rankings",
    "Write Letter",
    "Exit",
  ]) {
    await expect(btn(page, label)).toBeVisible();
  }
});

test("the stats sheet shows every stat of a new parlor, and the rating line", async () => {
  test.skip(saved() !== null, "resumed");
  const { page } = alice;
  const stats = await readStats(page);
  const labels = T.stats.labels;
  await btn(page, "Stats").click();
  const sheet = page.getByRole("region", { name: "Your stats and inventory" });
  for (const label of Object.values(labels)) {
    await expect(sheet.getByText(label, { exact: true })).toBeVisible();
  }
  // The starting values of the original (docs/classic-rules.md section 6, New players).
  expect(num(stats.turns)).toBe(400);
  expect(num(stats.bpTotal)).toBe(0);
  expect(num(stats.money)).toBe(500);
  expect(stats.psych).toBe(T.stats.psychLevel.replace("{level}", "1"));
  expect(num(stats.hpMax)).toBe(10);
  expect(num(stats.strength)).toBe(3);
  expect(num(stats.yangs)).toBe(1);
  expect(num(stats.visits)).toBe(8);
  expect(stats.ride).toBe(T.hearseNames[0]);
  expect(stats.rating).toMatch(rx(T.stats.rating));
  await expect(sheet.locator('[data-stat="rating"]')).toContainText(/#\d+ - /);
  // The sheet has the Name button (changing it is tested with the gold to pay for it).
  await expect(btn(page, "Name")).toBeVisible();
  await press(page, "Back");
});

const MOODS = [
  "In Shock",
  "Dazed",
  "Confused",
  "Crying",
  "Numb",
  "Disturbed",
  "Frustrated",
  "Irked",
  "Angry",
  "Pissed",
  "Chipper",
  "In a hurry",
  "Natural",
  "Tight Lipped",
  "Nervous",
  "Annoyed",
];

test("a customer: the arrival, the readout, and every button of the negotiation", async () => {
  test.skip(saved() !== null, "resumed");
  const { page } = alice;
  const N = T.negotiation;
  await toDesk(page);
  const seen = new Set<string>();
  const customer = page.getByRole("region", { name: "The customer" });
  // Which texts an action may answer with (one of these always shows).
  const answers: Record<string, RegExp> = {
    "Soft Sell": anyOf(
      N.softPitch,
      N.softRefuse,
      N.softAccept,
      N.softOverLimit,
      N.leavePissed,
      N.pissedOverLimit,
    ),
    "Hard Sell": anyOf(
      N.hardPitchWood,
      N.hardPitchSilver,
      N.upgradePitch,
      N.hardRefuse,
      N.hardAccept,
      N.hardAcceptAngry,
      N.hardOverLimit,
      N.upgradeRefuse,
      N.upgradeAccept,
      N.upgradeAcceptAngry,
      N.upgradeOverLimit,
      N.upgradeNothingLeft,
      N.leavePissed,
      N.pissedOverLimit,
    ),
    Guilt: anyOf(N.interrupted, N.guiltPitch, N.guiltLoved, N.guiltNotLoved),
    Sympathy: anyOf(N.interrupted, N.sympathyPitch, N.sympathyNotLoved, N.sympathyLoved),
  };
  for (let round = 0; round < 12 && seen.size < 3; round++) {
    await meet(page);
    // The arrival: the request, then the casket the customer needs (the pack's own words).
    await expect(well(page)).toContainText(
      rx(N.arrivalRequest.slice(0, N.arrivalRequest.indexOf("{dRelation}"))),
    );
    await expect(well(page)).toContainText(rx(N.arrivalNeed));
    await expect(well(page)).toContainText(/Total:\s*\$[\d,]+/);
    // The readout: the customer's mood, the running total, and the class on the picture.
    const mood = (await customer.locator(".fq-readout-mood strong").textContent()) ?? "";
    expect(MOODS).toContain(mood);
    await expect(page.locator(".fq-overlay-tags")).toContainText(
      /Class:? ?(Poor|Average|Rich|Super Rich)/,
    );
    const price0 = await totalOf(page);
    expect([800, 2600, 5300]).toContain(price0);
    for (const label of [
      N.buttons.guilt,
      N.buttons.sympathy,
      N.buttons.hard,
      N.buttons.soft,
      N.buttons.done,
    ]) {
      await expect(btn(page, label)).toBeVisible();
    }
    // Each of the four sales buttons, until the customer leaves or the sale is done.
    for (const label of ["Soft Sell", "Hard Sell", "Guilt", "Sympathy"]) {
      if (!(await customer.isVisible())) break;
      const text = await pressText(page, label);
      expect(text, `${label}: ${text}`).toMatch(answers[label] as RegExp);
      seen.add(label);
    }
    if (await customer.isVisible()) {
      const text = await finishSale(page);
      expect(text).toMatch(rx(N.done.success));
    } else {
      await closeAnything(page);
    }
    await toDesk(page);
  }
  expect([...seen].sort()).toEqual(["Guilt", "Hard Sell", "Soft Sell", "Sympathy"].sort());
});

test("a rival joins, and both parlors earn gold tags by selling", async ({ browser }) => {
  test.setTimeout(900_000);
  const resume = saved();
  if (resume) {
    for (const [name, player] of [
      ["alice", resume.alice],
      ["bob", resume.bob],
    ] as const) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await openDoor(page, TOWNS.main);
      await logOn(page, player);
      const who = { page, context, player };
      if (name === "alice") alice = who;
      else bob = who;
    }
    await alice.page.request.fetch(`/admin/towns/${TOWNS.main.id}/rollback`, {
      method: "POST",
      headers: {
        authorization: "Bearer e2e-admin-token-0123456789abcdef",
        "content-type": "application/json",
      },
      data: JSON.stringify({ snapshotId: resume.snapshot }),
    });
    for (const who of [alice, bob]) {
      await who.page.reload();
      await toDesk(who.page);
    }
    return;
  }
  bob = await join(browser, TOWNS.main, "bob");
  await sitDown(bob.page);
  const started = Date.now();
  const sales = await Promise.all([farmGold(alice.page, 130), farmGold(bob.page, 36)]);
  console.log(
    `farmed ${sales.join(" and ")} sales in ${Math.round((Date.now() - started) / 1000)} s`,
  );
  expect(num((await readStats(alice.page)).gold)).toBeGreaterThanOrEqual(130);
  expect(num((await readStats(bob.page)).gold)).toBeGreaterThanOrEqual(36);
  if (RESUME) {
    const res = await alice.page.request.fetch(`/admin/towns/${TOWNS.main.id}/snapshots`, {
      method: "POST",
      headers: {
        authorization: "Bearer e2e-admin-token-0123456789abcdef",
        "content-type": "application/json",
      },
      data: JSON.stringify({ reason: "audit" }),
    });
    const { id } = (await res.json()) as { id: number };
    writeFileSync(RESUME, JSON.stringify({ alice: alice.player, bob: bob.player, snapshot: id }));
  }
});

// ------------------------------------------------------------------ the town: Spirit University

/** Stats as a plain number, for the stat id. */
const stat = async (page: Page, id: string): Promise<number> => num((await readStats(page))[id]);

test("Spirit University: psychology to level 5 with its skills, PE and strength", async () => {
  const { page } = alice;
  const U = T.places.university;
  await goTo(page, PLACE.university);
  await expect(page.getByText(stripCodes(U.note))).toBeVisible();
  for (const label of ["Library", "Take PSY", "Take PE", "Take ST", "Leave"]) {
    await expect(btn(page, label)).toBeVisible();
  }
  // The schedule gives the prices: PSY 4 + 2 x level, PE 12 for 10 hit points, ST 9 for strength 3.
  await seeText(
    page,
    rx(U.schedule.replace("{psych}", "4").replace("{hp}", "12").replace("{strength}", "9")),
  );

  const gold0 = await stat(page, "gold");
  await goTo(page, PLACE.university);
  for (let level = 1; level <= 5; level++) {
    await press(page, "Take PSY");
    await seeText(page, rx(U.psychDone.replace("{level}", String(level + 1))));
    await seeText(page, rx(U.psychSkills[level - 1] as string));
    await press(page, "Continue");
    await expect(btn(page, "Take PSY")).toBeVisible();
  }
  // 4 + 6 + 8 + 10 + 12 gold tags, and the stats sheet says level 6 in the original's count.
  const gold1 = await stat(page, "gold");
  expect(gold0 - gold1).toBe(40);
  expect((await readStats(page)).psych).toBe(T.stats.psychLevel.replace("{level}", "6"));

  await goTo(page, PLACE.university);
  const hp0 = await stat(page, "hpMax");
  await goTo(page, PLACE.university);
  await press(page, "Take PE");
  await seeText(page, rx(U.hpDone));
  await press(page, "Continue");
  const hp1 = await stat(page, "hpMax");
  expect([4, 5]).toContain(hp1 - hp0);
  await goTo(page, PLACE.university);
  await press(page, "Take ST");
  await seeText(page, rx(U.strengthDone));
  await press(page, "Continue");
  expect(await stat(page, "strength")).toBe(4);
  expect(await stat(page, "gold")).toBe(gold1 - Math.trunc(hp0 * 1.2) - 9);
});

// ------------------------------------------------------------------ the bank

test("the bank: exchange in both directions, the checks on the count, All to wood and All to gold", async () => {
  const { page } = alice;
  const B = T.places.bank;
  await goTo(page, PLACE.bank);
  await expect(page.getByText(stripCodes(B.note))).toBeVisible();
  await seeText(page, rx(B.greeting.replace("{player}", alice.player.name)));
  for (const label of ["All to wood", "All to gold", "Exchange", "Leave"]) {
    await expect(btn(page, label)).toBeVisible();
  }
  const before = await readStats(page);
  const worth = (s: Record<string, string>) => num(s.gold) * 4 + num(s.silver) * 2 + num(s.wood);
  const w0 = worth(before);

  /** Exchange `count` tags of one tier for another; returns the teller's answer. */
  const exchange = async (from: string, to: string, count: string): Promise<string> => {
    await goTo(page, PLACE.bank);
    await press(page, "Exchange");
    await seeText(page, rx(B.which));
    await press(page, from);
    await seeText(page, rx(B.convertTo.replace("{from}", from)));
    await press(page, to);
    await seeDialog(page, rx(B.ratio.replaceAll("{from}", from), "i"));
    await submitNotepad(page, count);
    return norm(await well(page).textContent());
  };

  // Gold to silver: each gold is 2 silver.
  let text = await exchange("Gold", "Silver", "3");
  expect(text).toMatch(
    rx(
      B.done
        .replace("{lost}", "3")
        .replace("{from}", "gold")
        .replace("{gained}", "6")
        .replace("{to}", "silver"),
      "i",
    ),
  );
  await press(page, "Continue").catch(() => undefined);
  // The checks, in the original's order: a negative count, more than owned, too few for one tag.
  text = await exchange("Gold", "Silver", "-5");
  expect(text).toMatch(rx(B.amusing));
  // Silver to wood: 6 silver is 12 wood.
  text = await exchange("Silver", "Wood", "6");
  expect(text).toMatch(
    rx(
      B.done
        .replace("{lost}", "6")
        .replace("{from}", "silver")
        .replace("{gained}", "12")
        .replace("{to}", "wood"),
      "i",
    ),
  );
  await press(page, "Continue").catch(() => undefined);
  // Too few for one tag (3 wood is less than a gold), and more than owned.
  text = await exchange("Wood", "Gold", "9999");
  expect(text).toMatch(rx(B.notEnough));
  text = await exchange("Wood", "Gold", "3");
  expect(text).toMatch(rx(B.tooFew.replace("{count}", "3").replace("{to}", "gold"), "i"));
  // Zero, or something that is not a number, goes back to the menu.
  await exchange("Gold", "Silver", "0");
  await seeText(page, rx(B.which));
  await exchange("Gold", "Silver", "lots");
  await seeText(page, rx(B.which));
  // A cancelled prompt does the same.
  await goTo(page, PLACE.bank);
  await press(page, "Exchange");
  await press(page, "Gold");
  await press(page, "Silver");
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await settle(page);
  await seeText(page, rx(B.which));
  // Seven wood to gold turns four of them into one gold and keeps the other three.
  text = await exchange("Wood", "Gold", "7");
  expect(text).toMatch(
    rx(
      B.done
        .replace("{lost}", "4")
        .replace("{from}", "wood")
        .replace("{gained}", "1")
        .replace("{to}", "gold"),
      "i",
    ),
  );
  await press(page, "Continue").catch(() => undefined);

  // All to wood, then All to gold: the value never changes.
  await goTo(page, PLACE.bank);
  await press(page, "All to wood");
  await seeText(page, rx(B.allToWood));
  await closeAnything(page);
  const wood = await readStats(page);
  expect(num(wood.silver)).toBe(0);
  expect(num(wood.gold)).toBe(0);
  expect(worth(wood)).toBe(w0);
  await goTo(page, PLACE.bank);
  await press(page, "All to gold");
  await seeText(page, rx(B.allToGold));
  await closeAnything(page);
  const gold = await readStats(page);
  expect(num(gold.silver)).toBe(0);
  expect(num(gold.wood)).toBeLessThan(4);
  expect(worth(gold)).toBe(w0);
});

// ------------------------------------------------------------------ Di-Mart

test("Di-Mart hearses: the showroom, the trade-in price, buying, no downgrade, no money", async () => {
  const { page } = alice;
  const D = T.places.store;
  const hearse = (n: number) => T.hearseNames[n] as string;
  await goTo(page, PLACE.store);
  await expect(page.getByText(stripCodes(D.note).split("\n")[0] as string)).toBeVisible();
  await seeText(page, rx(D.greeting.replace("{player}", alice.player.name)));
  for (const label of ["Security", "Supplies", "Hearses", "Leave"]) {
    await expect(btn(page, label)).toBeVisible();
  }
  await press(page, "Hearses");
  await seeText(page, rx(D.hearseIntro));
  // Four hearses for sale (the bicycle you start with is not), at 12, 30, 50 and 80 gold tags.
  for (const [n, price] of [
    [1, 12],
    [2, 30],
    [3, 50],
    [4, 80],
  ] as const) {
    await seeText(
      page,
      rx(
        D.hearseLine
          .replace("{n}", String(n))
          .replace("{name}", hearse(n))
          .replace("{price}", String(price)),
      ),
    );
  }
  const before = await readStats(page);
  expect(before.ride).toBe(hearse(0));

  // The Budget Hearse: the bicycle goes in for half its 4 gold tags, so it costs 10.
  await goTo(page, PLACE.store);
  await press(page, "Hearses");
  await press(page, "View #1");
  await seeText(
    page,
    rx(
      D.look
        .replace("{name}", hearse(1))
        .replace("{description}", T.hearseDescriptions[1] as string)
        .replace("{bonus}", "2"),
    ),
  );
  await seeText(
    page,
    rx(
      D.lookTrade.replace("{current}", hearse(0)).replace("{credit}", "2").replace("{cost}", "10"),
    ),
  );
  await press(page, "Buy it");
  await seeText(
    page,
    rx(D.bought.replace("{old}", hearse(0)).replace("{new}", hearse(1)).replace("{bonus}", "2")),
  );
  const after = await readStats(page);
  expect(after.ride).toBe(hearse(1));
  expect(num(before.gold) - num(after.gold)).toBe(10);
  expect(num(after.turns) - num(before.turns)).toBe(2);

  // The same hearse again, or a cheaper one, is no upgrade: nothing is sold and nothing is paid.
  await goTo(page, PLACE.store);
  await press(page, "Hearses");
  await press(page, "View #1");
  await seeText(
    page,
    rx(D.lookNoUpgrade.replace("{current}", hearse(1)).replace("{name}", hearse(1))),
  );
  await press(page, "Buy it");
  await seeText(page, rx(D.noUpgrade.replace("{current}", hearse(1)).replace("{name}", hearse(1))));
  expect((await readStats(page)).gold).toBe(after.gold);

  // The Medalist: the Budget Hearse is worth 6, so 24 gold tags and 4 more turns today.
  await goTo(page, PLACE.store);
  await press(page, "Hearses");
  await press(page, "View #2");
  await seeText(
    page,
    rx(
      D.lookTrade.replace("{current}", hearse(1)).replace("{credit}", "6").replace("{cost}", "24"),
    ),
  );
  await press(page, "Buy it");
  await seeText(
    page,
    rx(D.bought.replace("{old}", hearse(1)).replace("{new}", hearse(2)).replace("{bonus}", "4")),
  );
  const last = await readStats(page);
  expect(last.ride).toBe(hearse(2));
  expect(num(after.gold) - num(last.gold)).toBe(24);
  expect(num(last.turns) - num(after.turns)).toBe(4);
  // The Crown Sovereign: Bob, with a few dozen gold tags, cannot pay 78 (80 less the bicycle's 2).
  await goTo(bob.page, PLACE.store);
  await press(bob.page, "Hearses");
  await press(bob.page, "View #4");
  await seeText(
    bob.page,
    rx(
      D.lookTrade.replace("{current}", hearse(0)).replace("{credit}", "2").replace("{cost}", "78"),
    ),
  );
  await press(bob.page, "Buy it");
  await seeText(bob.page, rx(D.cannotAfford.replace("{name}", hearse(4))));
  expect((await readStats(bob.page)).ride).toBe(hearse(0));
});

test("Di-Mart security: padlock, smoke detector and safe once each; lockpicks by the dozen", async () => {
  const { page } = alice;
  const buy = async (who: Who, view: string, bought: RegExp | string) => {
    await goTo(who.page, PLACE.store);
    await press(who.page, "Security");
    await press(who.page, view);
    await press(who.page, "Buy it");
    await seeText(who.page, bought);
    await press(who.page, "Continue");
  };
  await goTo(page, PLACE.store);
  await press(page, "Security");
  await seeText(page, "This town seems accident prone");
  await seeText(page, /Heavy Padlock - Cost: 6 gold tags/);
  await seeText(page, /Smoke Detector - Cost: 8 gold tags/);
  await seeText(page, /Safe - Cost: 6 gold tags/);
  const gold0 = await stat(page, "gold");
  await buy(alice, "View #1", "You purchase the Heavy Padlock for 6 gold tags.");
  await buy(alice, "View #2", "You purchase the Smoke Detector for 8 gold tags.");
  await buy(alice, "View #3", "You purchase the Safe for 6 gold tags.");
  expect(gold0 - (await stat(page, "gold"))).toBe(20);
  // The shelf now says what is owned, and a second one is refused before the price is asked.
  await goTo(page, PLACE.store);
  await press(page, "Security");
  await seeText(page, /already own one at 100 percent strength/);
  await press(page, "View #1");
  await press(page, "Buy it");
  await seeText(page, "Wait until the one you have breaks. Sorry, company policy.");
  await press(page, "Continue");
  await press(page, "View #2");
  await press(page, "Buy it");
  await seeText(page, "You really don't need two of these things.");
  await press(page, "Continue");
  await press(page, "View #3");
  await press(page, "Buy it");
  await seeText(page, "You already own a Safe.");
  await press(page, "Continue");
  expect(gold0 - (await stat(page, "gold"))).toBe(20);

  // Lockpicks: one gold tag each, and buying keeps you on the lockpick screen.
  await goTo(page, PLACE.store);
  await press(page, "Supplies");
  await seeText(page, /Lockpick - Cost: 1 gold tag/);
  await press(page, "View #1");
  await seeText(page, "(You currently have 0 lockpick(s))");
  for (let n = 1; n <= 4; n++) {
    await press(page, "Buy one");
    await seeText(page, "You purchase a Lockpick for 1 gold tag.");
    await press(page, "Continue");
    await seeText(page, `(You currently have ${n} lockpick(s))`);
  }
  await press(page, "Back");
  await press(page, "Back");
  expect(num((await readStats(page)).lockpicks)).toBe(4);

  // Bob: a padlock and a safe for the visits below (the Padlock first at full strength).
  await buy(bob, "View #1", "You purchase the Heavy Padlock for 6 gold tags.");
  await buy(bob, "View #3", "You purchase the Safe for 6 gold tags.");
  // With too little gold: refused with the clerk's line (Bob has gold for one more item at most).
  const bobGold = await stat(bob.page, "gold");
  expect(bobGold).toBeGreaterThanOrEqual(12);
});

// ------------------------------------------------------------------ Yang's

/** The luck meter's value (out of 100) on the current screen. */
const luckOf = async (page: Page): Promise<number> => {
  await toDesk(page);
  const label =
    (await page
      .getByRole("meter", { name: /Luck meter/ })
      .first()
      .getAttribute("aria-label")) ?? "";
  return Number(/(\d+) out of/.exec(label)?.[1] ?? "NaN");
};

/**
 * Reads the letters waiting: goes to the desk by the map and closes each message overlay in turn,
 * answering a letter's Reply question with `reply` ("No" leaves it). Returns each overlay's text.
 */
async function readLetters(page: Page, reply: "Yes" | "No" = "No"): Promise<string[]> {
  const texts: string[] = [];
  const drain = async () => {
    for (let i = 0; i < 12 && (await dialog(page).isVisible()); i++) {
      const dlg = dialog(page);
      if (await dlg.getByRole("textbox").isVisible()) break;
      texts.push(norm(await dlg.textContent()));
      const yes = dlg.getByRole("button", { name: reply, exact: true });
      const choice = (await yes.isVisible()) ? yes : dlg.getByRole("button").first();
      await choice.click();
      await settle(page);
    }
  };
  await settle(page);
  // Logging on shows the paper first.
  if (await page.locator(".fq-news").isVisible()) await press(page, "Continue");
  await drain();
  // An idle desk is pushed a letter a moment after it is queued.
  if (texts.length === 0) {
    const late = await dialog(page)
      .waitFor({ state: "visible", timeout: 1_500 })
      .then(
        () => true,
        () => false,
      );
    if (late) await drain();
  }
  // Letters wait for a visit to the desk: if the player is somewhere else, go there.
  if (texts.length === 0) {
    await btn(page, "Town Map")
      .click({ timeout: 5_000 })
      .catch(() => undefined);
    await page.getByRole("button", { name: /Go to Your Parlor/ }).click();
    await settle(page);
    await drain();
  }
  return texts;
}

test("Yang's: the three dishes, custom and random fortunes, the allowance and the kick-out", async () => {
  const Y = T.places.yangs;
  const a = alice.page;
  const b = bob.page;
  // Three deliveries a day for this test (the default is one; the limit is tested at the end).
  await setSettings(a, TOWNS.main, { yangsPerDay: 3 });
  await goTo(a, PLACE.yangs);
  await expect(a.getByText(stripCodes(Y.note))).toBeVisible();
  await expect(a.getByRole("status").filter({ hasText: Y.statusReady })).toBeVisible();
  await seeText(
    a,
    rx(
      Y.menu
        .replace("{dragonLuck}", "10")
        .replace("{dragonCost}", "5")
        .replace("{sparrowLuck}", "5")
        .replace("{sparrowCost}", "20")
        .replace("{tigerLuck}", "10")
        .replace("{tigerCost}", "20"),
    ),
  );
  for (const label of ["Order #1", "Order #2", "Order #3", "Leave"])
    await expect(btn(a, label)).toBeVisible();

  // The Lucky Dragon is for the down on their luck: at 50 it is refused and nothing is spent.
  const bp0 = num((await readStats(a)).bpToday);
  await goTo(a, PLACE.yangs);
  await press(a, "Order #1");
  await seeText(a, rx(Y.dragonLater.replace("{limit}", "40")));
  await press(a, "Continue");
  expect(num((await readStats(a)).bpToday)).toBe(bp0);

  // A Lucky Sparrow to Bob with a fortune of her own: the picker lists the parlors, the notepad asks.
  const luck0 = await luckOf(b);
  const deliver = async (order: string, who: string, fortune: string) => {
    await goTo(a, PLACE.yangs);
    await press(a, order);
    const picker = dialog(a);
    await expect(picker).toContainText(
      order === "Order #2" ? "Who's the lucky person?" : "Who would this unlucky person be?",
    );
    await picker.getByRole("radio", { name: who }).check({ force: true });
    await picker.getByRole("button", { name: "Choose" }).click();
    await settle(a);
    await expect(dialog(a)).toContainText(
      "If you would like to write a custom fortune, enter it now.",
    );
    await submitNotepad(a, fortune);
    await seeText(a, rx(Y.leaves));
    await press(a, "Continue");
  };
  await deliver("Order #2", bob.player.name, "Many thanks for the business.");
  // Two Cursed Tigers: one with a fortune from the kitchen (left empty), one of her own.
  await deliver("Order #3", bob.player.name, "");
  await deliver("Order #3", bob.player.name, "May your caskets rust.");
  expect(bp0 - num((await readStats(a)).bpToday)).toBe(60);

  // The fourth delivery of the day is over the allowance: Yang's is out, and one can Get Bitchy.
  await goTo(a, PLACE.yangs);
  await press(a, "Order #3");
  await seeText(a, rx(Y.tigerOut.replace("{player}", alice.player.name)));
  await expect(btn(a, "Get Bitchy")).toBeVisible();
  await press(a, "Continue");
  await seeText(a, rx(Y.menu));

  // Bob finds the letters: sparrow (named, +5), then the tigers (anonymous, -10 each).
  const letters = await readLetters(b);
  const all = letters.join(" | ");
  expect(all).toMatch(
    rx(
      Y.sparrowMail
        .replace("{name}", alice.player.name)
        .replace("{fortune}", "Many thanks for the business.")
        .replace("{luck}", "5"),
    ),
  );
  expect(all).toMatch(
    rx(Y.tigerMail.replace("{fortune}", "May your caskets rust.").replace("{luck}", "10")),
  );
  expect(all).toMatch(rx(Y.tigerMail.replace("{luck}", "10")));
  // The tiger never signs its name.
  for (const letter of letters.filter((l) => l.includes("Some delicious"))) {
    expect(letter).not.toContain(alice.player.name);
  }
  // 50 + 5 - 10 - 10 = 35.
  await expect.poll(() => luckOf(b)).toBe(luck0 + 5 - 10 - 10);

  // Bob, now below 40, eats the Lucky Dragon for 5 of today's Bury Points: +10 luck.
  await goTo(b, PLACE.yangs);
  const bobBp = num((await readStats(b)).bpToday);
  await goTo(b, PLACE.yangs);
  await press(b, "Order #1");
  await seeText(b, rx(Y.dragonDone.replace("{luck}", "10")));
  await press(b, "Continue");
  expect(bobBp - num((await readStats(b)).bpToday)).toBe(5);
  expect(await luckOf(b)).toBe(luck0 + 5 - 20 + 10);

  // Alice orders for herself: the delivery is refused with no cost (still within the allowance?).
  // She has used 3 of 3, so she raises the allowance for this one check.
  await setSettings(a, TOWNS.main, { yangsPerDay: 5 });
  await goTo(a, PLACE.yangs);
  await press(a, "Order #2");
  const picker = dialog(a);
  await picker.getByRole("radio", { name: alice.player.name }).check({ force: true });
  await picker.getByRole("button", { name: "Choose" }).click();
  await settle(a);
  await submitNotepad(a, "");
  await seeText(a, rx(Y.selfTarget.replace("{player}", alice.player.name)));
  await press(a, "Continue");

  // Back to the allowance of one: a delivery is now over it, and Get Bitchy throws her out.
  await setSettings(a, TOWNS.main, { yangsPerDay: 1 });
  await goTo(a, PLACE.yangs);
  await press(a, "Order #2");
  await seeText(a, rx(Y.sparrowOut));
  await press(a, "Get Bitchy");
  await seeText(a, rx(Y.bitchy.replace("{player}", alice.player.name)));
  await press(a, "Leave");
  // Thrown out: the next visit only meets June's brush-off.
  await goTo(a, PLACE.yangs);
  await seeText(a, rx(Y.kicked.replace("{player}", alice.player.name)));
  await expect(a.getByRole("status").filter({ hasText: Y.statusKicked })).toBeVisible();
  await expect(btn(a, "Order #1")).toHaveCount(0);
  await press(a, "Leave");
  await setSettings(a, TOWNS.main, { yangsPerDay: 3 });
});

// ------------------------------------------------------------------ Church, hospital, library, name

test("the church and the hospital's front desk greet the player by name", async () => {
  const { page, player } = alice;
  await goTo(page, PLACE.church);
  await seeText(
    page,
    `Father Smyth: "Why hello there, ${player.name}.  Isn't it a wonderfully fantastic day today?  Praise the Lord."`.replace(
      /\s+/g,
      " ",
    ),
  );
  await expect(
    page.getByText("Father Smyth greets you warmly, a little too warmly."),
  ).toBeVisible();
  await expect(btn(page, "Leave")).toBeVisible();
  await press(page, "Leave");
  await expect(page.getByRole("button", { name: /Go to Your Parlor/ })).toBeVisible();

  await goTo(page, PLACE.hospital);
  await expect(page.getByText(stripCodes(T.places.hospital.note))).toBeVisible();
  await seeText(page, rx(T.places.hospital.greeting.replace("{player}", player.name)));
  await press(page, "Leave");
});

test("the library: the Book of Deeds names the leader while nobody has won, and the old papers prompt", async () => {
  const { page, player } = alice;
  const U = T.places.university;
  await goTo(page, PLACE.university);
  await press(page, "Library");
  await seeText(page, rx(U.library));
  await press(page, "View Deeds");
  await seeText(page, rx(U.deedsTitle));
  await seeText(page, rx(U.deedsNone));
  // The glimmer of hope is the parlor with the most Bury Points: Alice sold the most.
  await seeText(page, rx(U.deedsHope.replace("{name}", player.name)));
  await press(page, "Back");
  // Old papers: the prompt names the days there are (none yet on day 1); asking for one that is not there.
  await press(page, "Old Papers");
  await expect(dialog(page)).toContainText(rx(U.paperPrompt));
  await submitNotepad(page, "1");
  await seeText(page, rx(U.paperMissing.replace("{day}", "1")));
  await press(page, "Back");
  // Cancelling goes back to the library.
  await press(page, "Old Papers");
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await settle(page);
  await seeText(page, rx(U.library));
  await press(page, "Back");
  await press(page, "Leave");
});

test("changing the name: the checks in order, the swear filter, the paper's NAME CHANGE line", async () => {
  const { page, player } = alice;
  const O = T.places.options;
  const goldBefore = await stat(page, "gold");
  const open = async () => {
    await toDesk(page);
    await press(page, "Stats");
    await press(page, "Name");
    await seeText(page, rx(O.ask.replace("{cost}", "1")));
    await press(page, "Yes");
    await expect(dialog(page)).toContainText("Enter your new name.");
  };
  await open();
  // Cancelled: back to the question.
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await settle(page);
  await seeText(page, rx(O.ask.replace("{cost}", "1")));
  await press(page, "Yes");
  await submitNotepad(page, player.name);
  await seeText(page, rx(O.same.replace("{name}", player.name)));
  await press(page, "Continue");
  await press(page, "Yes");
  await submitNotepad(page, "Al");
  await seeText(page, rx(O.short));
  await press(page, "Continue");
  await press(page, "Yes");
  await submitNotepad(page, "A very very long name indeed");
  await seeText(page, rx(O.long));
  await press(page, "Continue");
  await press(page, "Yes");
  // Another player's name, in other capitals, is taken.
  await submitNotepad(page, bob.player.name.toUpperCase());
  await seeText(page, rx(O.taken.replace("{name}", bob.player.name.toUpperCase())));
  await press(page, "Continue");
  await press(page, "Yes");
  // The original's swear filter changes the word it finds ("shit" becomes "shoot").
  await submitNotepad(page, "Alice Shit");
  await seeText(page, rx(O.done.replace("{name}", "Alice shoot")));
  await press(page, "Continue");
  expect(goldBefore - (await stat(page, "gold"))).toBe(1);
  alice.player = { ...player, name: "Alice shoot" };
  // The paper has the line, and nobody but the player's new name shows in the rankings.
  await toDesk(page);
  await press(page, "Read Paper");
  await expect(paper(page)).toContainText(
    rx(
      O.news.replace("{old}", player.name).replace("{his}", "his").replace("{new}", "Alice shoot"),
    ),
  );
  await press(page, "Continue");
});

// ------------------------------------------------------------------ psychology and the bonus

test("psychology reads the customer, and a bill near the limit earns a bonus", async () => {
  test.setTimeout(300_000);
  const a = alice.page;
  const N = T.negotiation;
  const customer = a.getByRole("region", { name: "The customer" });
  const seen = { resistance: false, estimate: false, mood: false };
  let bonusText = "";
  for (let n = 0; n < 150 && !bonusText; n++) {
    await meet(a);
    const text = norm(await well(a).textContent());
    if (await customer.locator(".fq-readout-resist").isVisible()) seen.resistance = true;
    if (/seems (heartbroken|guilty)\./.test(text)) seen.mood = true;
    const limit = /worth about \$([\d,]+)/.exec(text)?.[1];
    if (limit === undefined) {
      await finishSale(a);
      continue;
    }
    seen.estimate = true;
    // The estimate is the limit itself (doubled, if that skill fired): pad the bill with soft sells
    // until it is within $100 of it.
    for (let i = 0; i < 10; i++) {
      const remaining = num(limit) - (await totalOf(a));
      if (remaining <= 150) break;
      await press(a, "Soft Sell");
      if (!(await customer.isVisible())) break;
    }
    if (await customer.isVisible()) {
      const done = await finishSale(a);
      if (/EXCELLENT|GREAT|NICE/.test(done)) bonusText = done;
    } else await closeAnything(a);
    await toDesk(a);
  }
  expect(seen.estimate).toBe(true);
  expect(seen.resistance).toBe(true);
  expect(bonusText, "no bonus came up").not.toBe("");
  expect(bonusText).toMatch(anyOf(N.done.perfect, N.done.great, N.done.nice));
  expect(bonusText).toMatch(rx(N.done.success));
});

// ------------------------------------------------------------------ visits and battle

/** Logs a player off with the round Exit button, and back on from the front door's welcome. */
async function logOff(who: Who): Promise<void> {
  await clickClear(who.page, who.page.locator(".fq-exit"));
  await who.page.getByRole("button", { name: "Leave" }).click();
  await expect(who.page.getByText(`Welcome back, ${who.player.name}.`)).toBeVisible();
}

async function logBackOn(who: Who): Promise<void> {
  await who.page.getByRole("button", { name: "Open the parlor" }).click();
  await expect(who.page.getByRole("button", { name: "Open the parlor" })).toBeHidden();
  await expect(who.page.locator(".fq-cabinet")).toBeVisible();
  await settle(who.page);
}

/** The visits left today, from the stats sheet. */
const visitsLeft = (page: Page): Promise<number> => stat(page, "visits");

/** At the row of parlors, looks for a parlor by (part of) its owner's name; answers "Yes" to the first match. */
async function findParlor(page: Page, search: string): Promise<void> {
  await goTo(page, PLACE.rivals);
  await press(page, "Visit");
  await expect(dialog(page)).toContainText(S.visit.whoPrompt.replace(/`./g, ""));
  await submitNotepad(page, search);
  await expect(dialog(page)).toContainText(rx(S.mail.doYouMean));
  await answer(page, "Yes");
}

/** Sells `count` customers with Done after a random number of Hard Sells, for tags of every kind. */
async function sellSome(page: Page, count: number): Promise<void> {
  const customer = page.getByRole("region", { name: "The customer" });
  for (let n = 0; n < count; n++) {
    await meet(page);
    for (let i = 0; i < n % 3; i++) {
      if (!(await customer.isVisible())) break;
      await press(page, "Hard Sell");
    }
    if (await customer.isVisible()) await finishSale(page);
    else {
      await closeAnything(page);
      await toDesk(page);
    }
  }
}

/** Attacks round after round until one fighter is down; returns whether the player won. */
async function fightToTheEnd(page: Page): Promise<boolean> {
  const B = S.battle;
  for (let round = 0; round < 60; round++) {
    await press(page, "Attack");
    const text = norm(await well(page).textContent());
    // Every round says who hit, who dodged or who stepped aside, with the damage.
    expect(text).toMatch(/damage|dodges|sidestep|You have won|You fall down/);
    if (
      !(await btn(page, "Attack")
        .isVisible()
        .catch(() => false))
    ) {
      const won = rx(B.won).test(text);
      expect(won || rx(B.lost).test(text), text).toBe(true);
      return won;
    }
  }
  throw new Error("the fight never ended");
}

/**
 * After a fight: Continue opens the notepad for a last word (`quote` null cancels it); the winner
 * goes back to the row of parlors, the loser wakes up in the hospital.
 */
async function lastWords(page: Page, won: boolean, quote: string | null): Promise<void> {
  const B = S.battle;
  await press(page, "Continue");
  await expect(dialog(page)).toContainText(rx(won ? B.yellWinPrompt : B.yellLostPrompt));
  if (quote === null) {
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await settle(page);
  } else await submitNotepad(page, quote);
  if (won) {
    await seeText(page, /You look at your watch/);
    await press(page, "Leave");
  } else {
    await seeText(page, rx(T.places.hospital.roomText));
    await press(page, "Leave");
    await seeText(page, rx(T.places.hospital.wakeUp));
    await press(page, "Leave");
  }
}

let carl!: Who;

/** Opens today's paper at a section ("Front Page", "Crime", "Yesterday", "Today"); returns its body text. */
async function openPaper(page: Page, section?: string): Promise<string> {
  await toDesk(page);
  await press(page, "Read Paper");
  await expect(page.locator(".fq-news")).toBeVisible();
  if (section && section !== "Front Page") await press(page, section);
  return norm(await paper(page).first().textContent());
}

test("rival parlors with a rival online: Look lists everyone, a visit is refused, your own door, no such name", async () => {
  const { page, player } = alice;
  const V = S.visit;
  await goTo(page, PLACE.rivals);
  await expect(page.getByText(stripCodes(V.note))).toBeVisible();
  await seeText(page, rx(V.watchMany.replace("{visits}", "8")));
  for (const label of ["Leave", "Look", "Visit"]) await expect(btn(page, label)).toBeVisible();

  // Look: the ranked list, online players marked, yourself included (the original's "add_rankings_alive").
  await press(page, "Look");
  const table = page.getByRole("table");
  await expect(table.getByText(player.parlor)).toBeVisible();
  await expect(table.getByText(bob.player.parlor)).toBeVisible();
  await expect(table.getByText(T.rankings.onNow, { exact: false }).first()).toBeVisible();
  await press(page, "Continue");

  // A rival who is online cannot be visited, and it costs no visit.
  const before = await visitsLeft(page);
  await findParlor(page, bob.player.name.slice(0, 7));
  await seeText(page, rx(V.online.replace("{name}", bob.player.name)));
  await expect(page.getByRole("region", { name: "Notes" })).toContainText(
    rx(V.frontNote.replace("{parlor}", bob.player.parlor)),
  );
  await press(page, "Leave");
  // Your own parlor: "strangely familiar", and no visit used.
  await findParlor(page, player.name.slice(0, 6));
  await seeText(page, rx(V.self));
  await press(page, "Continue");
  expect(await visitsLeft(page)).toBe(before);

  // Nobody by that name.
  await goTo(page, PLACE.rivals);
  await press(page, "Visit");
  await submitNotepad(page, "zzzqqq");
  await seeDialog(page, rx(S.mail.noName));
  await dialog(page).getByRole("button").first().click();
  await settle(page);
  await press(page, "Leave");
});

test("logging off and back on keeps the parlor; a rival logging off can be visited", async () => {
  const before = await readStats(bob.page);
  await logOff(bob);
  await logBackOn(bob);
  await toDesk(bob.page);
  const after = await readStats(bob.page);
  // The same parlor (letters waiting at the desk may add Bury Points when they are read).
  expect(num(after.bpTotal)).toBeGreaterThanOrEqual(num(before.bpTotal));
  expect(after.gold).toBe(before.gold);
  await logOff(bob);
});

test("visiting an offline rival: the door, a padlock, a lockpick, the safe, the hit points", async () => {
  const { page } = alice;
  const V = S.visit;
  const visits0 = await visitsLeft(page);
  const picks0 = num((await readStats(page)).lockpicks);
  await findParlor(page, bob.player.name.slice(0, 7));
  await seeText(
    page,
    rx(V.outside.replace("{name}", bob.player.name).replace("{ride}", T.hearseNames[0] as string)),
  );
  await expect(page.getByRole("region", { name: "Notes" })).toContainText(
    rx(V.frontNote.replace("{parlor}", bob.player.parlor)),
  );
  // Try the door: a heavy padlock at full strength, and the lockpicks in hand.
  await press(page, "Try Door");
  await seeText(
    page,
    rx(V.padlockWithPicks.replace("{strength}", "100").replace("{picks}", String(picks0))),
  );
  await expect(btn(page, "Pick Lock")).toBeVisible();
  // Pick the lock: 5 to 10 points of damage, the pick breaks, Continue leads inside.
  await press(page, "Pick Lock");
  await seeText(page, rx(V.lockPicked));
  const damage = Number(/causes the padlock (\d+)/.exec(norm(await well(page).textContent()))?.[1]);
  expect(damage).toBeGreaterThanOrEqual(5);
  expect(damage).toBeLessThanOrEqual(10);
  await press(page, "Continue");
  await seeText(page, rx(V.inside.replace("{name}", bob.player.name)));
  // Bob has a safe: it is said, and there is no Steal.
  await seeText(page, rx(V.safe));
  await seeText(page, rx(V.hitpoints.replace("{name}", bob.player.name).replace("{hp}", "10")));
  await expect(btn(page, "Attack")).toBeVisible();
  await expect(btn(page, "Steal")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Notes" })).toContainText(
    rx(V.insideNote.replace("{parlor}", bob.player.parlor)),
  );

  // Inside there is no way out but through (the original offers Attack and Steal only): attack,
  // and run away. The picture says the fight is on, with both fighters' hit points.
  const B = S.battle;
  await press(page, "Attack");
  await seeText(page, rx(B.scream));
  await seeText(page, anyOf(B.cries.map((c) => c.replace("{discount}", B.discountMale))));
  // Alice has more plots, so she swings first.
  await seeText(page, rx(B.firstSwing.replace("{name}", bob.player.name)));
  const fight = page.getByRole("region", { name: "The fight" });
  await expect(fight.getByRole("meter")).toHaveCount(2);
  await expect(fight).toContainText("10/10");
  await expect(btn(page, "Run")).toBeVisible();
  await expect(btn(page, "Attack")).toBeVisible();
  await press(page, "Run");
  await seeText(page, rx(B.run));
  await press(page, "Continue");
  await seeText(page, rx(V.watchMany.replace("{visits}", String(visits0 - 1))));
  await press(page, "Leave");
  expect(num((await readStats(page)).lockpicks)).toBe(picks0 - 1);
  expect(await visitsLeft(page)).toBe(visits0 - 1);
});

test("stealing from a parlor without a safe, then a whole battle, the quote and the crime page", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const { page } = alice;
  const V = S.visit;
  const B = S.battle;
  // Carl is a new parlor with tags of every kind, and offline.
  carl = await join(browser, TOWNS.main, "carl");
  await sitDown(carl.page);
  await sellSome(carl.page, 30);
  await logOff(carl);

  await findParlor(page, carl.player.name.slice(0, 7));
  await seeText(page, rx(V.outside.replace("{name}", carl.player.name)));
  await press(page, "Try Door");
  // No padlock: straight inside, with both choices and no mention of a safe.
  await seeText(page, rx(V.inside.replace("{name}", carl.player.name)));
  await expect(btn(page, "Steal")).toBeVisible();
  await expect(well(page)).not.toContainText("Safe");
  await press(page, "Steal");
  const stolen = anyOf(
    V.stealNothing,
    V.stealNone,
    V.stealOne.replace("{type}", "wooden"),
    V.stealOne.replace("{type}", "silver"),
    V.stealOne.replace("{type}", "gold"),
    V.stealMany,
  );
  await seeText(page, stolen);
  await seeText(page, rx(V.caught.replace("{name}", carl.player.name)));
  await press(page, "Leave");

  // Again, and this time a fight to the end: Alice has the plots, so she swings first.
  await findParlor(page, carl.player.name.slice(0, 7));
  await press(page, "Try Door");
  await press(page, "Attack");
  await seeText(page, rx(B.firstSwing.replace("{name}", carl.player.name)));
  const won = await fightToTheEnd(page);
  await lastWords(page, won, "Mind the gap.");
  // The Crime section of today's paper has the line and the quote.
  const [winner, loser] = won
    ? [alice.player.name, carl.player.name]
    : [carl.player.name, alice.player.name];
  const crime = (await openPaper(page, "Crime")).replace(/\s+/g, " ");
  expect(crime).toMatch(
    rx(
      (won ? B.crimeWinQuote : B.crimeLostQuote)
        .replaceAll("{winner}", winner)
        .replaceAll("{loser}", loser)
        .replace("{quote}", "Mind the gap."),
    ),
  );
  expect(crime).toContain("Mind the gap.");
  await press(page, "Continue");
});

test("the victims log back on and read what happened to them", async () => {
  const V = S.visit;
  const B = S.battle;
  // Bob: a prowler weakened his padlock, and someone broke in and ran away.
  await logBackOn(bob);
  const bobLetters = (await readLetters(bob.page)).join(" | ");
  expect(bobLetters).toMatch(rx(V.lockPickedMail));
  expect(bobLetters).toMatch(rx(B.attackedMail.replace("{name}", alice.player.name)));
  expect(bobLetters).toMatch(rx(B.ranOffMail));
  // Carl: the burglar was seen, and then beaten, or won (a letter either way), with the last words.
  await logBackOn(carl);
  const carlLetters = (await readLetters(carl.page)).join(" | ");
  expect(carlLetters).toMatch(rx(V.stealMail.replace("{name}", alice.player.name)));
  expect(carlLetters).toMatch(rx(B.attackedMail.replace("{name}", alice.player.name)));
  expect(carlLetters).toContain("Mind the gap.");
  await toDesk(carl.page);
  await toDesk(bob.page);
});

test("a weaker rival breaks into a sleeping parlor without a pick, then with one, loses, and wakes up in the hospital", async () => {
  test.setTimeout(180_000);
  const V = S.visit;
  const B = S.battle;
  const b = bob.page;
  // Alice goes to bed: her padlock and safe stand.
  await logOff(alice);
  // Without a lockpick the padlock holds: "you attempt to pick the lock with your finger".
  await findParlor(b, alice.player.name.slice(0, 7));
  await press(b, "Try Door");
  await seeText(b, rx(V.padlock.replace("{strength}", "100")));
  await press(b, "Pick Lock");
  await seeText(b, rx(V.noPick));
  await press(b, "Leave");
  // One gold tag buys a pick.
  await goTo(b, PLACE.store);
  await press(b, "Supplies");
  await press(b, "View #1");
  await press(b, "Buy one");
  await press(b, "Continue");
  await press(b, "Back");
  await press(b, "Back");
  await findParlor(b, alice.player.name.slice(0, 7));
  await press(b, "Try Door");
  await seeText(b, rx(V.padlockWithPicks.replace("{strength}", "100").replace("{picks}", "1")));
  await press(b, "Pick Lock");
  await press(b, "Continue");
  await seeText(b, rx(V.safe));
  await press(b, "Attack");
  await seeText(b, rx(B.scream));
  // Bob has fewer plots: the sleeper wakes and strikes first.
  await seeText(b, rx(B.theyKnew.replace("{name}", alice.player.name)));
  const won = await fightToTheEnd(b);
  await lastWords(b, won, null);
  // The paper's Crime section has the plain line (no quote was given).
  const [winner, loser] = won
    ? [bob.player.name, alice.player.name]
    : [alice.player.name, bob.player.name];
  const crime = (await openPaper(b, "Crime")).replace(/\s+/g, " ");
  expect(crime).toMatch(
    rx((won ? B.crimeWin : B.crimeLost).replace("{winner}", winner).replace("{loser}", loser)),
  );
  await press(b, "Continue");
  // Alice wakes up to the news.
  await logBackOn(alice);
  const letters = (await readLetters(alice.page)).join(" | ");
  expect(letters).toMatch(rx(B.attackedMail.replace("{name}", bob.player.name)));
  expect(letters).toMatch(rx(V.lockPickedMail));
  await toDesk(alice.page);
});

// ------------------------------------------------------------------ the Pale Horse Cafe

const chatBox = (page: Page): Locator => page.getByRole("textbox", { name: "Say something" });

/** Types a line (or several, joined with `|`) in the cafe and sends it. */
async function say(page: Page, text: string): Promise<void> {
  await chatBox(page).fill(text);
  await chatBox(page).press("Enter");
  await expect(chatBox(page)).toHaveValue("");
}

async function chatSees(page: Page, pattern: RegExp | string): Promise<void> {
  await expect(chatLog(page)).toContainText(pattern);
}

test("the cafe: arrivals, help, who, info, all, talk, /me, /yell, unknown commands, leaving", async () => {
  const C = S.cafe;
  const a = alice.page;
  const c = carl.page;
  await toDesk(a);
  await toDesk(c);
  // Alice goes in first: she is the only one there.
  await goTo(a, PLACE.cafe);
  await expect(chatBox(a)).toBeVisible();
  await seeText(a, rx(C.intro.replace("{names}", C.onlyOne)));
  // Carl comes in: Alice hears it, and Carl is told who is here.
  await goTo(c, PLACE.cafe);
  await chatSees(a, rx(C.saunters.replace("{name}", carl.player.name)));
  await seeText(c, rx(C.othersHere));
  await seeText(c, alice.player.name);

  // Talk: everyone in the room reads it, after the original's swear filter.
  await say(a, "hello Carl");
  await chatSees(c, rx(C.say.replace("{name}", alice.player.name).replace("{text}", "hello Carl")));
  await chatSees(a, rx(C.say.replace("{name}", alice.player.name).replace("{text}", "hello Carl")));
  await say(c, "what the fuck is this");
  await chatSees(a, `${carl.player.name}: what the fudge is this`);
  // Several lines in one go, separated by a bar.
  await say(a, "one|two|three");
  for (const word of ["one", "two", "three"])
    await chatSees(c, rx(C.say.replace("{name}", alice.player.name).replace("{text}", word)));

  // /? and its help text; /who; /info with her own numbers; /all.
  await say(a, "/?");
  await chatSees(a, "Cafe chat help");
  await chatSees(a, "/yell to send a message to everyone");
  await chatSees(a, "/give name tag_type to give a tag");
  await say(a, "/who");
  await chatSees(a, rx(C.othersHere));
  const stats = await readStats(a);
  await goTo(a, PLACE.cafe);
  await say(a, "/info");
  const st = (id: string) => stats[id] ?? "";
  await chatSees(
    a,
    rx(
      C.info
        .replace("{turns}", st("turns"))
        .replace("{visits}", st("visits"))
        .replace("{bpToday}", st("bpToday"))
        .replace("{bp}", st("bpTotal"))
        .replace("{wood}", st("wood"))
        .replace("{silver}", st("silver"))
        .replace("{gold}", st("gold")),
    ),
  );
  await say(a, "/all");
  await chatSees(a, "Name                 Status            Last hit");
  await chatSees(a, new RegExp(`${escapeRx(alice.player.name)}\\s+in cafe`));
  await chatSees(a, new RegExp(`${escapeRx(carl.player.name)}\\s+in cafe`));
  // /me and /yell (Bob, at his desk, is told about the yell too).
  await say(a, "/me tips her hat");
  await chatSees(c, `${alice.player.name} tips her hat`);
  await say(a, "/yell is anybody out there");
  await chatSees(
    c,
    rx(C.yell.replace("{name}", alice.player.name).replace("{text}", "is anybody out there")),
  );
  await say(a, "/dance");
  await chatSees(a, rx(C.unknown));

  // Carl leaves through the map; Alice sees him step out.
  await btn(c, "Town Map")
    .isVisible()
    .catch(() => false);
  await toDesk(c);
  await chatSees(a, rx("{name} steps outside.".replace("{name}", carl.player.name)));
});

/** Walks into the cafe (from wherever the player is). A walk in starts the transcript afresh. */
async function enterCafe(who: Who): Promise<void> {
  await goTo(who.page, PLACE.cafe);
  await expect(chatBox(who.page)).toBeVisible();
}

test("the cafe: /give with every check, the town's one TV, and a Yang's commercial on it", async () => {
  const C = S.cafe;
  const a = alice.page;
  const b = bob.page;
  const c = carl.page;
  const carlPart = carl.player.name.slice(4);
  const bobPart = bob.player.name.slice(4);
  const mine = alice.player.name;
  // No silver in the pockets (the teller turns it all to gold), so a silver gift comes up empty.
  await goTo(a, PLACE.bank);
  await press(a, "All to gold");
  await closeAnything(a);
  expect(await stat(a, "silver")).toBe(0);
  const gold0 = await stat(a, "gold");
  const carlGold0 = await stat(c, "gold");
  for (const who of [alice, bob, carl]) await enterCafe(who);
  const gave = (target: string) =>
    rx(C.gave.replace("{name}", mine).replace("{target}", target).replace("{casket}", "Gold"));

  // The checks, in the original's order: nobody there by that name, a tag that is not a tag,
  // none of that kind in the pocket, yourself.
  await say(a, "/give zzzzzz gold");
  await chatSees(a, rx(C.giveNobody.replace("{search}", "zzzzzz")));
  await say(a, `/give ${carlPart} platinum`);
  await chatSees(a, rx(C.giveBadType));
  await say(a, `/give ${carlPart} silver`);
  await chatSees(c, rx(C.giveEmpty.replace("{name}", mine).replace("{casket}", "Silver")));
  await say(a, `/give ${mine.slice(-5)} gold`);
  await chatSees(c, rx(C.giveSelf.replace("{name}", mine).replace("{casket}", "Gold")));
  // A real gift: the whole room hears it.
  await say(a, `/give ${carlPart} gold`);
  await chatSees(c, gave(carl.player.name));
  await chatSees(b, gave(carl.player.name));
  // One a day may be received (the sysop's setting): the second is refused, told to the room.
  await setSettings(a, TOWNS.main, { tagsReceivablePerDay: 1 });
  await say(a, `/give ${carlPart} gold`);
  await chatSees(
    b,
    rx(
      C.giveLimit
        .replace("{name}", mine)
        .replace("{target}", carl.player.name)
        .replace("{casket}", "Gold")
        .replace("{count}", "1"),
    ),
  );
  // And with the transfer switched off (0), a rival who has had none is told it is disabled.
  await setSettings(a, TOWNS.main, { tagsReceivablePerDay: 0 });
  await say(a, `/give ${bobPart} gold`);
  await chatSees(
    b,
    rx(
      C.giveDisabled
        .replace("{name}", mine)
        .replace("{target}", bob.player.name)
        .replace("{casket}", "Gold"),
    ),
  );
  await setSettings(a, TOWNS.main, { tagsReceivablePerDay: 100 });

  // The TV: one switch for the town. /tv says how it stands; "on" in any capitals turns it on,
  // any other word turns it off.
  await say(a, "/tv");
  await chatSees(a, rx(C.tvIsOn));
  await say(a, "/tv off");
  await chatSees(a, rx(C.tvTurnedOff));
  await say(a, "/tv");
  await chatSees(a, rx(C.tvIsOff));
  await say(b, "/tv");
  await chatSees(b, rx(C.tvIsOff));
  // A Yang's commercial (for Carl's parlor) while it is off does not reach the cafe...
  const commercial = rx(T.places.yangs.tv.replace("{parlor}", carl.player.parlor));
  const sendSparrow = async (fortune: string) => {
    await goTo(b, PLACE.yangs);
    await press(b, "Order #2");
    const picker = dialog(b);
    await picker.getByRole("radio", { name: carl.player.name }).check({ force: true });
    await picker.getByRole("button", { name: "Choose" }).click();
    await settle(b);
    await submitNotepad(b, fortune);
    await press(b, "Continue");
  };
  await sendSparrow("off the air");
  // ...and with it on, it does (Bob walked out; Alice and Carl are still in).
  await say(c, "/tv ON");
  await chatSees(c, rx(C.tvTurnedOn));
  await sendSparrow("on the air");
  await expect(chatLog(a)).toContainText(commercial);
  const lines = await chatLog(a).locator("li").allTextContents();
  expect(lines.filter((l) => commercial.test(l.replace(/\s+/g, " ")))).toHaveLength(1);
  await say(a, "/tv please stop");
  await chatSees(a, rx(C.tvTurnedOff));
  await say(a, "/tv on");
  await chatSees(a, rx(C.tvTurnedOn));
  // The tags changed hands: one gold from Alice to Carl, nothing else.
  expect(await stat(a, "gold")).toBe(gold0 - 1);
  expect(await stat(c, "gold")).toBe(carlGold0 + 1);
});

// ------------------------------------------------------------------ letters

/** Writes a letter: the name search (answering No until the name asked for comes up), then the notepad. */
async function writeLetter(
  page: Page,
  search: string,
  wanted: string,
  text: string,
): Promise<void> {
  await toDesk(page);
  await press(page, "Write Letter");
  await expect(dialog(page)).toContainText(rx(S.mail.whoPrompt));
  await expect(dialog(page)).toContainText(S.mail.nameHint);
  await submitNotepad(page, search);
  for (let i = 0; i < 8; i++) {
    await expect(dialog(page)).toContainText(rx(S.mail.doYouMean));
    if (norm(await dialog(page).textContent()).includes(`Do you mean ${wanted}?`)) {
      await answer(page, "Yes");
      break;
    }
    await answer(page, "No");
  }
  await expect(dialog(page)).toContainText(rx(S.mail.composePrompt));
  await submitNotepad(page, text);
}

test("letters: the name search, a letter, the reply with its quote, the cafe's notice, cancelling", async () => {
  const M = S.mail;
  const a = alice.page;
  const c = carl.page;
  await enterCafe(carl);
  // Nobody by that name, and cancelling the name prompt, send nothing.
  await toDesk(a);
  await press(a, "Write Letter");
  await submitNotepad(a, "zzzzzz");
  await seeDialog(a, rx(M.noName));
  await dialog(a).getByRole("button").first().click();
  await settle(a);
  await expect(btn(a, "Wait for Customer")).toBeVisible();
  await press(a, "Write Letter");
  await dialog(a).getByRole("button", { name: "Cancel" }).click();
  await settle(a);
  await expect(btn(a, "Wait for Customer")).toBeVisible();

  // A partial name matches everyone: "Do you mean ...?" goes through them until Carl.
  const body = "Dear Carl,\nthe wake is at six.\nBring flowers.";
  await writeLetter(a, "Ned", carl.player.name, body);
  await expect(btn(a, "Wait for Customer")).toBeVisible();
  // Carl, in the cafe, is told; his desk's indicator counts the letter.
  await chatSees(c, rx(M.waiting));
  await expect(c.getByRole("status").filter({ hasText: /letter/ })).toContainText(
    "1 letter is waiting at your desk",
  );

  // He steps out to the desk: the letter, with the question whether to reply.
  await press(c, "Leave");
  await c.getByRole("button", { name: /Go to Your Parlor/ }).click();
  await settle(c);
  const letter = dialog(c);
  await expect(letter).toContainText(
    rx(M.received.replace("{name}", alice.player.name).replace("{text}", "")),
  );
  await expect(letter).toContainText("Dear Carl,");
  await expect(letter).toContainText("the wake is at six.");
  await expect(letter).toContainText(rx(M.replyPrompt));
  await answer(c, "Yes");
  // The notepad opens with the letter quoted, line by line.
  const pad = dialog(c).getByRole("textbox");
  await expect(pad).toHaveValue(/>Dear Carl,\n>the wake is at six\.\n>Bring flowers\./);
  await pad.press("End");
  await pad.pressSequentially("\nI will, thank you.");
  await dialog(c).getByRole("button", { name: "Submit" }).click();
  await settle(c);
  await expect(btn(c, "Wait for Customer")).toBeVisible();

  // Alice reads the answer: Carl's words under the quote of her own letter.
  // (An idle desk is pushed the letter; otherwise a visit to the desk delivers it.)
  const pushed = await dialog(a)
    .waitFor({ state: "visible", timeout: 4_000 })
    .then(
      () => true,
      () => false,
    );
  if (!pushed) {
    await press(a, "Town Map");
    await a.getByRole("button", { name: /Go to Your Parlor/ }).click();
    await settle(a);
  }
  const reply = dialog(a);
  await expect(reply).toContainText(
    rx(M.received.replace("{name}", carl.player.name).replace("{text}", "")),
  );
  await expect(reply).toContainText("I will, thank you.");
  await expect(reply).toContainText(">the wake is at six.");
  await answer(a, "No");
  await expect(btn(a, "Wait for Customer")).toBeVisible();
});

// ------------------------------------------------------------------ the paper

test("the paper: front page, crime page, yesterday and today, announcements with links", async () => {
  const N = S.news;
  const a = alice.page;
  // Today's front page: the new parlors, the top seller of the day (the day's most Bury Points).
  const front = await openPaper(a);
  expect(front).toContain(`A new parlor (${alice.player.parlor}) run by`);
  await expect(a.getByRole("heading", { name: "Top Seller Of The Day" })).toBeVisible();
  await expect(a.getByRole("heading", { name: "Yesterday's Top Seller" })).toBeVisible();
  await expect(a.locator(".fq-news")).toContainText(rx(T.news.topToday));
  await expect(a.locator(".fq-news")).toContainText(T.news.noTopYesterday);
  // The sections: Crime has the day's crimes (the burglaries and fights above), Front Page comes back.
  await press(a, "Crime");
  await expect(paper(a).first()).toContainText(/assaulted/);
  await press(a, "Front Page");
  // Yesterday's edition on day 1 is the day before the game: nothing happened. The button turns into Today.
  await press(a, "Yesterday");
  await expect(a.locator(".fq-edition")).toBeVisible();
  await expect(paper(a).first()).toContainText(T.news.nothingToday);
  await expect(btn(a, "Today")).toBeVisible();
  await press(a, "Today");
  await expect(btn(a, "Yesterday")).toBeVisible();

  // An announcement: the swear filter, backticks removed, [text] made a link when it is an address.
  await press(a, "Make Announcement");
  await expect(dialog(a)).toContainText(N.announcePrompt);
  await submitNotepad(
    a,
    "Sale on shit caskets!\nSee [example.com/caskets] or [not a link] today `4now",
  );
  const body = paper(a).first();
  await expect(body).toContainText(
    rx(
      N.announcementHeader
        .replace("{name}", alice.player.name)
        .replace("{parlor}", alice.player.parlor),
    ),
  );
  await expect(body).toContainText("Sale on shoot caskets!");
  await expect(body).toContainText("4now");
  const link = body.getByRole("link", { name: "example.com/caskets" });
  await expect(link).toHaveAttribute("href", "http://example.com/caskets");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(body.getByRole("link")).toHaveCount(1);
  await expect(body.getByText("not a link")).toBeVisible();
  // Another player sees it on the same page.
  const theirs = await openPaper(carl.page);
  expect(theirs).toContain("Sale on shoot caskets!");
  await press(carl.page, "Continue");
  await press(a, "Continue");
});

// ------------------------------------------------------------------ rankings

/** The rankings sheet: the rows in order, each as { name, bp, status, title }. */
async function readRankings(
  page: Page,
): Promise<{ name: string; bp: number; status: string; text: string }[]> {
  await toDesk(page);
  await press(page, "Rankings");
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  const rows = await table.locator("tbody tr").evaluateAll((trs) =>
    trs.map((tr) => ({
      name: tr.querySelector(".fq-rank-name")?.firstChild?.textContent?.trim() ?? "",
      bp: Number((tr.querySelector(".fq-rank-bp")?.textContent ?? "0").replace(/,/g, "")),
      status: tr.querySelector(".fq-rank-chip")?.textContent?.trim() ?? "",
      text: (tr.textContent ?? "").replace(/\s+/g, " ").trim(),
    })),
  );
  await press(page, "Continue");
  return rows;
}

test("rankings: every parlor by Bury Points, with its rating line and who is on", async () => {
  const a = alice.page;
  const rows = await readRankings(a);
  const names = [alice, bob, carl].map((w) => w.player.name);
  for (const name of names) expect(rows.map((r) => r.name)).toContain(name);
  // Sorted by total Bury Points, the best first, and every place numbered.
  const bps = rows.map((r) => r.bp);
  expect(bps).toEqual([...bps].sort((x, y) => y - x));
  await toDesk(a);
  await press(a, "Rankings");
  const table = a.getByRole("table");
  await expect(table.locator("tbody tr").first().locator(".fq-rank-place")).toHaveText("1");
  // The rating title is a line of the original's ratings.txt (each row has one).
  for (const row of rows) expect(row.text.length).toBeGreaterThan(row.name.length + 6);
  // Online players say so: Alice is on, Bob is on.
  const mine = rows.find((r) => r.name === alice.player.name);
  expect(mine?.status).toMatch(/on now|in cafe/);
  await press(a, "Continue");
});

// ------------------------------------------------------------------ a new day

/** The top seller of the day as the paper's notice names it, and the rank order of the parlors. */
async function topSellerToday(page: Page): Promise<string> {
  await openPaper(page);
  const notice = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Top Seller Of The Day" }) });
  const text = norm(await notice.textContent());
  await press(page, "Continue");
  const name = /Top Seller Of The Day\s*(.*?) from /.exec(text)?.[1];
  if (!name) throw new Error(`no top seller in "${text}"`);
  return name;
}

test("a new day: the banner, the wake-up at the desk, the morning screen, the daily rewards, yesterday's paper", async () => {
  const M = T.maintenance;
  const a = alice.page;
  const b = bob.page;
  const day0 = (
    (await (await a.request.get(`/api/towns/${TOWNS.main.id}`)).json()) as { day: number }
  ).day;

  // Who sold the most today, and how the parlors rank: the mail below goes by these.
  const top = await topSellerToday(a);
  const rank = (await readRankings(a)).map((r) => r.name);
  const bpToday = num((await readStats(a)).bpToday);
  expect(bpToday).toBeGreaterThan(0);
  // Carl goes to bed; Alice and Bob are at their desks when midnight comes.
  await logOff(carl);
  await toDesk(a);
  await toDesk(b);
  await admin(a, "POST", `/admin/towns/${TOWNS.main.id}/new-day`);
  for (const page of [a, b]) {
    await expect(page.getByText(`A new day has dawned. It is day ${day0 + 1}.`)).toBeVisible();
  }

  // Alice's next desk visit says the night passed at the desk, with the Medalist's four extra turns.
  await press(a, "Town Map");
  await a.getByRole("button", { name: /Go to Your Parlor/ }).click();
  await settle(a);
  const letters: Record<string, string> = { alice: "", bob: "" };
  const wake = rx(T.desk.newDayAtDesk.replace("{parlor}", alice.player.parlor));
  // The letters (the daily rewards) are read as overlays first, then the wake-up text.
  const read = async (who: "alice" | "bob", page: Page) => {
    const found: string[] = [];
    for (let i = 0; i < 10 && (await dialog(page).isVisible()); i++) {
      found.push(norm(await dialog(page).textContent()));
      await dialog(page).getByRole("button").first().click();
      await settle(page);
    }
    // Mail with no Continue after it (the daily rewards) is read out on the desk's own text.
    found.push(norm(await well(page).textContent()));
    letters[who] = found.join(" | ");
  };
  await read("alice", a);
  await seeText(a, wake);
  await seeText(
    a,
    rx(T.desk.hearseBonus.replace("{ride}", T.hearseNames[2] as string).replace("{turns}", "4")),
  );
  // The daily rewards come by mail on the next visit to the desk (the top seller of the day and the
  // top three parlors); reading them pays the Bury Points and the luck.
  letters.alice = (await readLetters(a)).join(" | ");
  const stats = await readStats(a);
  expect(num(stats.turns)).toBe(404);
  // Today's Bury Points start again at zero, plus the rewards the letters just paid.
  expect(num(stats.bpToday)).toBeLessThanOrEqual(60);
  expect(num(stats.bpToday)).toBeLessThan(bpToday);
  expect(num(stats.visits)).toBe(8);
  const rewards = rx(M.topSeller);
  if (top === alice.player.name) expect(letters.alice).toMatch(rewards);
  const place = rank.indexOf(alice.player.name);
  expect(letters.alice).toMatch(rx([M.topParlor, M.secondParlor, M.thirdParlor][place] as string));
  await press(b, "Town Map");
  await b.getByRole("button", { name: /Go to Your Parlor/ }).click();
  await settle(b);
  await read("bob", b);
  letters.bob = (await readLetters(b)).join(" | ");
  const bobPlace = rank.indexOf(bob.player.name);
  expect(letters.bob).toMatch(rx([M.topParlor, M.secondParlor, M.thirdParlor][bobPlace] as string));
  if (top === bob.player.name) expect(letters.bob).toMatch(rewards);

  // Carl, who was in bed, logs on to the morning screen: the new day's welcome, and the police
  // that watched his parlor overnight after he was beaten.
  await logBackOn(carl);
  await sitDownAfterLogon(carl.page);
  // Yesterday's paper: the day before has its news, the top seller's notice names the same player.
  await openPaper(a);
  await press(a, "Yesterday");
  await expect(a.locator(".fq-edition")).toBeVisible();
  await expect(paper(a).first()).toContainText("Sale on shoot caskets!");
  await expect(a.locator(".fq-news")).toContainText(top);
  await press(a, "Continue");

  // Yang's door is open again for the player thrown out yesterday.
  await goTo(a, PLACE.yangs);
  await seeText(a, rx(T.places.yangs.menu));
  await press(a, "Leave");
  // The library: the old papers now reach day 1.
  await goTo(a, PLACE.university);
  await press(a, "Library");
  await press(a, "Old Papers");
  await expect(dialog(a)).toContainText(
    rx(T.places.university.paperPrompt.replace("{max}", String(day0))),
  );
  await submitNotepad(a, String(day0));
  await seeText(a, rx(T.places.university.paperFound.replace("{day}", String(day0))));
  await seeText(a, "A new parlor (");
  await press(a, "Back");
  await press(a, "Back");
  await press(a, "Leave");
});

/** Logging on after a night away: the morning screen, then the desk. */
async function sitDownAfterLogon(page: Page): Promise<void> {
  // The paper first, then the morning at the desk with its coffee and a Continue.
  if (await page.locator(".fq-news").isVisible()) await press(page, "Continue");
  const morning = well(page);
  await expect(morning).toContainText("You unlock the front door and enter your beloved");
  await expect(morning).toContainText("Funeral Parlor.");
  await expect(morning).toContainText("There are police patrolling your parlor.");
  await press(page, "Continue");
  await toDesk(page);
}

// ------------------------------------------------------------------ events, risks, scripts

/** Sets the odds of the three things that can happen instead of a customer (the sysop's Game Settings). */
const odds = (page: Page, normal: number, luck: number, script: number) =>
  setSettings(page, TOWNS.main, { normalOdds: normal, luckOdds: luck, scriptOdds: script });

test("a random event and a risk come in place of a customer, and use no turn", async () => {
  const a = alice.page;
  const W = T.wait;
  // Every wait is a special event (the original's 8 percent, turned up).
  await odds(a, 1, 0, 0);
  await press(a, "Wait for Customer");
  await seeText(a, rx(W.eventHeader));
  // The gains and losses are told in the original's words, and the player stays at the desk.
  await expect(btn(a, "Wait for Customer")).toBeVisible();
  const event = norm(await well(a).textContent());
  expect(event).toMatch(/SPECIAL EVENT/);
  await press(a, "Wait for Customer");
  await seeText(a, rx(W.eventHeader));

  // Every wait is a risk (a woman's ring, a finger in the dirt...): decline, then take it. A risk
  // uses no turn (an event may give or take some of its own).
  const turns0 = num((await readStats(a)).turns);
  await odds(a, 0, 1, 0);
  for (const choice of ["risk:decline", "risk:take"]) {
    await press(a, "Wait for Customer");
    const take = a.locator('[data-button-id="risk:take"]');
    const decline = a.locator('[data-button-id="risk:decline"]');
    await expect(take).toBeVisible();
    await expect(decline).toBeVisible();
    await a.locator(`[data-button-id="${choice}"]`).click();
    await settle(a);
    const text = norm(await well(a).textContent());
    if (choice === "risk:decline") expect(text).toMatch(anyOf(T.risk.earnedOne, T.risk.earned));
    else expect(text).toMatch(anyOf(T.risk.won, T.risk.lost));
    await press(a, "Continue");
  }
  await odds(a, 0, 0, 0);
  expect(num((await readStats(a)).turns)).toBe(turns0);
});

test("a script event: a bonus tag, or the Twins and their fire (smoke detector and safe, a rival at the window)", async () => {
  test.setTimeout(240_000);
  const b = bob.page;
  const c = carl.page;
  await toDesk(b);
  await toDesk(c);
  await logOff(alice);
  await odds(b, 0, 0, 1);
  let bonus = 0;
  let declined = false;
  let burned = false;
  for (let step = 0; step < 80 && !(bonus > 0 && burned); step++) {
    await press(b, "Wait for Customer");
    if (await btn(b, "Hire Twins").isVisible()) {
      await expect(well(b)).toContainText(
        rx(
          "The Twins: \"We like to play with fire. We'll discreetly pay a 'visit' to any funeral parlor in town for only 6 gold tags.",
        ),
      );
      if (!declined) {
        declined = true;
        await press(b, "No Thanks");
        await expect(btn(b, "Wait for Customer")).toBeVisible();
        continue;
      }
      await press(b, "Hire Twins");
      const pick = async (name: string) => {
        const picker = dialog(b);
        await expect(picker).toContainText("Who would you like the Twins to pay a visit to?");
        await picker.getByRole("radio", { name }).check({ force: true });
        await picker.getByRole("button", { name: "Choose" }).click();
        await settle(b);
      };
      // Not yourself, not someone who is up and about (the Twins saw them in the yard)...
      await pick(bob.player.name);
      await seeText(
        b,
        "Even as a joke you don't think you should suggest the twins burn down your own building.",
      );
      await press(b, "Hire Twins");
      await pick(carl.player.name);
      await seeText(
        b,
        `The twins shake their heads vigorously.  Apparently they saw ${carl.player.name} working in the yard.`.replace(
          /\s+/g,
          " ",
        ),
      );
      // ...but Alice, asleep, with a smoke detector and a safe.
      await press(b, "Hire Twins");
      await pick(alice.player.name);
      const text = norm(await well(b).textContent());
      expect(text).toMatch(
        /The fire is put out before it can do any serious damage!|A fire engulfs/,
      );
      if (text.includes("A fire engulfs"))
        expect(text).toContain("You see a shiny safe through a window.");
      burned = true;
      await press(b, "Continue");
      continue;
    }
    if (await btn(b, "Continue").isVisible()) {
      const text = norm(await well(b).textContent());
      expect(text).toMatch(
        /While cleaning behind the .+ you find a (wooden|silver|gold|Wood|Silver|Gold) tag\./,
      );
      bonus++;
      await press(b, "Continue");
    }
  }
  await odds(b, 0, 0, 0);
  expect(burned).toBe(true);
  expect(bonus).toBeGreaterThan(0);
  // Alice wakes to the letter about the fire.
  await logBackOn(alice);
  const letters = (await readLetters(alice.page)).join(" | ");
  expect(letters).toMatch(/A mysterious fire was started on your property\./);
  await toDesk(alice.page);
});

// ------------------------------------------------------------------ limits and the tournament

const newDay = (page: Page, town: { id: string }) =>
  admin(page, "POST", `/admin/towns/${town.id}/new-day`);

test("limits: out of turns, no visits left, no name changes, too poor for a class", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const V = S.visit;
  await makeTown(alice.page, TOWNS.limits, {
    turnsPerDay: 2,
    visitsPerDay: 1,
    nameChangeCost: 0,
    normalOdds: 0,
    luckOdds: 0,
    scriptOdds: 0,
  });
  const p = await join(browser, TOWNS.limits, "pauper");
  await sitDown(p.page);
  const q = await join(browser, TOWNS.limits, "sleeper");
  await sitDown(q.page);
  await logOff(q);
  const page = p.page;

  // Too poor for Spirit University: no gold tags, "you fumble through your pockets".
  await goTo(page, PLACE.university);
  await press(page, "Take PSY");
  await seeText(page, rx(T.places.university.cantAfford));
  await press(page, "Continue");
  await press(page, "Leave");
  // The sysop switched name changes off: the Name button says so.
  await toDesk(page);
  await press(page, "Stats");
  await press(page, "Name");
  await seeText(page, rx(T.places.options.noChange));
  await press(page, "Continue");
  await press(page, "Back");

  // One visit a day: the row says so, the visit uses it, and the next is "look at everyone's parlor day".
  await goTo(page, PLACE.rivals);
  await seeText(page, rx(V.watchOne));
  await press(page, "Leave");
  await findParlor(page, q.player.name.slice(4));
  await press(page, "Try Door");
  await press(page, "Steal");
  await press(page, "Leave");
  await seeText(page, rx(V.watchNone));
  await press(page, "Visit");
  await seeText(page, rx(V.noVisitsLeft));
  await press(page, "Continue");
  await press(page, "Leave");

  // Two turns a day: two customers, then the closing-time line (one of the three) and the shut door.
  await sellSome(page, 2);
  await press(page, "Wait for Customer");
  await seeText(page, anyOf(T.wait.noTurns));
  expect(num((await readStats(page)).turns)).toBe(0);
  await p.context.close();
  await q.context.close();
});

test("the tournament: the countdown, the final day, the winner and the meteor, the Book of Deeds, the reset", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const N = T.news;
  const L = S.lobby;
  const a = alice.page;
  await makeTown(a, TOWNS.cup, {
    tournamentActive: true,
    tournamentDays: 3,
    normalOdds: 0,
    luckOdds: 0,
    scriptOdds: 0,
  });
  // The front door shows the tournament's day.
  const door = await (await browser.newContext()).newPage();
  await openDoor(door, TOWNS.cup);
  await expect(
    door.getByText(rx(L.tournament.replace("{day}", "1").replace("{days}", "3"))),
  ).toBeVisible();
  await door.context().close();

  const z = await join(browser, TOWNS.cup, "zed", { male: false });
  await sitDown(z.page);
  await sellSome(z.page, 4);
  const zp = z.page;
  // Day 1 of 3: two days left on the front page's top.
  expect(await openPaper(zp)).toMatch(rx(N.daysLeft.replace("{days}", "2")));
  await press(zp, "Continue");
  // Day 2: tomorrow is the last day.
  await newDay(a, TOWNS.cup);
  await expect(zp.getByText("A new day has dawned. It is day 2.")).toBeVisible();
  expect(await openPaper(zp)).toMatch(rx(N.lastDayTomorrow));
  await press(zp, "Continue");
  // Day 3: the final day, a winner at midnight.
  await newDay(a, TOWNS.cup);
  await expect(zp.getByText("A new day has dawned. It is day 3.")).toBeVisible();
  expect(await openPaper(zp)).toMatch(rx(N.finalDay));
  await press(zp, "Continue");
  // Day 4 is past the end: the winner, the meteor, the universe's top seller; nobody can play.
  await newDay(a, TOWNS.cup);
  await expect(zp.getByText("A new day has dawned. It is day 4.")).toBeVisible();
  const final = await openPaper(zp);
  expect(final).toMatch(rx(N.winnerHeadline));
  expect(final).toMatch(rx(N.winnerBody.replace("{name}", z.player.name)));
  expect(final).toMatch(rx(N.meteorHeadline));
  expect(final).toMatch(rx(N.meteorBody));
  await expect(zp.locator(".fq-news")).toContainText(
    rx(N.universeTop.replace("{name}", z.player.name)),
  );
  await press(zp, "Continue");
  await seeText(zp, rx(T.desk.newDayAtDesk));
  await press(zp, "Wait for Customer");
  await seeText(zp, anyOf(T.wait.noTurns));
  await goTo(zp, PLACE.rivals);
  await press(zp, "Visit");
  await seeText(zp, rx(S.visit.noVisitsLeft));
  await press(zp, "Continue");
  await press(zp, "Leave");
  // The Book of Deeds has the winner already.
  await goTo(zp, PLACE.university);
  await press(zp, "Library");
  await press(zp, "View Deeds");
  await seeText(zp, rx(N.deed.replace("{name}", z.player.name)));
  await press(zp, "Back");
  await press(zp, "Back");
  await press(zp, "Leave");
  // The front door: the tournament is over, and new parlors are refused until tomorrow.
  const door2 = await (await browser.newContext()).newPage();
  await openDoor(door2, TOWNS.cup);
  await expect(door2.getByText(rx(L.over.replace("{name}", z.player.name)))).toBeVisible();
  await expect(door2.getByText(rx(L.closedOver))).toBeVisible();
  await door2.context().close();

  // Midnight: the game is reset. Everyone is told, the town starts over on day 1.
  await newDay(a, TOWNS.cup);
  const ended = zp.getByRole("alert").filter({ hasText: "Your session has ended" });
  await expect(ended).toBeVisible();
  await expect(ended).toContainText(`The tournament is over. ${z.player.name} won.`);
  await zp.getByRole("button", { name: "Back to the front door" }).click();
  await expect(
    zp.getByText(
      rx(L.endless.replace("{day}", "1").replace("{online}", "0").replace("{players}", "0")),
    ),
  ).toBeVisible();
  // The parlor is gone, the account is not: she opens a new one, and the Book of Deeds remembers.
  await expect(zp.getByRole("button", { name: "Get started" })).toBeVisible();
  await zp.getByRole("button", { name: "Get started" }).click();
  await createParlor(zp, z.player, false);
  await sitDown(zp);
  await goTo(zp, PLACE.university);
  await press(zp, "Library");
  await press(zp, "View Deeds");
  await seeText(zp, rx(N.deed.replace("{name}", z.player.name)));
  await z.context.close();
});

// ------------------------------------------------------------------ a second log-in

test("a second log-in elsewhere ends the first session", async ({ browser }) => {
  const first = bob.page;
  await toDesk(first);
  const elsewhere = await (await browser.newContext()).newPage();
  await openDoor(elsewhere, TOWNS.main);
  await logOn(elsewhere, bob.player);
  await expect(elsewhere.getByRole("button", { name: "Log on" })).toBeHidden();
  await expect(elsewhere.locator(".fq-cabinet")).toBeVisible();
  const ended = first.getByRole("alert").filter({ hasText: "Your session has ended" });
  await expect(ended).toBeVisible();
  await expect(ended).toContainText("logged on somewhere else");
  await expect(first.locator(".fq-plaque")).toHaveCount(0);
  // The parlor goes on in the new window; the old one can come back to the door.
  await first.getByRole("button", { name: "Back to the front door" }).click();
  await expect(first.getByText(`Welcome back, ${bob.player.name}.`)).toBeVisible();
  await elsewhere.context().close();
});

// ------------------------------------------------------------------ the three layouts

const SIZES = [
  { name: "classic", width: 1024, height: 745 },
  { name: "wide", width: 1280, height: 720 },
  { name: "phone", width: 390, height: 844 },
] as const;

for (const size of SIZES) {
  test(`every Classic screen fits its cabinet at ${size.name} (${size.width}x${size.height})`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(300_000);
    const phone = size.name === "phone";
    const me = await join(browser, TOWNS.main, `lay${size.name.slice(0, 2)}`);
    await me.page.setViewportSize({ width: size.width, height: size.height });
    const page = me.page;
    await sitDown(page);
    const problems: Problem[] = [];
    let shot = 0;
    const check = async (screen: string) => {
      await page.waitForTimeout(200);
      problems.push(...(await inspect(page, `${screen} / ${size.name}`, phone)));
      // Nothing makes the page wider than the screen, and an open dialog fits inside it.
      const extra = await page.evaluate(() => {
        const out: string[] = [];
        const de = document.documentElement;
        if (de.scrollWidth > window.innerWidth + 1)
          out.push(`the page scrolls sideways (${de.scrollWidth} > ${window.innerWidth})`);
        for (const d of document.querySelectorAll('[role="dialog"]')) {
          const r = d.getBoundingClientRect();
          if (
            r.left < -1 ||
            r.right > window.innerWidth + 1 ||
            r.top < -1 ||
            r.bottom > window.innerHeight + 1
          ) {
            out.push(
              `a dialog leaves the screen (${Math.round(r.left)},${Math.round(r.top)}-${Math.round(r.right)},${Math.round(r.bottom)})`,
            );
          }
        }
        return out;
      });
      for (const what of extra) problems.push({ screen: `${screen} / ${size.name}`, what });
      await page.screenshot({
        path: testInfo.outputPath(
          `${size.name}-${String(++shot).padStart(2, "0")}-${screen.replace(/\W+/g, "-")}.png`,
        ),
      });
    };

    await check("the desk");
    await meet(page);
    await check("a customer");
    await press(page, "Soft Sell");
    await check("soft sell answered");
    await finishSale(page).catch(async () => closeAnything(page));
    await toDesk(page);
    await press(page, "Stats");
    await check("the stats sheet");
    await press(page, "Name");
    await check("name change");
    await press(page, "No");
    await press(page, "Back");
    await press(page, "Rankings");
    await check("the rankings");
    await press(page, "Continue");
    await press(page, "Read Paper");
    await check("the paper, front page");
    await press(page, "Crime");
    await check("the paper, crime");
    await press(page, "Make Announcement");
    await check("the announcement notepad");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await settle(page);
    await press(page, "Continue");
    await press(page, "Write Letter");
    await check("the letter's name notepad");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await settle(page);
    await btn(page, "Town Map").click();
    await check("the town map");
    for (const [name, place, inside] of [
      [
        "the bank",
        PLACE.bank,
        async () => {
          await press(page, "Exchange");
          await check("the bank's exchange menu");
          await press(page, "Gold");
          await press(page, "Silver");
          await check("the bank's count notepad");
          await dialog(page).getByRole("button", { name: "Cancel" }).click();
          await settle(page);
        },
      ],
      [
        "Di-Mart",
        PLACE.store,
        async () => {
          await press(page, "Hearses");
          await check("the hearse showroom");
          await press(page, "View #1");
          await check("a hearse");
          await press(page, "Back");
          await press(page, "Back");
          await press(page, "Security");
          await check("the security shelf");
          await press(page, "View #1");
          await check("the padlock");
          await press(page, "Back");
          await press(page, "Back");
          await press(page, "Supplies");
          await check("the supplies shelf");
          await press(page, "Back");
        },
      ],
      [
        "Spirit University",
        PLACE.university,
        async () => {
          await press(page, "Library");
          await check("the library");
          await press(page, "Old Papers");
          await check("the old papers notepad");
          await dialog(page).getByRole("button", { name: "Cancel" }).click();
          await settle(page);
          await press(page, "View Deeds");
          await check("the Book of Deeds");
          await press(page, "Back");
          await press(page, "Back");
        },
      ],
      [
        "Yang's",
        PLACE.yangs,
        async () => {
          await press(page, "Order #3");
          await check("Yang's name picker");
          await dialog(page).getByRole("button", { name: "Cancel" }).click();
          await settle(page);
        },
      ],
      ["the church", PLACE.church, async () => undefined],
      ["the hospital", PLACE.hospital, async () => undefined],
      [
        "the row of parlors",
        PLACE.rivals,
        async () => {
          await press(page, "Look");
          await check("the parlors' look list");
          await press(page, "Continue");
          await press(page, "Visit");
          await check("the visit name notepad");
          await dialog(page).getByRole("button", { name: "Cancel" }).click();
          await settle(page);
        },
      ],
    ] as const) {
      await goTo(page, place);
      await check(name);
      await inside();
      await toDesk(page);
      await btn(page, "Town Map").click();
    }
    // The cafe with some talk in it.
    await goTo(page, PLACE.cafe);
    await say(page, "/?");
    await say(
      page,
      "a line of talk in the cafe, long enough to wrap around the edge of the window at a phone's width",
    );
    await check("the cafe");
    await toDesk(page);
    expect(problems, JSON.stringify(problems, null, 1)).toEqual([]);
    await me.context.close();
  });
}
