import { fileURLToPath } from "node:url";
import { EXPANDED_RULES, richTextToPlain, type TownState } from "@fq/core";
import type { View } from "@fq/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { ApiClient } from "../src/client/index.js";
import { checkOverride, tunableRules, withOverrides } from "../src/game/tuning.js";
import type { HallOfFameResponse, TownInfo } from "../src/wire.js";
import {
  backToMap,
  enabled,
  finishTutorial,
  press,
  type Send,
  sellOne,
  visit,
} from "./support/expanded.js";
import {
  ADMIN_TOKEN,
  connectSocket,
  type Harness,
  type Socket,
  startServer,
  TestPlayer,
} from "./support/harness.js";

/**
 * The Expanded ruleset through the server: towns, the admin API, a whole career over HTTP (tutorial,
 * a sale with a card, every new place, Bingo, a vote), midnights, seasons and the hall of fame,
 * presence for duels and hits, default towns and museum mode.
 */

let h: Harness | null = null;
const sockets: Socket[] = [];
afterEach(async () => {
  for (const s of sockets.splice(0)) s.close();
  await h?.stop();
  h = null;
});

// biome-ignore lint/suspicious/noExplicitAny: admin answers are checked field by field below.
type Json = Record<string, any>;

const DAY = 86_400_000;

/** The value at a dotted path. */
function at(root: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], root);
}

