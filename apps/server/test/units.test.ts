import type { Effect, TownState } from "@fq/core";
import { describe, expect, it } from "vitest";
import { parseAddress, parseIpRule, ruleMatches } from "../src/auth/ip.js";
import { loadConfig } from "../src/config.js";
import { diffPushes, planEffects } from "../src/game/effects.js";
import { SerialQueue } from "../src/game/queue.js";

const matches = (rule: string, ip: string): boolean => {
  const r = parseIpRule(rule);
  const a = parseAddress(ip);
  if (!r || !a) throw new Error(`bad input ${rule} ${ip}`);
  return ruleMatches(r, a);
};

describe("IP ban rules", () => {
  it("matches whole octets, not substrings (the original's mistake)", () => {
    expect(matches("192.168.1", "192.168.1.200")).toBe(true);
    expect(matches("192.168.1.", "192.168.1.200")).toBe(true);
    expect(matches("192.168.1", "192.168.10.1")).toBe(false);
    expect(matches("192.168.1", "10.192.168.1")).toBe(false);
    expect(matches("1.1", "21.1.5.5")).toBe(false);
    expect(matches("10", "10.9.9.9")).toBe(true);
    expect(matches("10", "110.9.9.9")).toBe(false);
  });

  it("supports exact addresses, CIDR blocks and IPv6", () => {
    expect(matches("203.0.113.5", "203.0.113.5")).toBe(true);
    expect(matches("203.0.113.5", "203.0.113.6")).toBe(false);
    expect(matches("10.0.0.0/8", "10.200.1.1")).toBe(true);
    expect(matches("10.0.0.0/8", "11.0.0.1")).toBe(false);
    expect(matches("198.51.100.64/26", "198.51.100.127")).toBe(true);
    expect(matches("198.51.100.64/26", "198.51.100.128")).toBe(false);
    expect(matches("2001:db8::/32", "2001:db8:ffff::1")).toBe(true);
    expect(matches("2001:db8::/32", "2001:db9::1")).toBe(false);
    expect(matches("2001:db8", "2001:db8:1:2::3")).toBe(true);
    expect(matches("2001:db", "2001:db8::1")).toBe(false);
    // An IPv4 client seen through a dual-stack socket is still an IPv4 client.
    expect(matches("192.0.2", "::ffff:192.0.2.9")).toBe(true);
    expect(matches("192.0.2", "2001:db8::1")).toBe(false);
  });

  it("refuses rules that are not addresses", () => {
    for (const bad of ["", "abc", "256.1.1", "1.2.3.4.5", "10.0.0.0/33", "::/129", "1..2", "a/b"]) {
      expect(parseIpRule(bad), bad).toBeNull();
    }
  });
});

describe("the town queue", () => {
  it("runs operations one at a time, in order, and survives a failure", async () => {
    const q = new SerialQueue();
    const log: string[] = [];
    const slow = q.run(async () => {
      log.push("a start");
      await new Promise((r) => setTimeout(r, 20));
      log.push("a end");
      return 1;
    });
    const failing = q.run(() => {
      log.push("b");
      throw new Error("boom");
    });
    const last = q.run(() => {
      log.push("c");
      return 3;
    });
    expect(await slow).toBe(1);
    await expect(failing).rejects.toThrow("boom");
    expect(await last).toBe(3);
    expect(log).toEqual(["a start", "a end", "b", "c"]);
    expect(q.length).toBe(0);
  });
});

describe("configuration", () => {
  it("reads defaults and environment, and rejects nonsense loudly", () => {
    const c = loadConfig({
      FQ_PORT: "9000",
      FQ_GUEST_ENABLED: "false",
      FQ_ADMIN_TOKEN: "x".repeat(32),
    });
    expect(c).toMatchObject({
      port: 9000,
      guestEnabled: false,
      signupEnabled: true,
      host: "127.0.0.1",
    });
    expect(() => loadConfig({ FQ_PORT: "banana" })).toThrow(/FQ_PORT/);
    expect(() => loadConfig({ FQ_ADMIN_TOKEN: "short" })).toThrow(/FQ_ADMIN_TOKEN/);
    expect(() => loadConfig({ FQ_LOG_LEVEL: "loud" })).toThrow(/FQ_LOG_LEVEL/);
    expect(() => loadConfig({ FQ_SIGNUP_ENABLED: "maybe" })).toThrow(/FQ_SIGNUP_ENABLED/);
  });
});

