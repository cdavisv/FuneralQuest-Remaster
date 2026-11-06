import type { Action, View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import {
  CLASSIC_RULES,
  type ClassicRules,
  Custom,
  createPlayer,
  createTown,
  type Effect,
  type EngineContext,
  enterGame,
  isPresent,
  leaveGame,
  originalClassicRules,
  runDailyMaintenance,
  setPresence,
  step,
  type TownState,
} from "../src/index.js";
import { context, PLAYER_NAMES, policyRng } from "./support/harness.js";

/**
 * Several players over several days, visiting, stealing, fighting, chatting,
 * writing letters and posting announcements with random choices, checking
 * invariants after every action. The policy stays inside the places this
 * port owns (the parlors row, the cafe, the desk, mail, paper, rankings and
 * the negotiation), so a failure points here.
 */

const TEXTS = [
  "",
  "x",
  "Hello neighbour",
  "shit happens",
  "See [www.example.com] and [javascript:alert(1)]",
  "`4red?",
  "a|b|c",
  "o",
  "i",
  "s",
  "Digby",
  "Morticia",
  "zzz",
];
const CHATS = [
  "hi there",
  "/me waves",
  "/yell boo",
  "/who",
  "/info",
  "/all",
  "/tv off",
  "/tv on",
  "/give o wood",
  "/give i gold",
  "/give s silver",
  "/?",
  "/nonsense",
  "line one|line two",
];
const ALLOWED_SCOPES = new Set([
  "desk",
  "neg",
  "risk",
  "script",
  "news",
  "rankings",
  "competitors",
  "battle",
  "cafe",
  "mailbox",
  "hospital",
]);
const ALLOWED_GO = new Set(["desk", "map", "news", "rankings", "mailbox", "competitors"]);
const MY_PLACES = ["funeral-home", "competitors", "cafe"];

function allowedButton(id: string): boolean {
  const [scope, rest = ""] = id.split(":");
  if (scope === "go") return ALLOWED_GO.has(rest.split(":")[0] ?? "");
  if (id === "desk:quit") return false;
  return ALLOWED_SCOPES.has(scope ?? "");
}

/** Every action the policy may take from a view. */
function choices(view: View, rand: () => number): Action[] {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)] as T;
  const o = view.overlay;
  if (o) {
    switch (o.kind) {
      case "message":
        return [{ type: "dismiss", overlayId: o.id }];
      case "confirm":
        return [
          { type: "confirm", overlayId: o.id, accepted: true },
          { type: "confirm", overlayId: o.id, accepted: false },
        ];
      case "textInput": {
        const text = rand() < 0.1 ? null : (o.initial ?? "") + pick(TEXTS);
        return [{ type: "submitText", overlayId: o.id, text: text?.slice(0, o.maxLength) ?? null }];
      }
      case "playerPicker":
        return [{ type: "pickPlayer", overlayId: o.id, playerId: pick(o.players)?.id ?? null }];
    }
  }
  const out: Action[] = view.buttons
    .filter((b) => b.enabled !== false && allowedButton(b.id))
    .map((b) => ({ type: "press", buttonId: b.id }));
  for (const place of view.map ?? []) {
    if (MY_PLACES.includes(place.id)) out.push({ type: "visit", placeId: place.id });
  }
  if (view.scene === "cafe")
    for (let i = 0; i < 3; i++) out.push({ type: "chat", text: pick(CHATS) });
  return out;
}

/** Visits and fights are the point: weight them. */
function weight(a: Action): number {
  if (a.type === "visit") return a.placeId === "funeral-home" ? 1 : 4;
  if (a.type !== "press") return 1;
  if (a.buttonId.startsWith("competitors:") || a.buttonId.startsWith("battle:")) return 6;
  if (a.buttonId === "go:map") return 4;
  if (a.buttonId === "go:mailbox" || a.buttonId === "news:announce") return 2;
  return 1;
}

function weighted(xs: Action[], rand: () => number): Action | undefined {
  const total = xs.reduce((n, a) => n + weight(a), 0);
  let r = rand() * total;
  for (const a of xs) {
    r -= weight(a);
    if (r < 0) return a;
  }
  return xs.at(-1);
}

