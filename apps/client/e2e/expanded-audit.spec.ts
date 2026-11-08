import { expandedPack } from "@fq/content";
import { CLASSIC_TEXT } from "@fq/core";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { ADMIN_TOKEN, createParlor, newPlayer, type Player, signUp } from "./helpers";
import { inspect, type Problem } from "./layout-check";

/**
 * The Expanded audit (docs/expanded-audit.md): every player-facing feature of the Expanded
 * ruleset (docs/expanded-rules.md sections 3 to 10 and 16 to 24, presented as sections 11 and 26
 * say), driven through the real web client against the real server, with the Expanded content
 * pack as the oracle. Expected strings come from `expandedPack` (`@fq/content`, the pack the
 * server's Expanded towns load) and are matched as patterns with the placeholders left open.
 *
 * The audit makes its own Expanded towns through the admin API (and removes them again). Random
 * draws are handled by trying again until the outcome wanted comes up, within a bound; what
 * chance rarely gives is reached through the town's Game Settings, its Expanded rule numbers
 * (`expandedRules`, docs 12.2) and the sysop's player editor (money, karma, tags, turns), the way
 * the Classic audit reaches the original's rare events. A feature that needs several days uses
 * the sysop's "force new day".
 */

const XP = expandedPack.expanded;
if (!XP?.town) throw new Error("the Expanded pack has no town section");
const X = XP.text;
const TT = XP.town.text;
const TOWN = XP.town;
const N = X.negotiation;
const CN = CLASSIC_TEXT.negotiation;

// ------------------------------------------------------------------ text patterns

/** The pack's colour codes (a backtick and one character) are not text. */
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

/** The first sentence-ish piece of a template up to its first placeholder, as a pattern. */
const head = (template: string): RegExp => {
  const plain = stripCodes(template);
  const cut = plain.search(/\{[A-Za-z]+\}/);
  return rx(cut > 0 ? plain.slice(0, cut) : plain);
};

/** A pack field that is one line or a list of alternatives, as a pattern. */
const pool = (field: string | readonly string[]): RegExp => anyOf(field);

/** Any one of a list of templates (a line picked at random). */
function anyOf(...lists: (string | readonly string[])[]): RegExp {
  const all = lists.flatMap((l) => (typeof l === "string" ? [l] : [...l]));
  return new RegExp(all.map((t) => `(?:${rx(t).source})`).join("|"));
}

const norm = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();
const num = (s: string | null | undefined): number =>
  Number((s ?? "0").replace(/[^0-9-]/g, "") || "0");
const money = (n: number): string => `$${n.toLocaleString("en-US")}`;

// ------------------------------------------------------------------ driving the client

/** The main text of whatever screen is up. */
const well = (page: Page): Locator => page.locator(".fq-textpanel .fq-text").first();
const dialog = (page: Page): Locator => page.getByRole("dialog");
/** A button of the View by its id (plaques, desk orbs, cards, upgrade rows, moral choices). */
const bid = (page: Page, id: string): Locator => page.locator(`[data-button-id="${id}"]`).first();
const books = (page: Page): Locator =>
  page.getByRole("region", { name: "Your parlor's books" }).first();
const chip = (page: Page, key: string): Locator =>
  books(page).locator(`[data-chip="${key}"] .fq-lchip-value`).first();
const file = (page: Page): Locator => page.getByRole("region", { name: "The customer's file" });
const hand = (page: Page): Locator => page.getByRole("navigation", { name: "Cards to pick from" });
const strip = (page: Page): Locator => page.getByRole("region", { name: "Today in Deathville" });

/** Waits until no action is in flight (a button pressed meanwhile would be dropped). */
const settle = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'));
};

/** Clicks, reading away a letter pushed over the page meanwhile. */
const clickClear = async (page: Page, target: Locator): Promise<void> => {
  for (let attempt = 0; ; attempt++) {
    try {
      await target.click({ timeout: attempt < 3 ? 3_000 : 10_000 });
      return;
    } catch (error) {
      if (attempt >= 3) throw error;
      if (await dialog(page).isVisible()) {
        await dialog(page).getByRole("button").first().click();
        await settle(page);
        continue;
      }
      if ((await target.count()) === 0) throw error;
    }
  }
};

/** Presses a button by its id and waits for the server's answer to be drawn. */
const press = async (page: Page, id: string): Promise<void> => {
  await clickClear(page, bid(page, id));
  await settle(page);
};

/** The main text after pressing, whitespace made plain. */
const pressText = async (page: Page, id: string): Promise<string> => {
  await press(page, id);
  return norm(await well(page).textContent());
};

async function seeText(page: Page, pattern: RegExp | string, timeout?: number): Promise<void> {
  await expect(well(page)).toContainText(pattern, timeout ? { timeout } : undefined);
}

/** Types into the open text box and submits it. */
async function submitText(page: Page, text: string): Promise<void> {
  const pad = dialog(page);
  await pad.getByRole("textbox").fill(text);
  await pad
    .getByRole("button", { name: /Submit|OK/ })
    .first()
    .click();
  await settle(page);
}

/** Closes message dialogs, one by one, and returns their text. */
async function readLetters(page: Page): Promise<string> {
  const found: string[] = [];
  for (let i = 0; i < 12 && (await dialog(page).isVisible()); i++) {
    found.push(norm(await dialog(page).textContent()));
    await dialog(page).getByRole("button").first().click();
    await settle(page);
    await page.waitForTimeout(80);
  }
  return found.join(" | ");
}

/** Dialogs and Continue plaques, answered with the first choice, until a plain screen. */
async function closeAnything(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    if (await dialog(page).isVisible()) {
      await dialog(page).getByRole("button").first().click();
      await page.waitForTimeout(100);
      continue;
    }
    const cont = page
      .locator(".fq-plaque")
      .filter({ has: page.locator(".fq-plaque-label").getByText(/^Continue$/) })
      .first();
    if (await cont.isVisible()) {
      await cont.click();
      await page.waitForTimeout(100);
      continue;
    }
    return;
  }
}

/** Through dialogs, Continue, Leave and Back until the desk with Wait for Customer is up. */
async function toDesk(page: Page): Promise<void> {
  const wait = bid(page, "desk:wait");
  for (let i = 0; i < 16; i++) {
    if ((await wait.isVisible()) && !(await dialog(page).isVisible())) return;
    if (await dialog(page).isVisible()) {
      await dialog(page).getByRole("button").first().click();
    } else if (await page.getByRole("button", { name: /Go to Your Parlor/ }).isVisible()) {
      await page
        .getByRole("button", { name: /Go to Your Parlor/ })
        .click({ timeout: 2_000 })
        .catch(() => undefined);
    } else if (await page.locator('[data-button-id^="prep:opt:"]').first().isVisible()) {
      // A body-preparation choice is answered with its last option (the honest one, as a rule).
      await page.locator('[data-button-id^="prep:opt:"]').last().click();
    } else {
      const next = page
        .locator(".fq-plaque")
        .filter({
          has: page
            .locator(".fq-plaque-label")
            .getByText(/^(Continue|Leave|Back|Prepare the Body|Skip Tour)$/),
        })
        .first();
      if (await next.isVisible()) await next.click({ timeout: 2_000 }).catch(() => undefined);
      else if (await bid(page, "go:desk").isVisible()) await bid(page, "go:desk").click();
      else if (await bid(page, "go:map").isVisible()) await bid(page, "go:map").click();
    }
    await page.waitForTimeout(150);
  }
  await expect(wait).toBeVisible();
}

/** From any screen: to the desk's map and into a place. */
async function goTo(page: Page, place: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    await toDesk(page);
    try {
      await bid(page, "go:map").click({ timeout: 3_000 });
      break;
    } catch (error) {
      if (attempt >= 3) throw error;
      await closeAnything(page);
    }
  }
  const spot = page.getByRole("button", { name: `Go to ${place}`, exact: true }).first();
  const listed = page.getByRole("button", { name: place, exact: true }).first();
  await spot.or(listed).first().waitFor({ state: "visible" });
  if (await spot.isVisible()) await spot.click();
  else await listed.click();
  await settle(page);
}

const PLACE = {
  graveyard: "Town Graveyard",
  church: "Church",
  cityHall: "City Hall",
  hospital: "Hospital",
  club: "The Reaper Club",
  bank: "Bank",
  store: "Di-Mart",
  rivals: "Rival Parlors",
  university: "Spirit University",
} as const;

// ------------------------------------------------------------------ the audit towns

interface Who {
  page: Page;
  context: BrowserContext;
  player: Player;
  id?: number;
}

const ADMIN = `Bearer ${ADMIN_TOKEN}`;
const TOWNS = {
  main: { id: "xaudit-main", name: "Expanded Audit" },
  life: { id: "xaudit-life", name: "Expanded Life" },
} as const;
type Town = { id: string; name: string };
const created: string[] = [];

async function api(
  page: Page,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await page.request.fetch(path, {
    method,
    headers: { authorization: ADMIN, "content-type": "application/json" },
    ...(body !== undefined || method === "POST" ? { data: JSON.stringify(body ?? {}) } : {}),
  });
  expect(res.status(), `${method} ${path}: ${await res.text()}`).toBeLessThan(300);
  return res.status() === 204 ? null : res.json();
}

async function makeTown(
  page: Page,
  town: Town,
  settings: Record<string, unknown>,
  rules: Record<string, number> = {},
  seed = 1234,
): Promise<void> {
  await page.request.fetch(`/admin/towns/${town.id}`, {
    method: "DELETE",
    headers: { authorization: ADMIN },
  });
  await api(page, "POST", "/admin/towns", {
    id: town.id,
    name: town.name,
    ruleset: "expanded",
    seed,
    settings,
    ...(Object.keys(rules).length ? { rules } : {}),
  });
  created.push(town.id);
}

/** The town's Game Settings and Expanded rule numbers, changed while the game runs. */
async function tune(
  page: Page,
  town: Town,
  patch: Record<string, unknown>,
  expandedRules?: Record<string, number | null>,
): Promise<void> {
  await api(page, "PATCH", `/admin/towns/${town.id}/settings`, {
    ...patch,
    ...(expandedRules ? { expandedRules } : {}),
  });
}

/** The sysop's player editor: sets plain fields of a parlor (money, karma, turns, tags...). */
async function edit(page: Page, town: Town, who: Who, patch: Record<string, unknown>) {
  if (who.id === undefined) {
    const list = (await api(
      page,
      "GET",
      `/admin/towns/${town.id}/players?search=${encodeURIComponent(who.player.login)}`,
    )) as { players: { id: number; logon: string }[] };
    const row = list.players.find((p) => p.logon.toLowerCase() === who.player.login.toLowerCase());
    if (!row) throw new Error(`no player ${who.player.login}`);
    who.id = row.id;
  }
  await api(page, "PATCH", `/admin/towns/${town.id}/players/${who.id}`, patch);
}

const newDay = (page: Page, town: Town) => api(page, "POST", `/admin/towns/${town.id}/new-day`);

async function townDay(page: Page, town: Town): Promise<number> {
  return ((await api(page, "GET", `/admin/towns/${town.id}`)) as { day: number }).day;
}

async function dropTowns(page: Page): Promise<void> {
  for (const id of created.splice(0)) {
    await page.request
      .fetch(`/admin/towns/${id}`, { method: "DELETE", headers: { authorization: ADMIN } })
      .catch(() => undefined);
  }
}

/** The front door, with the audit town chosen, up to the log-on plaque. */
async function openDoor(page: Page, town: Town): Promise<void> {
  await page.goto("/");
  await expect(page.getByText(/Connected to /)).toBeVisible();
  await page.getByRole("button", { name: /^Play online/ }).click();
  await expect(page.getByRole("button", { name: "Log on" })).toBeVisible();
  const towns = page.getByRole("group", { name: "Choose a town" });
  await towns.locator("label", { hasText: town.name }).locator("input").check();
}

