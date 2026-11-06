/**
 * News that remembers the story arcs (docs/expanded-rules.md 22.5), in the Expanded pack: the lint
 * rules for `when` (each with a planted violation), and the engine: every arc is driven to every
 * one of its endings, and the follow-up stories gated on that ending can then appear, while those
 * gated on its other endings cannot.
 */
import {
  type ArcBeatDef,
  type ContentPack,
  type EngineContext,
  type ExpandedTownContent,
  expandedContext,
  type NewsEventDef,
  runDailyMaintenance,
  TOWN_STREAM,
  type TownState,
  Turn,
  townLife,
} from "@fq/core";
import { describe, expect, it } from "vitest";
import { applyNews, rollNews } from "../../core/src/expanded/town/world.js";
import { makeXTown } from "../../core/test/support/expanded.js";
import { edit, frontPage } from "../../core/test/support/xtown.js";
import { classicPack, expandedPack, formatIssue, lintPack } from "../src/index.js";
import { arcPaths, endingDays, newsConditionDay } from "../src/townLint.js";
import { ctx, playToEnding } from "./arcPlay.js";
import { expandedIds } from "./support.js";

const T = (() => {
  const t = expandedPack.expanded?.town;
  if (!t) throw new Error("no town");
  return t;
})();

function lint(p: ContentPack): string[] {
  return lintPack(p, { base: classicPack, assetIds: expandedIds }).map(formatIssue);
}
function planted(edit: (t: ExpandedTownContent, p: ContentPack) => void): string[] {
  const p = structuredClone(expandedPack);
  const t = p.expanded?.town;
  if (!t) throw new Error("no town");
  edit(t, p);
  return lint(p);
}
function story(t: ExpandedTownContent, id: string): NewsEventDef {
  const n = t.news.find((x) => x.id === id);
  if (!n) throw new Error(id);
  return n;
}
function hasIssue(out: string[], re: RegExp): void {
  expect(out, `expected ${re}`).toContainEqual(expect.stringMatching(re));
}

describe("the lint for `when`", () => {
  it("passes the pack", () => {
    expect(lint(expandedPack)).toEqual([]);
  });

  it("names an arc that does not exist, in a story and in a blurb", () => {
    hasIssue(
      planted((t) => {
        story(t, "steeple-tourists").when = { arcs: [{ id: "spire" }] };
      }),
      /news\.yaml: \[\d+\]\.when.*unknown arc spire/,
    );
    hasIssue(
      planted((t) => {
        story(t, "steeple-tourists").when = { notArcs: ["spire"] };
      }),
      /news\.yaml: \[\d+\]\.when.*unknown arc spire/,
    );
    hasIssue(
      planted((_, p) => {
        const e = p.newsBlurbs.ranges[1]?.entries.at(-1);
        if (e) e.when = { arcs: [{ id: "spire" }] };
      }),
      /news_blurbs\.yaml: .*when.*unknown arc spire/,
    );
  });

  it("names an ending that does not exist, in a story and in a blurb", () => {
    hasIssue(
      planted((t) => {
        story(t, "steeple-tourists").when = { arcs: [{ id: "steeple", endings: ["melted"] }] };
      }),
      /news\.yaml: \[\d+\]\.when.*arc steeple has no ending melted/,
    );
    hasIssue(
      planted((_, p) => {
        const e = p.newsBlurbs.ranges[1]?.entries.at(-1);
        if (e) e.when = { arcs: [{ id: "steeple", endings: ["melted"] }] };
      }),
      /news_blurbs\.yaml: .*when.*arc steeple has no ending melted/,
    );
  });

  it("a story gated on an ending cannot start before that ending can be recorded", () => {
    // The steeple starts on day 4 at the earliest and takes 6 days to either ending: day 10.
    expect(endingDays(T.arcs.find((a) => a.id === "steeple") as never).get("rebuilt")).toEqual({
      first: 10,
      last: 18,
    });
    hasIssue(
      planted((t) => {
        story(t, "steeple-tourists").minDay = 9;
      }),
      /news\.yaml: \[\d+\]\.when.*minDay 9 is before day 10/,
    );
    hasIssue(
      planted((t) => {
        delete story(t, "steeple-tourists").minDay;
      }),
      /news\.yaml: \[\d+\]\.when.*minDay 0 is before day 10/,
    );
    // A story that waits for two arcs waits for the later one.
    hasIssue(
      planted((t) => {
        const n = story(t, "steeple-tourists");
        n.when = { arcs: [{ id: "steeple" }, { id: "lake" }] };
        n.minDay = 12;
      }),
      /news\.yaml: \[\d+\]\.when.*minDay 12 is before day 21/,
    );
  });

  it("a blurb gated on an ending needs a range that reaches the day after it", () => {
    hasIssue(
      planted((_, p) => {
        // Day 21 is the first day the lake monster's ending can be recorded; the middle range
        // (days 8 to 22) reaches day 22, the early one (to day 7) cannot.
        const e = p.newsBlurbs.ranges[2]?.entries.at(-1);
        const early = p.newsBlurbs.ranges[0];
        if (e && early) early.entries.push({ ...e, title: "LAKE NEWS, TOO EARLY" });
      }),
      /news_blurbs\.yaml: .*when.*this range ends on day 7, before the first day \(\d+\)/,
    );
  });

  it("a story cannot name an arc in both arcs and notArcs, or list an arc twice", () => {
    hasIssue(
      planted((t) => {
        story(t, "steeple-tourists").when = { arcs: [{ id: "steeple" }], notArcs: ["steeple"] };
      }),
      /news\.yaml: \[\d+\]\.when.*both arcs and notArcs/,
    );
    hasIssue(
      planted((t) => {
        story(t, "steeple-tourists").when = {
          arcs: [
            { id: "steeple", endings: ["rebuilt"] },
            { id: "steeple", endings: ["paved"] },
          ],
        };
      }),
      /news\.yaml: \[\d+\]\.when.*listed twice/,
    );
  });

  it("a story that waits for an ending too late in the season can never run", () => {
    hasIssue(
      planted((t) => {
        const a = t.arcs.find((x) => x.id === "morty");
        const b = a?.beats.find((x) => x.id === "debate");
        if (a && b) {
          // Delay morty's debate so that its endings come on day 28 or later.
          b.after = 7;
          a.earliest = 22;
          a.latest = 22;
        }
        story(t, "morty-badge").minDay = 25;
      }),
      /news\.yaml: \[\d+\]\.when.*no news runs on the last day/,
    );
  });

  it("{mayor} is a placeholder of a story's title and message, not of a blurb", () => {
    expect(
      planted((t) => {
        story(t, "mayor-audit").title = "{mayor} AUDITED";
      }),
    ).toEqual([]);
    hasIssue(
      planted((_, p) => {
        const e = p.newsBlurbs.ranges[1]?.entries.at(-1);
        if (e) e.message = "{mayor} waves.";
      }),
      /news_blurbs\.yaml: .*placeholder \{mayor\}: this field takes none/,
    );
    // Lower-case words around it are still caught.
    hasIssue(
      planted((t) => {
        story(t, "mayor-audit").title = "{mayor} audited";
      }),
      /news\.yaml: \[\d+\]\.title.*capitals/,
    );
  });
});

