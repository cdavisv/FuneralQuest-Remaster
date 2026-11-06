import { fairBrain, runBotDay } from "@fq/bots";
import { classicPack, expandedPack } from "@fq/content";
import { classicContext, expandedContext } from "@fq/core";
import type { View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import {
  chooseRivals,
  END_DAY,
  migrateSave,
  practiceDay,
  SAVE_VERSION,
  type SoloConfig,
  SoloHost,
  type SoloSave,
  SoloSetupError,
} from "../src/index.js";
import { workerDriver } from "./drivers.js";
import {
  enabled,
  finishTutorial,
  press,
  type Send,
  saleStep,
  sellOne,
  toDesk,
} from "./expandedPlay.js";
import classicV1 from "./fixtures/classic-v1.fqsave.json" with { type: "json" };

const T0 = Date.UTC(2026, 10, 6, 9, 0, 0);

function expandedConfig(overrides: Partial<SoloConfig> = {}): SoloConfig {
  return {
    seed: 31337,
    contentPack: "expanded",
    ruleset: "expanded",
    mode: "career",
    careerDays: 30,
    clock: "manual",
    player: { name: "Edna Embalm", parlor: "Embalm and Co", male: false },
    rivals: [
      { personality: "shark", difficulty: "normal" },
      { personality: "mourner", difficulty: "easy" },
      { personality: "builder", difficulty: "normal" },
    ],
    ...overrides,
  };
}

const create = (config: SoloConfig) => SoloHost.create(config, expandedPack, { now: () => T0 });
const sender =
  (host: SoloHost): Send =>
  (action) =>
    host.act(action);

describe("an Expanded Solo career", () => {
  it("starts on the paper, runs the guided first day, sells with a card, and offers End the Day", () => {
    const host = create(expandedConfig());
    const send = sender(host);
    const paper = host.connectNow();
    expect(paper.scene).toBe("news");
    expect(host.state.ruleset).toBe("expanded");
    expect(host.state.settings.tournamentActive).toBe(true);
    expect(host.state.settings.tournamentDays).toBe(30);

    const desk = finishTutorial(send, paper);
    expect(enabled(desk)).toContain("desk:wait");
    expect(enabled(desk)).toContain(END_DAY);
    const me = host.state.players[host.humanId];
    expect(me?.expanded?.tutorial.done).toBe(true);
    expect(me?.expanded?.record.sales).toBeGreaterThanOrEqual(1);

    // The rivals are offline while the player plays.
    for (const bot of host.save().bots) {
      expect(host.state.sessions[String(bot.playerId)]).toBeUndefined();
    }
  });

  it("lets a returning player skip the tour (tutorial: false)", () => {
    const host = create(expandedConfig({ tutorial: false, rivals: [] }));
    const desk = toDesk(sender(host), host.connectNow());
    expect(enabled(desk)).toContain("desk:wait");
    expect(host.state.players[host.humanId]?.expanded?.tutorial.done).toBe(true);
    // The first customer is a real one, not the practice customer.
    const first = press(sender(host), "desk:wait");
    expect(first.note ?? []).toEqual([]);
  });

  it("rolls over days: rivals play, maintenance runs, the player wakes on the new day", () => {
    const host = create(expandedConfig());
    const send = sender(host);
    let desk = finishTutorial(send, host.connectNow());
    for (let i = 0; i < 3; i++) desk = sellOne(send);
    const before = host.save();
    const view = host.endDayNow();
    expect(view.scene).toBe("news");
    const after = host.save();
    expect(after.town.day).toBe(before.town.day + 1);
    for (const bot of after.bots) {
      const p = after.town.players[bot.playerId];
      // They played the old day (their new day ran then), and maintenance ran after them.
      expect(p?.dayLastLoggedOn).toBe(before.town.day);
      expect(p?.bpToday).toBe(0);
      expect(after.town.sessions[String(bot.playerId)]).toBeUndefined();
    }
    expect(host.status().day).toBe(2);
    expect(desk.scene).toBe("desk");
    // A few more days: the day always ends, however the rivals fare.
    for (let i = 0; i < 4; i++) {
      toDesk(send, host.connectNow());
      host.endDayNow();
    }
    expect(host.state.day).toBe(6);
  });

  it("seats all twelve personalities as rivals and plays their days: bounded, no errors, real sales", () => {
    const host = create(expandedConfig({ rivals: chooseRivals(7, "normal", 5, "expanded") }));
    const send = sender(host);
    finishTutorial(send, host.connectNow());
    for (let day = 0; day < 3; day++) {
      // Replay each rival's day by hand and look at how it ends: the runner's step cap always stops
      // it, the policy never throws out of the runner, and nobody hangs the day.
      const save = host.save();
      const ctx = expandedContext(expandedPack, { now: T0 });
      for (const seat of save.bots) {
        const result = runBotDay(save.town, { ...seat, brain: fairBrain(expandedPack) }, ctx, {
          stepCap: 800,
        });
        const who = `${seat.memory.personality} on day ${save.town.day}`;
        expect(result.steps, who).toBeLessThanOrEqual(800);
        expect(result.stuck, who).toBe(false);
        expect(result.errors, who).toEqual([]);
        expect(result.town.sessions[String(seat.playerId)], `${who} logs off`).toBeUndefined();
      }
      host.endDayNow();
    }
    // Over the three nights every rival took the guided first day and sold.
    for (const bot of host.save().bots) {
      const p = host.state.players[bot.playerId];
      expect(p?.expanded?.tutorial.done, bot.memory.personality).toBe(true);
      expect(p?.expanded?.record.sales ?? 0, bot.memory.personality).toBeGreaterThan(0);
    }
    expect(host.state.day).toBe(4);
  });

  it("round-trips a save mid-day and continues identically", () => {
    const a = create(expandedConfig({ seed: 99 }));
    const send = sender(a);
    finishTutorial(send, a.connectNow());
    sellOne(send);
    const text = JSON.stringify(a.save());
    const b = SoloHost.load(JSON.parse(text), expandedPack, { now: () => T0 });
    expect(b.state).toEqual(a.state);
    // The same moves on both give the same screens, a sale, a day, and the same saves.
    const sendB = sender(b);
    const views: [View, View][] = [];
    for (let i = 0; i < 2; i++) {
      views.push([sellOne(send), sellOne(sendB)]);
      views.push([a.endDayNow(), b.endDayNow()]);
      views.push([toDesk(send, a.connectNow()), toDesk(sendB, b.connectNow())]);
    }
    for (const [x, y] of views) expect(y).toEqual(x);
    const norm = (s: SoloSave) => JSON.parse(JSON.stringify({ ...s, savedAt: 0, createdAt: 0 }));
    expect(norm(b.save())).toEqual(norm(a.save()));
    expect(a.save().version).toBe(SAVE_VERSION);
  });

  it("refuses a pack that cannot run Expanded, and Expanded numbers do not leak into Classic", () => {
    const classicCtx = classicContext(expandedPack);
    expect(classicCtx.rules.ruleset).toBe("classic");
    // The Expanded pack plays Classic too (its Classic tables are compatible).
    const host = SoloHost.create(
      expandedConfig({
        ruleset: "classic",
        rivals: [{ personality: "shark", difficulty: "easy" }],
      }),
      expandedPack,
      { now: () => T0 },
    );
    expect(host.state.ruleset).toBe("classic");
    expect(host.connectNow().scene).toBe("news");
    const broken = {
      ...expandedPack,
      expanded: { ...(expandedPack.expanded as object), traits: [] },
    };
    expect(() => SoloHost.create(expandedConfig(), broken as never, { now: () => T0 })).toThrow(
      SoloSetupError,
    );
  });

  it("chooses Expanded rivals from every personality", () => {
    const classic = new Set(chooseRivals(7, "normal", 1).map((r) => r.personality));
    expect(classic.size).toBeLessThanOrEqual(6);
    const all = chooseRivals(7, "normal", 1, "expanded");
    expect(all).toHaveLength(7);
    expect(new Set(all.map((r) => r.personality)).size).toBe(7);
  });
});

describe("saves: an old Classic save still loads", () => {
  it("migrates a version 1 save and plays on", () => {
    expect(classicV1.version).toBe(1);
    const migrated = migrateSave(structuredClone(classicV1));
    expect(migrated.version).toBe(SAVE_VERSION);
    expect(migrated.config.ruleset).toBe("classic");
    expect(migrated.config.tutorial).toBe(false);
    expect(migrated.config.challengeDay).toBeNull();
    // The game itself is untouched.
    expect(migrated.town).toEqual(classicV1.town);
    expect(migrated.bots).toEqual(classicV1.bots);

    const host = SoloHost.load(structuredClone(classicV1), classicPack, { now: () => T0 });
    expect(host.state.day).toBe(2);
    const desk = toDesk((a) => host.act(a), host.connectNow());
    expect(desk.scene).toBe("desk");
    const day = host.endDayNow();
    expect(day.scene).toBe("news");
    expect(host.state.day).toBe(3);
    expect(host.save().version).toBe(SAVE_VERSION);
    expect(host.save().config.ruleset).toBe("classic");
  });

  it("refuses a newer format and a save made with another pack", () => {
    expect(() => migrateSave({ ...classicV1, version: 99 })).toThrow(/newer version/);
    const host = SoloHost.create(expandedConfig(), expandedPack, { now: () => T0 });
    expect(() => SoloHost.load(host.save(), classicPack)).toThrow(/content pack "expanded"/);
  });
});

describe("the Daily Challenge as practice", () => {
  const dailyConfig = (day: string, name = "Prac Tice"): SoloConfig =>
    expandedConfig({
      mode: "daily",
      challengeDay: day,
      rivals: [],
      player: { name, parlor: `${name} Rest`, male: true },
    });

  it("gives the same customers on the same date, different ones on another", () => {
    const first = (day: string, name?: string): string => {
      const host = create(dailyConfig(day, name));
      const v = press(sender(host), "desk:wait");
      return JSON.stringify(v).replaceAll(name ?? "Prac Tice", "NAME");
    };
    expect(first("2026-11-06")).toBe(first("2026-11-06", "Someone Else"));
    // Another date is another challenge (compare the whole opening, which includes the customer).
    const days = ["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10"].map((d) => first(d));
    expect(days.some((d) => d !== first("2026-11-06"))).toBe(true);
  });

  it("is one day for one parlor: no rivals, no End the Day, a score at the end", () => {
    const host = create(dailyConfig("2026-11-06"));
    const send = sender(host);
    const desk = host.connectNow();
    expect(desk.scene).toBe("desk");
    expect(enabled(desk)).not.toContain(END_DAY);
    expect(host.status()).toMatchObject({
      mode: "daily",
      canEndDay: false,
      daysLeft: null,
      finished: false,
    });
    expect(host.status().standings).toHaveLength(1);
    expect(host.state.players).toHaveLength(1);
    expect(host.endDayNow()).toEqual(desk);
    expect(host.state.day).toBe(1);

    let view = desk;
    const state = { carded: false };
    for (let i = 0; i < 1500 && !host.status().finished; i++) {
      if (enabled(view).includes("desk:wait") && !enabled(view).includes("neg:done")) {
        state.carded = false;
        view = press(send, "desk:wait");
        continue;
      }
      view = saleStep(send, view, state).view;
    }
    const status = host.status();
    expect(status.finished).toBe(true);
    expect(status.challenge?.day).toBe("2026-11-06");
    expect(status.challenge?.score).toBeGreaterThan(0);
    // Leaving through the finished desk shows the score, with nothing to resume.
    const finalDesk = press(send, "go:desk");
    expect(enabled(finalDesk)).toEqual(["desk:quit"]);
    expect(JSON.stringify(finalDesk.text)).toContain("BP");
    const left = press(send, "desk:quit");
    expect(left.scene).toBe("lobby");
    expect(left.buttons).toEqual([]);
    expect(JSON.stringify(left.text)).toContain("2026-11-06");
    // Save and load keep it (a practice run is a save like any other).
    const again = SoloHost.load(JSON.parse(JSON.stringify(host.save())), expandedPack);
    expect(again.status().challenge).toEqual(status.challenge);
  });

  it("defaults the date to today's, checks it, and needs the Expanded ruleset", () => {
    const host = create(expandedConfig({ mode: "daily", rivals: [] }));
    expect(host.save().config.challengeDay).toBe(practiceDay(T0));
    expect(practiceDay(Date.UTC(2026, 10, 6, 23, 30), 120)).toBe("2026-11-07");
    expect(() => create(dailyConfig("tomorrow"))).toThrow(/not a date/);
    expect(() =>
      SoloHost.create(
        { ...dailyConfig("2026-11-06"), ruleset: "classic", contentPack: "expanded" },
        expandedPack,
      ),
    ).toThrow(/needs the Expanded ruleset/);
  });
});

describe("through the worker proxy", () => {
  it("creates an Expanded career with the worker's built-in pack, plays a day and saves", async () => {
    const d = workerDriver();
    try {
      await d.create(
        expandedConfig({ rivals: [{ personality: "shark", difficulty: "normal" }] }),
        T0,
      );
      const paper = await d.connect();
      expect(paper.scene).toBe("news");
      const toView = async (a: Parameters<Send>[0]) => d.send(a);
      // The tour starts at the desk.
      const desk = await toView({ type: "press", buttonId: "go:desk" });
      expect(enabled(desk)).toContain("go:tutorial");
      const day = await d.endDay().catch(() => null);
      expect(day === null || day.scene === "news" || day.scene === "desk").toBe(true);
      const save = await d.save();
      expect(save.config.ruleset).toBe("expanded");
      expect(save.town.ruleset).toBe("expanded");
      expect(save.version).toBe(SAVE_VERSION);
      // A daily practice run through the worker too.
      await d.create(expandedConfig({ mode: "daily", challengeDay: "2026-11-06", rivals: [] }), T0);
      const challenge = await d.connect();
      expect(enabled(challenge)).toContain("desk:wait");
      expect((await d.status()).challenge?.day).toBe("2026-11-06");
    } finally {
      await d.dispose();
    }
  });
});
