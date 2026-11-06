/**
 * The Expanded pack's town under the Expanded ruleset (docs/expanded-rules.md section 27): core's
 * town walker with this pack's content; a walker that visits every place and reads every View for
 * unfilled placeholders and empty text; each story arc driven to each of its endings; and an
 * ordinance ballot voted and applied.
 */
import {
  type ArcBeatDef,
  enterGame,
  liveModifiers,
  richTextToPlain,
  runDailyMaintenance,
  startArc,
  step,
  Turn,
} from "@fq/core";
import type { Action, View } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { chooseInjury } from "../../core/src/expanded/town/life.js";
import { makeXTown } from "../../core/test/support/expanded.js";
import { policyRng } from "../../core/test/support/harness.js";
import { townWalk } from "../../core/test/support/townWalk.js";
import { edit, frontPage, midnight, press, seat, visit } from "../../core/test/support/xtown.js";
import { expandedPack } from "../src/index.js";
import { arcPaths } from "../src/townLint.js";
import { ctx, playToEnding, xtown } from "./arcPlay.js";

const town0 = expandedPack.expanded?.town;
if (!town0) throw new Error("no town");
const T = town0;

const UNFILLED = /\{[A-Za-z]+\}/;

/** Every string a player sees in a View, but the newspaper (Classic blurbs keep their quirks). */
function viewStrings(v: View): string[] {
  const out = [v.title, richTextToPlain(v.text)];
  if (v.note) out.push(richTextToPlain(v.note));
  if (v.status) out.push(richTextToPlain(v.status));
  for (const b of v.buttons) out.push(b.label, b.hint ?? "", b.detail ?? "");
  if (v.overlay) out.push(JSON.stringify(v.overlay));
  if (v.town) out.push(JSON.stringify(v.town));
  return out;
}

function checkView(v: View, where: string): void {
  for (const s of viewStrings(v)) {
    expect(s, `${where}: unfilled placeholder in "${s}"`).not.toMatch(UNFILLED);
    // The one exception is the original's snakehead blurb, kept as written (lint.ts header).
    const star = s.replace("More fish fatalities for you, *NAME*", "");
    expect(star, `${where}: unfilled *TOKEN* in "${s}"`).not.toMatch(/\*(NAME|HOME|SIR|PARLOR)\*/);
  }
  expect(v.title.trim(), `${where}: empty title`).not.toBe("");
  for (const b of v.buttons)
    expect(b.label.trim(), `${where}: button ${b.id} has no label`).not.toBe("");
  if (!v.overlay && v.buttons.length > 0 && !v.map && !v.news)
    expect(richTextToPlain(v.text).trim(), `${where}: ${v.title} shows no text`).not.toBe("");
}

const PLACES = ["graveyard", "church", "city-hall", "hospital", "reaper-club", "bank"];
const AMOUNTS = ["500", "2000", "0", "abc", "8", "2"];

describe("the town plays with this pack", { timeout: 600_000 }, () => {
  it("core's town walker: every invariant, every enabled button accepted, across seeds", () => {
    for (const seed of [4, 9]) {
      const { town } = makeXTown(seed * 13, 4, { ctx });
      const r = townWalk(town, ctx, {
        seed,
        days: 8,
        players: 4,
        exercise: true,
        cap: 220,
        setup: (t) => {
          for (const p of t.players) {
            p.money = 300_000;
            p.tags = [60, 20, 20];
            p.bp = 2000;
            p.karma = [90, 10, 50, 25][p.id] ?? 50;
            p.plots = 200;
          }
        },
      });
      expect(r.rejected, r.rejected.slice(0, 5).join("\n")).toEqual([]);
      expect(r.actions).toBeGreaterThan(1000);
    }
  });

  it("a walker visiting every place for a whole season: no unfilled placeholder, no empty text", () => {
    let { town } = makeXTown(77, 4, { ctx });
    town = edit(town, (t) => {
      for (const p of t.players) {
        p.money = 250_000;
        p.tags = [60, 10, 10];
        p.bp = 1500;
        p.karma = [95, 5, 50, 28][p.id] ?? 50;
        p.plots = 120;
      }
    });
    const seenTitles = new Set<string>();
    const seenNews = new Set<string>();
    const seenArcs = new Set<string>();
    const used = new Set<string>();
    let views = 0;
    for (let d = 0; d < 29; d++) {
      const rand = policyRng(d * 31 + 7);
      for (let id = 0; id < 4; id++) {
        let r = enterGame(town, id, ctx);
        town = r.town;
        let view = r.view;
        let place = 0;
        for (let n = 0; n < 160; n++) {
          checkView(view, `day ${town.day} player ${id}`);
          views++;
          seenTitles.add(view.title);
          const action = choose(
            view,
            rand,
            id + n + d,
            () => PLACES[place++ % PLACES.length] ?? "bank",
          );
          r = step(town, id, action, ctx);
          if (r.rejected) throw new Error(`${JSON.stringify(action)} rejected: ${r.rejected}`);
          if (action.type === "press") used.add(action.buttonId.split(":").slice(0, 2).join(":"));
          town = r.town;
          view = r.view;
          if (action.type === "exit" || !town.sessions[String(id)]) break;
        }
        if (town.sessions[String(id)]) town = step(town, id, { type: "exit" }, ctx).town;
      }
      town = runDailyMaintenance(town, ctx).town;
      const page = town.news[String(town.day)];
      for (const part of [page?.front ?? "", page?.crime ?? ""]) {
        expect(part, `day ${town.day} newspaper`).not.toMatch(UNFILLED);
      }
      const today = town.expanded?.life?.today.news;
      if (today) seenNews.add(today);
      const running = town.expanded?.life?.arc?.id;
      if (running) seenArcs.add(running);
      // Every mail waiting for a player is filled in.
      for (const p of town.players) {
        for (const m of (p as unknown as { mail?: { text?: string }[] }).mail ?? [])
          expect(m.text ?? "").not.toMatch(UNFILLED);
      }
    }
    for (const title of [
      T.text.graveyard.title,
      T.text.church.title,
      T.text.cityHall.title,
      T.text.hospital.title,
      T.text.club.title,
    ])
      expect(seenTitles.has(title), title).toBe(true);
    for (const k of [
      "graveyard:tend",
      "graveyard:rob",
      "graveyard:look",
      "church:bingo",
      "church:confess",
      "city-hall:permits",
      "city-hall:ordinance",
      "reaper-club:games",
      "reaper-club:market",
      "bank:savings",
    ])
      expect(used.has(k), k).toBe(true);
    expect(seenNews.size).toBeGreaterThan(8);
    // Arcs started on their own, played out, and the walk read every beat's front page.
    expect(seenArcs.size).toBeGreaterThanOrEqual(2);
    expect(town.expanded?.life?.arcsDone.length).toBeGreaterThanOrEqual(2);
    expect(views).toBeGreaterThan(3000);
  });
});