/** A new player in a town, on the first screen after the parlor form (the paper). */
async function join(
  browser: import("@playwright/test").Browser,
  town: Town,
  prefix: string,
): Promise<Who> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const player = newPlayer(prefix);
  await openDoor(page, town);
  await signUp(page, player);
  await createParlor(page, player, true);
  return { page, context, player };
}

/** Reads the paper, skips the clerk's tour, and stands at the desk. */
async function sitDown(page: Page): Promise<void> {
  await expect(page.locator(".fq-news")).toBeVisible();
  await press(page, "go:desk");
  await readLetters(page);
  if (await bid(page, "go:tutorial").isVisible()) await press(page, "go:tutorial");
  if (await bid(page, "tutorial:skip").isVisible()) await press(page, "tutorial:skip");
  await toDesk(page);
}

// ------------------------------------------------------------------ the sale

/**
 * Waits for a customer to haggle with (the file and a Soft Sell plaque). An offer (County
 * Contract, Cousin Sal) is answered with its first choice and the wait goes on.
 */
async function meet(page: Page, keep?: (page: Page) => Promise<boolean>): Promise<void> {
  for (let step = 0; step < 60; step++) {
    if ((await file(page).isVisible()) && (await bid(page, "neg:soft").isVisible())) {
      if (!keep || (await keep(page))) return;
      await finish(page);
      continue;
    }
    if ((await file(page).isVisible()) && !(await bid(page, "neg:done").isVisible())) {
      // A flat offer (County Contract, Cousin Sal): no haggling, two choices; take the first.
      if (keep && (await keep(page))) return;
      await clickClear(page, page.locator(".fq-r-buttons [data-button-id]").first());
      await settle(page);
      await toDesk(page);
      continue;
    }
    if (await dialog(page).isVisible()) {
      await dialog(page).getByRole("button").first().click();
      await settle(page);
      continue;
    }
    if (await bid(page, "desk:wait").isVisible()) {
      await press(page, "desk:wait");
      continue;
    }
    await toDesk(page);
  }
  throw new Error("no customer came in sixty steps");
}

/** Finishes the open sale with Done (or leaves a walked-out customer) and returns to the desk. */
async function finish(page: Page): Promise<string> {
  let text = "";
  if (await bid(page, "neg:done").isVisible()) {
    text = await pressText(page, "neg:done");
  }
  await toDesk(page);
  return text;
}

const totalOf = async (page: Page): Promise<number> =>
  num(await page.locator(".fq-readout-total strong").first().textContent());

test.describe.configure({ mode: "serial" });
// A click on a button that never comes fails in seconds, not at the end of a long test.
test.use({ actionTimeout: 15_000 });

// WebKit on a CI runner takes several seconds per sale; the audit is a check on the client's
// Expanded features, like the Classic audit, and runs in Chromium and Firefox.
test.skip(
  ({ browserName }) => browserName === "webkit",
  "the Expanded audit runs in Chromium and Firefox (WebKit is too slow for its selling)",
);

let alice!: Who;
let bob!: Who;
const M = TOWNS.main;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await makeTown(
    page,
    M,
    {
      turnsPerDay: 400,
      normalOdds: 0,
      luckOdds: 0,
      scriptOdds: 0,
      tagsReceivablePerDay: 100,
      visitsPerDay: 8,
    },
    {
      // The living town is switched on for its own test (a news story can close the graveyard).
      "town.world.newsChance": 0,
      "town.world.arcChance": 0,
      // A parlor may send tags on its first day (the rule says three days).
      "town.bank.transfer.minAccountDays": 0,
    },
  );
  await context.close();
});

test.afterAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await dropTowns(page);
  await alice?.context.close().catch(() => undefined);
  await bob?.context.close().catch(() => undefined);
  await context.close();
});

// ------------------------------------------------------------------ 10.4 the guided first day

test("a new Expanded parlor: the paper, the morning, the clerk's tour, the practice sale and its prep choice", async ({
  browser,
}) => {
  alice = await join(browser, M, "xalice");
  const { page, player } = alice;
  const U = X.tutorial;
  await expect(page.locator(".fq-news")).toBeVisible();
  await press(page, "go:desk");
  await readLetters(page);
  // The morning screen: the Classic welcome, today's weather, and one button, to the tour.
  await seeText(page, /You unlock the front door and enter your beloved/);
  await seeText(page, head(TT.world.morningWeather));
  // The ledger: cash, karma and rating for an Expanded player (11.1), the starting $2,000.
  await expect(chip(page, "money")).toHaveText("$2,000");
  await expect(chip(page, "karma")).toHaveText("50");
  await expect(bid(page, "go:tutorial")).toBeVisible();
  await press(page, "go:tutorial");
  // The tour: every page in the clerk's words, the page count on the parchment.
  const pages = U.pages.length;
  for (let i = 0; i < pages; i++) {
    const words = (U.pages[i] as string)
      .replace("{name}", player.name)
      .replace("{parlor}", player.parlor);
    await seeText(page, rx(words));
    await expect(page.getByText(`Tour page ${i + 1} of ${pages}`).first()).toBeVisible();
    await expect(bid(page, "tutorial:skip")).toBeVisible();
    if (i < pages - 1) await press(page, "tutorial:next");
  }
  await expect(bid(page, "tutorial:start")).toContainText(U.start);
  await press(page, "tutorial:start");
  // The practice customer: the clerk's hint beside the file, an estimate gauge, cards.
  const tip = page.getByRole("complementary", { name: "The clerk says" });
  const hint = (s: string) => rx(s.replace(/^Clerk:\s*/, ""));
  await expect(tip).toContainText(hint(U.hints.arrival));
  await expect(file(page)).toBeVisible();
  await expect(page.getByRole("figure", { name: /close the bill is/ })).toBeVisible();
  await press(page, "neg:soft");
  await expect(hand(page)).toBeVisible();
  await expect(tip).toContainText(hint(U.hints.hand));
  await hand(page).locator('.fq-card:not([aria-disabled="true"])').first().click();
  await settle(page);
  await expect(tip).toContainText(
    new RegExp(`${hint(U.hints.afterPitch).source}|${hint(U.hints.impatient).source}`),
  );
  await press(page, "neg:done");
  await seeText(page, head(X.done.success));
  // The practice sale always ends in a body-preparation choice (8.2).
  await expect(bid(page, "prep:start")).toContainText(X.done.prepButton);
  await press(page, "prep:start");
  const choices = page.getByRole("navigation", { name: "A choice about the body" });
  await expect(choices).toBeVisible();
  await expect(page.getByRole("region", { name: "Where this leaves your karma" })).toBeVisible();
  await seeText(page, rx(X.prep.header));
  const karma0 = num(await chip(page, "karma").textContent());
  await choices.locator('[data-tone="good"]').first().click();
  await settle(page);
  await expect(chip(page, "karma")).not.toHaveText(String(karma0));
  await press(page, "go:desk").catch(async () => closeAnything(page));
  // The clerk's last words, and the tour is done: the desk with the Parlor orb and the town strip.
  await seeText(page, rx(U.finish.replace("{name}", player.name)));
  await toDesk(page);
  await expect(bid(page, "go:parlor")).toBeVisible();
  await expect(strip(page)).toBeVisible();
});

// ------------------------------------------------------------------ 3 and 4 the negotiation

/** The patience pips as [left, max]. */
async function patience(page: Page): Promise<[number, number]> {
  const label = (await file(page)
    .getByRole("meter", { name: /^Patience/ })
    .first()
    .getAttribute("aria-label")) as string;
  const m = /Patience (\d+) of (\d+)/.exec(label);
  return [Number(m?.[1]), Number(m?.[2])];
}

const walkedOut = async (page: Page): Promise<boolean> =>
  !(await bid(page, "neg:soft").isVisible());

test("the negotiation: the file, the gauge, Coffee, Listen, Discount, the soft-sell hand, Hard Sell, Guilt, Sympathy and Done", async () => {
  test.setTimeout(180_000);
  const { page } = alice;
  await toDesk(page);
  const seen = new Set<string>();
  for (let round = 0; round < 10 && seen.size < 8; round++) {
    await meet(page);
    // The arrival: the request, the estimate as a sentence and as a gauge, the bonus rule (3.2, 11.2).
    await seeText(page, head(N.estimate));
    await seeText(page, /Total:\s*\$[\d,]+/);
    await expect(file(page)).toBeVisible();
    await expect(
      file(page).getByRole("list", { name: "What you can see about them" }),
    ).toBeVisible();
    // The gauge draws the same range the sentence gives.
    const range = /between (\$[\d,]+) and (\$[\d,]+)/.exec(norm(await well(page).textContent()));
    expect(range).not.toBeNull();
    await expect(page.getByRole("figure", { name: /close the bill is/ })).toContainText(
      `Estimate ${range?.[1]} to ${range?.[2]}`,
    );
    // The bonus rule is behind "Why the bands?" (the View's status line, 11.2).
    await file(page).getByRole("button", { name: "Why the bands?" }).click();
    await expect(file(page)).toContainText(rx(N.bonusRule));
    await file(page).getByRole("button", { name: "Why the bands?" }).click();
    await expect(file(page).getByRole("tab", { name: /^What you know/ })).toBeVisible();
    await expect(file(page).getByRole("tab", { name: /^The bill/ })).toBeVisible();
    // The main row in Classic's order, the second row under it (11.2).
    for (const id of ["neg:guilt", "neg:sympathy", "neg:hard", "neg:soft", "neg:done"]) {
      await expect(bid(page, id)).toBeVisible();
    }
    const more = page.getByRole("navigation", { name: "More choices" });
    for (const id of ["neg:packages", "neg:coffee", "neg:listen", "neg:discount"]) {
      await expect(more.locator(`[data-button-id="${id}"]`)).toBeVisible();
    }

    // Coffee: once per customer, then disabled with its hint (3.4).
    if (!seen.has("coffee")) {
      const text = await pressText(page, "neg:coffee");
      expect(text).toMatch(anyOf(N.coffeePitch));
      expect(text).toMatch(
        anyOf(N.coffeeAccept.loved, N.coffeeAccept.notLoved, N.coffeeRefuse, N.impatient),
      );
      if (await walkedOut(page)) continue;
      await expect(bid(page, "neg:coffee")).toHaveAttribute("aria-disabled", "true");
      await expect(bid(page, "neg:coffee")).toHaveAccessibleDescription(N.hints.coffeeUsed);
      seen.add("coffee");
    }
    // Listen: two patience, a fact learned (3.4, 3.5).
    if (
      !seen.has("listen") &&
      (await bid(page, "neg:listen").getAttribute("aria-disabled")) === null
    ) {
      const [left] = await patience(page);
      const text = await pressText(page, "neg:listen");
      if (await walkedOut(page)) continue;
      expect(text).toMatch(anyOf(N.listenPitch));
      const learned = anyOf(
        N.listenTrait,
        N.listenNothing,
        N.listenLoved,
        N.listenNotLoved,
        XP.tells.loved,
        XP.tells.notLoved,
        XP.tells.cheapLow,
        XP.tells.cheapMid,
        XP.tells.cheapHigh,
        XP.tells.limitHigh,
        XP.tells.limitLow,
      );
      expect(text).toMatch(learned);
      expect((await patience(page))[0]).toBe(Math.max(0, left - 2));
      seen.add("listen");
    }
    // Discount: the amount on the button comes off the bill (3.4).
    if (
      !seen.has("discount") &&
      (await bid(page, "neg:discount").getAttribute("aria-disabled")) === null
    ) {
      const off = num(await bid(page, "neg:discount").locator(".fq-plaque-detail").textContent());
      const before = await totalOf(page);
      const text = await pressText(page, "neg:discount");
      if (await walkedOut(page)) continue;
      expect(text).toMatch(anyOf(N.discountPitch));
      expect(await totalOf(page)).toBe(before - Math.abs(off));
      seen.add("discount");
    }
    // The soft-sell hand: three cards at luck 50, looking is free and Back keeps the hand (4).
    if (!seen.has("hand")) {
      await press(page, "neg:soft");
      await expect(page.getByText(stripCodes(N.handIntro)).first()).toBeVisible();
      const cards = hand(page).locator(".fq-card");
      await expect(cards).toHaveCount(3);
      const labels = await cards.locator(".fq-card-label").allTextContents();
      for (const c of await cards.all())
        await expect(c.locator(".fq-card-detail")).toHaveText(/^\$[\d,]+$/);
      await press(page, "neg:back");
      await press(page, "neg:soft");
      expect(await hand(page).locator(".fq-card .fq-card-label").allTextContents()).toEqual(labels);
      const before = await totalOf(page);
      const card = hand(page).locator('.fq-card:not([aria-disabled="true"])').first();
      const price = num(await card.locator(".fq-card-detail").textContent());
      await card.click();
      await settle(page);
      const text = norm(await well(page).textContent());
      if (await walkedOut(page)) continue;
      expect(text).toMatch(anyOf(N.softPitch, CN.softPitch));
      const after = await totalOf(page);
      // Accepted (the bill grows by the card's price) or refused / over the limit (it does not).
      expect([before, before + price]).toContain(after);
      seen.add("hand");
    }
    // Hard Sell, Guilt and Sympathy answer with their lines (Classic's pools and the pack's).
    for (const [key, id, pools] of [
      [
        "hard",
        "neg:hard",
        [N.hardPitchWood, N.hardPitchSilver, CN.hardPitchWood, CN.hardPitchSilver],
      ],
      ["guilt", "neg:guilt", [N.guiltPitch, CN.guiltPitch, [CN.interrupted]]],
      ["sympathy", "neg:sympathy", [N.sympathyPitch, CN.sympathyPitch, [CN.interrupted]]],
    ] as const) {
      if (seen.has(key) || (await walkedOut(page))) continue;
      if ((await bid(page, id).getAttribute("aria-disabled")) !== null) continue;
      const text = await pressText(page, id);
      expect(text, `${key}: ${text}`).toMatch(anyOf(...pools));
      seen.add(key);
    }
    if (await walkedOut(page)) {
      await toDesk(page);
      continue;
    }
    // Done: the success line, the bonus band or what was left on the table, the money (3.7, 6.1).
    const done = await pressText(page, "neg:done");
    expect(done).toMatch(rx(X.done.success));
    expect(done).toMatch(anyOf(X.done.perfect, X.done.great, X.done.nice, X.done.missed));
    expect(done).toMatch(rx(X.done.money));
    expect(done).toMatch(anyOf(X.done.fromStock, X.done.rushOrder));
    seen.add("done");
    await toDesk(page);
  }
  expect([...seen].sort()).toEqual(
    ["coffee", "discount", "done", "guilt", "hand", "hard", "listen", "sympathy"].sort(),
  );
});