const town = (over: Partial<TownState> = {}): TownState =>
  ({
    sessions: {},
    players: [],
    ...over,
  }) as unknown as TownState;

describe("effect dispatch", () => {
  it("maps every effect kind the engine has to host work", () => {
    const text = [{ text: "hello" }];
    const effects: Effect[] = [
      { kind: "log", text: "x" },
      { kind: "tv", text },
      { kind: "broadcast", text: "`4hi" },
      { kind: "chat", to: [2, 3], text },
      { kind: "playerCreated", playerId: 1 },
      { kind: "playerDeleted", playerId: 1, reason: "inactive" },
      { kind: "sessionEnded", playerId: 1, reason: "timeout" },
      { kind: "tournamentResetDue" },
      { kind: "tournamentReset", winner: "Skelly" },
    ];
    const after = town({
      sessions: {
        "1": { status: "play" },
        "2": { status: "chat" },
        "3": { status: "play" },
      } as never,
      players: [{ active: true }, { active: true }, { active: true }, { active: true }] as never,
    });
    const plan = planEffects(effects, after, 1000);
    expect(plan.audit.map((a) => a.kind)).toEqual([
      "effect:log",
      "effect:tv",
      "effect:broadcast",
      "effect:playerCreated",
      "effect:playerDeleted",
      "effect:sessionEnded",
      "effect:tournamentResetDue",
      "effect:tournamentReset",
    ]);
    // A broadcast goes to online players outside the cafe; the cafe gets its own chat effect.
    const broadcast = plan.pushes.find(
      (p) => p.message.type === "notice" && p.message.notice.kind === "broadcast",
    );
    expect(broadcast?.recipient).toEqual({ to: "players", playerIds: [1, 3] });
    // Cafe lines go to exactly the players the engine named.
    const chat = plan.pushes.find(
      (p) => p.message.type === "notice" && p.message.notice.kind === "chat",
    );
    expect(chat?.recipient).toEqual({ to: "players", playerIds: [2, 3] });
    // The TV effect is not delivered by itself (the engine sends the cafe a chat effect).
    expect(
      plan.pushes.some((p) => p.message.type === "notice" && p.message.notice.kind === "tv"),
    ).toBe(false);
    expect(plan.commands).toEqual(
      expect.arrayContaining([
        { kind: "unlinkParlor", playerId: 1 },
        { kind: "closePlayer", playerId: 1, reason: "deleted" },
        { kind: "clearPresence", playerId: 1 },
        { kind: "resetTown", reason: "tournament" },
        { kind: "unlinkAllParlors" },
      ]),
    );
  });

  it("reports a kick as a kick rather than the engine's time-out", () => {
    const plan = planEffects(
      [{ kind: "sessionEnded", playerId: 4, reason: "timeout" }],
      town(),
      5,
      {
        endReason: "kicked",
      },
    );
    // The lobby View goes first, then the notice saying why.
    expect(plan.pushes[0]?.message).toMatchObject({ type: "view", view: { scene: "lobby" } });
    expect(plan.pushes[1]?.message).toMatchObject({
      notice: { kind: "sessionEnded", reason: "kicked" },
    });
  });

  it("pushes a changed View and new mail to other players, and nothing to the actor", () => {
    const view = (title: string) => ({ scene: "desk", title, text: [], buttons: [] });
    const session = (title: string) => ({ status: "play", view: view(title) });
    const before = town({
      sessions: { "0": session("a"), "1": session("b"), "2": session("c") } as never,
      players: [{ mail: [] }, { mail: [] }, { mail: [] }] as never,
    });
    const after = town({
      sessions: { "0": session("a2"), "1": session("b2"), "2": session("c") } as never,
      players: [
        { mail: [] },
        {
          mail: [
            { type: "text", text: "a letter", importance: "high", from: 0, expireDay: null },
            { type: "buttons", buttons: [], importance: "high", from: 0, expireDay: null },
            {
              type: "simpleText",
              text: "bob logged on",
              importance: "normal",
              from: -1,
              expireDay: null,
            },
          ],
        },
        { mail: [] },
      ] as never,
    });
    const pushes = diffPushes(before, after, 0, 99);
    expect(pushes).toHaveLength(2);
    expect(pushes[0]).toMatchObject({ recipient: { playerId: 1 }, message: { type: "view" } });
    expect(pushes[1]).toMatchObject({
      recipient: { playerId: 1 },
      message: { type: "notice", notice: { kind: "mail", count: 1 } },
    });
  });
});
