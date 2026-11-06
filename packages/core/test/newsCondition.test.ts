/**
 * Section 22.5: news stories and front-page blurbs that remember how a story
 * arc ended, or need a mayor (`when`). Expanded only; Classic ignores `when`.
 */
import { describe, expect, it } from "vitest";
import { rollNews } from "../src/expanded/town/world.js";
import {
  CLASSIC_RULES,
  type ContentPack,
  checkExpandedContent,
  checkNewsCondition,
  classicContext,
  createTown,
  EXPANDED,
  EXPANDED_RULES,
  expandedContext,
  newsConditionMet,
  runDailyMaintenance,
  TOWN_STARTER,
  TOWN_STREAM,
  type TownState,
  Turn,
  townLife,
} from "../src/index.js";
import { xcontext } from "./support/expanded.js";
import { legacyContent } from "./support/legacyContent.js";
import { edit, frontPage, xtown } from "./support/xtown.js";

function withEnding(town: TownState, id: string, ending: string): TownState {
  return edit(town, (t) => {
    townLife(t).arcsDone.push({ id, ending });
  });
}

describe("22.5 news conditions", () => {
  it("newsConditionMet reads arc endings and the mayor", () => {
    let { town } = xtown();
    expect(newsConditionMet(town, undefined)).toBe(true);
    expect(newsConditionMet(town, {})).toBe(true);
    expect(newsConditionMet(town, { arcs: [{ id: "steeple" }] })).toBe(false);
    expect(newsConditionMet(town, { notArcs: ["steeple"] })).toBe(true);
    expect(newsConditionMet(town, { mayor: false })).toBe(true);
    expect(newsConditionMet(town, { mayor: true })).toBe(false);
    town = withEnding(town, "steeple", "paved");
    expect(newsConditionMet(town, { arcs: [{ id: "steeple" }] })).toBe(true);
    expect(newsConditionMet(town, { arcs: [{ id: "steeple", endings: ["rebuilt"] }] })).toBe(false);
    expect(
      newsConditionMet(town, { arcs: [{ id: "steeple", endings: ["rebuilt", "paved"] }] }),
    ).toBe(true);
    expect(newsConditionMet(town, { notArcs: ["steeple"] })).toBe(false);
    town = edit(town, (t) => {
      townLife(t).election.mayor = 1;
    });
    expect(newsConditionMet(town, { mayor: true })).toBe(true);
    expect(newsConditionMet(town, { mayor: true, arcs: [{ id: "cough" }] })).toBe(false);
    // A mayor who left town no longer counts.
    town = edit(town, (t) => {
      const p = t.players[1];
      if (p) p.active = false;
    });
    expect(newsConditionMet(town, { mayor: true })).toBe(false);
  });

  it("a story waits for its arc's ending (the starter's steeple stories)", () => {
    const ctx = xcontext();
    const seen = (town: TownState): Set<string> => {
      const out = new Set<string>();
      for (let k = 0; k < 400; k++) {
        const t = edit(town, (x) => {
          x.seed = (k * 7919 + 13) >>> 0;
          x.streams = {};
          x.day = 6;
        });
        const news = rollNews(new Turn(t, ctx, TOWN_STREAM));
        if (news) out.add(news.id);
      }
      return out;
    };
    const { town } = xtown();
    const before = seen(town);
    expect(before.has("steeple-bells")).toBe(false);
    expect(before.has("garage-opens")).toBe(false);
    expect(before.has("mayor-ribbon")).toBe(false);
    expect(before.has("small-quake")).toBe(true);
    const rebuilt = seen(withEnding(town, "steeple", "rebuilt"));
    expect(rebuilt.has("steeple-bells")).toBe(true);
    expect(rebuilt.has("garage-opens")).toBe(false);
    const paved = seen(withEnding(town, "steeple", "paved"));
    expect(paved.has("garage-opens")).toBe(true);
    expect(paved.has("steeple-bells")).toBe(false);
    const mayor = seen(
      edit(town, (t) => {
        townLife(t).election.mayor = 0;
      }),
    );
    expect(mayor.has("mayor-ribbon")).toBe(true);
  });

  it("{mayor} in a story is filled on the front page", () => {
    const ctx = xcontext();
    const { town } = xtown();
    const t = edit(town, (x) => {
      townLife(x).election.mayor = 0;
    });
    const turn = new Turn(t, ctx, TOWN_STREAM);
    const def = TOWN_STARTER.news.find((n) => n.id === "mayor-ribbon");
    expect(def).toBeDefined();
    if (!def) return;
    // applyNews is what the midnight calls after rollNews.
    return import("../src/expanded/town/world.js").then(({ applyNews }) => {
      applyNews(turn, def);
      turn.commit();
      const name = t.players[0]?.name ?? "";
      expect(frontPage(turn.town)).toContain(`${name} OPENS NEW BENCH`);
      expect(frontPage(turn.town)).not.toContain("{mayor}");
    });
  });

  it("a front-page blurb with `when` runs only when it holds; Classic ignores `when`", () => {
    const base = legacyContent();
    // Day 2's blurbs replaced by one blurb that needs a mayor.
    const pack: ContentPack = {
      ...base,
      id: "when-test",
      newsBlurbs: {
        ranges: [
          {
            low: -999,
            high: 999,
            entries: [{ title: "THE MAYOR WAVES", message: "Waving.", when: { mayor: true } }],
          },
        ],
      },
    };
    const xctx = expandedContext(pack, { now: 1_000_000 });
    let x = createTown({ seed: 5 }, xctx).town;
    x = runDailyMaintenance(x, xctx).town;
    expect(frontPage(x)).not.toContain("THE MAYOR WAVES");
    const cctx = classicContext(pack, { now: 1_000_000, rules: CLASSIC_RULES });
    let c = createTown({ seed: 5 }, cctx).town;
    c = runDailyMaintenance(c, cctx).town;
    expect(frontPage(c)).toContain("THE MAYOR WAVES");
  });

  it("a blurb that needs a mayor runs once there is one", () => {
    const base = legacyContent();
    const pack: ContentPack = {
      ...base,
      id: "when-test-2",
      newsBlurbs: {
        ranges: [
          {
            low: -999,
            high: 999,
            entries: [{ title: "THE MAYOR WAVES", message: "Waving.", when: { mayor: true } }],
          },
        ],
      },
    };
    const ctx = expandedContext(pack, { now: 1_000_000 });
    const { town } = xtown();
    const t = edit(town, (x) => {
      townLife(x).election.mayor = 0;
    });
    const after = runDailyMaintenance(t, ctx).town;
    expect(frontPage(after)).toContain("THE MAYOR WAVES");
  });

  it("the content check names unknown arcs and endings", () => {
    expect(
      checkExpandedContent({ ...EXPANDED_RULES_CONTENT(), town: TOWN_STARTER }, EXPANDED),
    ).toEqual([]);
    const bad = checkNewsCondition(TOWN_STARTER, "blurb", {
      arcs: [{ id: "steeple", endings: ["melted"] }, { id: "nope" }],
      notArcs: ["also-nope"],
    });
    expect(bad).toEqual([
      "blurb: arc steeple has no ending melted",
      "blurb: when names unknown arc nope",
      "blurb: when names unknown arc also-nope",
    ]);
    expect(
      checkNewsCondition(TOWN_STARTER, "ok", { arcs: [{ id: "cough", endings: ["fled"] }] }),
    ).toEqual([]);
  });
});

function EXPANDED_RULES_CONTENT() {
  const c = expandedContext(legacyContent(), { rules: EXPANDED_RULES }).content.expanded;
  if (!c) throw new Error("no expanded content");
  return c;
}