// ---------------------------------------------------------------------------------------------
// The engine
// ---------------------------------------------------------------------------------------------

const arcStories = T.news.filter((n) => (n.when?.arcs ?? []).length > 0);
const arcBlurbs = expandedPack.newsBlurbs.ranges.flatMap((r) =>
  r.entries.filter((e) => e.when).map((e) => ({ range: r, entry: e })),
);

/** The stories `rollNews` can draw on `day` in `town`, over many seeds. */
function drawn(town: TownState, day: number, seeds = 500): Set<string> {
  const out = new Set<string>();
  for (let k = 0; k < seeds; k++) {
    const t = edit(town, (x) => {
      x.seed = (k * 7919 + 13) >>> 0;
      x.streams = {};
      x.day = day;
    });
    const news = rollNews(new Turn(t, ctx, TOWN_STREAM));
    if (news) out.add(news.id);
  }
  return out;
}

describe("the pack's follow-up news", () => {
  it("every ending of every arc has at least one follow-up (a story, or a blurb)", () => {
    for (const arc of T.arcs) {
      for (const ending of endingDays(arc).keys()) {
        const asStory = arcStories.filter((n) =>
          n.when?.arcs?.some((a) => a.id === arc.id && (a.endings ?? []).includes(ending)),
        ).length;
        const asBlurb = arcBlurbs.filter(({ entry }) =>
          entry.when?.arcs?.some((a) => a.id === arc.id && (a.endings ?? []).includes(ending)),
        ).length;
        expect(asStory + asBlurb, `${arc.id}/${ending}`).toBeGreaterThanOrEqual(1);
        expect(asStory, `${arc.id}/${ending} news story`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("every story and blurb in a condition starts after the arc can have ended", () => {
    for (const n of arcStories) {
      const { problems, first } = newsConditionDay(T, n.when ?? {});
      expect(problems, n.id).toEqual([]);
      expect(n.minDay ?? 0, n.id).toBeGreaterThanOrEqual(first);
    }
    for (const { range, entry } of arcBlurbs) {
      const { problems, first } = newsConditionDay(T, entry.when ?? {});
      expect(problems, entry.title).toEqual([]);
      expect(range.high, entry.title).toBeGreaterThanOrEqual(first + 1);
    }
  });

  it("a few stories wait for a mayor, or for none, and fill in {mayor}", () => {
    const withMayor = T.news.filter((n) => n.when?.mayor === true && /\{mayor\}/.test(n.title));
    const without = T.news.filter((n) => n.when?.mayor === false && /\{mayor\}/.test(n.title));
    expect(withMayor.length).toBeGreaterThanOrEqual(2);
    expect(without.length).toBeGreaterThanOrEqual(2);
    const { town } = { town: edit(makeXTown(31, 3, { ctx }).town, () => {}) };
    const elected = edit(town, (t) => {
      townLife(t).election.mayor = 0;
    });
    const seenElected = drawn(elected, 6);
    const seenNone = drawn(town, 6);
    for (const n of withMayor) {
      expect(seenElected.has(n.id), `${n.id} with a mayor`).toBe(true);
      expect(seenNone.has(n.id), `${n.id} without`).toBe(false);
    }
    for (const n of without) {
      expect(seenNone.has(n.id), `${n.id} without a mayor`).toBe(true);
      expect(seenElected.has(n.id), `${n.id} with one`).toBe(false);
    }
    // The front page names the mayor: the player's name when elected, the town's NPC otherwise.
    for (const [state, name] of [
      [elected, elected.players[0]?.name ?? ""],
      [town, T.cast.mayor],
    ] as const) {
      for (const n of [...withMayor, ...without]) {
        const turn = new Turn(
          edit(state, () => {}),
          ctx,
          TOWN_STREAM,
        );
        applyNews(turn, n);
        turn.commit();
        const page = frontPage(turn.town);
        expect(page, n.id).not.toContain("{mayor}");
        expect(page, n.id).toContain(name);
      }
    }
  });
});

describe("every arc ending brings its own follow-ups", { timeout: 300_000 }, () => {
  for (const def of T.arcs) {
    for (const path of arcPaths(def).paths) {
      const last = path.at(-1) as ArcBeatDef;
      const ending = last.ending ?? last.id;
      it(`${def.id} -> ${ending}`, () => {
        // The real arc, played to this ending (the branch tests forced), then the paper.
        const town = playToEnding(def, path);
        expect(townLife(town).arcsDone.at(-1)).toEqual({ id: def.id, ending });
        const mine = arcStories.filter((n) => n.when?.arcs?.some((a) => a.id === def.id));
        expect(mine.length, "stories for this arc").toBeGreaterThanOrEqual(1);
        const none = edit(town, (t) => {
          townLife(t).arcsDone = [];
        });
        for (const n of mine) {
          const day = Math.max(n.minDay ?? 0, 2);
          const wants = n.when?.arcs?.some(
            (a) => a.id === def.id && (a.endings === undefined || a.endings.includes(ending)),
          );
          expect(drawn(town, day).has(n.id), `${n.id} on day ${day} after '${ending}'`).toBe(
            !!wants,
          );
          // Never without the ending, and never before its minDay.
          expect(drawn(none, day).has(n.id), `${n.id} with no arc ended`).toBe(false);
          if ((n.minDay ?? 0) > 2)
            expect(drawn(town, (n.minDay ?? 0) - 1).has(n.id), `${n.id} before minDay`).toBe(false);
        }
      });
    }
  }

  it("blurbs wait for their ending too (the day's range holds only the blurb and a filler)", () => {
    for (const { range, entry } of arcBlurbs) {
      const arcId = entry.when?.arcs?.[0]?.id ?? "";
      const arc = T.arcs.find((a) => a.id === arcId);
      if (!arc) throw new Error(arcId);
      const wanted = entry.when?.arcs?.[0]?.endings ?? [];
      const { first } = newsConditionDay(T, entry.when ?? {});
      const day = Math.min(Math.max(range.low, first + 1), range.high, 29);
      const pack: ContentPack = {
        ...expandedPack,
        id: "blurb-test",
        newsBlurbs: {
          ranges: [
            {
              low: range.low,
              high: range.high,
              entries: [{ title: "FILLER", message: "Nothing happened." }, entry],
            },
          ],
        },
      };
      const bctx: EngineContext = expandedContext(pack, { now: 1_000_000 });
      const base = makeXTown(31, 2, { ctx: bctx }).town;
      const appears = (ending: string | null): boolean => {
        for (let seed = 1; seed <= 24; seed++) {
          const t = edit(base, (x) => {
            x.seed = seed * 101;
            x.streams = {};
            x.day = day - 1;
            townLife(x).arcsDone = ending === null ? [] : [{ id: arcId, ending }];
          });
          const after = runDailyMaintenance(t, bctx).town;
          if (frontPage(after, day).includes(entry.title ?? "?")) return true;
        }
        return false;
      };
      for (const ending of endingDays(arc).keys()) {
        expect(appears(ending), `${entry.title} after '${ending}'`).toBe(wanted.includes(ending));
      }
      expect(appears(null), `${entry.title} with no arc ended`).toBe(false);
    }
  });
});