function choose(view: View, rand: () => number, salt: number, nextPlace: () => string): Action {
  const pick = <X>(xs: readonly X[]): X => xs[Math.floor(rand() * xs.length)] as X;
  const o = view.overlay;
  if (o) {
    if (o.kind === "message") return { type: "dismiss", overlayId: o.id };
    if (o.kind === "confirm") return { type: "confirm", overlayId: o.id, accepted: rand() < 0.6 };
    if (o.kind === "textInput") {
      const text = o.id === "city-hall:chainname" ? `Stiff ${salt}` : pick(AMOUNTS);
      return { type: "submitText", overlayId: o.id, text: text.slice(0, o.maxLength) };
    }
    return {
      type: "pickPlayer",
      overlayId: o.id,
      playerId: o.players.length === 0 ? null : pick(o.players).id,
    };
  }
  if (view.map && view.map.length > 0) {
    if (rand() < 0.15) return { type: "visit", placeId: "funeral-home" };
    return { type: "visit", placeId: nextPlace() };
  }
  const ids = view.buttons.filter((b) => b.enabled !== false).map((b) => b.id);
  if (ids.length === 0) return { type: "exit" };
  if (ids.includes("neg:done") && rand() < 0.3) return { type: "press", buttonId: "neg:done" };
  if (ids.includes("desk:wait")) {
    if (rand() < 0.45) return { type: "press", buttonId: "desk:wait" };
    return { type: "press", buttonId: "go:map" };
  }
  const stay = ids.filter((id) => id !== "go:map" && id !== "desk:quit");
  if (stay.length > 0 && rand() < 0.85) return { type: "press", buttonId: pick(stay) };
  return { type: "press", buttonId: pick(ids) };
}

// ---------------------------------------------------------------------------------------------
// Story arcs, each to each ending
// ---------------------------------------------------------------------------------------------

