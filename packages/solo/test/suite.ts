import { BotRandom, createMemory, createPolicy, safeAction } from "@fq/bots";
import type { Action, View } from "@fq/protocol";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { END_DAY, RESUME, type SoloConfig, type SoloSave } from "../src/index.js";
import type { Driver } from "./drivers.js";

export const T0 = Date.UTC(2026, 10, 5, 9, 0, 0);
const DAY = 86_400_000;

export function config(overrides: Partial<SoloConfig> = {}): SoloConfig {
  return {
    seed: 4242,
    contentPack: "classic",
    ruleset: "classic",
    mode: "endless",
    clock: "manual",
    player: { name: "Edna Embalm", parlor: "Embalm and Co", male: false },
    rivals: [
      { personality: "saboteur", difficulty: "hard" },
      { personality: "saboteur", difficulty: "normal" },
      { personality: "shark", difficulty: "normal" },
      { personality: "mourner", difficulty: "easy" },
    ],
    ...overrides,
  };
}

const ids = (view: View) => view.buttons.map((b) => b.id);

/** From wherever the player is to the desk, answering letters along the way. */
async function toDesk(d: Driver, start: View): Promise<View> {
  let view = start;
  for (let i = 0; i < 40; i++) {
    if (!view.overlay && ids(view).includes("desk:wait")) return view;
    const action: Action =
      !view.overlay && ids(view).includes("go:desk")
        ? { type: "press", buttonId: "go:desk" }
        : safeAction(view);
    view = await d.send(action);
  }
  throw new Error(`never reached the desk: ${view.title}`);
}

/** Plays the player with the bots' own policy (a scholar) for `n` actions, recording them. */
function humanPlayer() {
  const memory = createMemory({
    playerId: 0,
    name: "Edna Embalm",
    parlor: "Embalm and Co",
    personality: "scholar",
    difficulty: "hard",
  });
  const policy = createPolicy();
  const rng = new BotRandom(77);
  return (view: View): Action => policy({ view, memory, rng });
}

/** The parts of a save that must match between two runs (timestamps aside). */
function gameOf(save: SoloSave) {
  const { savedAt: _s, createdAt: _c, ...rest } = save;
  return JSON.parse(
    JSON.stringify(rest, (k, v) =>
      k === "lastLogon" || k === "lastPacket" || k === "loggedOnAt" ? 0 : v,
    ),
  );
}