// ------------------------------------------------------------------ 6.2 Di-Mart's caskets

test("Di-Mart's casket shelf: wholesale prices, one casket, Fill Up, and a full storeroom", async () => {
  const { page } = alice;
  const S = X.store;
  await edit(page, M, alice, { money: 500_000 });
  await goTo(page, PLACE.store);
  await expect(bid(page, "store:caskets")).toContainText(S.caskets);
  await press(page, "store:caskets");
  // 75% of the list price rounded up to $50: $600, $1,950, $4,000 (6.2).
  await seeText(page, rx(S.casketIntro));
  await seeText(page, "Wood $600, silver $1,950, gold $4,000");
  await expect(bid(page, "store:casket:0")).toContainText("$600");
  await expect(bid(page, "store:casket:1")).toContainText("$1,950");
  await expect(bid(page, "store:casket:2")).toContainText("$4,000");
  const cash0 = num(await chip(page, "money").textContent());
  const room0 = num(/room for (\d+) more/.exec(norm(await well(page).textContent()))?.[1]);
  if (room0 > 0) {
    await press(page, "store:casket:1");
    await seeText(page, rx(S.bought.replace("{tier}", "silver")));
    await expect(chip(page, "money")).toHaveText(money(cash0 - 1950));
  }
  await press(page, "store:restock");
  await seeText(page, anyOf(S.restocked, S.full));
  // Six caskets fill a storeroom without the upgrade: the shelf says so on every card.
  await expect(bid(page, "store:casket:0")).toHaveAttribute("aria-disabled", "true");
  await expect(bid(page, "store:casket:0")).toContainText(X.hints.storeroomFull);
  await expect(bid(page, "store:restock")).toHaveAttribute("aria-disabled", "true");
  await press(page, "go:store");
  await press(page, "go:map");
});

// ------------------------------------------------------------------ 6.3, 7, 9.3 the office

test("the office: the summary, markup, rivalry and its wait, the contractor's upgrades, the rating and the building", async () => {
  test.setTimeout(120_000);
  const { page, player } = alice;
  const O = X.office;
  await toDesk(page);
  await press(page, "go:parlor");
  await seeText(page, rx(O.summary.replace("{parlor}", player.parlor)));
  await expect(page.getByRole("list", { name: "The building" })).toBeVisible();
  // The contractor: every upgrade with its state, a purchase moves it to Owned (7.2).
  await press(page, "parlor:upgrades");
  await seeText(page, rx(O.upgradesIntro));
  const shelf = page.getByRole("region", { name: "Catalogue" });
  await expect(shelf).toContainText("0 of 15 owned");
  await expect(
    shelf.locator('.fq-up[data-state="locked"]').filter({ hasText: /^Alarm System/ }),
  ).toContainText(rx(O.needs.replace("{name}", "Guard Dog")));
  const buy = async (id: string, name: string, owned: number) => {
    await press(page, `parlor:buy:${id}`);
    await seeText(page, rx(O.bought.replace("{name}", name)));
    await expect(shelf).toContainText(`${owned} of 15 owned`);
    await expect(
      shelf.locator('.fq-up[data-state="owned"]').filter({ hasText: name }),
    ).toBeVisible();
  };
  const r0 = num(await chip(page, "rating").textContent());
  await buy("paint", "Fresh Paint", 1);
  await expect(chip(page, "rating")).toHaveText(String(r0 + 3));
  await buy("coffee-machine", "Coffee Machine", 2);
  await buy("storeroom", "Storeroom", 3);
  await buy("incinerator", "Incinerator", 4);
  await buy("viewing-room", "Viewing Room", 5);
  await buy("guard-dog", "Guard Dog", 6);
  await press(page, "go:parlor");
  const rating0 = num(await chip(page, "rating").textContent());

  // Markup +30%: the cards show the choice, the rating falls 15 (6.3, 7.1).
  await press(page, "parlor:markup");
  await seeText(page, rx(O.markupIntro));
  await expect(bid(page, "parlor:markup:0")).toHaveAttribute("aria-pressed", "true");
  await press(page, "parlor:markup:30");
  await seeText(page, rx(O.markupSet.replace("{markup}", "30")));
  await expect(bid(page, "parlor:markup:30")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "rating")).toHaveText(String(Math.max(0, rating0 - 15)));
  // A customer's caskets at +30%: wood $1,050, silver $3,400, gold $6,900 (list x 1.3, to $50).
  await toDesk(page);
  await meet(page);
  expect([1050, 3400, 6900]).toContain(await totalOf(page));
  await finish(page);
  await press(page, "go:parlor");
  // (The sale's family may have moved word of mouth a point; the markup's 15 come back.)
  const rating1 = num(await chip(page, "rating").textContent());
  await press(page, "parlor:markup");
  await press(page, "parlor:markup:0");
  await expect(chip(page, "rating")).toHaveText(String(Math.min(100, rating1 + 15)));
  await press(page, "go:parlor");

  // Rivalry: Cutthroat, then the tiers wait three days (9.3).
  await press(page, "parlor:rivalry");
  await seeText(page, rx(O.rivalryIntro));
  await expect(bid(page, "parlor:rivalry:standard")).toHaveAttribute("aria-pressed", "true");
  await press(page, "parlor:rivalry:cutthroat");
  await seeText(page, rx(O.rivalrySet.replace("{rivalry}", O.rivalryNames.cutthroat)));
  await expect(bid(page, "parlor:rivalry:peaceful")).toHaveAttribute("aria-disabled", "true");
  await expect(bid(page, "parlor:rivalry:peaceful")).toContainText(
    rx(O.rivalryWait.replace("{days}", "3")),
  );
  await press(page, "go:parlor");

  // Paint and the viewing room are building upgrades: the Shack is now Respectable.
  await seeText(page, `${player.parlor} (${O.levelNames[2]})`);
  await expect(page.getByRole("list", { name: "The building" })).toContainText(
    O.levelNames[2] as string,
  );
  await toDesk(page);
});

// ------------------------------------------------------------------ 5 packages and cremation

test("packages: one card per category with its next tier; cremation with the incinerator changes the track", async () => {
  test.setTimeout(180_000);
  const { page } = alice;
  await toDesk(page);
  let packaged = false;
  let cremated = false;
  for (let round = 0; round < 25 && !(packaged && cremated); round++) {
    await meet(page);
    if (!packaged) {
      await press(page, "neg:packages");
      await expect(page.getByText(stripCodes(X.negotiation.packagesIntro)).first()).toBeVisible();
      const cards = hand(page).locator(".fq-card");
      expect(await cards.count()).toBeGreaterThanOrEqual(4);
      for (const label of await cards.locator(".fq-card-label").allTextContents()) {
        expect(label).toMatch(/^(Embalming|Flowers|Plot|Headstone|Service|Urn): /);
      }
      for (const d of await cards.locator(".fq-card-detail").allTextContents()) {
        expect(d).toMatch(/^\+\$[\d,]+$/);
      }
      const before = await totalOf(page);
      const card = hand(page).locator('.fq-card:not([aria-disabled="true"])').first();
      const price = num(await card.locator(".fq-card-detail").textContent());
      await card.click();
      await settle(page);
      const text = norm(await well(page).textContent());
      expect(text).toMatch(anyOf(X.negotiation.packagePitch, CN.upgradePitch));
      if (await walkedOut(page)) {
        await toDesk(page);
        continue;
      }
      expect([before, before + price]).toContain(await totalOf(page));
      packaged = true;
    }
    if (!cremated && (await bid(page, "neg:cremation").isVisible())) {
      const text = await pressText(page, "neg:cremation");
      expect(text).toMatch(anyOf(XP.cremation.pitch));
      if (await walkedOut(page)) {
        await toDesk(page);
        continue;
      }
      if ((await file(page).locator(".fq-track").textContent()) === "Cremation") {
        // The cremation track: no casket upgrade, the urn ladder, the fee on the bill (5.2).
        await expect(bid(page, "neg:hard")).toHaveAttribute("aria-disabled", "true");
        await expect(bid(page, "neg:hard")).toHaveAccessibleDescription(
          X.negotiation.hints.cremationTrack,
        );
        await press(page, "neg:packages");
        await expect(hand(page)).toContainText("Urn:");
        await expect(hand(page)).not.toContainText("Plot:");
        await press(page, "neg:back");
        const done = await pressText(page, "neg:done");
        expect(done).toMatch(rx(X.done.success.replace("{casket}", X.done.cremated)));
        cremated = true;
        await toDesk(page);
        continue;
      }
    }
    await finish(page);
  }
  expect(packaged).toBe(true);
  expect(cremated).toBe(true);
});

// ------------------------------------------------------------------ 3.8 specials and families