function checkPlayers(town: TownState, rules: ClassicRules): void {
  for (const p of town.players) {
    const where = `${p.name} on day ${town.day}`;
    expect(p.bp, where).toBeGreaterThanOrEqual(0);
    expect(p.bpToday, where).toBeGreaterThanOrEqual(0);
    expect(p.turns, where).toBeGreaterThanOrEqual(0);
    expect(p.hp, where).toBeGreaterThanOrEqual(0);
    expect(p.hp, where).toBeLessThanOrEqual(p.hpMax);
    expect(p.playerFights, where).toBeGreaterThanOrEqual(0);
    expect(p.luck, where).toBeGreaterThanOrEqual(rules.luckMin);
    expect(p.luck, where).toBeLessThanOrEqual(rules.luckMax);
    for (const n of p.tags) expect(n, where).toBeGreaterThanOrEqual(0);
    expect(p.custom[Custom.Lockpick] ?? 0, where).toBeGreaterThanOrEqual(0);
    expect(p.custom[Custom.PadlockStrength] ?? 0, where).toBeGreaterThanOrEqual(0);
    expect(p.tagsReceivedToday, where).toBeLessThanOrEqual(town.settings.tagsReceivablePerDay);
  }
}

/** Every effect names a real player; chat goes only to players in the cafe, never to the actor. */
function checkEffects(
  effects: Effect[],
  before: TownState,
  after: TownState,
  actor: number | null,
): void {
  for (const e of effects) {
    switch (e.kind) {
      case "chat":
        expect(e.to.length).toBeGreaterThan(0);
        for (const id of e.to) {
          expect(after.players[id]?.active, JSON.stringify(e)).toBe(true);
          if (actor !== null) {
            expect(id, JSON.stringify(e)).not.toBe(actor);
            expect(after.sessions[String(id)]?.status ?? before.sessions[String(id)]?.status).toBe(
              "chat",
            );
          }
        }
        break;
      case "sessionEnded":
      case "playerCreated":
      case "playerDeleted":
        expect(before.players[e.playerId] ?? after.players[e.playerId]).toBeDefined();
        break;
      default:
        break;
    }
  }
}

function simulate(
  seed: number,
  rules: ClassicRules,
  tournament: boolean,
): { battles: number; steals: number; chats: number; letters: number; announcements: number } {
  const ctx: EngineContext = context(rules, 1_000_000 + seed);
  const rand = policyRng(seed);
  let town = createPlayersTown(seed, ctx, tournament);
  const stats = { battles: 0, steals: 0, chats: 0, letters: 0, announcements: 0 };
  for (let day = 0; day < 4; day++) {
    for (let tick = 0; tick < 260; tick++) {
      const id = Math.floor(rand() * town.players.length);
      const p = town.players[id];
      if (!p?.active) continue;
      const session = town.sessions[String(id)];
      if (!session) {
        if (rand() < 0.4) {
          const r = enterGame(town, id, ctx);
          expect(r.rejected).toBeUndefined();
          checkEffects(r.effects, town, r.town, null);
          town = r.town;
        }
        continue;
      }
      if (rand() < 0.02) {
        const r = leaveGame(town, id, ctx);
        checkEffects(r.effects, town, r.town, null);
        town = r.town;
        continue;
      }
      if (rand() < 0.02) town = setPresence(town, id, rand() < 0.5);
      const view = session.view;
      if (!view) continue;
      const options = choices(view, rand);
      const action = weighted(options, rand);
      if (!action) {
        town = step(town, id, { type: "exit" }, ctx).town;
        continue;
      }
      // Something not offered is refused and changes nothing.
      const bogus = step(
        town,
        id,
        { type: "press", buttonId: "competitors:steal-everything" },
        ctx,
      );
      expect(bogus.rejected).toBeDefined();
      expect(bogus.town).toBe(town);

      const before = town;
      const r = step(town, id, action, ctx);
      expect(
        r.rejected,
        `${JSON.stringify(action)} on ${JSON.stringify(view.buttons)}`,
      ).toBeUndefined();
      checkEffects(r.effects, before, r.town, id);
      // Nobody is attacked or robbed while online or under police protection.
      const target = before.sessions[String(id)]?.hisId ?? -1;
      const startedBattle = r.view.battle !== undefined && view.battle === undefined;
      const stole =
        action.type === "press" &&
        action.buttonId === "competitors:steal" &&
        r.view.text.some((s) => s.text.includes("startled by a noise"));
      if (startedBattle || stole) {
        expect(target).toBeGreaterThanOrEqual(0);
        // The original checked only at the door (fixes.visitTargetRecheck), so a rival
        // who logged on meanwhile could still be hit; the door check itself always holds.
        if (target !== id && rules.fixes.visitTargetRecheck) {
          expect(isPresent(before, target), `target ${target} online`).toBe(false);
          expect(before.players[target]?.policeProtected).toBe(false);
        }
      }
      if (startedBattle) stats.battles++;
      if (stole) stats.steals++;
      if (action.type === "chat") stats.chats++;
      if (
        action.type === "submitText" &&
        action.overlayId === "mailbox:compose" &&
        action.text !== null
      )
        stats.letters++;
      if (
        action.type === "submitText" &&
        action.overlayId === "news:announcement" &&
        action.text !== null
      )
        stats.announcements++;
      town = r.town;
      checkPlayers(town, rules);
    }
    const night = runDailyMaintenance(town, ctx);
    checkEffects(night.effects, town, night.town, null);
    town = night.town;
    checkPlayers(town, rules);
    if (town.players.length === 0) town = addPlayers(town, ctx, 5);
    expect(JSON.parse(JSON.stringify(town))).toEqual(town);
  }
  return stats;
}