export function hostSuite(name: string, make: () => Driver): void {
  let d: Driver;
  beforeEach(() => {
    d = make();
  });
  afterEach(async () => {
    await d.dispose();
  });

  describe(`Solo host via ${name}`, () => {
    it("starts on the paper, offers End the Day at the desk, and rivals are offline", async () => {
      await d.create(config(), T0);
      const paper = await d.connect();
      expect(paper.scene).toBe("news");
      const desk = await toDesk(d, paper);
      expect(ids(desk)).toContain(END_DAY);
      const status = await d.status();
      expect(status.day).toBe(1);
      expect(status.standings).toHaveLength(5);
      const save = await d.save();
      for (const bot of save.bots) expect(save.town.sessions[String(bot.playerId)]).toBeUndefined();
    });

    it("ending the day runs every rival's day, then maintenance, then wakes the player", async () => {
      await d.create(config(), T0);
      await toDesk(d, await d.connect());
      const before = await d.save();
      const view = await d.endDay();
      expect(view.scene).toBe("news");
      const after = await d.save();
      expect(after.town.day).toBe(before.town.day + 1);
      for (const bot of after.bots) {
        const p = after.town.players[bot.playerId];
        // They played on the old day (their new day ran then) ...
        expect(p?.dayLastLoggedOn).toBe(before.town.day);
        expect(p?.bp).toBeGreaterThan(0);
        // ... and maintenance ran after them: today's BP reset, and yesterday's top seller is a rival.
        expect(p?.bpToday).toBe(0);
        expect(after.town.sessions[String(bot.playerId)]).toBeUndefined();
      }
      expect(after.bots.map((b) => after.town.players[b.playerId]?.name)).toContain(
        after.town.topYesterday?.name,
      );
      expect(after.town.sessions[String(after.humanId)]).toBeDefined();
      expect(d.notices).toContainEqual({ kind: "newDay", day: 2 });
    });

    it("round-trips a save mid-day and mid-negotiation and continues identically", async () => {
      await d.create(config({ seed: 99 }), T0);
      const play = humanPlayer();
      let view = await d.connect();
      let midDay: SoloSave | null = null;
      let midSale: SoloSave | null = null;
      for (let i = 0; i < 400 && !midSale; i++) {
        if (i === 6) midDay = await d.save();
        if (i > 6 && ids(view).includes("neg:done") && !view.overlay) midSale = await d.save();
        else view = await d.send(play(view));
      }
      expect(midDay).not.toBeNull();
      expect(midSale).not.toBeNull();
      const saved = midSale as SoloSave;
      // Carry on from the save in this host, recording the actions and views.
      const actions: Action[] = [];
      const views: View[] = [];
      for (let i = 0; i < 30; i++) {
        const action = play(view);
        actions.push(action);
        view = await d.send(action);
        views.push(view);
      }
      await d.endDay();
      const expected = gameOf(await d.save());
      // Load the save (through JSON, as a file would) and replay.
      await d.load(JSON.parse(JSON.stringify(saved)), T0);
      const resumed = await d.connect();
      expect(ids(resumed)).toContain("neg:done");
      for (let i = 0; i < actions.length; i++) {
        expect(await d.send(actions[i] as Action)).toEqual(views[i]);
      }
      await d.endDay();
      expect(gameOf(await d.save())).toEqual(expected);
      // The mid-day save opens too.
      await d.load(midDay as SoloSave, T0);
      expect((await d.connect()).scene).not.toBe("lobby");
    });

    it("the player can visit a rival's parlor (rivals are offline while the player plays)", async () => {
      await d.create(config(), T0);
      const desk = await toDesk(d, await d.connect());
      const save = await d.save();
      const rival = save.town.players[save.bots[0]?.playerId ?? 1];
      let view = await d.send({ type: "press", buttonId: "go:map" });
      expect(view.map).toBeDefined();
      view = await d.send({ type: "visit", placeId: "competitors" });
      view = await d.send({ type: "press", buttonId: "competitors:visit" });
      view = await d.send({
        type: "submitText",
        overlayId: "competitors:getname",
        text: rival?.name ?? "",
      });
      expect(view.overlay?.kind).toBe("confirm");
      view = await d.send({ type: "confirm", overlayId: "competitors:namenext", accepted: true });
      expect(ids(view)).toContain("competitors:trydoor");
      view = await d.send({ type: "press", buttonId: "competitors:trydoor" });
      expect(ids(view)).toContain("competitors:attack");
      view = await d.send({ type: "press", buttonId: "competitors:steal" });
      expect(desk.scene).toBe("desk");
      // The rival hears about it the next time it logs on.
      const after = await d.save();
      expect(
        after.town.players[rival?.id ?? 1]?.mail.some(
          (m) => m.type === "text" && m.importance === "high",
        ),
      ).toBe(true);
    });

    it("a rival's visit (or curse) produces mail the player reads the next day", async () => {
      await d.create(config(), T0);
      await toDesk(d, await d.connect());
      let letter: string | null = null;
      for (let day = 0; day < 8 && !letter; day++) {
        const paper = await d.endDay();
        const save = await d.save();
        const names = save.bots.map((b) => save.town.players[b.playerId]?.name ?? "?");
        const mine = save.town.players[save.humanId]?.mail ?? [];
        const fromRival = mine.some(
          (m) => m.type === "text" && names.some((n) => m.text.includes(n)),
        );
        if (!fromRival) continue;
        // Read it at the desk.
        let view = await d.send({ type: "press", buttonId: "go:desk" });
        for (let i = 0; i < 30 && !letter; i++) {
          const o = view.overlay;
          const shown =
            o && "text" in o
              ? o.text.map((s) => s.text).join("")
              : view.text.map((s) => s.text).join("");
          if (names.some((n) => shown.includes(n))) letter = shown;
          else
            view = await d.send(
              ids(view).includes("go:desk") && !o
                ? { type: "press", buttonId: "go:desk" }
                : safeAction(view),
            );
        }
        expect(paper.scene).toBe("news");
      }
      expect(letter).not.toBeNull();
    }, 60_000);

    it("logging off shows the host's lobby: resume the same day, or sleep until tomorrow", async () => {
      await d.create(config(), T0);
      await toDesk(d, await d.connect());
      const lobby = await d.send({ type: "exit" });
      expect(lobby.scene).toBe("lobby");
      expect(ids(lobby)).toEqual([RESUME, END_DAY]);
      expect(d.notices).toContainEqual({ kind: "sessionEnded", reason: "quit" });
      const back = await d.send({ type: "press", buttonId: RESUME });
      expect(back.scene).toBe("news");
      expect((await d.status()).day).toBe(1);
      await d.send({ type: "exit" });
      const next = await d.send({ type: "press", buttonId: END_DAY });
      expect(next.scene).toBe("news");
      expect((await d.status()).day).toBe(2);
    });

    it("real-time mode: no End the Day, and missed days are played when the save is opened", async () => {
      await d.create(config({ clock: "realtime" }), T0);
      const desk = await toDesk(d, await d.connect());
      expect(ids(desk)).not.toContain(END_DAY);
      const save = await d.save();
      await d.load(save, T0 + 3 * DAY);
      const view = await d.connect();
      expect(view.scene).toBe("news");
      const later = await d.save();
      expect(later.town.day).toBe(save.town.day + 3);
      for (const bot of later.bots)
        expect(later.town.players[bot.playerId]?.dayLastLoggedOn).toBe(later.town.day - 1);
      // Same day again: nothing to catch up.
      expect(await d.tick()).toBe(false);
    }, 60_000);

    it("a career ends after its days with standings, and the day no longer advances", async () => {
      await d.create(config({ mode: "career", careerDays: 3 }), T0);
      await d.connect();
      for (let i = 0; i < 3; i++) await d.endDay();
      const status = await d.status();
      expect(status.day).toBe(4);
      expect(status.finished).toBe(true);
      expect(status.canEndDay).toBe(false);
      expect(status.standings[0]?.place).toBe(1);
      expect(status.standings.map((s) => s.bp)).toEqual(
        [...status.standings.map((s) => s.bp)].sort((a, b) => b - a),
      );
      await d.endDay();
      expect((await d.status()).day).toBe(4);
    });
  });
}