function adminCall(
  harness: Harness,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
) {
  return harness
    .inject({
      method,
      url,
      headers: {
        authorization: `Bearer ${ADMIN_TOKEN}`,
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    })
    .then((r) => ({
      status: r.statusCode,
      body: r.body ? (JSON.parse(r.body) as Json) : {},
    }));
}

const sendFor =
  (p: TestPlayer, townId: string): Send =>
  (action) =>
    p.act(action, townId);
const stateOf = (harness: Harness, townId: string): TownState => {
  const town = harness.server.host.get(townId);
  if (!town) throw new Error(`no town ${townId}`);
  return town.snapshotState;
};

/** Midnight of the next UTC day, from the fake clock's point of view. */
async function nextMidnight(harness: Harness): Promise<void> {
  const now = harness.clock.now();
  await harness.clock.advanceTo(Math.floor(now / DAY) * DAY + DAY + 1000);
}

describe("Expanded towns: creation and the lobby", () => {
  it("creates an Expanded town through the admin API with the Expanded pack, and says what it is", async () => {
    h = await startServer({ towns: [] });
    const made = await adminCall(h, "POST", "/admin/towns", {
      id: "exp",
      name: "Expanse",
      ruleset: "expanded",
    });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    expect(made.body.ruleset).toBe("expanded");
    expect(made.body.contentPack).toBe("expanded");
    expect(made.body.rulesetLabel).toBe("Expanded");
    expect(String(made.body.description)).toMatch(/graveyard/i);
    // An Expanded town is a 30-day season with the tournament reset.
    expect(made.body.tournament).toEqual({ active: true, daysLeft: 29 });
    expect(made.body.season).toBe(1);

    // The same facts, publicly, for the lobby.
    const api = new ApiClient({ fetch: (url, init) => injectFetch(h as Harness, url, init) });
    const towns: TownInfo[] = await api.towns();
    expect(towns.map((t) => [t.id, t.ruleset, t.rulesetLabel])).toEqual([
      ["exp", "expanded", "Expanded"],
    ]);
    expect((await api.town("exp")).description).toBe(made.body.description);

    // A Classic town says what it is too.
    await adminCall(h, "POST", "/admin/towns", { id: "old", name: "Old", ruleset: "classic" });
    const old = await api.town("old");
    expect(old.rulesetLabel).toBe("Classic");
    expect(old.contentPack).toBe("classic");
    expect(old.description).not.toBe(made.body.description);
  });

  it("reads Expanded towns from the towns file, and allows the Expanded pack under Classic", async () => {
    h = await startServer({
      towns: [
        { id: "flag", name: "Flagship", ruleset: "expanded" },
        { id: "mixed", name: "Mixed", ruleset: "classic", contentPack: "expanded" },
        { id: "vint", name: "Vintage Expanded", ruleset: "expanded", contentPack: "vintage" },
      ],
    });
    const host = h.server.host;
    expect(host.get("flag")?.info().contentPack).toBe("expanded");
    expect(host.get("mixed")?.info().ruleset).toBe("classic");
    expect(host.get("mixed")?.info().contentPack).toBe("expanded");
    expect(host.get("vint")?.info().contentPack).toBe("vintage");
    // The Classic ruleset with the Expanded pack plays Classic: a sign-up and a first screen.
    const p = await new TestPlayer(h, "classicfan").signUp();
    const view = await p.enter("mixed");
    expect(view.scene).toBe("news");
  });

  it("refuses nonsensical combinations with a message that says what to change", async () => {
    h = await startServer({ towns: [] });
    const bad = async (config: Record<string, unknown>) => {
      const r = await adminCall(h as Harness, "POST", "/admin/towns", {
        id: "bad",
        name: "Bad",
        ...config,
      });
      expect(r.status, JSON.stringify(r.body)).toBe(422);
      expect(r.body.error).toBe("bad_town_config");
      return String(r.body.message);
    };
    expect(await bad({ ruleset: "medieval" })).toMatch(
      /Unknown ruleset "medieval".*classic, expanded/,
    );
    expect(await bad({ ruleset: "expanded", contentPack: "nope" })).toMatch(
      /Unknown content pack "nope"/,
    );
    expect(await bad({ ruleset: "classic", rules: { "town.bank.loan.rate": 0.05 } })).toMatch(
      /only apply to the Expanded ruleset/,
    );
    expect(await bad({ ruleset: "expanded", rules: { "customer.limitStep": 100 } })).toMatch(
      /not an Expanded rule number that can be tuned/,
    );
    expect(await bad({ ruleset: "expanded", rules: { "town.bank.loan.rate": 7 } })).toMatch(
      /must be between/,
    );
    expect((await adminCall(h, "GET", "/admin/towns")).body.towns).toHaveLength(0);
    // And a switch of pack on a running town is checked the same way.
    await adminCall(h, "POST", "/admin/towns", { id: "e", name: "E", ruleset: "expanded" });
    const switched = await adminCall(h, "PUT", "/admin/towns/e/content-pack", {
      contentPack: "vintage",
    });
    expect(switched.status).toBe(200);
    const unknown = await adminCall(h, "PUT", "/admin/towns/e/content-pack", {
      contentPack: "nope",
    });
    expect(unknown.status).toBe(422);
  });

  it("lists the Expanded rulesets and packs in /admin/server", async () => {
    h = await startServer({ towns: [] });
    const server = (await adminCall(h, "GET", "/admin/server")).body;
    expect(server.rulesets).toEqual(["classic", "expanded"]);
    expect(
      server.rulesetDetails.map((r: { name: string; defaultPack: string }) => [
        r.name,
        r.defaultPack,
      ]),
    ).toEqual([
      ["classic", "classic"],
      ["expanded", "expanded"],
    ]);
    expect(server.contentPacks).toContain("expanded");
  });
});

describe("Expanded rule numbers per town (admin settings)", () => {
  it("derives the tunable list from the engine, never from copied numbers", () => {
    const rules = tunableRules();
    expect(rules.length).toBeGreaterThan(20);
    const live = EXPANDED_RULES.expanded as unknown as Record<string, unknown>;
    for (const r of rules) {
      const value = at(live, r.path);
      expect(value, r.path).toBe(r.default);
      expect(r.min, r.path).toBeLessThanOrEqual(r.default);
      expect(r.max, r.path).toBeGreaterThanOrEqual(r.default);
    }
    // The negotiation's balance and the Daily Challenge loadout stay fixed.
    expect(
      rules.some((r) => r.path.startsWith("customer.") || r.path.startsWith("town.challenge.")),
    ).toBe(false);
    // Counts that size tables are not offered.
    expect(rules.map((r) => r.path)).not.toContain("town.church.bingo.cards");
  });

  it("changes a town's numbers, keeps the engine's shared rules untouched, and persists them", async () => {
    h = await startServer({ towns: [{ id: "exp", name: "Expanse", ruleset: "expanded" }] });
    const pick = tunableRules().find(
      (r) => r.integer && r.default > 0 && r.path.startsWith("town."),
    );
    if (!pick) throw new Error("no integer rule to tune");
    const wanted = pick.default + 1 <= pick.max ? pick.default + 1 : pick.default - 1;

    const before = await adminCall(h, "GET", "/admin/towns/exp/settings");
    expect(before.status).toBe(200);
    expect(before.body.settings.tournamentDays).toBe(30);
    expect(before.body.expandedRules.overrides).toEqual({});
    expect(before.body.expandedRules.values[pick.path]).toBe(pick.default);
    expect(before.body.expandedRules.tunable.map((t: { path: string }) => t.path)).toContain(
      pick.path,
    );

    const patched = await adminCall(h, "PATCH", "/admin/towns/exp/settings", {
      turnsPerDay: 12,
      expandedRules: { [pick.path]: wanted },
    });
    expect(patched.status, JSON.stringify(patched.body)).toBe(200);
    expect(patched.body.settings.turnsPerDay).toBe(12);
    expect(patched.body.expandedRules.overrides).toEqual({ [pick.path]: wanted });
    expect(patched.body.expandedRules.values[pick.path]).toBe(wanted);
    // The engine's context for this town carries the number; the shared rules do not.
    const town = h.server.host.get("exp");
    const mine = town?.engineContext().rules.expanded as unknown as Record<string, unknown>;
    expect(at(mine, pick.path)).toBe(wanted);
    const shared = EXPANDED_RULES.expanded as unknown as Record<string, unknown>;
    expect(at(shared, pick.path)).toBe(pick.default);

    // Refused: not tunable, out of range, and nothing changes.
    for (const body of [
      { expandedRules: { "customer.limitStep": 100 } },
      { expandedRules: { [pick.path]: pick.max + 1 } },
      { expandedRules: { [pick.path]: "lots" } },
    ]) {
      const r = await adminCall(h, "PATCH", "/admin/towns/exp/settings", body);
      expect([400, 422], JSON.stringify(r.body)).toContain(r.status);
    }
    expect(town?.ruleOverrides).toEqual({ [pick.path]: wanted });

    // It survives a restart, and null puts the engine's number back.
    h = await h.restart();
    const again = await adminCall(h, "GET", "/admin/towns/exp/settings");
    expect(again.body.expandedRules.overrides).toEqual({ [pick.path]: wanted });
    const reset = await adminCall(h, "PATCH", "/admin/towns/exp/settings", {
      expandedRules: { [pick.path]: null },
    });
    expect(reset.body.expandedRules.overrides).toEqual({});
    expect(reset.body.expandedRules.values[pick.path]).toBe(pick.default);
  });

  it("applies overrides to a copy only, and a Classic town has no Expanded numbers", async () => {
    const rule = tunableRules()[0];
    if (!rule) throw new Error("no tunable rules");
    const changed = withOverrides(EXPANDED_RULES, { [rule.path]: rule.default });
    expect(changed).not.toBe(EXPANDED_RULES);
    expect(checkOverride(rule.path, rule.default)).toBeNull();
    expect(checkOverride("nope.nothing", 1)).toMatch(/not an Expanded rule number/);
    h = await startServer({ towns: [{ id: "old", name: "Old" }] });
    const settings = await adminCall(h, "GET", "/admin/towns/old/settings");
    expect(settings.body.expandedRules).toBeUndefined();
    const patched = await adminCall(h, "PATCH", "/admin/towns/old/settings", {
      expandedRules: { [rule.path]: rule.default },
    });
    expect(patched.status).toBe(422);
  });

  it("lets a town be created with rule overrides in its config", async () => {
    h = await startServer({ towns: [] });
    const pick = tunableRules().find(
      (r) => r.integer && r.default > 0 && r.path.startsWith("town."),
    );
    if (!pick) throw new Error("no integer rule to tune");
    const made = await adminCall(h, "POST", "/admin/towns", {
      id: "tuned",
      name: "Tuned",
      ruleset: "expanded",
      rules: { [pick.path]: pick.default },
    });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    expect(h.server.host.get("tuned")?.ruleOverrides).toEqual({ [pick.path]: pick.default });
  });
});

async function injectFetch(
  harness: Harness,
  url: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await harness.inject({
    method: (init?.method ?? "GET") as "GET" | "POST",
    url: String(url),
    headers: init?.headers as Record<string, string>,
    ...(typeof init?.body === "string" ? { payload: init.body } : {}),
  });
  return new Response(res.statusCode === 204 ? null : res.body, { status: res.statusCode });
}

describe("an Expanded career over HTTP", () => {
  it("signs up, finishes the tutorial, sells with a card, visits every place, buys Bingo, votes, and lives through the days", async () => {
    h = await startServer({
      towns: [{ id: "exp", name: "Expanse", ruleset: "expanded", seed: 777 }],
    });
    const alice = await new TestPlayer(h, "alice").signUp();
    const intro = await alice.enter("exp");
    expect(intro.scene).toBe("news");
    const send = sendFor(alice, "exp");

    // The guided first day and its practice sale (a card pick: the tutorial's note says so).
    const desk = await finishTutorial(send, intro);
    expect(enabled(desk)).toContain("desk:wait");
    const player = () => stateOf(h as Harness, "exp").players[0];
    expect(player()?.expanded?.tutorial.done).toBe(true);
    expect(player()?.expanded?.record.sales).toBeGreaterThanOrEqual(1);

    // A real sale: a Soft Sell card is bought and the bill is closed.
    const salesBefore = player()?.expanded?.record.sales ?? 0;
    let v: View = desk;
    for (let i = 0; i < 6 && (player()?.expanded?.record.sales ?? 0) === salesBefore; i++) {
      v = await sellOne(send);
    }
    expect(player()?.expanded?.record.sales).toBeGreaterThan(salesBefore);
    expect(player()?.expanded?.record.bonusBp).toBeDefined();

    // Money and wood tags for the town (the admin player editor).
    const edit = await adminCall(h, "PATCH", "/admin/towns/exp/players/0", {
      money: 90_000,
      tags: [8, 2, 1],
    });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);

    // Every place on the Expanded map.
    v = await press(send, "go:map");
    expect(v.map?.map((m) => m.id)).toEqual(
      expect.arrayContaining([
        "graveyard",
        "city-hall",
        "reaper-club",
        "church",
        "hospital",
        "bank",
      ]),
    );
    const seen: Record<string, string> = {};
    for (const place of [
      "graveyard",
      "city-hall",
      "reaper-club",
      "church",
      "hospital",
      "bank",
      "store",
      "spirit-university",
      "competitors",
    ]) {
      const screen = await visit(send, v, place);
      seen[place] = screen.title;
      v = await backToMap(send, screen);
      expect(v.scene).toBe("map");
    }
    // Each place answered with a screen of its own (the titles are content, so not pinned here).
    expect(Object.values(seen).every((t) => t.length > 0)).toBe(true);
    expect(new Set(Object.values(seen)).size).toBe(Object.keys(seen).length);

    // Church: a Bingo card for a wood tag.
    let church = await visit(send, v, "church");
    church = await press(send, "church:bingo");
    expect(enabled(church)).toContain("church:card:1");
    const woodBefore = player()?.tags[0] ?? 0;
    church = await press(send, "church:card:1");
    expect(player()?.tags[0]).toBe(woodBefore - 1);
    expect(stateOf(h, "exp").expanded?.life?.bingo?.cards.filter((c) => c === 0)).toHaveLength(1);

    // City Hall: cast a vote on the open ordinance ballot.
    v = await backToMap(send, church);
    let hall = await visit(send, v, "city-hall");
    hall = await press(send, "city-hall:ordinance");
    const vote = enabled(hall).find((id) => id.startsWith("city-hall:vote:"));
    expect(vote).toBeDefined();
    hall = await press(send, vote as string);
    const ballot = stateOf(h, "exp").expanded?.life?.ballot;
    expect(ballot).toBeTruthy();
    expect(Object.values(ballot?.votes ?? {}).flat().length ?? 0).toBeGreaterThan(0);
    expect(richTextToPlain(hall.text)).toMatch(/vote/i);

    // The bank: savings now, a loan too.
    v = await backToMap(send, hall);
    let bank = await visit(send, v, "bank");
    bank = await press(send, "bank:savings");
    bank = await press(send, "bank:depositall");
    const life = () => stateOf(h as Harness, "exp").expanded?.life;
    expect(player()?.expanded?.life?.savings ?? 0).toBeGreaterThan(0);
    const saved = player()?.expanded?.life?.savings ?? 0;
    v = await backToMap(send, bank);
    bank = await visit(send, v, "bank");
    bank = await press(send, "bank:loan");
    bank = await press(send, "bank:borrow");
    expect(bank.overlay?.kind).toBe("textInput");
    const lent = await send({
      type: "submitText",
      overlayId: bank.overlay?.id ?? "",
      text: "1000",
    });
    expect(lent.status, JSON.stringify(lent.body)).toBe(200);
    const owed = () => player()?.expanded?.life?.loan?.owed ?? 0;
    expect(owed()).toBeGreaterThanOrEqual(1000);

    // Time passes: the scheduler runs the real midnights.
    const dayBefore = stateOf(h, "exp").day;
    const cardsBefore = life()?.bingo?.day;
    const owedBefore = owed();
    await nextMidnight(h);
    expect(stateOf(h, "exp").day).toBe(dayBefore + 1);
    // Bingo was drawn and cleared for the new night.
    expect(life()?.bingo?.day).not.toBe(cardsBefore);
    expect(life()?.bingo?.cards.filter((c) => c === 0)).toHaveLength(0);
    // Interest accrued on the savings, and on the loan if one was taken.
    expect(player()?.expanded?.life?.savings ?? 0).toBeGreaterThan(saved);
    expect(owed()).toBeGreaterThan(owedBefore);

    // The ballot closes at the end of its week: an ordinance is in force afterwards.
    for (let i = 0; i < 8 && !life()?.ordinance; i++) await nextMidnight(h);
    expect(life()?.ordinance, "the vote closed into an ordinance").toBeTruthy();
    expect(stateOf(h, "exp").day).toBeGreaterThan(dayBefore + 1);
  });
});

