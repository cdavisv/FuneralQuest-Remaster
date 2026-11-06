/**
 * Blocking and moderation (classic/blocking.ts, classic/moderation.ts; a
 * remaster addition for app-store rules, both rulesets). A blocked player's
 * letters, cafe lines, `/give`, Yang's deliveries and quote mails do not reach
 * the blocker; fights are not shielded; with no block list nothing changes
 * (the Classic regression transcripts, recorded without blocks, still pass).
 */
import type { Action, View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import {
  blockedList,
  blockersOf,
  CLASSIC_SOCIAL_TEXT,
  type EngineContext,
  enterGame,
  fill,
  isBlocking,
  removePlayerText,
  renamePlayer,
  richTextToPlain,
  type StepResult,
  setBlocked,
  step,
  type TownState,
} from "../src/index.js";
import { socialTown } from "./support/social.js";
import { seat, xtown } from "./support/xtown.js";

type Ruleset = "classic" | "expanded";

/** Players 0, 1 and 2 at their desks. */
function town3(rules: Ruleset): { town: TownState; ctx: EngineContext } {
  if (rules === "classic") {
    const made = socialTown(3, 3, { online: [0, 1, 2] });
    return { town: made.town, ctx: made.ctx };
  }
  const { town, ctx } = xtown({ players: 3 });
  let t = town;
  for (const id of [0, 1, 2]) t = seat(t, ctx, id).town;
  return { town: t, ctx };
}

function act(town: TownState, id: number, action: Action, ctx: EngineContext): StepResult {
  const r = step(town, id, action, ctx);
  if (r.rejected) throw new Error(`${JSON.stringify(action)} rejected: ${r.rejected}`);
  return r;
}
const press = (town: TownState, id: number, buttonId: string, ctx: EngineContext) =>
  act(town, id, { type: "press", buttonId }, ctx);

/** `from` writes `text` to the first player whose name contains `name`. */
function write(town: TownState, from: number, name: string, text: string, ctx: EngineContext) {
  const pen = press(town, from, "go:mailbox", ctx);
  const asked = act(
    pen.town,
    from,
    { type: "submitText", overlayId: "mailbox:getname", text: name },
    ctx,
  );
  const yes = act(
    asked.town,
    from,
    { type: "confirm", overlayId: "mailbox:namenext", accepted: true },
    ctx,
  );
  return act(yes.town, from, { type: "submitText", overlayId: "mailbox:compose", text }, ctx);
}

function toCafe(town: TownState, id: number, ctx: EngineContext): StepResult {
  const map = press(town, id, "go:map", ctx);
  return act(map.town, id, { type: "visit", placeId: "cafe" }, ctx);
}

function chatTo(r: StepResult, id: number): string[] {
  return r.effects.flatMap((e) =>
    e.kind === "chat" && e.to.includes(id) ? [richTextToPlain(e.text)] : [],
  );
}

const nameOf = (town: TownState, id: number) => town.players[id]?.name ?? "";

describe("setBlocked and the lookups", () => {
  it("keeps sorted, de-duplicated lists of real players and drops the field when empty", () => {
    const { town } = town3("classic");
    let t = setBlocked(town, 1, [2, 0, 0, 1, 99]);
    expect(blockedList(t, 1)).toEqual([0, 2]);
    expect(isBlocking(t, 1, 0)).toBe(true);
    expect(isBlocking(t, 0, 1)).toBe(false);
    expect([...blockersOf(t, 0)]).toEqual([1]);
    t = setBlocked(t, 1, []);
    expect("blocks" in t).toBe(false);
    expect(JSON.stringify(t)).toBe(JSON.stringify(town));
  });
});

for (const rules of ["classic", "expanded"] as const) {
  describe(`blocking under ${rules} rules`, () => {
    it("a blocked player's letter is not delivered, and the sender's screens are the usual ones", () => {
      const { town, ctx } = town3(rules);
      const blocked = setBlocked(town, 1, [0]);
      const before = blocked.players[1]?.mail.length ?? 0;
      const sent = write(blocked, 0, nameOf(town, 1).slice(0, 4), "Hello, rival.", ctx);
      expect(sent.town.players[1]?.mail.length).toBe(before);
      expect(chatTo(sent, 1)).toEqual([]);
      // Exactly what an unblocked sender sees.
      const plain = write(town, 0, nameOf(town, 1).slice(0, 4), "Hello, rival.", ctx);
      expect(JSON.stringify(sent.view)).toBe(JSON.stringify(plain.view));
      expect(plain.town.players[1]?.mail.length).toBeGreaterThan(before);
      // Blocking is one way: the blocker can still write to the blocked player.
      const back = write(sent.town, 1, nameOf(town, 0).slice(0, 4), "Go away.", ctx);
      expect(back.town.players[0]?.mail.length).toBeGreaterThan(
        sent.town.players[0]?.mail.length ?? 0,
      );
    });

    it("cafe lines, /me, /yell and /give from a blocked player do not reach the blocker", () => {
      const { town, ctx } = town3(rules);
      let t = toCafe(town, 2, ctx).town;
      t = toCafe(t, 1, ctx).town;
      t = toCafe(t, 0, ctx).town;
      t = setBlocked(t, 1, [0]);
      const said = act(t, 0, { type: "chat", text: "hello" }, ctx);
      expect(chatTo(said, 1)).toEqual([]);
      expect(chatTo(said, 2).join()).toContain("hello");
      for (const text of ["/me waves", "/yell HEY"]) {
        const r = act(t, 0, { type: "chat", text }, ctx);
        expect(chatTo(r, 1)).toEqual([]);
        expect(chatTo(r, 2).length).toBeGreaterThan(0);
        expect(r.town.players[1]?.mail.length).toBe(t.players[1]?.mail.length);
      }
      // /give cannot find the blocker; the tag stays with the giver.
      const rich = structuredClone(t);
      (rich.players[0] as { tags: number[] }).tags = [5, 0, 0];
      const give = act(rich, 0, { type: "chat", text: `/give ${nameOf(t, 1)} wood` }, ctx);
      expect(give.town.players[1]?.tags[0]).toBe(rich.players[1]?.tags[0]);
      expect(give.town.players[0]?.tags[0]).toBe(5);
      expect(chatTo(give, 1)).toEqual([]);
      // ...but the blocker still talks to everyone, the blocked player included.
      const reply = act(t, 1, { type: "chat", text: "I can talk" }, ctx);
      expect(chatTo(reply, 0).join()).toContain("I can talk");
    });

    it("Yang's: the blocker is not in the delivery picker", () => {
      const { town, ctx } = town3(rules);
      const t = setBlocked(town, 1, [0]);
      const map = press(t, 0, "go:map", ctx);
      const yangs = act(map.town, 0, { type: "visit", placeId: "yangs" }, ctx);
      const pick = press(yangs.town, 0, "yangs:sparrow", ctx);
      const ids = pick.view.overlay?.kind === "playerPicker" ? pick.view.overlay.players : [];
      expect(ids.map((p) => p.id)).not.toContain(1);
      expect(ids.map((p) => p.id)).toContain(2);
      // Unblocked, the blocker would be offered.
      const open = press(
        act(press(town, 0, "go:map", ctx).town, 0, { type: "visit", placeId: "yangs" }, ctx).town,
        0,
        "yangs:sparrow",
        ctx,
      );
      const all = open.view.overlay?.kind === "playerPicker" ? open.view.overlay.players : [];
      expect(all.map((p) => p.id)).toContain(1);
    });

    it("is never a combat shield: the blocked player can still visit the blocker's parlor", () => {
      const { town, ctx } = town3(rules);
      const unblocked = (t: TownState): View => {
        const map = press(t, 0, "go:map", ctx);
        const row = act(map.town, 0, { type: "visit", placeId: "competitors" }, ctx);
        const prompt = press(row.town, 0, "competitors:visit", ctx);
        const asked = act(
          prompt.town,
          0,
          { type: "submitText", overlayId: "competitors:getname", text: nameOf(t, 1) },
          ctx,
        );
        return act(
          asked.town,
          0,
          { type: "confirm", overlayId: "competitors:namenext", accepted: true },
          ctx,
        ).view;
      };
      const off = (t: TownState) => {
        let x = t;
        for (const id of [1, 2]) x = step(x, id, { type: "exit" }, ctx).town;
        return x;
      };
      const free = unblocked(off(town));
      const shielded = unblocked(setBlocked(off(town), 1, [0]));
      expect(JSON.stringify(shielded)).toBe(JSON.stringify(free));
    });
  });
}

describe("blocking, Expanded only", () => {
  it("bank transfers and chain invitations leave the blocker out; duels do not", () => {
    const { town, ctx } = xtown({ players: 3 });
    const t = structuredClone(town);
    for (const p of t.players) {
      p.money = 100_000;
      p.tags = [20, 5, 5];
      p.dayCreated = -10;
    }
    const blocked = setBlocked(t, 1, [0]);
    let s = seat(blocked, ctx, 0);
    let r = press(s.town, 0, "go:map", ctx);
    r = act(r.town, 0, { type: "visit", placeId: "bank" }, ctx);
    r = press(r.town, 0, "bank:transferhome", ctx);
    r = press(r.town, 0, "bank:transfer", ctx);
    const transfer = r.view.overlay?.kind === "playerPicker" ? r.view.overlay.players : [];
    expect(transfer.map((p) => p.id)).toEqual([2]);
    s = seat(blocked, ctx, 0);
    r = press(s.town, 0, "go:map", ctx);
    r = act(r.town, 0, { type: "visit", placeId: "graveyard" }, ctx);
    r = press(r.town, 0, "graveyard:duel", ctx);
    const duel = r.view.overlay?.kind === "playerPicker" ? r.view.overlay.players : [];
    expect(duel.map((p) => p.id)).toContain(1);
  });
});

describe("removePlayerText (account deletion, takedown)", () => {
  it("removes queued letters, announcements, quote mails, sparrow fortunes and crime quotes", () => {
    const { town, ctx } = town3("classic");
    const name0 = nameOf(town, 0);
    let t = write(town, 0, nameOf(town, 1).slice(0, 4), "Buy my hearse.", ctx).town;
    t = write(t, 2, nameOf(town, 1).slice(0, 4), "Hi from 2.", ctx).town;
    // An announcement by 0 and one by 2.
    for (const [id, text] of [
      [0, "Skelly's sale today"],
      [2, "Digby says hi"],
    ] as const) {
      const r0 = press(t, id, "go:news", ctx);
      const r1 = press(r0.town, id, "news:announce", ctx);
      t = act(r1.town, id, { type: "submitText", overlayId: "news:announcement", text }, ctx).town;
    }
    // A crime-page quote by 0 and a quote mail to 1, as battle.ts writes them.
    const b = CLASSIC_SOCIAL_TEXT.battle;
    const day = t.news[String(t.day)];
    if (!day) throw new Error("no paper");
    day.crime += fill(b.crimeWinQuote, { winner: name0, loser: nameOf(t, 1), quote: "Ha!" });
    day.crime += fill(b.crimeLostQuote, { winner: nameOf(t, 2), loser: name0, quote: "Ow" });
    t.players[1]?.mail.push({
      type: "text",
      text: fill(b.winQuoteMail, { name: name0, quote: "Ha!" }),
      importance: "high",
      from: -1,
      expireDay: null,
    });
    const sparrow = ctx.content.text.places.yangs.sparrowMail;
    t.players[2]?.mail.push({
      type: "text",
      text: fill(sparrow, { name: name0, fortune: "You smell.", luck: 5 }),
      importance: "high",
      from: -1,
      expireDay: null,
    });
    const before1 = t.players[1]?.mail.length ?? 0;
    const before2 = t.players[2]?.mail.length ?? 0;
    const { town: out, removed } = removePlayerText(t, 0, ctx);
    expect(removed).toEqual({ letters: 1, announcements: 1, quotes: 3, fortunes: 1 });
    expect(out.players[1]?.mail.length).toBe(before1 - 4);
    expect(out.players[2]?.mail.length).toBe(before2 - 1);
    const mail = JSON.stringify(out.players[1]?.mail);
    expect(mail).not.toContain("Buy my hearse");
    expect(mail).toContain("Hi from 2");
    const paper = out.news[String(out.day)];
    expect(paper?.front).not.toContain("Skelly's sale today");
    expect(paper?.front).toContain("Digby says hi");
    expect(paper?.crime).not.toContain("Ha!");
    expect(paper?.crime).not.toContain("Ow");
    expect(paper?.crime).toContain(fill(b.crimeWin, { winner: name0, loser: nameOf(t, 1) }));
    expect(paper?.crime).toContain(fill(b.crimeLost, { winner: nameOf(t, 2), loser: name0 }));
    // The other player's text is untouched, and the input town is unchanged.
    expect(removePlayerText(out, 0, ctx).removed).toEqual({
      letters: 0,
      announcements: 0,
      quotes: 0,
      fortunes: 0,
    });
    expect(t.news[String(t.day)]?.front).toContain("Skelly's sale today");
  });
});

describe("renamePlayer (moderator action)", () => {
  it("renames name and parlor, checks lengths and clashes, and rewrites stored text", () => {
    const { town, ctx } = town3("classic");
    const old = nameOf(town, 0);
    const t = write(town, 0, nameOf(town, 1).slice(0, 4), "A letter.", ctx).town;
    expect(renamePlayer(t, 0, ctx, { name: "X" }).error).toBe("nameLength");
    expect(renamePlayer(t, 0, ctx, { name: nameOf(t, 1) }).error).toBe("nameTaken");
    expect(renamePlayer(t, 0, ctx, { parlor: "" }).error).toBe("parlorLength");
    expect(renamePlayer(t, 9, ctx, { name: "Bones" }).error).toBe("noSuchPlayer");
    const r = renamePlayer(t, 0, ctx, { name: "Bones", parlor: "Bones Rest" });
    expect(r.error).toBeUndefined();
    expect(r.town.players[0]?.name).toBe("Bones");
    expect(r.town.players[0]?.parlor).toBe("Bones Rest");
    expect(JSON.stringify(r.town.news)).not.toContain(old);
    expect(JSON.stringify(r.town.players[1]?.mail)).toContain("Bones");
    // The takedown still finds the renamed player's letter.
    expect(removePlayerText(r.town, 0, ctx).removed.letters).toBe(1);
    // The renamed player logs on and plays as before.
    expect(enterGame(r.town, 0, ctx).rejected).toBeUndefined();
  });
});
