import { describe, expect, it } from "vitest";
import {
  type EngineContext,
  richTextToPlain,
  runDailyMaintenance,
  type StepResult,
  step,
  type TownState,
} from "../src/index.js";
import { act, chatFor, chatLines, edit, press, socialTown } from "./support/social.js";

function enterCafe(town: TownState, id: number, ctx: EngineContext): StepResult {
  const map = press(town, id, "go:map", ctx);
  return act(map.town, id, { type: "visit", placeId: "cafe" }, ctx);
}

function say(town: TownState, id: number, text: string, ctx: EngineContext): StepResult {
  return act(town, id, { type: "chat", text }, ctx);
}

/** Skelly (0) and Morticia (1) in the cafe, Digby (2) at his desk, Graves (3) offline. */
function cafe(seed = 1) {
  const { town, ctx } = socialTown(seed, 4, { online: [0, 1, 2] });
  const one = enterCafe(town, 1, ctx);
  const zero = enterCafe(one.town, 0, ctx);
  return { town: zero.town, ctx, entered: zero, first: one };
}

describe("the Pale Horse Cafe (commands_bar.cpp)", () => {
  it("walking in: the others hear it, the newcomer sees who is here (:321-348, :56-98)", () => {
    const { entered, first } = cafe();
    expect(richTextToPlain(first.view.text)).toContain("You are the only one here.");
    expect(entered.view.scene).toBe("cafe");
    expect(richTextToPlain(entered.view.text)).toContain("Other people here: Morticia");
    expect(chatLines(entered)).toEqual(["Skelly saunters in."]);
    expect(chatFor(entered, 1)).toEqual(["Skelly saunters in."]);
    // Digby is not in the cafe: no chat for him, and nothing queued.
    expect(entered.effects.every((e) => e.kind !== "chat" || !e.to.includes(2))).toBe(true);
    expect(entered.view.buttons.map((b) => b.id)).toEqual(["go:map"]);
  });

  it("a line said aloud goes to the others as a chat effect and back in the speaker's view (:350-411)", () => {
    const { town, ctx } = cafe();
    const r = say(town, 0, "Hello there|second line", ctx);
    expect(chatLines(r)).toEqual(["Skelly: Hello there", "Skelly: second line"]);
    expect(chatFor(r, 1)).toEqual(["Skelly: Hello there", "Skelly: second line"]);
    expect(chatFor(r, 0)).toEqual([]);
    for (const e of r.effects) if (e.kind === "chat") expect(e.to).toEqual([1]);
    // The words are swear-checked (:380).
    expect(chatFor(say(town, 0, "oh shit", ctx), 1)).toEqual(["Skelly: oh shoot"]);
  });

  it("/me and /yell; /yell reaches everyone online, queued for those outside the cafe (:281-307)", () => {
    const { town, ctx } = cafe();
    expect(chatFor(say(town, 0, "/me waves", ctx), 1)).toEqual(["Skelly waves"]);
    const yell = say(town, 0, "/yell FIRE", ctx);
    expect(chatFor(yell, 1)).toEqual(["Skelly yells: FIRE"]);
    expect(chatLines(yell)).toEqual(["Skelly yells: FIRE"]);
    const queued = yell.town.players[2]?.mail.at(-1);
    expect(queued?.type === "simpleText" && queued.text).toBe("Skelly yells: FIRE");
    expect(yell.town.players[3]?.mail.some((m) => m.type === "simpleText")).toBe(false);
    expect(
      yell.town.players[1]?.mail.some((m) => m.type === "simpleText" && m.text.includes("FIRE")),
    ).toBe(false);
  });

  it("/?, /who, /info, /all and unknown commands answer only the speaker (:244-318)", () => {
    const { town, ctx } = cafe();
    const help = say(town, 0, "/?", ctx);
    expect(chatLines(help)[0]).toContain("Cafe chat help");
    expect(help.effects.some((e) => e.kind === "chat")).toBe(false);
    expect(chatLines(say(town, 0, "/WHO", ctx))).toEqual(["Other people here: Morticia"]);
    expect(chatLines(say(town, 0, "/info", ctx))[0]).toContain(
      "You have 15 turns left today and 2 parlor visits.",
    );
    const all = chatLines(say(town, 0, "/all", ctx));
    expect(all[0]).toContain("Name                 Status            Last hit");
    expect(all.slice(2).map((l) => l.slice(0, 21).trim())).toEqual(["Skelly", "Morticia", "Digby"]);
    expect(all[2]).toContain("in cafe");
    expect(chatLines(say(town, 0, "/dance", ctx))).toEqual([
      "Unknown command.  Do /? for the list.",
    ]);
  });

  it("/give: one tag, the recipient may get tagsReceivablePerDay (1) a day, reset at midnight (:136-222, maint.cpp:263-310)", () => {
    const base = cafe();
    const ctx = base.ctx;
    const town = edit(base.town, 0, { tags: [2, 0, 1] });
    const given = say(town, 0, "/give morti wood", ctx);
    expect(chatFor(given, 1)).toEqual(["Skelly gives Morticia a Wood tag."]);
    expect(given.town.players[0]?.tags).toEqual([1, 0, 1]);
    expect(given.town.players[1]?.tags[0]).toBe(1);
    expect(given.town.players[1]?.tagsReceivedToday).toBe(1);
    const again = say(given.town, 0, "/give Morticia gold", ctx);
    expect(chatLines(again)).toEqual([
      "Skelly is unable to give Morticia a Gold tag. (he's already received 1 today)",
    ]);
    expect(again.town.players[0]?.tags).toEqual([1, 0, 1]);
    expect(chatLines(say(town, 0, "/give Morticia silver", ctx))).toEqual([
      "Skelly looks in his pocket for a Silver tag but comes up empty.",
    ]);
    expect(chatLines(say(town, 0, "/give Skelly gold", ctx))).toEqual([
      "Skelly absently tosses a Gold tag into the air and catches it.",
    ]);
    expect(chatLines(say(town, 0, "/give Digby gold", ctx))[0]).toContain(
      "don't see anyone with 'Digby' in their name",
    );
    expect(chatLines(say(town, 0, "/give Morticia coal", ctx))).toEqual([
      "Valid tag types are wood, silver and gold.",
    ]);
    const night = runDailyMaintenance(given.town, ctx).town;
    expect(night.players[1]?.tagsReceivedToday).toBe(0);
    // A limit of 0 disables giving (:196-201).
    const off = structuredClone(town);
    off.settings.tagsReceivablePerDay = 0;
    expect(chatLines(say(off, 0, "/give Morticia wood", ctx))[0]).toContain(
      "the admin has disabled tag transfer",
    );
  });

  it("the TV: on by default, /tv off silences it in the cafe (the log line stays), /tv on (:100-133, broadcast.cpp:427-448)", () => {
    const { town, ctx } = cafe();
    expect(chatLines(say(town, 0, "/tv", ctx))).toEqual(["The TV is currently on."]);
    const off = say(town, 0, "/tv off", ctx);
    expect(off.town.tvOn).toBe(false);
    expect(chatLines(say(off.town, 0, "/tv", ctx))).toEqual([
      "The TV is currently off, that stuff will rot your brain.",
    ]);
    // "On" is not "on" or "ON": the original turned the TV off.
    expect(say(off.town, 0, "/tv On", ctx).town.tvOn).toBe(false);
    expect(say(off.town, 0, "/tv ON", ctx).town.tvOn).toBe(true);
  });

  it("TV reports reach the cafe as chat effects (a battle's hospital report)", () => {
    const { town, ctx } = socialTown(3, 3, { online: [0, 2] });
    const inCafe = enterCafe(town, 2, ctx).town;
    const t = edit(edit(inCafe, 0, { plots: 9, strength: 40 }), 1, { hp: 1, hpMax: 1 });
    const map = press(t, 0, "go:map", ctx);
    const row = act(map.town, 0, { type: "visit", placeId: "competitors" }, ctx);
    const prompt = press(row.town, 0, "competitors:visit", ctx);
    const named = act(
      prompt.town,
      0,
      { type: "submitText", overlayId: "competitors:getname", text: "Morticia" },
      ctx,
    );
    const front = act(
      named.town,
      0,
      { type: "confirm", overlayId: "competitors:namenext", accepted: true },
      ctx,
    );
    const inside = press(front.town, 0, "competitors:trydoor", ctx);
    const fight = press(inside.town, 0, "competitors:attack", ctx);
    const hit = press(fight.town, 0, "battle:attack", ctx);
    expect(chatFor(hit, 2)).toEqual(["The TV: It looks like Morticia was taken to the hospital."]);
    expect(hit.effects.some((e) => e.kind === "tv")).toBe(true);
    const quiet = structuredClone(fight.town);
    quiet.tvOn = false;
    const hush = press(quiet, 0, "battle:attack", ctx);
    expect(chatFor(hush, 2)).toEqual([]);
    expect(hush.effects.some((e) => e.kind === "tv")).toBe(true);
  });

  it("leaving tells the others; chat outside the cafe is rejected", () => {
    const { town, ctx } = cafe();
    const out = press(town, 0, "go:map", ctx);
    expect(chatFor(out, 1)).toEqual(["Skelly steps outside."]);
    expect(step(out.town, 0, { type: "chat", text: "hi" }, ctx).rejected).toBeDefined();
    expect(out.town.sessions["0"]?.status).toBe("play");
  });
});