test("special customers and repeat families: the badge, an offer without haggling, a family that comes back", async () => {
  test.setTimeout(300_000);
  const { page } = alice;
  const labels = XP.specials.map((s) => s.label);
  await edit(page, M, alice, { luck: 100, turns: 400 });
  let special = "";
  let offer = false;
  let family = false;
  const repeats = anyOf(
    N.repeat.happy as readonly string[],
    N.repeat.ok as readonly string[],
    N.repeat.sour as readonly string[],
    N.repeat.walked as readonly string[],
  );
  for (let n = 0; n < 150 && !(special && family); n++) {
    await meet(page, async () => true);
    const badge = file(page).locator(".fq-special");
    if (await badge.isVisible()) {
      const label = norm(await badge.textContent());
      expect(labels).toContain(label);
      if (!(await bid(page, "neg:done").isVisible())) {
        // A flat offer: no gauge, no patience, two choices (11.5 haggle: false).
        await expect(page.getByRole("figure", { name: /close the bill is/ })).toHaveCount(0);
        offer = true;
      } else special ||= label;
    } else if (!family && repeats.test(norm(await well(page).textContent()))) {
      family = true;
    }
    if (await bid(page, "neg:done").isVisible()) await finish(page);
    else {
      await clickClear(page, page.locator(".fq-r-buttons [data-button-id]").first());
      await settle(page);
      await toDesk(page);
    }
  }
  console.log(`special: ${special}, offer seen: ${offer}`);
  expect(special).not.toBe("");
  expect(family).toBe(true);
  await edit(page, M, alice, { luck: 50 });
});

// ------------------------------------------------------------------ a rival

test("a rival parlor joins and skips the tour straight to the desk", async ({ browser }) => {
  bob = await join(browser, M, "xbob");
  const { page } = bob;
  await expect(page.locator(".fq-news")).toBeVisible();
  await press(page, "go:desk");
  await readLetters(page);
  await press(page, "go:tutorial");
  await expect(page.getByText(/Tour page 1 of/).first()).toBeVisible();
  await press(page, "tutorial:skip");
  await toDesk(page);
  await expect(bid(page, "desk:wait")).toBeVisible();
  await expect(chip(page, "money")).toHaveText("$2,000");
});

// ------------------------------------------------------------------ 8 karma