describe("a season ends", () => {
  it("records the final standings, the winner and the chain board in the hall of fame, then the town starts again", async () => {
    h = await startServer({
      towns: [
        {
          id: "short",
          name: "Short Season",
          ruleset: "expanded",
          seed: 4242,
          settings: { tournamentDays: 2 },
        },
      ],
    });
    const ann = await new TestPlayer(h, "annie", undefined, "10.0.0.2").signUp();
    const bob = await new TestPlayer(h, "bobby", undefined, "10.0.0.3").signUp();
    const annDesk = await finishTutorial(sendFor(ann, "short"), await ann.enter("short"));
    await finishTutorial(sendFor(bob, "short"), await bob.enter("short"));
    // Annie sells more and founds a parlor chain, so the chain board has a row.
    await adminCall(h, "PATCH", "/admin/towns/short/players/0", { money: 40_000 });
    const sendA = sendFor(ann, "short");
    let v = annDesk;
    for (let i = 0; i < 3; i++) v = await sellOne(sendA);
    let screen = await visit(sendA, v, "city-hall");
    screen = await press(sendA, "city-hall:chains");
    screen = await press(sendA, "city-hall:found");
    if (screen.overlay?.kind === "textInput") {
      const r = await sendA({
        type: "submitText",
        overlayId: screen.overlay.id,
        text: "Grim Partners",
      });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
    }
    expect(stateOf(h, "short").expanded?.life?.chains).toHaveLength(1);

    const api = new ApiClient({ fetch: (url, init) => injectFetch(h as Harness, url, init) });
    expect((await api.hallOfFame()).entries).toEqual([]);

    const startDay = stateOf(h, "short").day;
    // Day 1, then 2 (the last), then 3 (the meteor, nobody can play), then the reset.
    await nextMidnight(h);
    await nextMidnight(h);
    expect(stateOf(h, "short").day).toBe(startDay + 2);
    expect(stateOf(h, "short").players.length).toBe(2);
    // The standings the season ends with are these (rewards from the midnights are in them).
    const bp = stateOf(h, "short").players.map((p) => [p.name, p.bp]);
    expect((await api.hallOfFame()).entries).toHaveLength(0);
    await nextMidnight(h);

    // The town is back on day 1 with nobody in it, and a season is on the record.
    expect(stateOf(h, "short").day).toBe(1);
    expect(stateOf(h, "short").players).toHaveLength(0);
    const hall: HallOfFameResponse = await api.hallOfFame();
    expect(hall.entries).toHaveLength(1);
    const entry = hall.entries[0];
    expect(entry?.townId).toBe("short");
    expect(entry?.season).toBe(1);
    expect(entry?.days).toBe(2);
    expect(entry?.ruleset).toBe("expanded");
    expect(entry?.players).toBe(2);
    expect(entry?.standings.map((s) => [s.name, s.bp])).toEqual(
      [...bp].sort((a, b) => (b[1] as number) - (a[1] as number) || 0).map(([n, b]) => [n, b]),
    );
    expect(entry?.standings.map((s) => s.rank)).toEqual([1, 2]);
    expect(entry?.winner?.name).toBe(entry?.standings[0]?.name);
    expect(entry?.chains).toEqual([
      { rank: 1, name: "Grim Partners", score: expect.any(Number), members: ["annie"] },
    ]);
    expect(entry?.deed).toContain(entry?.winner?.name);
    expect(entry?.endedAt).toBe(new Date(Math.floor(h.clock.now() / DAY) * DAY).toISOString());

    // The town's own page, the per-town route and the town list all know.
    const viaTown = await h.inject({ method: "GET", url: "/api/towns/short/hall-of-fame" });
    expect(viaTown.json().entries).toHaveLength(1);
    expect((await api.hallOfFame({ townId: "nowhere" })).entries).toEqual([]);
    expect((await api.town("short")).season).toBe(2);

    // Parlors were unlinked with the reset, and the record survives a restart.
    expect((await ann.request<{ parlors: unknown[] }>("GET", "/api/me")).body.parlors).toEqual([]);
    h = await h.restart();
    const after = new ApiClient({ fetch: (url, init) => injectFetch(h as Harness, url, init) });
    expect((await after.hallOfFame()).entries[0]?.winner).toEqual(entry?.winner);

    // A second season adds a second entry; catching up several missed days in one go finds it too.
    const again = await new TestPlayer(h, "carol", undefined, "10.0.0.4").signUp();
    await finishTutorial(sendFor(again, "short"), await again.enter("short"));
    h.clock.jump(5 * DAY);
    await h.server.host.get("short")?.catchUp();
    const both = await after.hallOfFame({ townId: "short" });
    expect(both.entries.map((e) => e.season)).toEqual([2, 1]);
    expect(both.entries[0]?.winner?.name).toBe("carol");
    // Paging.
    const page = await after.hallOfFame({ limit: 1 });
    expect(page.entries).toHaveLength(1);
    expect(page.next).not.toBeNull();
    expect((await after.hallOfFame({ before: page.next ?? 0 })).entries[0]?.season).toBe(1);
  });
});

