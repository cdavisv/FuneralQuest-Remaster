/**
 * The engine gaps closed after the bots pass (docs/expanded-rules.md 11.5,
 * 13.5, 20.4, 29): facts the client used to read from prose (monuments, how a
 * sale ended, the meteor edition, what a message overlay carries, who said a
 * cafe line, a hit-man rumour), single-item moderation, and age-aware lines
 * and traits. Classic is untouched (the regression transcripts and the last
 * test here).
 */
import type { Action, View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { agedPool, fitsAges } from "../src/expanded/ages.js";
import {
  CLASSIC_SOCIAL_TEXT,
  type CustomerState,
  checkExpandedContent,
  createPlayer,
  type EngineContext,
  EXPANDED,
  enterGame,
  fill,
  generateCustomer,
  listAnnouncements,
  listQueuedLetters,
  removeAnnouncement,
  removeLetter,
  removePlayerText,
  renamePlayer,
  step,
  type TownState,
  type TraitDef,
  Turn,
  textHash,
  townLife,
} from "../src/index.js";
import { xcontext } from "./support/expanded.js";
import { socialTown } from "./support/social.js";
import { atXDesk, meet, px } from "./support/xplaces.js";
import {
  act,
  edit,
  lifeIn,
  midnight,
  player,
  press,
  type Seat,
  seat,
  visit,
  xtown,
} from "./support/xtown.js";

function funded(players: number, seed = 41): { town: TownState; ctx: EngineContext } {
  const { town, ctx } = xtown({ players, seed });
  return {
    ctx,
    town: edit(town, (t) => {
      for (const p of t.players) {
        p.money = 100_000;
        p.tags = [40, 0, 0];
        p.bp = 1000;
      }
    }),
  };
}

/** `from` writes `body` to player `to` from the desk's pen. */
function write(s: Seat, toName: string, body: string): Seat {
  let q = press(s, "go:mailbox");
  q = act(q, { type: "submitText", overlayId: "mailbox:getname", text: toName.slice(0, 4) });
  if (q.view.overlay?.kind === "confirm")
    q = act(q, { type: "confirm", overlayId: q.view.overlay.id, accepted: true });
  return act(q, { type: "submitText", overlayId: "mailbox:compose", text: body });
}

describe("11.5 View.monuments on graveyard screens", () => {
  it("lists every tier and how many are built", () => {
    const { town, ctx } = funded(2);
    let g = visit(seat(town, ctx, 0), "graveyard");
    const tiers = EXPANDED.town.graveyard.monuments;
    expect(g.view.monuments?.built).toBe(0);
    expect(g.view.monuments?.tiers.map((t) => [t.price, t.bp, t.rating])).toEqual(
      tiers.map((t) => [t.price, t.bp, t.rating]),
    );
    expect(g.view.monuments?.tiers.every((t) => t.name !== "")).toBe(true);
    g = press(press(g, "graveyard:monuments"), "graveyard:monument");
    expect(g.view.monuments?.built).toBe(1);
    expect(press(g, "graveyard:main").view.monuments?.built).toBe(1);
  });
});

describe("11.5 sound cues as data", () => {
  it("a sale's closing view says how it ended: exact, plain or walkout", () => {
    // Exact: the limit set to the bill as it stands.
    const p0 = meet(atXDesk({ seed: 23 }));
    const total = p0.view.customer?.total ?? 0;
    const exact = edit(p0.town, (t) => {
      (t.sessions["0"]?.customer as CustomerState).moneyToSpend = total;
    });
    expect(px({ ...p0, town: exact }, "neg:done").view.saleOutcome).toBe("exact");
    const plain = meet(atXDesk({ seed: 23 }), (c) => {
      c.moneyToSpend = 18000;
    });
    expect(px(plain, "neg:done").view.saleOutcome).toBe("plain");
    const walked = meet(atXDesk({ seed: 19 }), (c) => {
      c.mood = 10;
    });
    const w = px(walked, "neg:guilt");
    expect(w.view.customer).toBeUndefined();
    expect(w.view.saleOutcome).toBe("walkout");
  });

  it("the paper marks the meteor edition", () => {
    const { town, ctx } = funded(2);
    const headline = ctx.content.text.news.meteorHeadline;
    const t = edit(town, (x) => {
      const day = x.news[String(x.day)] ?? { front: "", crime: "" };
      day.front += headline;
      x.news[String(x.day)] = day;
    });
    let s = seat(t, ctx, 0);
    s = press(s, "go:news");
    expect(s.view.news?.meteor).toBe(true);
    const plainDay = seat(town, ctx, 0);
    expect(press(plainDay, "go:news").view.news?.meteor).toBeUndefined();
  });

  it("message overlays say letter, notice or reward", () => {
    const { town, ctx } = funded(3);
    // A letter from player 1 to player 0: the Reply question is a letter.
    const sent = write(seat(town, ctx, 1), player(town, 0).name, "Nice hearse.");
    const views = toDesk(step(sent.town, 1, { type: "exit" }, ctx).town, ctx, 0);
    const reply = views.find((v) => v.overlay?.kind === "confirm")?.overlay;
    expect(reply?.kind === "confirm" && reply.id).toBe("mailbox:reply");
    expect(reply?.kind === "confirm" && reply.messageKind).toBe("letter");
    // A notice: nobody by that name.
    let n = press(seat(town, ctx, 2), "go:mailbox");
    n = act(n, { type: "submitText", overlayId: "mailbox:getname", text: "Zzzz" });
    expect(n.view.overlay?.kind).toBe("message");
    expect(n.view.overlay?.kind === "message" && n.view.overlay.messageKind).toBe("notice");
  });

  it("mail that reported a reward is a reward overlay, and the reward is not paid twice", () => {
    let p = meet(atXDesk({ seed: 19 }), (c) => {
      c.mood = 10;
    });
    p = px(p, "neg:guilt");
    const rival = p.town.players.find((q) =>
      q.mail.some((m) => m.type === "varMod" && m.applied === true),
    );
    expect(rival).toBeDefined();
    if (!rival) return;
    const bp = rival.bp;
    const views = toDesk(p.town, p.ctx, rival.id);
    const reward = views.find((v) => v.overlay?.kind === "message")?.overlay;
    expect(reward?.kind === "message" && reward.messageKind).toBe("reward");
    expect((views[views.length - 1] as View).hud?.bpTotal).toBe(bp);
  });
});

/** Logs `id` on and walks to the desk (past the tour), keeping every view and every overlay. */
function toDesk(town: TownState, ctx: EngineContext, id: number): View[] {
  const first = enterGame(town, id, ctx);
  let t = first.town;
  let v = first.view;
  const views = [v];
  for (let i = 0; i < 20 && (v.overlay || !v.buttons.some((b) => b.id === "desk:wait")); i++) {
    let action: Action | undefined;
    const o = v.overlay;
    if (o?.kind === "message") action = { type: "dismiss", overlayId: o.id };
    else if (o?.kind === "confirm") action = { type: "confirm", overlayId: o.id, accepted: false };
    else {
      const next = ["tutorial:skip", "go:tutorial", "go:desk"].find((b) =>
        v.buttons.some((x) => x.id === b && x.enabled !== false),
      );
      if (next) action = { type: "press", buttonId: next };
    }
    if (!action) break;
    const r = step(t, id, action, ctx);
    if (r.rejected) throw new Error(r.rejected);
    t = r.town;
    v = r.view;
    views.push(v);
  }
  return views;
}

describe("11.5 chat attribution (Expanded)", () => {
  it("a cafe line carries the speaker on the effect and on the speaker's own line", () => {
    const { town, ctx } = funded(3);
    let a = visit(seat(town, ctx, 0), "cafe");
    const b = visit(seat(a.town, ctx, 1), "cafe");
    a = { ...a, town: b.town };
    const r = step(a.town, 0, { type: "chat", text: "hello" } as Action, ctx);
    const effect = r.effects.find((e) => e.kind === "chat" && e.to.includes(1));
    expect(effect?.kind === "chat" && effect.from).toEqual({
      playerId: 0,
      name: player(town, 0).name,
    });
    expect(r.view.chat?.[0]?.from).toEqual({ playerId: 0, name: player(town, 0).name });
    // Room lines (arrivals) carry no speaker.
    expect(b.view.chat?.every((l) => l.from === undefined)).toBe(true);
  });

  it("Classic lines and effects stay as they were (no speaker)", () => {
    const { town, ctx } = socialTown(1, 3, { online: [0, 1] });
    const go = (t: TownState, id: number) => {
      const m = step(t, id, { type: "press", buttonId: "go:map" }, ctx);
      return step(m.town, id, { type: "visit", placeId: "cafe" }, ctx);
    };
    const t = go(go(town, 0).town, 1).town;
    const r = step(t, 0, { type: "chat", text: "hello" }, ctx);
    expect(r.effects.some((e) => e.kind === "chat" && "from" in e)).toBe(false);
    expect(r.view.chat?.some((l) => "from" in l)).toBe(false);
  });
});

describe("20.4 a hit-man rumour is data on the View", () => {
  it("the lucky target sees Hud.warnings that day; a bodyguard foils the hit", () => {
    let { town, ctx } = funded(3);
    town = edit(town, (t) => {
      player(t, 1).luck = 90;
    });
    let c = press(
      press(visit(seat(town, ctx, 0), "reaper-club"), "reaper-club:pay"),
      "reaper-club:hit",
    );
    c = act(c, { type: "pickPlayer", overlayId: "reaper-club:hitpick", playerId: 1 });
    let t = step(c.town, 0, { type: "exit" }, ctx).town;
    const target = seat(t, ctx, 1);
    expect(target.view.hud?.warnings).toEqual([{ kind: "hit-rumour", day: t.day }]);
    expect(lifeIn(target.town, 1).rumourDay).toBe(t.day);
    // The hirer and the unlucky third parlor see nothing.
    expect(seat(t, ctx, 2).view.hud?.warnings).toBeUndefined();
    let g = press(visit(target, "reaper-club"), "reaper-club:pay");
    g = press(g, "reaper-club:bodyguard");
    expect(g.view.hud?.warnings?.length).toBe(1);
    const bp = player(g.town, 1).bp;
    t = midnight(g.town, ctx);
    // Foiled: no BP lost and no injury (the top-parlor bonus may still add BP).
    expect(player(t, 1).bp).toBeGreaterThanOrEqual(bp);
    expect(lifeIn(t, 1).injuries).toEqual([]);
    // The next day the warning is gone.
    expect(seat(t, ctx, 1).view.hud?.warnings).toBeUndefined();
  });
});

describe("29 single-item moderation", () => {
  function announce(s: Seat, body: string): Seat {
    const n = press(press(s, "go:news"), "news:announce");
    return act(n, { type: "submitText", overlayId: "news:announcement", text: body });
  }

  it("lists and removes one announcement by index or hash, and one crime quote", () => {
    const { town, ctx } = funded(3);
    let s = announce(seat(town, ctx, 0), "First words");
    s = announce(seat(step(s.town, 0, { type: "exit" }, ctx).town, ctx, 1), "Second words");
    s = announce(seat(step(s.town, 1, { type: "exit" }, ctx).town, ctx, 0), "Third words");
    let t = s.town;
    const list = listAnnouncements(t, ctx, t.day);
    expect(list.map((a) => a.author)).toEqual([
      player(t, 0).name,
      player(t, 1).name,
      player(t, 0).name,
    ]);
    expect(list[1]?.text).toContain("Second words");
    expect(list[1]?.hash).toBe(textHash(list[1]?.text ?? ""));
    // By index.
    const r1 = removeAnnouncement(t, ctx, { day: t.day, index: 1 });
    expect(r1.removed).toBe(true);
    expect(r1.town.news[String(t.day)]?.front).not.toContain("Second words");
    expect(r1.town.news[String(t.day)]?.front).toContain("First words");
    expect(t.news[String(t.day)]?.front).toContain("Second words");
    // By hash, and a stale hash does nothing.
    const third = list[2]?.hash ?? "";
    const r2 = removeAnnouncement(r1.town, ctx, { day: t.day, section: "front", hash: third });
    expect(r2.removed).toBe(true);
    expect(r2.town.news[String(t.day)]?.front).not.toContain("Third words");
    expect(removeAnnouncement(r2.town, ctx, { day: t.day, hash: third }).removed).toBe(false);
    expect(removeAnnouncement(r2.town, ctx, { day: t.day, index: 0, hash: third }).removed).toBe(
      false,
    );
    // A crime-page quote: the entry keeps the fight and loses the quote.
    const b = CLASSIC_SOCIAL_TEXT.battle;
    t = edit(r2.town, (x) => {
      const day = x.news[String(x.day)];
      if (!day) throw new Error("no paper");
      day.crime += fill(b.crimeWinQuote, { winner: "Ann", loser: "Bob", quote: "Ha!" });
      day.crime += fill(b.crimeLostQuote, { winner: "Cy", loser: "Di", quote: "Ow" });
    });
    const crime = listAnnouncements(t, ctx, t.day, "crime");
    expect(crime.map((q) => q.author)).toEqual(["Ann", "Di"]);
    const r3 = removeAnnouncement(t, ctx, { day: t.day, section: "crime", index: 1 });
    const page = r3.town.news[String(t.day)]?.crime ?? "";
    expect(page).toContain("Ha!");
    expect(page).not.toContain("Ow");
    expect(page).toContain(fill(b.crimeLost, { winner: "Cy", loser: "Di" }));
  });

  it("removes one queued letter, leaving the others", () => {
    const { town, ctx } = funded(3);
    const to = player(town, 2).name;
    let s = write(seat(town, ctx, 0), to, "Letter one.");
    s = write(seat(step(s.town, 0, { type: "exit" }, ctx).town, ctx, 1), to, "Letter two.");
    const t = s.town;
    const letters = listQueuedLetters(t, 2);
    expect(letters.map((l) => l.author)).toEqual([0, 1]);
    expect(letters[1]?.text).toContain("Letter two.");
    const before = player(t, 2).mail.length;
    const r = removeLetter(t, { to: 2, hash: letters[0]?.hash ?? "" });
    expect(r.removed).toBe(true);
    expect(player(r.town, 2).mail.length).toBe(before - 3);
    expect(listQueuedLetters(r.town, 2).map((l) => l.author)).toEqual([1]);
    expect(removeLetter(r.town, { to: 2, index: 1 }).removed).toBe(false);
    // The rest still reads: player 2's Reply question is player 1's letter.
    const desk = seat(r.town, ctx, 2);
    expect(JSON.stringify(desk.view.overlay)).toContain("Letter two.");
  });

  it("removePlayerText renames the chains a player founded; renamePlayer fixes the Book of Deeds", () => {
    const { town, ctx } = funded(3);
    let t = edit(town, (x) => {
      townLife(x).chains.push(
        {
          id: "c4",
          name: "Rude Name",
          founder: 0,
          members: [0, 1],
          score: 0,
          invites: [],
          hitsToday: 0,
          hitsDay: 0,
        },
        {
          id: "c5",
          name: "Other",
          founder: 1,
          members: [1],
          score: 0,
          invites: [],
          hitsToday: 0,
          hitsDay: 0,
        },
      );
      player(x, 2).mail.push({
        type: "text",
        text: "Join Rude Name today.",
        importance: "high",
        from: -1,
        expireDay: null,
      });
      x.deeds.push(`${player(x, 0).name} won the season.`);
    });
    const r = removePlayerText(t, 0, ctx);
    expect(r.removed.chains).toBe(1);
    const chains = r.town.expanded?.life?.chains ?? [];
    expect(chains.map((c) => c.name)).toEqual(["Parlor Chain No. 4", "Other"]);
    expect(JSON.stringify(player(r.town, 2).mail)).toContain("Parlor Chain No. 4");
    t = renamePlayer(r.town, 0, ctx, { name: "Renamed" }).town;
    expect(t.deeds.at(-1)).toBe("Renamed won the season.");
    // A Classic town reports no chains.
    const classic = socialTown(1, 2);
    expect(removePlayerText(classic.town, 0, classic.ctx).removed.chains).toBeUndefined();
  });
});

describe("13.5 age-aware lines and traits", () => {
  const kid = { customerAge: 16, deceasedAge: 70 } as CustomerState;
  const adult = { customerAge: 40, deceasedAge: 70 } as CustomerState;
  const young = { customerAge: 40, deceasedAge: 30 } as CustomerState;

  it("fitsAges is inclusive and absent bounds pass", () => {
    expect(fitsAges({ maxCustomerAge: 17 }, kid)).toBe(true);
    expect(fitsAges({ maxCustomerAge: 17 }, adult)).toBe(false);
    expect(fitsAges({ minCustomerAge: 40, maxCustomerAge: 40 }, adult)).toBe(true);
    expect(fitsAges({ minDeceasedAge: 60 }, young)).toBe(false);
    expect(fitsAges({}, kid)).toBe(true);
  });

  it("a restricted line joins its pool only for customers it suits; a pool never goes empty", () => {
    const { town, ctx } = funded(2);
    const turn = new Turn(town, ctx, 0);
    const juice = /juice box/;
    const longLife = /long life/;
    const base = ["plain"];
    const forKid = agedPool(turn, kid, "sympathyPitch", base);
    expect(forKid.some((l) => juice.test(l))).toBe(true);
    expect(forKid.some((l) => longLife.test(l))).toBe(false);
    const forAdult = agedPool(turn, adult, "sympathyPitch", base);
    expect(forAdult.some((l) => juice.test(l))).toBe(false);
    expect(forAdult.some((l) => longLife.test(l))).toBe(true);
    expect(agedPool(turn, young, "sympathyPitch", base)).toEqual(["plain"]);
    // No aged lines for the pool: the base list itself (the draw is unchanged).
    expect(agedPool(turn, kid, "guiltPitch", base)).toBe(base);
    // A pool of restricted lines only, none fitting: falls back to all of them.
    expect(agedPool(turn, young, "sympathyPitch", []).length).toBe(2);
  });

  it("a restricted trait is never drawn for a customer outside its ages", () => {
    const base = xcontext();
    const x = base.content.expanded;
    if (!x) throw new Error("no expanded content");
    // Every trait but three is for customers of 19 or younger only.
    const keep = new Set(
      x.traits
        .filter((t) => t.minCustomerAge === undefined)
        .slice(0, 3)
        .map((t) => t.id),
    );
    const traits = x.traits.map((t): TraitDef => {
      if (keep.has(t.id)) return t;
      const { minCustomerAge: _drop, ...rest } = t;
      return { ...rest, maxCustomerAge: 19 };
    });
    const ctx: EngineContext = {
      ...base,
      content: { ...base.content, expanded: { ...x, traits } },
    };
    expect(checkExpandedContent(ctx.content.expanded as typeof x, EXPANDED)).toEqual([]);
    const { town } = funded(2);
    const turn = new Turn(
      edit(town, () => {}),
      ctx,
      0,
    );
    const open = keep;
    let kids = 0;
    let kidRestricted = 0;
    for (let i = 0; i < 600; i++) {
      const c = generateCustomer(turn);
      // A special customer's own traits are its design (forced, section 3.8), not drawn.
      if (c.expanded?.special) continue;
      const ids = c.expanded?.traits ?? [];
      if (c.customerAge > 19) {
        expect(
          ids.every((id) => open.has(id)),
          `age ${c.customerAge}: ${ids}`,
        ).toBe(true);
      } else {
        kids++;
        if (ids.some((id) => !open.has(id))) kidRestricted++;
      }
    }
    expect(kids).toBeGreaterThan(0);
    expect(kidRestricted).toBeGreaterThan(0);
  });

  it("the content check catches bad limits and unknown pools", () => {
    const x = xcontext().content.expanded;
    if (!x) throw new Error("no expanded content");
    const bad = {
      ...x,
      traits: x.traits.map((t, i) =>
        i === 0 ? { ...t, minCustomerAge: 50, maxCustomerAge: 10 } : t,
      ),
      text: {
        ...x.text,
        negotiation: {
          ...x.text.negotiation,
          agedLines: [
            { pool: "nope" as "softPitch", text: "x", maxCustomerAge: 14 },
            { pool: "softPitch" as const, text: "y" },
          ],
        },
      },
    };
    const problems = checkExpandedContent(bad, EXPANDED).join("\n");
    expect(problems).toMatch(/minCustomerAge > maxCustomerAge/);
    expect(problems).toMatch(/unknown pool nope/);
    expect(problems).toMatch(/no age limit/);
  });
});

describe("9.4 a late starter's money", () => {
  it("a parlor created after day 1 starts with underdog.late.money a season day already played", () => {
    const { town, ctx } = xtown({ players: 2 });
    const late = midnight(town, ctx, 9);
    expect(late.day).toBe(10);
    const input = {
      logon: "late",
      name: "Latecomer",
      parlor: "Late Rest",
      password: "pw",
      passwordVerify: "pw",
      male: true,
      email: "late@example.com",
    };
    const r = createPlayer(late, input, ctx);
    if (!r.ok) throw new Error("createPlayer failed");
    const per = EXPANDED.underdog.late.money;
    expect(player(r.town, r.playerId).money).toBe(EXPANDED.money.startingMoney + 9 * per);
    // On day 1 nothing extra.
    const early = createPlayer(town, { ...input, logon: "early", name: "Earlybird" }, ctx);
    if (!early.ok) throw new Error("createPlayer failed");
    expect(player(early.town, early.playerId).money).toBe(EXPANDED.money.startingMoney);
  });
});

describe("13.5 original lines are never restricted (owner's rule)", () => {
  it("an aged line that repeats a plain or original line is ignored; the plain list is always kept", () => {
    const base = xcontext();
    const x = base.content.expanded;
    if (!x) throw new Error("no expanded content");
    const original = base.content.text.negotiation.sympathyPitch[0] ?? "";
    const ctx: EngineContext = {
      ...base,
      content: {
        ...base.content,
        expanded: {
          ...x,
          text: {
            ...x.text,
            negotiation: {
              ...x.text.negotiation,
              agedLines: [{ pool: "sympathyPitch", text: original, minCustomerAge: 99 }],
            },
          },
        },
      },
    };
    const { town } = funded(2);
    const turn = new Turn(town, ctx, 0);
    const pool = [original, "other"];
    const teen = { customerAge: 16, deceasedAge: 70 } as CustomerState;
    expect(agedPool(turn, teen, "sympathyPitch", pool)).toEqual(pool);
    expect(agedPool(turn, { ...teen, customerAge: 99 }, "sympathyPitch", pool)).toEqual(pool);
  });
});