describe("every story arc reaches every ending", { timeout: 300_000 }, () => {
  for (const def of T.arcs) {
    const { paths } = arcPaths(def);
    for (const path of paths) {
      const last = path.at(-1) as ArcBeatDef;
      it(`${def.id} -> ${last.ending} (${path.map((b) => b.id).join(" > ")})`, () => {
        const town = playToEnding(def, path);
        expect(town.expanded?.life?.arcsDone.at(-1)).toEqual({ id: def.id, ending: last.ending });
        expect(town.expanded?.life?.arc).toBeNull();
        if ((last.modifiers ?? []).length > 0) {
          const live = (town.expanded?.modifiers ?? []).filter(
            (m) => m.source === `arc:${def.id}:${last.id}`,
          );
          expect(live.length).toBe(last.modifiers?.length);
        }
      });
    }
  }

  it("every appeal is offered at its place, takes the money and says thanks", () => {
    for (const def of T.arcs) {
      for (const b of def.beats) {
        const appeals = b.appeals ?? [];
        if (appeals.length === 0) continue;
        let town = xtown(2);
        const turn = new Turn(town, ctx, -1);
        startArc(turn, def);
        turn.commit();
        town = edit(turn.town, (t) => {
          const s = t.expanded?.life?.arc;
          if (s) s.beat = b.id;
        });
        for (const place of new Set(appeals.map((a) => a.place))) {
          let s = visit(seat(town, ctx, 0), place);
          if (place === "reaper-club" && s.view.buttons.some((x) => x.id === "reaper-club:pay"))
            s = press(s, "reaper-club:pay");
          const here = appeals.filter((a) => a.place === place);
          here.forEach((a, n) => {
            const before = s.town.players[0]?.money ?? 0;
            s = press(s, `arc:give:${place}:${n}`);
            expect(s.town.players[0]?.money, `${def.id}.${b.id} ${a.label}`).toBe(
              before - a.amount,
            );
            const shown = richTextToPlain(s.view.text);
            expect(shown).not.toMatch(UNFILLED);
            expect(shown).toContain(a.amount.toLocaleString("en-US"));
          });
          town = step(s.town, 0, { type: "exit" }, ctx).town;
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// The ordinance ballot
// ---------------------------------------------------------------------------------------------

describe("the weekly ballot with this pack's ordinances", () => {
  it("opens with three of ours, is voted, passes, and its rules hold for the week", () => {
    let town = xtown(3, 41);
    town = edit(town, (t) => {
      t.day = 0;
    });
    town = midnight(town, ctx);
    const ballot = town.expanded?.life?.ballot;
    expect(ballot?.options.length).toBe(3);
    const ids = new Set(T.ordinances.map((o) => o.id));
    for (const o of ballot?.options ?? []) expect(ids.has(o)).toBe(true);
    const [a, b] = ballot?.options ?? [];
    for (const [id, choice] of [
      [0, b],
      [1, b],
      [2, a],
    ] as const) {
      let s = visit(seat(town, ctx, id), "city-hall");
      s = press(s, "city-hall:ordinance");
      checkView(s.view, "ballot");
      const shown = richTextToPlain(s.view.text);
      const def = T.ordinances.find((o) => o.id === choice);
      expect(shown).toContain(def?.title);
      s = press(s, `city-hall:vote:${choice}`);
      town = step(s.town, id, { type: "exit" }, ctx).town;
    }
    const closes = ballot?.closes ?? 7;
    town = midnight(town, ctx, closes + 1 - town.day);
    const passed = T.ordinances.find((o) => o.id === b);
    expect(town.expanded?.life?.ordinance?.id).toBe(b);
    expect(frontPage(town)).toContain(`NEW ORDINANCE: ${passed?.title}`);
    expect(frontPage(town)).not.toMatch(UNFILLED);
    for (const m of passed?.modifiers ?? []) {
      const live = liveModifiers(town, m.key).filter((x) => x.source === `ordinance:${b}`);
      expect(live.length, m.key).toBe(1);
      expect(live[0]?.untilDay).toBe(town.day + 6);
    }
    const desk = seat(town, ctx, 0);
    expect(desk.view.town?.ordinance?.title).toBe(passed?.title);
    checkView(desk.view, "desk with an ordinance");
  });

  it("every ordinance, passed, shows its title and effect on the desk with no unfilled text", () => {
    for (const o of T.ordinances) {
      let town = xtown(1, 5);
      town = edit(town, (t) => {
        const life = t.expanded?.life;
        if (life) life.ordinance = { id: o.id, from: t.day, until: t.day + 6 };
      });
      let s = visit(seat(town, ctx, 0), "city-hall");
      s = press(s, "city-hall:ordinance");
      checkView(s.view, o.id);
      expect(richTextToPlain(s.view.text)).toContain(o.title);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// Injuries by cause
// ---------------------------------------------------------------------------------------------

describe("injuries by cause with this pack", () => {
  const CAUSES = ["duel", "fight", "rob", "roulette", "hit"] as const;

  it("each cause draws only injuries tagged for it, and draws every one of them", () => {
    const town = xtown(1, 3);
    for (const cause of CAUSES) {
      const tagged = T.injuries.filter((i) => i.causes?.includes(cause)).map((i) => i.id);
      expect(tagged.length, cause).toBeGreaterThanOrEqual(3);
      const seen = new Set<string>();
      const turn = new Turn(town, ctx, -1);
      for (let n = 0; n < 600; n++) seen.add(chooseInjury(turn, cause) ?? "");
      for (const id of seen) expect(tagged, `${cause} drew ${id}`).toContain(id);
      expect(seen.size, `${cause} should reach all of ${tagged.join(", ")}`).toBe(tagged.length);
    }
  });

  it("every injury is reachable by some cause and its text is whole", () => {
    const reachable = new Set(T.injuries.flatMap((i) => i.causes ?? []));
    expect(reachable.size).toBe(CAUSES.length);
    for (const i of T.injuries) {
      expect(i.causes?.length ?? 0, `${i.id} names no cause, so it never happens`).toBeGreaterThan(
        0,
      );
      expect(i.text.trim(), i.id).not.toBe("");
      expect(i.text, i.id).not.toMatch(UNFILLED);
    }
    // A hit man's injuries must not be a lily rash.
    const hit = T.injuries.filter((i) => i.causes?.includes("hit")).map((i) => i.id);
    expect(hit).not.toContain("lily-rash");
  });
});