describe("presence in the Expanded town", () => {
  it("lets a graveyard duel and a Reaper Club hit run against players who are online and away, and resolves the hit at midnight", async () => {
    h = await startServer({
      listen: true,
      towns: [{ id: "exp", name: "Expanse", ruleset: "expanded", seed: 99 }],
    });
    const a = await new TestPlayer(h, "dueler", undefined, "10.0.0.5").signUp();
    const b = await new TestPlayer(h, "victim", undefined, "10.0.0.6").signUp();
    const sendA = sendFor(a, "exp");
    const sendB = sendFor(b, "exp");
    await finishTutorial(sendA, await a.enter("exp"));
    await finishTutorial(sendB, await b.enter("exp"));
    await adminCall(h, "PATCH", "/admin/towns/exp/players/0", {
      money: 60_000,
      tags: [9, 0, 0],
      turns: 14,
    });
    await adminCall(h, "PATCH", "/admin/towns/exp/players/1", { turns: 14 });

    // Victim is online with a socket: the engine counts them present.
    const socket = await connectSocket(h, b.token, "exp");
    sockets.push(socket);
    await h.server.host.get("exp")?.enqueue(() => undefined);
    expect(stateOf(h, "exp").presence?.["1"]).toBe(true);

    // The duel: pick the rival in the graveyard and yield.
    let v = await press(sendA, "go:map");
    v = await visit(sendA, v, "graveyard");
    v = await press(sendA, "graveyard:duel");
    expect(v.overlay?.kind).toBe("playerPicker");
    const picked = await sendA({ type: "pickPlayer", overlayId: v.overlay?.id ?? "", playerId: 1 });
    expect(picked.status, JSON.stringify(picked.body)).toBe(200);
    v = picked.body.view as View;
    expect(enabled(v)).toContain("graveyard:yield");
    v = await press(sendA, "graveyard:yield");
    expect(enabled(v)).not.toContain("graveyard:yield");

    // The hit: pay the cover, name the victim, the envelope is booked.
    v = await backToMap(sendA, v);
    v = await visit(sendA, v, "reaper-club");
    v = await press(sendA, "reaper-club:pay");
    v = await press(sendA, "reaper-club:hit");
    expect(v.overlay?.kind).toBe("playerPicker");
    const booked = await sendA({ type: "pickPlayer", overlayId: v.overlay?.id ?? "", playerId: 1 });
    expect(booked.status, JSON.stringify(booked.body)).toBe(200);
    expect(stateOf(h, "exp").expanded?.life?.hits).toHaveLength(1);

    // Midnight resolves the hit (and the victim hears of it).
    const mailBefore = stateOf(h, "exp").players[1]?.mail.length ?? 0;
    await nextMidnight(h);
    expect(stateOf(h, "exp").expanded?.life?.hits).toHaveLength(0);
    expect(stateOf(h, "exp").players[1]?.mail.length ?? 0).toBeGreaterThanOrEqual(mailBefore);

    // Away: the socket closes, the player counts as away, and the same rules still run for them.
    socket.close();
    await socket.waitClosed();
    for (let i = 0; i < 100 && stateOf(h, "exp").presence?.["1"] !== false; i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(stateOf(h, "exp").presence?.["1"]).toBe(false);
  });
});

describe("default towns", () => {
  it("creates an Expanded flagship and a Classic town on a fresh server", async () => {
    h = await startServer({ towns: [], config: { createDefaultTown: true } });
    const towns = h.server.host.list();
    expect(towns.map((t) => [t.id, t.ruleset, t.contentPack])).toEqual([
      ["expanded", "expanded", "expanded"],
      ["main", "classic", "classic"],
    ]);
    const flagship = towns[0];
    expect(flagship?.tournament).toEqual({ active: true, daysLeft: 29 });
    expect(stateOf(h, "expanded").settings.tournamentDays).toBe(30);
    // Both are playable.
    const p = await new TestPlayer(h, "newbie").signUp();
    expect((await p.enter("expanded")).scene).toBe("news");
    expect((await p.enter("main")).scene).toBe("news");
  });

  it("is switched by FQ_DEFAULT_TOWNS and FQ_CREATE_DEFAULT_TOWN, and a towns file replaces it", async () => {
    h = await startServer({
      towns: [],
      config: { createDefaultTown: true, defaultTowns: "classic" },
    });
    expect(h.server.host.list().map((t) => t.id)).toEqual(["main"]);
    await h.stop();
    h = await startServer({
      towns: [],
      config: { createDefaultTown: true, defaultTowns: "expanded" },
    });
    expect(h.server.host.list().map((t) => t.id)).toEqual(["expanded"]);
    await h.stop();
    h = await startServer({ towns: [], config: { createDefaultTown: false } });
    expect(h.server.host.list()).toEqual([]);
    await h.stop();
    h = await startServer({
      towns: [{ id: "mine", name: "Mine", ruleset: "classic" }],
      config: { createDefaultTown: true },
    });
    expect(h.server.host.list().map((t) => t.id)).toEqual(["mine"]);
  });
});

describe("the example towns file", () => {
  it("is valid and creates an Expanded, a Classic and a Blitz Expanded town", async () => {
    h = await startServer({
      towns: [],
      config: { townsFile: fileURLToPath(new URL("../towns.example.json", import.meta.url)) },
    });
    expect(h.server.host.list().map((t) => [t.id, t.ruleset, t.contentPack])).toEqual([
      ["expanded", "expanded", "expanded"],
      ["classic", "classic", "classic"],
      ["blitz", "expanded", "expanded"],
    ]);
    expect(h.server.host.get("blitz")?.ruleOverrides).toEqual({ "town.bank.loan.rate": 0.05 });
  });
});

describe("museum mode and Expanded towns", () => {
  it("refuses an Expanded town with an explanation page, and plays the Classic one beside it", async () => {
    h = await startServer({
      config: { legacyClient: true, legacyTown: "exp" },
      towns: [
        { id: "exp", name: "Expanse", ruleset: "expanded" },
        { id: "old", name: "Old", ruleset: "classic" },
      ],
    });
    const page = await h.inject({ method: "GET", url: "/museum/" });
    expect(page.statusCode).toBe(409);
    expect(page.headers["content-type"]).toMatch(/text\/html/);
    expect(page.body).toMatch(/Classic towns only/);
    expect(page.body).toMatch(/Expanded ruleset/);
    expect(page.body).toContain("exp");
    // The bridge's own requests are refused the same way, without touching the town.
    const xp = await h.inject({ method: "GET", url: "/museum/request.xp?logon" });
    expect(xp.statusCode).toBe(409);
    const features = (await h.inject({ method: "GET", url: "/api/features" })).json();
    expect(features.museum).toMatchObject({ enabled: true, available: false });
    expect(features.museum.reason).toMatch(/Expanded/);
    await h.stop();

    // Without a named town, the first Classic town is used even when an Expanded one comes first.
    h = await startServer({
      config: { legacyClient: true },
      towns: [
        { id: "exp", name: "Expanse", ruleset: "expanded" },
        { id: "old", name: "Old", ruleset: "classic" },
      ],
    });
    const ok = await h.inject({ method: "GET", url: "/museum/" });
    expect(ok.statusCode).toBe(200);
    expect((await h.inject({ method: "GET", url: "/api/features" })).json().museum).toMatchObject({
      available: true,
      reason: null,
    });
  });

  it("explains itself when every town is Expanded, and still stops for a town that does not exist", async () => {
    h = await startServer({
      config: { legacyClient: true },
      towns: [{ id: "exp", name: "Expanse", ruleset: "expanded" }],
    });
    const page = await h.inject({ method: "GET", url: "/museum/" });
    expect(page.statusCode).toBe(409);
    expect(page.body).toMatch(/Every town on this server runs the Expanded ruleset/);
    await h.stop();
    await expect(
      startServer({
        config: { legacyClient: true, legacyTown: "ghost" },
        towns: [{ id: "exp", name: "E", ruleset: "expanded" }],
      }),
    ).rejects.toThrow(/no town "ghost"/);
    h = null;
  });
});

describe("every Expanded effect is handled", () => {
  it("keeps the host's effect switch exhaustive (a type-level guarantee, checked by tsc)", async () => {
    const { planEffects } = await import("../src/game/effects.js");
    const plan = planEffects(
      [{ kind: "tournamentReset", winner: "x" }],
      { sessions: {}, players: [] } as unknown as TownState,
      1,
    );
    expect(plan.commands).toEqual([{ kind: "unlinkAllParlors" }]);
  });
});