test("karma: a body-preparation choice, the perk paths (Bless, Raise Mourners, Dig for Goodies), the stats sheet", async () => {
  test.setTimeout(240_000);
  const { page } = alice;
  const perk = (id: string): string => X.perks[id]?.name ?? id;
  await toDesk(page);
  // A prep choice after 40% of sales: the dishonest card is marked, its karma previewed (8.2).
  let prepped = false;
  for (let n = 0; n < 40 && !prepped; n++) {
    await meet(page);
    await press(page, "neg:done");
    if (await bid(page, "prep:start").isVisible()) {
      await press(page, "prep:start");
      await seeText(page, rx(X.prep.header));
      const choices = page.getByRole("navigation", { name: "A choice about the body" });
      const evil = choices.locator('[data-tone="evil"]').first();
      if ((await evil.count()) > 0 && (await evil.getAttribute("aria-disabled")) === null) {
        const karma0 = num(await chip(page, "karma").textContent());
        await evil.hover();
        await expect(page.getByText("Karma would become")).toBeVisible();
        await evil.click();
        await settle(page);
        // A gamble may fail; either way the karma goes down.
        expect(num(await chip(page, "karma").textContent())).toBeLessThan(karma0);
        prepped = true;
      }
    }
    await toDesk(page);
  }
  expect(prepped).toBe(true);

  // The good paths: Trusted and Church Associate at karma 90; Bless once per customer (8.3).
  await edit(page, M, alice, { karma: 90 });
  await press(page, "go:stats");
  const sheet = page.getByRole("region", { name: "Your stats and inventory" });
  // The lines 11.1 adds to the Classic sheet, with the rating as a number and a title.
  const L = X.stats.labels;
  for (const label of [
    L.karma,
    L.parlor,
    L.stock,
    L.markup,
    L.rivalry,
    L.plotIncome,
    L.perks,
    L.sales,
  ]) {
    await expect(sheet.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(sheet.locator('[data-stat="rating"]')).toContainText(/\d+ \(.+\)/);
  await expect(sheet.locator('[data-stat="karma"]')).toContainText(/90 \(.+\)/);
  await expect(sheet.locator('[data-stat="perks"]')).toContainText(perk("trusted"));
  await expect(sheet.locator('[data-stat="perks"]')).toContainText(perk("church-associate"));
  await press(page, "go:desk");
  await meet(page);
  const blessed = await pressText(page, "neg:bless");
  expect(blessed).toMatch(rx(N.blessPitch));
  expect(blessed).toMatch(anyOf(N.blessResult.loved, N.blessResult.notLoved));
  if (!(await walkedOut(page))) {
    await expect(bid(page, "neg:bless")).toHaveAttribute("aria-disabled", "true");
    await expect(bid(page, "neg:bless")).toHaveAccessibleDescription(N.hints.blessUsed);
  }
  await finish(page);

  // The evil paths: Grave Robber digs at the office, Necromancer raises mourners (8.3).
  await edit(page, M, alice, { karma: 10 });
  await press(page, "go:stats");
  await expect(sheet.locator('[data-stat="perks"]')).toContainText(perk("grave-robber"));
  await expect(sheet.locator('[data-stat="perks"]')).toContainText(perk("necromancer"));
  await press(page, "go:desk");
  await press(page, "go:parlor");
  await expect(bid(page, "parlor:dig")).toContainText(X.office.buttons.dig);
  await press(page, "parlor:dig");
  await seeText(page, anyOf(X.desk.digFound, X.desk.digCaught, X.desk.digTag));
  await toDesk(page);
  // (Raised mourners also anger the customer: one who was near the edge walks out instead.)
  let raisedOk = false;
  for (let n = 0; n < 6 && !raisedOk; n++) {
    await meet(page);
    const raised = await pressText(page, "neg:raise");
    expect(raised).toMatch(rx(N.raisePitch));
    if (!(await walkedOut(page))) {
      expect(raised).toMatch(rx(N.raiseResult));
      await expect(bid(page, "neg:raise")).toHaveAttribute("aria-disabled", "true");
      await expect(bid(page, "neg:raise")).toHaveAccessibleDescription(N.hints.raiseUsed);
      raisedOk = true;
    }
    await finish(page);
  }
  expect(raisedOk).toBe(true);
  await edit(page, M, alice, { karma: 50 });
});

// ------------------------------------------------------------------ 17 the church

test("the church: Bingo Night's cards, confession and its rising price, holy water and a Bless with it, Lead the Service, tithes", async () => {
  test.setTimeout(120_000);
  const { page } = alice;
  const C = TT.church;
  await edit(page, M, alice, { karma: 50, money: 300_000, tags: [40, 10, 40] });
  await goTo(page, PLACE.church);
  await seeText(page, pool(C.greeting.map((g) => g.replace("{player}", alice.player.name))));
  // Bingo: 12 cards for the town, one and three bought, the grid marks the player's (17.1).
  await press(page, "church:bingo");
  await seeText(page, rx(C.bingoIntro));
  const sheet = page.getByRole("region", { name: "Bingo Night" });
  await expect(sheet.locator(".fq-bingo-cells li")).toHaveCount(12);
  await press(page, "church:card:1");
  await seeText(page, rx(C.bingoBought.replace("{count}", "1")));
  await press(page, "church:card:3");
  await seeText(page, rx(C.bingoBought.replace("{count}", "3")));
  await expect(sheet.locator('.fq-bingo-cells [data-state="mine"]')).toHaveCount(4);
  await press(page, "church:main");
  // Confession while karma is under 60: $400, then $600 (17.2).
  await expect(bid(page, "church:confess")).toContainText("$400");
  const karma0 = num(await chip(page, "karma").textContent());
  await press(page, "church:confess");
  await seeText(page, pool(C.confessed));
  await expect(chip(page, "karma")).toHaveText(String(karma0 + 1));
  await expect(bid(page, "church:confess")).toContainText("$600");
  // Holy water at karma 50 or more (17.3), and a Bless with the bottle in a negotiation.
  await press(page, "church:water");
  await seeText(page, rx(C.holyWaterBought.replace("{have}", "1")));
  // Tithes: $1,000 a press for BP (17.5).
  await press(page, "church:tithe");
  await seeText(page, pool(C.tithed));
  // Lead the Service needs the Church Associate (karma 85+): disabled with the reason, then done.
  await expect(bid(page, "church:serve")).toHaveAttribute("aria-disabled", "true");
  await expect(bid(page, "church:serve")).toHaveAccessibleDescription(TT.hints.karmaTooLow);
  await edit(page, M, alice, { karma: 90 });
  await press(page, "church:tithe");
  await press(page, "church:serve");
  await seeText(page, rx(C.served));
  await expect(bid(page, "church:serve")).toHaveAttribute("aria-disabled", "true");
  await edit(page, M, alice, { karma: 52 });
  await toDesk(page);
  await meet(page);
  await expect(bid(page, "neg:bless")).toBeVisible();
  const text = await pressText(page, "neg:bless");
  expect(text).toMatch(rx(N.blessPitch));
  await finish(page);
});

// ------------------------------------------------------------------ 16 the graveyard

test("the graveyard: monuments, tending (good), robbing (evil), looking around, and a duel with Swing, Shove and Yield", async () => {
  test.setTimeout(150_000);
  const G = TT.graveyard;
  const a = alice.page;
  await edit(a, M, alice, { karma: 90, money: 300_000, hpMax: 40, hp: 40, strength: 12 });
  await goTo(a, PLACE.graveyard);
  await seeText(a, rx(G.intro));
  // The place's note (the Design Doc's fog) is still on screen beside the monuments panel, the
  // panel names the next stone, and the luck tube on the parchment shows the luck.
  await seeText(a, rx(G.note));
  const ladder = a.getByRole("region", { name: "The graveyard's monuments" });
  await expect(ladder).toContainText(`Next up: ${TOWN.monuments[0]}`);
  await expect(a.getByRole("meter", { name: /luck/i }).first()).toBeAttached();
  // Monuments: the stonecutter's next tier, bought, BP paid once, the ladder lit (16.1).
  await press(a, "graveyard:monuments");
  await seeText(a, rx(G.monumentsIntro));
  const name1 = TOWN.monuments[0] as string;
  await seeText(a, rx(G.monumentLine.replace("{name}", name1).replace("{price}", "3,000")));
  await press(a, "graveyard:monument");
  await seeText(a, rx(G.monumentBought.replace("{name}", name1).replace("{bp}", "60")));
  await expect(bid(a, "graveyard:monument")).toContainText(TOWN.monuments[1] as string);
  await press(a, "graveyard:main");
  await seeText(a, rx(G.intro.replace("{monument}", name1)));
  await expect(ladder).toContainText(`Next up: ${TOWN.monuments[1]}`);
  // Tending at karma 70+, no turn, twice a day (16.2).
  await press(a, "graveyard:tend");
  await seeText(a, pool(G.tended));
  await expect(bid(a, "graveyard:rob")).toHaveAttribute("aria-disabled", "true");
  await expect(bid(a, "graveyard:rob")).toHaveAccessibleDescription(TT.hints.karmaTooHigh);
  await press(a, "graveyard:look");
  await seeText(a, pool(G.look));
  await seeText(a, rx(G.lookRows));

  // A duel: the picker, the power bars with names, Swing and Shove until it ends (16.4).
  await press(a, "graveyard:duel");
  await expect(dialog(a)).toContainText(G.duel.prompt);
  await dialog(a).getByLabel(bob.player.name).check({ force: true });
  await dialog(a).getByRole("button", { name: "Choose" }).click();
  await settle(a);
  await seeText(a, anyOf(G.duel.youFirst, G.duel.theyFirst));
  const fight = a.getByRole("region", { name: "The fight" });
  await expect(fight).toContainText(alice.player.name);
  await expect(fight).toContainText(bob.player.name);
  await expect(bid(a, "graveyard:shove")).toContainText(rx(G.duel.shoveDetail));
  let shoved = false;
  for (let i = 0; i < 30 && (await bid(a, "graveyard:swing").isVisible()); i++) {
    const id = shoved ? "graveyard:swing" : "graveyard:shove";
    const text = await pressText(a, id);
    if (!shoved) expect(text).toMatch(anyOf(G.duel.shoveIn, G.duel.shoveFail));
    else expect(text).toMatch(anyOf(G.duel.youHit, G.duel.youMiss, G.duel.won, G.duel.lost));
    shoved = true;
  }
  await seeText(a, anyOf(G.duel.won, G.duel.lost));
  await press(a, "go:graveyard");
  await expect(bid(a, "graveyard:duel")).toHaveAttribute("aria-disabled", "true");
  await expect(bid(a, "graveyard:duel")).toHaveAccessibleDescription(TT.hints.doneToday);
  // The rival hears of it by letter.
  await toDesk(bob.page);
  await press(bob.page, "go:map");
  await bob.page.getByRole("button", { name: "Go to Your Parlor" }).click();
  await settle(bob.page);
  const mail = await readLetters(bob.page);
  expect(`${mail} ${norm(await well(bob.page).textContent())}`).toMatch(
    anyOf(G.duel.wonMail, G.duel.lostMail),
  );

  // Bob yields a duel of his own, then robs a grave on the evil path (16.3).
  const b = bob.page;
  await edit(b, M, bob, { karma: 10, money: 20_000 });
  await goTo(b, PLACE.graveyard);
  await press(b, "graveyard:duel");
  await dialog(b).getByLabel(alice.player.name).check({ force: true });
  await dialog(b).getByRole("button", { name: "Choose" }).click();
  await settle(b);
  if (await bid(b, "graveyard:yield").isVisible()) {
    await press(b, "graveyard:yield");
    await seeText(b, rx(G.duel.yielded));
  }
  await toDesk(b);
  await goTo(b, PLACE.graveyard);
  await expect(bid(b, "graveyard:tend")).toHaveAccessibleDescription(TT.hints.karmaTooLow);
  await press(b, "graveyard:rob");
  await seeText(b, anyOf(...G.robFound, G.robSilver, G.robCaught));
  await toDesk(b);
  await edit(a, M, alice, { karma: 52 });
});

// ------------------------------------------------------------------ 9.5 hearses

test("hearses: a Budget Hearse bought with gold tags at Di-Mart", async () => {
  const { page } = alice;
  await edit(page, M, alice, { tags: [40, 10, 40] });
  await goTo(page, PLACE.store);
  await press(page, "store:hearse");
  await seeText(page, rx(CLASSIC_TEXT.places.store.hearseIntro));
  await press(page, "store:look:1");
  await seeText(page, "Budget Hearse");
  await press(page, "store:buy");
  await seeText(page, rx(CLASSIC_TEXT.places.store.bought.replace("{new}", "Budget Hearse")));
  await toDesk(page);
  await press(page, "go:stats");
  await expect(page.locator('[data-stat="ride"]')).toContainText("Budget Hearse");
  await press(page, "go:desk");
});

/** A button of the screen by its label (for ids that carry a generated part). */
const labelled = (page: Page, label: string | RegExp): Locator =>
  page
    .locator(".fq-r-buttons [data-button-id], .fq-r-note [data-button-id]")
    .filter({ hasText: label })
    .first();

/** Picks a name in the open player picker. */
async function pick(page: Page, name: string): Promise<void> {
  await dialog(page).getByLabel(name, { exact: false }).first().check({ force: true });
  await dialog(page).getByRole("button", { name: "Choose" }).click();
  await settle(page);
}

let carl!: Who;

/** Logs a player off through Exit. */
async function logOff(who: Who): Promise<void> {
  await toDesk(who.page);
  await clickClear(who.page, who.page.locator(".fq-exit"));
  await who.page.getByRole("button", { name: "Leave" }).click();
  await expect(who.page.getByText(`Welcome back, ${who.player.name}.`)).toBeVisible();
}

/**
 * From whatever the first screen is (the paper, the morning, a letter) to the desk, gathering
 * every letter and every screen's text on the way.
 */
async function wakeUp(page: Page): Promise<string> {
  const seen: string[] = [];
  for (let i = 0; i < 10; i++) {
    seen.push(await readLetters(page));
    if (await page.locator(".fq-news").isVisible()) {
      await press(page, "go:desk");
      continue;
    }
    if (await well(page).isVisible()) seen.push(norm(await well(page).textContent()));
    if ((await bid(page, "desk:wait").isVisible()) && !(await dialog(page).isVisible())) break;
    const next = page
      .locator(".fq-plaque")
      .filter({ has: page.locator(".fq-plaque-label").getByText(/^(Continue|Skip Tour)$/) })
      .first();
    if (await next.isVisible()) {
      await next.click();
      await settle(page);
    }
  }
  return seen.join(" | ");
}

/** Back in from the front door after logging off. */
async function logBackOn(who: Who): Promise<void> {
  await who.page.getByRole("button", { name: "Open the parlor" }).click();
  await expect(who.page.getByRole("button", { name: "Open the parlor" })).toBeHidden();
  await expect(who.page.locator(".fq-cabinet")).toBeVisible();
  await settle(who.page);
}

// ------------------------------------------------------------------ 20 the Reaper Club

test("the Reaper Club: the cover, the three house games, the black market, the bodyguard, a hit booked, the seance", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const C = TT.club;
  // A third parlor, asleep tonight: the hit man's target (and later a burglar's).
  carl = await join(browser, M, "xcarl");
  await sitDown(carl.page);
  await logOff(carl);

  const { page } = alice;
  await edit(page, M, alice, { karma: 52, money: 300_000, tags: [40, 10, 40] });
  await goTo(page, PLACE.club);
  await seeText(page, rx(C.door.replace("{cover}", "2")));
  await expect(bid(page, "reaper-club:pay")).toContainText("2 wood");
  await press(page, "reaper-club:pay");
  await seeText(page, pool(C.inside));
  for (const id of ["reaper-club:games", "reaper-club:market", "reaper-club:hit"]) {
    await expect(bid(page, id)).toBeVisible();
  }
  // The back tables: three games at four stakes, a banner for the last round (20.2, 11.5).
  await press(page, "reaper-club:games");
  await seeText(page, rx(C.gamesIntro));
  const board = page.getByRole("region", { name: "The back tables" });
  await expect(board.getByRole("button")).toHaveCount(12);
  const round = page.getByRole("region", { name: "Last round" });
  await board.getByRole("button", { name: "Dead Man's Draw, Stake $100" }).click();
  await settle(page);
  await expect(round).toHaveAttribute("data-game", "draw");
  await seeText(page, anyOf(C.drawWin, C.drawLose, C.drawTie));
  await board.getByRole("button", { name: "The One-Armed Undertaker, Stake $100" }).click();
  await settle(page);
  await expect(round).toHaveAttribute("data-game", "slots");
  await seeText(page, rx(C.slotsSpin));
  await seeText(page, anyOf(C.slotsWin, C.slotsLose, C.slotsSpin));
  await board.getByRole("button", { name: "Formaldehyde Roulette, Stake $100" }).click();
  await settle(page);
  await expect(round).toHaveAttribute("data-game", "shots");
  await seeText(page, anyOf(C.shotsWin, C.shotsLose));
  await expect(round).toContainText(/You won|You lost|Stake back|Part of the stake back/);
  await press(page, "reaper-club:main");
  // The black market: today's three items with their reward summaries (20.3).
  await press(page, "reaper-club:market");
  await seeText(page, rx(C.marketIntro));
  const cards = hand(page).locator(".fq-card");
  await expect(cards).toHaveCount(3);
  // A card's hint is the reward in words, with no colour codes left in it.
  for (const hint of await cards.locator(".fq-card-hint").allTextContents()) {
    expect(hint).not.toContain("`");
    expect(hint).toMatch(/^\(.+\)$/);
  }
  const item = hand(page).locator('.fq-card:not([aria-disabled="true"])').first();
  const itemName = norm(await item.locator(".fq-card-label").textContent());
  await item.click();
  await settle(page);
  await seeText(page, rx(C.marketBought.replace("{name}", itemName)));
  await press(page, "reaper-club:main");
  // The bodyguard for tonight (20.4).
  await press(page, "reaper-club:bodyguard");
  await seeText(page, rx(C.bodyguardBought));
  await expect(bid(page, "reaper-club:bodyguard")).toHaveAccessibleDescription(
    TT.hints.alreadyHave,
  );
  // A hit: the picker names the price, the booking costs karma, one a day (20.4).
  await press(page, "reaper-club:hit");
  await expect(dialog(page)).toContainText(rx(C.hitPrompt));
  await expect(dialog(page)).toContainText(`${carl.player.name} ($3,`);
  await pick(page, carl.player.name);
  await seeText(page, rx(C.hitBooked.replace("{name}", carl.player.name)));
  await expect(bid(page, "reaper-club:hit")).toHaveAccessibleDescription(TT.hints.doneToday);
  await toDesk(page);
  // The Necromancer's seance (20.5); the cover is paid for the day, so straight inside.
  await edit(page, M, alice, { karma: 10 });
  await goTo(page, PLACE.club);
  await press(page, "reaper-club:seance");
  await seeText(page, anyOf(C.seanceWin, C.seanceFail));
  await expect(bid(page, "reaper-club:seance")).toHaveAccessibleDescription(TT.hints.doneToday);
  await toDesk(page);
  await edit(page, M, alice, { karma: 52 });
});

// ------------------------------------------------------------------ 18, 23 City Hall

test("City Hall: permits unlock an upgrade, the inspector's certificate and envelope, the ordinance vote and lobbying, filing for mayor, a parlor chain", async () => {
  test.setTimeout(150_000);
  const H = TT.cityHall;
  const CH = TT.chains;
  const a = alice.page;
  const b = bob.page;
  await edit(a, M, alice, { karma: 52, money: 300_000 });
  await goTo(a, PLACE.cityHall);
  await seeText(
    a,
    rx(H.greeting.replace("{mayor}", TOWN.cast.mayor).replace("{player}", alice.player.name)),
  );
  const panel = a.getByRole("region", { name: "City Hall's ballots" });
  await expect(panel).toBeVisible();
  // Permits (18.1): the signage permit, then the billboard is no longer locked at the office.
  await press(a, "city-hall:permits");
  await seeText(a, rx(H.permitsIntro));
  const signage = TOWN.permits.signage?.name as string;
  await press(a, "city-hall:permit:signage");
  await seeText(a, rx(H.permitBought.replace("{name}", signage)));
  await expect(bid(a, "city-hall:permit:signage")).toHaveAttribute("aria-disabled", "true");
  await expect(bid(a, "city-hall:permit:signage")).toContainText(TT.hints.alreadyHave);
  await press(a, "city-hall:main");
  // The inspection (18.2): a certificate for seven days.
  await press(a, "city-hall:inspection");
  await seeText(a, rx(H.inspectionIntro));
  await press(a, "city-hall:certify");
  await seeText(a, rx(H.certified.replace("{days}", "7")));
  await seeText(a, rx(H.certifiedUntil));
  await expect(bid(a, "city-hall:bribe")).toHaveAttribute("aria-disabled", "true");
  await press(a, "city-hall:main");
  // The ordinance vote (18.3): a vote, marked on its card and the panel, then a lobbied vote.
  await press(a, "city-hall:ordinance");
  await seeText(a, rx(H.ordinanceIntro));
  await seeText(a, rx(H.noOrdinance));
  const ballot = hand(a);
  await expect(ballot.getByRole("button")).toHaveCount(3);
  await expect(ballot).toContainText("0 votes");
  const first = ballot.getByRole("button").first();
  const title = norm(await first.locator(".fq-card-label").textContent());
  await first.click();
  await settle(a);
  await seeText(a, rx(H.voted.replace("{title}", title)));
  await expect(ballot.locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(ballot.locator('[aria-pressed="true"]')).toContainText(
    TT.hints.yourVote ?? "Your vote",
  );
  await expect(panel.locator("li[data-mine]")).toContainText("Your vote");
  await press(a, "city-hall:lobby");
  await seeText(a, rx(H.lobbied.replace("{title}", title)));
  await expect(ballot.locator('[aria-pressed="true"]')).toContainText(/^.*2 votes/);
  await press(a, "city-hall:main");
  // The election (18.4): filing, then an ad.
  await press(a, "city-hall:election");
  await seeText(a, rx(H.electionFiling));
  await press(a, "city-hall:file");
  await seeText(a, rx(H.filed));
  await press(a, "city-hall:ads");
  await seeText(a, rx(H.adsBought));
  await press(a, "city-hall:main");
  // A parlor chain (23): founded with a typed name, the board, an invitation, a member joins.
  await press(a, "city-hall:chains");
  await seeText(a, rx(CH.none));
  await press(a, "city-hall:found");
  await expect(dialog(a)).toContainText(CH.namePrompt);
  await submitText(a, "Audit Rites");
  await seeText(a, rx(CH.founded.replace("{name}", "Audit Rites")));
  const scores = a.getByRole("region", { name: "Season score board" });
  await expect(scores.getByRole("row", { name: /Audit Rites/ })).toHaveAttribute(
    "data-mine",
    "true",
  );
  await press(a, "city-hall:invite");
  await expect(dialog(a)).toContainText(CH.invitePrompt);
  await pick(a, bob.player.name);
  await seeText(a, rx(CH.invited.replace("{name}", bob.player.name)));
  // The permit unlocked the billboard at the contractor's.
  await toDesk(a);
  await press(a, "go:parlor");
  await press(a, "parlor:upgrades");
  await expect(bid(a, "parlor:buy:billboard")).not.toHaveAttribute("aria-disabled", "true");
  await toDesk(a);

  await edit(b, M, bob, { money: 50_000, karma: 10 });
  await toDesk(b);
  await readLetters(b);
  await goTo(b, PLACE.cityHall);
  // Bob's envelope for the inspector, at karma 30 or less.
  await press(b, "city-hall:inspection");
  await press(b, "city-hall:bribe");
  await seeText(b, rx(H.bribed));
  await press(b, "city-hall:main");
  await press(b, "city-hall:chains");
  await labelled(b, /Join Audit Rites/).click();
  await settle(b);
  await seeText(b, rx(CH.joined.replace("{name}", "Audit Rites")));
  await expect(
    b.getByRole("region", { name: "Season score board" }).getByRole("row", { name: /Audit Rites/ }),
  ).toContainText(bob.player.name);
  await toDesk(b);
});

// ------------------------------------------------------------------ 19 the hospital

test("the hospital: an injury from Formaldehyde Roulette listed and treated; the ambulance chaser's lead brings a sure customer", async () => {
  test.setTimeout(150_000);
  const Hs = TT.hospital;
  const b = bob.page;
  // Bob is a Necromancer: the bouncer waves him in free (20.1). He drinks until a glass is wrong.
  await edit(b, M, bob, { karma: 10, money: 50_000 });
  await goTo(b, PLACE.club);
  await seeText(b, rx(TT.club.necroFree));
  await press(b, "reaper-club:games");
  const board = b.getByRole("region", { name: "The back tables" });
  let hurt = false;
  for (let i = 0; i < 60 && !hurt; i++) {
    await board.getByRole("button", { name: "Formaldehyde Roulette, Stake $100" }).click();
    await settle(b);
    if (rx(TT.club.shotsLose).test(norm(await well(b).textContent()))) hurt = true;
  }
  expect(hurt).toBe(true);
  await seeText(b, rx(Hs.newInjury));
  await expect(books(b).locator('[data-chip="injuries"]')).toBeVisible();
  // The hospital lists it with its effects and price, and treats it today (19.1).
  await goTo(b, PLACE.hospital);
  await seeText(
    b,
    rx(Hs.greeting.replace("{nurse}", TOWN.cast.nurse).replace("{player}", bob.player.name)),
  );
  await seeText(b, rx(Hs.injuryLine));
  const list = b.getByRole("region", { name: "Your injuries" });
  await expect(list).toContainText("What is wrong with you");
  await expect(list).toContainText(/Heals in \d+ days?\./);
  // (The duel he lost may have left one too: each is treated in turn.)
  const treat = b.locator('[data-button-id^="hospital:treat:"]').first();
  for (let i = 0; i < 3 && (await treat.isVisible()); i++) {
    const label = norm(await treat.locator(".fq-card-label").textContent());
    const injury = label.replace(/^Fix /, "");
    await expect(list).toContainText(injury);
    await treat.click();
    await settle(b);
    await seeText(b, rx(Hs.treated.replace("{name}", injury)));
  }
  await seeText(b, rx(Hs.noInjuries));
  await expect(list).toHaveCount(0);
  await toDesk(b);

  // A lead from the nurse: -2 karma, counted in the books, the next customer is sure (19.2).
  const a = alice.page;
  await edit(a, M, alice, { karma: 52, money: 300_000 });
  await goTo(a, PLACE.hospital);
  await seeText(a, rx(Hs.leadIntro));
  const karma0 = num(await chip(a, "karma").textContent());
  // (The seance may already have given leads; three is the most a parlor holds.)
  const leadChip = books(a).locator('[data-chip="leads"]');
  const leads0 = (await leadChip.count()) > 0 ? num(await chip(a, "leads").textContent()) : 0;
  expect(leads0).toBeLessThan(3);
  await press(a, "hospital:lead");
  await seeText(a, pool(Hs.leadBought));
  await expect(chip(a, "leads")).toHaveText(String(leads0 + 1));
  await expect(chip(a, "karma")).toHaveText(String(karma0 - 2));
  await toDesk(a);
  await press(a, "desk:wait");
  await seeText(a, rx(Hs.leadArrives));
  await expect(file(a)).toBeVisible();
  await finish(a);
});

// ------------------------------------------------------------------ 21 the bank

test("the bank: savings in and out, a loan with its due day and its repayment, tags sent to a rival", async () => {
  test.setTimeout(120_000);
  const B = TT.bank;
  const a = alice.page;
  await edit(a, M, alice, { money: 300_000, tags: [40, 10, 40] });
  await goTo(a, PLACE.bank);
  // The bank's own books beside the teller (11.5).
  const books2 = a.getByRole("region", { name: "The bank's books" });
  await expect(books2).toBeVisible();
  // The 2001 bank's own note is still on screen with the Expanded books in its place.
  await seeText(a, rx(CLASSIC_TEXT.places.bank.note));
  // Savings (21.2).
  await press(a, "bank:savings");
  await seeText(a, rx(B.savingsIntro));
  await press(a, "bank:deposit");
  await expect(dialog(a)).toContainText(B.depositPrompt);
  await submitText(a, "10000");
  await seeText(a, rx(B.deposited.replace("{money}", "10,000")));
  await expect(chip(a, "savings")).toHaveText("$10,000");
  await press(a, "bank:withdraw");
  await expect(dialog(a)).toContainText(B.withdrawPrompt);
  await submitText(a, "4000");
  await seeText(a, rx(B.withdrew.replace("{money}", "4,000")));
  await expect(chip(a, "savings")).toHaveText("$6,000");
  await press(a, "go:bank");
  // A loan (21.3): the terms first, then the debt in red in the books with its due day.
  await press(a, "bank:loan");
  await seeText(a, rx(B.loanIntro));
  await expect(a.getByLabel("The loan's terms")).toContainText("The most it lends you");
  await press(a, "bank:borrow");
  await expect(dialog(a)).toContainText(B.borrowPrompt);
  await submitText(a, "1000");
  await seeText(a, rx(B.borrowed.replace("{money}", "1,000")));
  await seeText(a, rx(B.loanOwed.replace("{owed}", "1,030")));
  const debt = books(a).locator('[data-chip="debt"]');
  await expect(debt).toBeVisible();
  await expect(debt).toContainText(/Due/);
  await expect(books2).toContainText("You owe");
  // No deposits while the loan is out.
  await press(a, "go:bank");
  await press(a, "bank:savings");
  await expect(bid(a, "bank:deposit")).toHaveAttribute("aria-disabled", "true");
  await expect(bid(a, "bank:deposit")).toHaveAccessibleDescription(B.noDepositWithLoan);
  await press(a, "go:bank");
  await press(a, "bank:loan");
  await expect(bid(a, "bank:repay")).toContainText("$1,030");
  await press(a, "bank:repay");
  await seeText(a, rx(B.repaid.replace("{money}", "1,030")));
  await expect(debt).toHaveCount(0);
  await press(a, "go:bank");
  // Tags to a rival (21.1): the picker, the tier, the count; the teller keeps 10% rounded up.
  await press(a, "bank:transferhome");
  await seeText(a, rx(B.transferIntro));
  await press(a, "bank:transfer");
  await expect(dialog(a)).toContainText(B.transferPick);
  await pick(a, bob.player.name);
  await seeText(a, rx(B.transferTier.replace("{name}", bob.player.name)));
  await labelled(a, B.buttons.wood).click();
  await settle(a);
  await expect(dialog(a)).toContainText(B.transferCount);
  await submitText(a, "4");
  await seeText(
    a,
    // Four sent: the teller keeps one, three arrive.
    rx(
      B.transferred
        .replace("{count}", "3")
        .replace("{name}", bob.player.name)
        .replace("{fee}", "1"),
    ),
  );
  await toDesk(a);
  // Bob's letter from the bank.
  const b = bob.page;
  await toDesk(b);
  await press(b, "go:map");
  await b.getByRole("button", { name: "Go to Your Parlor" }).click();
  await settle(b);
  const mail = `${await readLetters(b)} ${norm(await well(b).textContent())}`;
  expect(mail).toMatch(
    rx(B.transferMail.replace("{name}", alice.player.name).replace("{count}", "3")),
  );
  await toDesk(b);
});

// ------------------------------------------------------------------ 9, 23.3 rivals

test("rivals: theft takes cash from an open till, the Twins burn caskets, chain-mates and the Peace Pledge are refused, the underdog's bonus and the pledge's insurance", async () => {
  test.setTimeout(240_000);
  const a = alice.page;
  const V = X.visit;
  // Carl (asleep) has cash in the till, caskets in stock and no safe.
  await edit(a, M, carl, { money: 20_000 });
  await edit(a, M, alice, { tags: [40, 10, 40], money: 300_000 });
  const visit = async (who: Who) => {
    await goTo(a, PLACE.rivals);
    await press(a, "competitors:visit");
    await submitText(a, who.player.name.slice(0, 8));
    await expect(dialog(a)).toContainText(`Do you mean ${who.player.name}?`);
    await dialog(a).getByRole("button", { name: "Yes", exact: true }).click();
    await settle(a);
  };
  // Theft without a safe: up to 4 tags and 5% of the cash (9.6).
  await visit(carl);
  await press(a, "competitors:trydoor");
  await expect(labelled(a, "Steal")).toBeVisible();
  await labelled(a, "Steal").click();
  await settle(a);
  await seeText(a, rx(V.cashStolen.replace("{money}", "1,000")));
  await toDesk(a);
  // Chain-mates never fight (23.3).
  await visit(bob);
  await seeText(a, rx(TT.chains.noFriendlyFire.replace("{name}", bob.player.name)));
  await toDesk(a);

  // The Twins (a script event): a fire burns half the caskets in stock (9.6).
  await tune(a, M, { scriptOdds: 1 });
  let burned = false;
  for (let i = 0; i < 40 && !burned; i++) {
    await press(a, "desk:wait");
    if (await bid(a, "script:1").isVisible()) {
      await seeText(a, rx(X.arson.offer));
      await press(a, "script:1");
      await expect(dialog(a)).toContainText("Who would you like the Twins to pay a visit to?");
      await pick(a, carl.player.name);
      await seeText(
        a,
        anyOf(X.arson.burned, "The fire is put out before it can do any serious damage!"),
      );
      burned = true;
    } else if (await file(a).isVisible()) {
      // (A lead from the nurse brings a sure customer first: sold and on.)
      if (await bid(a, "neg:done").isVisible()) await press(a, "neg:done");
      else await clickClear(a, a.locator(".fq-r-buttons [data-button-id]").first());
    }
    await toDesk(a);
  }
  await tune(a, M, { scriptOdds: 0 });
  expect(burned).toBe(true);

  // Carl wakes to the letters, takes the Peace Pledge, and is safe from both.
  await logBackOn(carl);
  const c = carl.page;
  const letters = await wakeUp(c);
  expect(letters).toMatch(rx(V.cashStolenMail.replace("{money}", "1,000")));
  expect(letters).toMatch(anyOf(X.arson.burnedMail, "The fire is put out"));
  await toDesk(c);
  await press(c, "go:parlor");
  await press(c, "parlor:rivalry");
  await press(c, "parlor:rivalry:peaceful");
  await seeText(c, rx(X.office.rivalrySet.replace("{rivalry}", X.office.rivalryNames.peaceful)));
  await toDesk(c);
  // A pledged parlor cannot go visiting either.
  await goTo(c, PLACE.rivals);
  await press(c, "competitors:visit");
  await seeText(c, rx(V.selfPeaceful));
  await toDesk(c);
  await visit(carl);
  await seeText(a, rx(V.targetPeaceful.replace("{name}", carl.player.name)));
  await toDesk(a);
  // Carl trails the leader: a sale pays the underdog's bonus, less the pledge's insurance (9.3, 9.4).
  // (8% of a small sale's base BP rounds to nothing: a Hard Sell or two makes the bill big enough.)
  let sold = false;
  let insured = false;
  for (let i = 0; i < 12 && !insured; i++) {
    await meet(c);
    for (let h = 0; h < 2 && (await bid(c, "neg:hard").isVisible()); h++) {
      if ((await bid(c, "neg:hard").getAttribute("aria-disabled")) !== null) break;
      await press(c, "neg:hard");
    }
    if (await walkedOut(c)) {
      await toDesk(c);
      continue;
    }
    const done = await pressText(c, "neg:done");
    if (rx(X.done.success).test(done)) {
      expect(done).toMatch(rx(X.done.underdog));
      sold = true;
      if (rx(X.done.insurance).test(done)) insured = true;
    }
    await toDesk(c);
  }
  expect(sold).toBe(true);
  expect(insured).toBe(true);
  await logOff(carl);
});

// ------------------------------------------------------------------ 10.1, 22.4 the new day

/** The paper's text: today's front page, its crime page, and yesterday's of both. */
async function readPaper(page: Page): Promise<string> {
  await toDesk(page);
  await press(page, "go:news");
  const body = page.locator(".fq-news");
  const parts = [norm(await body.textContent())];
  await press(page, "news:crime");
  parts.push(norm(await body.textContent()));
  if (await bid(page, "news:yesterday").isVisible()) {
    await press(page, "news:yesterday");
    parts.push(norm(await body.textContent()));
    if (await bid(page, "news:crime").isVisible()) {
      await press(page, "news:crime");
      parts.push(norm(await body.textContent()));
    }
  }
  await toDesk(page);
  return parts.join(" | ");
}

/** Through the map to the desk, so the day's first visit (the morning screen) happens now. */
async function morning(page: Page): Promise<string> {
  await toDesk(page);
  await press(page, "go:map");
  await page.getByRole("button", { name: "Go to Your Parlor" }).click();
  await settle(page);
  return wakeUp(page);
}

test("a new day: carried turns, plot income, hearse upkeep, the weather; the inspector, bingo, the brawl and the foiled hit", async () => {
  test.setTimeout(150_000);
  const a = alice.page;
  const day0 = await townDay(a, M);
  await toDesk(a);
  await toDesk(bob.page);
  await newDay(a, M);
  await expect(a.getByText(`A new day has dawned. It is day ${day0 + 1}.`)).toBeVisible();
  // The morning screen lists each part of the Expanded new day (10.1, 22.4).
  const text = await morning(a);
  expect(text).toMatch(rx(X.desk.banked));
  expect(text).toMatch(rx(X.desk.plotIncome));
  expect(text).toMatch(
    rx(X.desk.hearsePaid.replace("{ride}", "Budget Hearse").replace("{upkeep}", "150")),
  );
  expect(text).toMatch(rx(TT.world.morningWeather));
  // The certificate kept the inspector happy (alice is the only parlor with upgrades, 18.2).
  expect(text).toMatch(rx(TT.cityHall.inspectPassMail));
  // A cutthroat parlor has one more visit a day (9.3): the row of parlors counts nine.
  await goTo(a, PLACE.rivals);
  await seeText(a, rx(CLASSIC_TEXT.social.visit.watchMany.replace("{visits}", "9")));
  await toDesk(a);
  // The night in the paper: the bingo draw, the graveyard brawl, the hit on Carl (17.1, 16.4, 20.4).
  const paper = await readPaper(a);
  expect(paper).toMatch(/BINGO NIGHT/);
  expect(paper).toMatch(anyOf(TT.church.bingoNews, TT.church.bingoCarryNews));
  expect(paper).toMatch(/GRAVEYARD BRAWL/);
  // Carl took the Peace Pledge before midnight, which foils the hit: the hirer hears so, and
  // half the time the hit man talks and the crime page names who paid (20.4).
  expect(`${text} ${paper}`).toMatch(
    anyOf(TT.club.hitFoiledHirer.replace("{name}", carl.player.name), TT.club.hitSnitchNews),
  );
  // Bob's morning: the chain's dues are paid and nothing is said; his desk is up.
  await morning(bob.page);
  await expect(bid(bob.page, "desk:wait")).toBeVisible();
});

// ------------------------------------------------------------------ 18.3, 18.4 over the days

/** Forces new days until the town is on `day`. */
async function untilDay(page: Page, town: Town, day: number): Promise<void> {
  for (let d = await townDay(page, town); d < day; d++) await newDay(page, town);
  expect(await townDay(page, town)).toBe(day);
}

test("the week's ordinance passes and is in force; the election's vote and count make a mayor", async () => {
  test.setTimeout(180_000);
  const H = TT.cityHall;
  const a = alice.page;
  const b = bob.page;
  // The ballot that opened on day 1 closes after day 7: alice's lobbied option wins (18.3).
  await untilDay(a, M, 8);
  await morning(a);
  const paper = await readPaper(a);
  expect(paper).toMatch(/NEW ORDINANCE: /);
  const title = /NEW ORDINANCE: (.+?) [A-Z"]/.exec(paper)?.[1] ?? "";
  await expect(strip(a).locator('[data-kind="ordinance"]')).toBeVisible();
  await goTo(a, PLACE.cityHall);
  await press(a, "city-hall:ordinance");
  await seeText(a, rx(H.currentOrdinance));
  await expect(a.getByRole("region", { name: "City Hall's ballots" })).toContainText(
    title.slice(0, 12),
  );
  await press(a, "city-hall:main");
  // The election's voting days (18.4): the strip asks Bob to vote, he votes for the lone candidate.
  await press(a, "city-hall:election");
  await seeText(a, rx(H.electionVoting));
  await toDesk(a);
  await morning(b);
  await expect(strip(b).locator('[data-kind="vote"]').first()).toBeVisible();
  await goTo(b, PLACE.cityHall);
  await press(b, "city-hall:election");
  await seeText(b, rx(H.electionVoting));
  await labelled(b, alice.player.name).click();
  await settle(b);
  await seeText(b, rx(H.electionVoted.replace("{name}", alice.player.name)));
  await toDesk(b);
  // The count at the midnight starting day 11: alice is mayor (the strip, City Hall, her letter).
  await untilDay(a, M, 11);
  const letters = await morning(a);
  expect(letters).toMatch(rx(H.electedMail));
  await expect(strip(a).locator('[data-kind="mayor"]')).toContainText(alice.player.name);
  expect(await readPaper(a)).toMatch(rx(H.electedNews.replace("{name}", alice.player.name)));
  await goTo(a, PLACE.cityHall);
  await seeText(
    a,
    rx(H.greeting.replace("{mayor}", alice.player.name).replace("{player}", alice.player.name)),
  );
  await press(a, "city-hall:election");
  await seeText(a, rx(H.electionDone.replace("{name}", alice.player.name)));
  await toDesk(a);
  await morning(b);
});

// ------------------------------------------------------------------ 22 the living town

test("the living town: the weather and the news on the morning screen and the strip, a story arc with its appeal and its ending, news that remembers", async ({
  browser,
}) => {
  test.setTimeout(420_000);
  const W = TT.world;
  const L = TOWNS.life;
  {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto("/");
    await makeTown(
      p,
      L,
      { turnsPerDay: 50, normalOdds: 0, luckOdds: 0, scriptOdds: 0 },
      { "town.world.newsChance": 1, "town.world.arcChance": 1 },
      777,
    );
    await ctx.close();
  }
  const dora = await join(browser, L, "xdora");
  const page = dora.page;
  await sitDown(page);
  const conditional = TOWN.news.filter((n) => n.when);
  const endings = new Map<string, string>();
  for (const arc of TOWN.arcs) {
    for (const beat of arc.beats) {
      if (!beat.next) endings.set(stripCodes(beat.headline).trim(), arc.id);
    }
  }
  const seen = {
    weather: false,
    news: false,
    arc: false,
    appeal: false,
    ending: "",
    remembers: "",
  };
  for (let day = 2; day < 29 && !(seen.appeal && seen.ending && seen.remembers); day++) {
    await newDay(page, L);
    const text = await morning(page);
    // Weather every day (22.2): a line on the morning screen and a chip on the strip.
    expect(text).toMatch(rx(W.morningWeather));
    await expect(strip(page).locator('[data-kind="weather"]')).toBeVisible();
    seen.weather = true;
    // News every day here (22.1): its line, its chip, its effect in the desk's status.
    if (rx(W.morningNews).test(text)) {
      await expect(strip(page).locator('[data-kind="news"]')).toBeVisible();
      seen.news = true;
    }
    // The running story (22.3): its line, its chip, and an appeal at a place while it lasts.
    if (rx(W.morningArc).test(text)) {
      await expect(strip(page).locator('[data-kind="story"]')).toBeVisible();
      seen.arc = true;
      if (!seen.appeal) {
        const places: Record<string, string> = {
          church: PLACE.church,
          "city-hall": PLACE.cityHall,
          "reaper-club": PLACE.club,
          graveyard: PLACE.graveyard,
          hospital: PLACE.hospital,
          bank: PLACE.bank,
          store: PLACE.store,
        };
        for (const [id, name] of Object.entries(places)) {
          if (seen.appeal) break;
          await edit(page, L, dora, { money: 50_000 });
          await goTo(page, name);
          if (id === "reaper-club" && (await bid(page, "reaper-club:pay").isVisible())) {
            await edit(page, L, dora, { tags: [10, 0, 0] });
            await press(page, "reaper-club:pay");
          }
          const appeal = page.locator('[data-button-id^="arc:give:"]').first();
          if (await appeal.isVisible()) {
            await expect(appeal).toContainText(/\$[\d,]+/);
            const cash = num(await chip(page, "money").textContent());
            await appeal.click();
            await settle(page);
            expect(num(await chip(page, "money").textContent())).toBeLessThan(cash);
            seen.appeal = true;
          }
          await toDesk(page);
        }
      }
    }
    // The front page: an arc's ending headline, and a story that only runs after one (22.5).
    await press(page, "go:news");
    const front = norm(await page.locator(".fq-news").textContent());
    for (const [headline, arc] of endings) {
      if (!seen.ending && front.includes(headline.slice(0, 30))) seen.ending = arc;
    }
    for (const story of conditional) {
      const head = stripCodes(story.title)
        .replace(/\{mayor\}.*/, "")
        .trim();
      if (!seen.remembers && head.length > 6 && front.includes(head)) seen.remembers = story.id;
    }
    await toDesk(page);
  }
  console.log(`living town: ${JSON.stringify(seen)}`);
  expect(seen.weather).toBe(true);
  expect(seen.news).toBe(true);
  expect(seen.arc).toBe(true);
  expect(seen.appeal).toBe(true);
  expect(seen.ending).not.toBe("");
  expect(seen.remembers).not.toBe("");
  await dora.context.close();
});

// ------------------------------------------------------------------ 24 the Daily Challenge

test("the Daily Challenge: a guest plays the whole seeded day to the end and is scored; a member is on the board", async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const Ch = TT.challenge;
  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/");
  await expect(guest.getByText(/Connected to /)).toBeVisible();
  await guest.getByRole("button", { name: /^Play online/ }).click();
  await guest.getByRole("button", { name: "Daily Challenge" }).click();
  await expect(guest.getByRole("heading", { name: "Daily Challenge" })).toBeVisible();
  // The fixed loadout is announced before the run (24.1).
  await expect(guest.getByText(/Everyone starts with 20 turns/)).toBeVisible();
  await guest.getByRole("button", { name: "Play as a guest" }).click();
  await guest.getByLabel("What's your name?", { exact: true }).fill("Audit Guest");
  await guest.getByLabel("What is your parlor called?", { exact: true }).fill("Audit Rest");
  await guest.getByRole("radio", { name: "Male", exact: true }).check({ force: true });
  await guest.getByRole("button", { name: "start the challenge" }).click();
  await expect(bid(guest, "desk:wait")).toBeVisible();
  await seeText(guest, rx(Ch.intro.replace("{turns}", "20")));
  // Every turn spent on a customer; the finished run's desk has the score and one button.
  // (The day has the town's street events too: each is answered with its last choice.)
  for (let i = 0; i < 120; i++) {
    if (await bid(guest, "desk:quit").filter({ hasText: Ch.leave }).isVisible()) break;
    if (await dialog(guest).isVisible()) {
      await readLetters(guest);
      continue;
    }
    const next = (await bid(guest, "desk:wait").isVisible())
      ? bid(guest, "desk:wait")
      : (await bid(guest, "neg:done").isVisible())
        ? bid(guest, "neg:done")
        : guest.locator(".fq-r-buttons [data-button-id]").last();
    await clickClear(guest, next);
    await settle(guest);
  }
  await seeText(guest, rx(Ch.finished));
  await expect(guest.locator(".fq-r-buttons [data-button-id]")).toHaveCount(1);
  await press(guest, "desk:quit");
  await expect(guest.getByRole("heading", { name: "Results" })).toBeVisible();
  await expect(guest.getByRole("region", { name: "Your result" })).toContainText("Score");
  await expect(guest.getByText("Guests are not on the board.")).toBeVisible();
  await guest.context().close();

  // A member (Carl, at the front door since he logged off) plays and is on the board.
  const c = carl.page;
  await c.getByRole("button", { name: "Daily Challenge" }).click();
  await c.getByLabel("What's your name?", { exact: true }).fill("Carl Board");
  await c.getByLabel("What is your parlor called?", { exact: true }).fill("Board Rest");
  await c.getByRole("radio", { name: "Male", exact: true }).check({ force: true });
  await c.getByRole("button", { name: "start the challenge" }).click();
  await expect(bid(c, "desk:wait")).toBeVisible();
  // One sale (a street event that comes first is answered with its last choice), then out.
  for (let i = 0; i < 20; i++) {
    if (await bid(c, "neg:done").isVisible()) {
      await press(c, "neg:done");
      break;
    }
    if (await dialog(c).isVisible()) await readLetters(c);
    else if (await bid(c, "desk:wait").isVisible()) await press(c, "desk:wait");
    else {
      await clickClear(c, c.locator(".fq-r-buttons [data-button-id]").last());
      await settle(c);
    }
  }
  await clickClear(c, c.locator(".fq-exit"));
  await c.getByRole("button", { name: "Leave" }).click();
  await expect(c.getByRole("heading", { name: "Results" })).toBeVisible();
  const board = c.getByRole("region", { name: /Today's board/ });
  await expect(board.locator("tr[data-mine]")).toContainText("Carl Board");
});

// ------------------------------------------------------------------ 11, 26 the three layouts

const SIZES = [
  { name: "classic", width: 1024, height: 745 },
  { name: "wide", width: 1280, height: 720 },
  { name: "phone", width: 390, height: 844 },
] as const;

for (const size of SIZES) {
  test(`every Expanded screen fits its cabinet at ${size.name} (${size.width}x${size.height})`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(300_000);
    const phone = size.name === "phone";
    const me = await join(browser, M, `xlay${size.name.slice(0, 2)}`);
    await me.page.setViewportSize({ width: size.width, height: size.height });
    const page = me.page;
    await sitDown(page);
    await edit(page, M, me, { money: 400_000, tags: [40, 10, 40], karma: 90 });
    const problems: Problem[] = [];
    let shot = 0;
    const check = async (screen: string) => {
      await page.waitForTimeout(200);
      // A button scrolled out of sight inside a scrolling list (the contractor's catalogue) is
      // where it should be: the list, not the page, scrolls.
      const scrolledAway = await page.evaluate(() =>
        [...document.querySelectorAll("[data-button-id]")]
          .filter((el) => {
            for (let p = el.parentElement; p; p = p.parentElement) {
              const cs = getComputedStyle(p);
              if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) {
                const a = el.getBoundingClientRect();
                const b = p.getBoundingClientRect();
                return a.top < b.top - 1 || a.bottom > b.bottom + 1;
              }
            }
            return false;
          })
          .map((el) => (el as HTMLElement).dataset.buttonId ?? ""),
      );
      const plaques = (await inspect(page, `${screen} / ${size.name}`, phone)).filter(
        (problem) =>
          (problem.what !== "no buttons on the screen" ||
            !/map|picker|text box/.test(problem.screen)) &&
          !scrolledAway.some((id) => problem.what.startsWith(`${id} `)),
      );
      problems.push(...plaques);
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
        for (const h of document.querySelectorAll(".fq-hotspot")) {
          const r = h.getBoundingClientRect();
          if (
            r.width > 0 &&
            (r.left < -1 || r.right > window.innerWidth + 1 || r.bottom > window.innerHeight + 1)
          ) {
            out.push(`a map place is off the screen (${h.getAttribute("aria-label")})`);
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

    await check("the desk with the town strip");
    await meet(page);
    await check("a negotiation with the second row");
    await press(page, "neg:soft");
    await check("the soft-sell hand");
    await press(page, "neg:back");
    await press(page, "neg:packages");
    await check("the packages");
    await press(page, "neg:back");
    await press(page, "neg:done");
    if (await bid(page, "prep:start").isVisible()) {
      await press(page, "prep:start");
      await check("a body-preparation choice");
    }
    await toDesk(page);
    await press(page, "go:stats");
    await check("the stats sheet");
    await press(page, "go:desk");
    await press(page, "go:parlor");
    await check("the office");
    await press(page, "parlor:upgrades");
    await check("the contractor's catalogue");
    await press(page, "go:parlor");
    await press(page, "parlor:markup");
    await check("the markup chooser");
    await press(page, "go:parlor");
    await press(page, "parlor:rivalry");
    await check("the rivalry chooser");
    await toDesk(page);
    await press(page, "go:map");
    await check("the town map");
    const places: [string, string, (() => Promise<void>) | null][] = [
      [
        "Di-Mart",
        PLACE.store,
        async () => {
          await press(page, "store:caskets");
          await check("Di-Mart's casket shelf");
        },
      ],
      [
        "the graveyard",
        PLACE.graveyard,
        async () => {
          await press(page, "graveyard:monuments");
          await check("the monuments");
          await press(page, "graveyard:main");
          await press(page, "graveyard:duel");
          await check("the duel picker");
          await pick(page, bob.player.name);
          if (await bid(page, "graveyard:swing").isVisible()) {
            await check("a duel");
            await press(page, "graveyard:yield");
          }
        },
      ],
      [
        "the church",
        PLACE.church,
        async () => {
          await press(page, "church:bingo");
          await check("Bingo Night");
        },
      ],
      [
        "City Hall",
        PLACE.cityHall,
        async () => {
          await press(page, "city-hall:permits");
          await check("the permits");
          await press(page, "city-hall:main");
          await press(page, "city-hall:ordinance");
          await check("the ordinance ballot");
          await press(page, "city-hall:main");
          await press(page, "city-hall:election");
          await check("the election");
          await press(page, "city-hall:main");
          await press(page, "city-hall:chains");
          await check("the chains and their board");
          await press(page, "city-hall:found");
          await check("the chain-name text box");
          await dialog(page).getByRole("button", { name: "Cancel" }).click();
          await settle(page);
        },
      ],
      ["the hospital", PLACE.hospital, null],
      [
        "the Reaper Club",
        PLACE.club,
        async () => {
          await check("the club's door");
          await press(page, "reaper-club:pay");
          await check("inside the club");
          await press(page, "reaper-club:games");
          await page
            .getByRole("region", { name: "The back tables" })
            .getByRole("button", { name: "Dead Man's Draw, Stake $100" })
            .click();
          await settle(page);
          await check("the back tables after a round");
          await press(page, "reaper-club:main");
          await press(page, "reaper-club:market");
          await check("the black market");
        },
      ],
      [
        "the bank",
        PLACE.bank,
        async () => {
          await press(page, "bank:savings");
          await check("savings");
          await press(page, "go:bank");
          await press(page, "bank:loan");
          await check("loans");
        },
      ],
      [
        "the row of parlors",
        PLACE.rivals,
        async () => {
          await press(page, "competitors:look");
          await check("the parlors' look list");
        },
      ],
    ];
    for (const [name, place, inside] of places) {
      await goTo(page, place);
      if (name !== "the Reaper Club") await check(name);
      if (inside) await inside();
      await toDesk(page);
    }
    expect(problems, JSON.stringify(problems, null, 1)).toEqual([]);
    await me.context.close();
  });
}

// ------------------------------------------------------------------ engine and content defects

/*
 * What the audit found that the client could not fix (docs/expanded-audit.md, "Defects"): the
 * engine and the pack were corrected the same day, and each test now proves the correction.
 */

test("the teller's savings rate agrees with the bank's books", async () => {
  const a = alice.page;
  await goTo(a, PLACE.bank);
  await press(a, "bank:savings");
  const panel = a.getByRole("region", { name: "The bank's books" });
  const rate = /([\d.]+)% a day/.exec(norm(await panel.textContent()))?.[1];
  await seeText(a, `earning ${rate}% a day`);
  await toDesk(a);
});

test("the stats sheet counts a cutthroat parlor's extra visit", async () => {
  const a = alice.page;
  await goTo(a, PLACE.rivals);
  const row = /visit (\d+) more/.exec(norm(await well(a).textContent()))?.[1];
  await toDesk(a);
  await press(a, "go:stats");
  await expect(a.locator('[data-stat="visits"] dd')).toHaveText(row ?? "");
  await press(a, "go:desk");
});

test("a ballot option with one vote reads '1 vote'", async () => {
  const b = bob.page;
  await goTo(b, PLACE.cityHall);
  await press(b, "city-hall:ordinance");
  await hand(b).getByRole("button").first().click();
  await settle(b);
  await expect(hand(b).locator('[aria-pressed="true"]')).not.toContainText("1 votes");
  await toDesk(b);
});