function addPlayers(town: TownState, ctx: EngineContext, count: number): TownState {
  let t = town;
  for (let i = 0; i < count; i++) {
    const name = PLAYER_NAMES[i] ?? `Player ${i}`;
    const r = createPlayer(
      t,
      {
        logon: `sim${i}`,
        name,
        parlor: `${name} Rest`,
        password: "pw",
        passwordVerify: "pw",
        male: i % 2 === 0,
        email: `s${i}@example.com`,
      },
      ctx,
    );
    if (!r.ok) throw new Error("createPlayer failed");
    t = r.town;
  }
  return t;
}

function createPlayersTown(seed: number, ctx: EngineContext, tournament: boolean): TownState {
  let town = createTown(
    {
      seed,
      settings: tournament ? { tournamentActive: true, tournamentDays: 2 } : {},
    },
    ctx,
  ).town;
  town = addPlayers(town, ctx, 5);
  const rand = policyRng(seed ^ 0x5eed);
  const t = structuredClone(town);
  for (const p of t.players) {
    p.strength = 1 + Math.floor(rand() * 8);
    p.hpMax = 5 + Math.floor(rand() * 20);
    p.hp = p.hpMax;
    p.plots = Math.floor(rand() * 5);
    p.tags = [Math.floor(rand() * 6), Math.floor(rand() * 4), Math.floor(rand() * 3)];
    p.bp = Math.floor(rand() * 500);
    if (rand() < 0.4) {
      p.custom[Custom.Padlock] = 1;
      p.custom[Custom.PadlockStrength] = 10 + Math.floor(rand() * 30);
    }
    if (rand() < 0.3) p.custom[Custom.Safe] = 1;
    p.custom[Custom.Lockpick] = Math.floor(rand() * 4);
  }
  return t;
}

describe("a multi-player town over several days, random choices across seeds", () => {
  it("keeps every invariant with the Classic rules, and the social systems all get used", () => {
    const total = { battles: 0, steals: 0, chats: 0, letters: 0, announcements: 0 };
    for (let seed = 1; seed <= 10; seed++) {
      const s = simulate(seed * 7717, CLASSIC_RULES, seed % 3 === 0);
      for (const k of Object.keys(total) as (keyof typeof total)[]) total[k] += s[k];
    }
    expect(total.battles).toBeGreaterThan(5);
    expect(total.steals).toBeGreaterThan(2);
    expect(total.chats).toBeGreaterThan(20);
    expect(total.letters).toBeGreaterThan(5);
    expect(total.announcements).toBeGreaterThan(2);
  });

  it("keeps the invariants with every fix off (the original's rules)", () => {
    for (let seed = 1; seed <= 3; seed++)
      simulate(seed * 104729, originalClassicRules(), seed === 2);
  });

  it("is deterministic for a seed", () => {
    expect(simulate(99, CLASSIC_RULES, true)).toEqual(simulate(99, CLASSIC_RULES, true));
  });
});
