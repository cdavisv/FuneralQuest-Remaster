// biome-ignore-all lint/suspicious/noTemplateCurlyInString: "${price}" in planted lines is a dollar sign before a {price} placeholder.
/**
 * The Expanded pack's town (`expanded.town`, docs/expanded-rules.md section 25): its schema in
 * both modes, every town lint rule (each with a planted violation), and the volume targets.
 */
import {
  type ContentPack,
  EXPANDED,
  type ExpandedTownContent,
  type StoryArcDef,
  TOWN_STARTER,
} from "@fq/core";
import { describe, expect, it } from "vitest";
import {
  checkPack,
  classicPack,
  expandedPack,
  formatIssue,
  lintPack,
  strictExpandedSchema,
} from "../src/index.js";
import {
  arcPaths,
  ENGINE_MODIFIER_KEYS,
  MODIFIER_LIMITS,
  pathDays,
  TOWN_TEXT_TOKENS,
} from "../src/townLint.js";
import { assetIds, expandedIds } from "./support.js";

function town(p: ContentPack = expandedPack): ExpandedTownContent {
  const t = p.expanded?.town;
  if (!t) throw new Error("The Expanded pack has no town");
  return t;
}
function withTown(edit: (t: ExpandedTownContent) => void): ContentPack {
  const p = structuredClone(expandedPack);
  edit(town(p));
  return p;
}
function lint(p: ContentPack): string[] {
  return lintPack(p, { base: classicPack, assetIds: expandedIds }).map(formatIssue);
}
/** The lint finds `re` in the planted pack, and the clean pack does not have it. */
function catches(edit: (t: ExpandedTownContent) => void, re: RegExp): void {
  const out = lint(withTown(edit));
  expect(out, `expected ${re}`).toContainEqual(expect.stringMatching(re));
}
/** The lint's messages for a pack whose town was edited by `edit`. */
function catchesAmount(edit: (t: ExpandedTownContent) => void): string[] {
  return lint(withTown(edit));
}
function arc(t: ExpandedTownContent, id: string): StoryArcDef {
  const a = t.arcs.find((x) => x.id === id);
  if (!a) throw new Error(id);
  return a;
}
function beat(t: ExpandedTownContent, arcId: string, beatId: string) {
  const b = arc(t, arcId).beats.find((x) => x.id === beatId);
  if (!b) throw new Error(beatId);
  return b;
}

const T = town();

describe("the town schema", () => {
  it("the built pack's town passes the strict schema, the manifest and the lint", () => {
    expect(strictExpandedSchema.safeParse(expandedPack.expanded).success).toBe(true);
    expect(checkPack(expandedPack, { assetIds: expandedIds, strictExpanded: true })).toEqual([]);
    expect(lint(expandedPack)).toEqual([]);
  });

  it("the core starter fits the schema too (the shapes agree with townTypes.ts)", () => {
    const p = structuredClone(expandedPack);
    if (p.expanded) p.expanded.town = structuredClone(TOWN_STARTER);
    expect(checkPack(p, { assetIds: expandedIds, strictExpanded: true })).toEqual([]);
  });

  it("strict mode rejects a misspelt town field; loose mode lets it through", () => {
    const p = withTown((t) => {
      (t.news[0] as unknown as Record<string, unknown>).headline = "TYPO";
      (t.text.church as unknown as Record<string, unknown>).greetings = ["x"];
    });
    const strict = checkPack(p, { strictExpanded: true }).map(formatIssue);
    expect(strict).toContainEqual(
      expect.stringMatching(/town\.news\[0\].*unknown field 'headline'/),
    );
    expect(strict).toContainEqual(expect.stringMatching(/town\.text\.church.*'greetings'/));
    expect(checkPack(p, {})).toEqual([]);
  });

  it("rejects wrong shapes: a bad op, a test kind, a grant, a missing text, an empty pool", () => {
    const p = withTown((t) => {
      (t.news[0]?.modifiers[0] as { op: string }).op = "pow";
      const b = beat(t, "steeple", "bids");
      (b.next as { test: { kind: string } }).test.kind = "coinFlip";
      (t.market[0] as { grant?: string }).grant = "jetpack";
      delete (t.text.bank as unknown as Record<string, unknown>).repaid;
      t.text.club.inside = [];
      (t.pictures.club as { bg: string }).bg = "flash/Bar.swf";
    });
    const out = checkPack(p, { strictExpanded: true }).map(formatIssue);
    expect(out).toContainEqual(expect.stringMatching(/news\[0\]\.modifiers\[0\]\.op/));
    expect(out).toContainEqual(expect.stringMatching(/arcs\[0\]\.beats\[1\]\.next/));
    expect(out).toContainEqual(expect.stringMatching(/market\[0\]\.grant/));
    expect(out).toContainEqual(expect.stringMatching(/text\.bank\.repaid.*required/));
    expect(out).toContainEqual(expect.stringMatching(/text\.club\.inside.*at least one/));
    expect(out).toContainEqual(expect.stringMatching(/pictures\.club\.bg.*asset id/));
  });
});

describe("the town lint", () => {
  it("placeholders: only the ones the engine fills for that field", () => {
    catches((t) => {
      t.text.hospital.leadIntro = "`${bp} wants `w${price}`$.";
    }, /town\/text\/hospital\.yaml: leadIntro.*placeholder \{bp\}/);
    catches((t) => {
      t.text.church.greeting.push('`wFather Smyth: `y"Hello, {customer}."');
    }, /church\.yaml: greeting\[9\].*\{customer\}/);
    catches((t) => {
      if (t.news[0]) t.news[0].message = "The {player} felt nothing.";
    }, /town\/news\.yaml: \[0\]\.message.*\{player\} is not filled in here \(allowed: \{mayor\}\)/);
    catches((t) => {
      beat(t, "cough", "credit").headline = "{mayor} TAKES CREDIT";
    }, /arcs\.yaml: \[1\]\.beats\[4\]\.headline.*\{mayor\}/);
    catches((t) => {
      beat(t, "cough", "credit").story = "{player} takes credit.";
    }, /arcs\.yaml.*story.*\{player\} is not filled in here/);
    catches((t) => {
      t.text.club.door = "`$Cover's {cover tags.";
    }, /club\.yaml: door.*unbalanced brace/);
  });

  it("the engine now fills {nurse} in the lead offer, {rating} and {turns} in the election, {fee} in the loan", () => {
    const p = structuredClone(expandedPack);
    if (p.expanded) p.expanded.town = structuredClone(TOWN_STARTER);
    const out = lint(p).filter((m) => /leadIntro|electionFiling|loanIntro/.test(m));
    expect(out).toEqual([]);
  });

  it("a pack that names injury causes needs three injuries for each (the starter has fewer)", () => {
    const p = structuredClone(expandedPack);
    if (p.expanded) p.expanded.town = structuredClone(TOWN_STARTER);
    expect(lint(p)).toContainEqual(
      expect.stringMatching(/injuries\.yaml.*only 2 injuries name the cause 'duel'.*at least 3/),
    );
  });

  it("colour codes, lengths and banned terms apply to the town", () => {
    catches((t) => {
      t.text.graveyard.look.push("`zA ghost waves.");
    }, /graveyard\.yaml: look\[\d+\].*colour code/);
    catches((t) => {
      t.text.graveyard.buttons.rob = "Rob a Very Fresh and Extremely Expensive Grave";
    }, /graveyard\.yaml: buttons\.rob.*too long/);
    catches((t) => {
      t.weather[0]?.morning.push("x".repeat(200));
    }, /weather\.yaml: \[0\]\.morning\[\d+\].*too long/);
    catches((t) => {
      if (t.market[1]) t.market[1].name = "Kevlar Vest";
    }, /market\.yaml: \[1\]\.name.*banned brand 'Kevlar'/);
  });

  it("no duplicate lines within a pool", () => {
    catches((t) => {
      t.text.church.tithed.push(t.text.church.tithed[0] ?? "");
    }, /church\.yaml: tithed\[\d+\].*duplicate line/);
    catches((t) => {
      t.weather[2]?.morning.push(t.weather[0]?.morning[0] ?? "");
    }, /weather\.yaml: \[2\]\.morning\[\d+\].*duplicate/);
  });

  it("pictures exist in the manifest and are scene art", () => {
    catches((t) => {
      t.pictures.graveyard.bg = "places/no-such-place";
    }, /pictures\.yaml: graveyard\.bg.*not in assets\/manifest\.json/);
    catches((t) => {
      t.pictures.duel.fg = "ui/battle-bars";
    }, /pictures\.yaml: duel\.fg.*interface art/);
  });

  it("pictures may come from either manifest, but not from the Classic one alone", () => {
    // The pack uses Remastered ids and passes with both manifests...
    expect(town().pictures.graveyard.bg).toBe("places/graveyard");
    expect(lint(expandedPack)).toEqual([]);
    // ...and not when only the Classic manifest is known.
    const classicOnly = lintPack(expandedPack, { base: classicPack, assetIds }).map(formatIssue);
    expect(classicOnly).toContainEqual(expect.stringMatching(/pictures\.yaml: graveyard\.bg/));
    expect(expandedIds.has("places/graveyard")).toBe(true);
    expect(assetIds.has("places/graveyard")).toBe(false);
    // The Classic pack may not use a Remastered id.
    const p = structuredClone(classicPack);
    const ev = p.events.ranges[0]?.entries[0];
    if (ev) ev.picture = "places/graveyard";
    expect(checkPack(p, { assetIds }).map(formatIssue)).toContainEqual(
      expect.stringMatching(/picture 'places\/graveyard' is not in assets\/manifest\.json/),
    );
  });

  it("every injury cause has at least three injuries, and causes are known and not repeated", () => {
    const named = (t: ExpandedTownContent, cause: string) =>
      t.injuries.filter((i) => (i.causes as string[] | undefined)?.includes(cause)).length;
    for (const cause of ["duel", "fight", "rob", "roulette", "hit"])
      expect(named(T, cause), cause).toBeGreaterThanOrEqual(3);
    catches((t) => {
      for (const i of t.injuries) if (i.causes) i.causes = i.causes.filter((c) => c !== "hit");
    }, /injuries\.yaml.*only 0 injuries name the cause 'hit'.*at least 3/);
    catches((t) => {
      for (const i of t.injuries.filter((x) => x.causes?.includes("roulette")).slice(1))
        if (i.causes) i.causes = i.causes.filter((c) => c !== "roulette");
    }, /only 1 injury name the cause 'roulette'/);
    catches((t) => {
      const i = t.injuries[0];
      if (i) i.causes = ["rob", "rob"];
    }, /injuries\.yaml: \[0\]\.causes.*listed twice/);
    catches((t) => {
      const i = t.injuries[0];
      if (i) (i as { causes?: string[] }).causes = ["nap"];
    }, /injuries\.yaml: \[0\]\.causes.*'nap' is not a cause/);
    const p = withTown((t) => {
      const i = t.injuries[0];
      if (i) (i as { causes?: string[] }).causes = ["nap"];
    });
    expect(checkPack(p, { strictExpanded: true }).map(formatIssue)).toContainEqual(
      expect.stringMatching(/injuries\[0\]\.causes/),
    );
  });

  it("typed percentages and dollar amounts are flagged where the engine fills a placeholder", () => {
    // The Peace Pledge text has {tax}: a typed 5% goes stale when the tax is tuned.
    const typed = (p: ContentPack, edit: (x: NonNullable<ContentPack["expanded"]>) => void) => {
      const q = structuredClone(p);
      if (q.expanded) edit(q.expanded);
      return lint(q);
    };
    expect(
      typed(expandedPack, (x) => {
        x.text.office.rivalryIntro = "Peace Pledge: 8% of every sale goes to insurance.";
      }),
    ).toContainEqual(
      expect.stringMatching(/office\.yaml: rivalryIntro.*typed amount '8%'.*\{tax\}/),
    );
    expect(
      typed(expandedPack, (x) => {
        x.text.office.rivalryHints.peaceful = "Safe, {tax}% on sales, 8 percent really";
      }),
    ).toContainEqual(expect.stringMatching(/rivalryHints\.peaceful.*typed amount '8 percent'/));
    // A dollar amount typed beside {price}; "${price}" itself is fine.
    expect(
      catchesAmount((t) => {
        t.text.cityHall.permitLine = "`w{name}`$ for `w$1,500`$: {description}";
      }),
    ).toContainEqual(
      expect.stringMatching(/cityHall\.yaml: permitLine.*typed amount '\$1,500'.*\{price\}/),
    );
    // Digits in a field without such a placeholder are left alone (Arson has {cost} but no percentage).
    expect(typed(expandedPack, () => {})).toEqual([]);
    expect(
      typed(expandedPack, (x) => {
        x.text.arson.offer = "A fire burns 5 percent for {cost} gold tags.";
      }).filter((m) => /typed amount/.test(m)),
    ).toEqual([]);
    // The election text uses {rating} and {turns}, not typed numbers.
    expect(
      catchesAmount((t) => {
        t.text.bank.loanIntro = "Up to `w${limit}`$ at `w{rate}%`$, 3% up front, for {days} days.";
      }),
    ).toContainEqual(expect.stringMatching(/bank\.yaml: loanIntro.*typed amount '3%'/));
  });

  it("a sales test over an arc is measured in tens of sales, a walkouts test in a few", () => {
    catches((t) => {
      beat(t, "dimart", "clipboard").next = {
        test: { kind: "sales", perPlayer: 2 },
        ifTrue: "saved",
        ifFalse: "closed",
      };
    }, /arcs\.yaml.*next\.test.*sales perPlayer from 5 to 120/);
  });

  it("modifier keys exist, with their own op, inside their ranges", () => {
    catches((t) => {
      t.news[0]?.modifiers.push({ key: "customer.happiness", op: "add", value: 1 });
    }, /news\.yaml.*customer\.happiness/);
    catches((t) => {
      t.ordinances[0]?.modifiers.splice(0, 1, { key: "turns.daily", op: "mul", value: 2 });
    }, /ordinances\.yaml: \[0\]\.modifiers\[0\]\.op.*add key/);
    catches((t) => {
      t.news[0]?.modifiers.splice(0, 1, { key: "turns.daily", op: "add", value: 5 });
    }, /news\.yaml: \[0\]\.modifiers\[0\]\.value.*outside -1 to 2/);
    catches((t) => {
      beat(t, "steeple", "rebuilt").modifiers = [{ key: "sale.bpMult", op: "mul", value: 2 }];
    }, /arcs\.yaml: \[0\]\.beats\[2\]\.modifiers\[0\]\.value/);
    catches((t) => {
      t.news[0]?.modifiers.push({
        ...(t.news[0]?.modifiers[0] ?? { key: "", op: "add", value: 0 }),
      });
    }, /news\.yaml: \[0\]\.modifiers.*given twice/);
  });

  it("the table of limits lists exactly the keys the engine reads", () => {
    expect(Object.keys(MODIFIER_LIMITS).sort()).toEqual([...ENGINE_MODIFIER_KEYS].sort());
  });

  it("midnight keys need a story that lasts into the night; weather stays small", () => {
    catches((t) => {
      const n = t.news.find((x) => x.id === "bank-rates");
      if (n) delete n.days;
    }, /news\.yaml: \[\d+\]\.days.*read at midnight/);
    catches((t) => {
      t.weather[1]?.modifiers.push({ key: "turns.daily", op: "add", value: 1 });
    }, /weather\.yaml: \[1\]\.modifiers\[\d+\]\.key.*weather is small/);
    catches((t) => {
      t.weather[0]?.modifiers.push({ key: "customer.mood", op: "add", value: 0.1 });
    }, /weather\.yaml: \[0\]\.effect.*no effect/);
  });

  it("news: capitals, ranges, one to three rules, not a Classic headline", () => {
    catches((t) => {
      if (t.news[1]) t.news[1].title = "Quiet Day";
    }, /news\.yaml: \[1\]\.title.*capitals/);
    catches((t) => {
      if (t.news[1]) t.news[1].title = "DEATH WITH DIGNITY";
    }, /news\.yaml: \[1\]\.title.*Classic-format news blurb/);
    catches((t) => {
      if (t.news[1]) t.news[1].days = 9;
    }, /news\.yaml: \[1\]\.days/);
    catches((t) => {
      if (t.news[1]) t.news[1].modifiers = [];
    }, /news\.yaml: \[1\]\.modifiers.*1 to 3 rules/);
  });

  it("arcs: every target exists, every beat is reachable, no loops", () => {
    catches((t) => {
      const b = beat(t, "steeple", "bids");
      if (typeof b.next === "object") b.next.ifFalse = "nowhere";
    }, /arcs\.yaml: \[0\]\.beats\[1\]\.next.*no beat 'nowhere'/);
    catches((t) => {
      arc(t, "steeple").beats.push({
        id: "orphan",
        headline: "NOBODY READS THIS",
        story: "Nothing.",
        ending: "orphan",
      });
    }, /arcs\.yaml: \[0\]\.beats\[4\].*never be reached/);
    catches((t) => {
      const b = beat(t, "steeple", "bids");
      if (typeof b.next === "object") b.next.ifTrue = "crack";
    }, /arcs\.yaml: \[0\]\.beats.*loop \(crack -> bids -> crack\)/);
    catches((t) => {
      arc(t, "steeple").start = "nope";
    }, /arcs\.yaml: \[0\]\.start.*no beat 'nope'/);
  });

  it("arcs: endings, day offsets, length inside the season", () => {
    catches((t) => {
      delete beat(t, "steeple", "paved").ending;
    }, /arcs\.yaml: \[0\]\.beats\[3\].*needs an ending/);
    catches((t) => {
      beat(t, "steeple", "paved").ending = "rebuilt";
    }, /arcs\.yaml: \[0\].*at least two endings/);
    catches((t) => {
      beat(t, "steeple", "crack").after = 0;
    }, /arcs\.yaml: \[0\]\.beats\[0\]\.after.*later than the one before/);
    catches((t) => {
      beat(t, "steeple", "crack").after = 1;
      beat(t, "steeple", "bids").after = 1;
    }, /arcs\.yaml: \[0\]\.beats\[\d\].*takes 2 days/);
    catches((t) => {
      arc(t, "steeple").latest = 28;
    }, /arcs\.yaml: \[0\].*runs past the season's last day/);
    catches((t) => {
      beat(t, "steeple", "rebuilt").after = 2;
    }, /arcs\.yaml: \[0\]\.beats\[2\]\.after.*ending has no next/);
    catches((t) => {
      beat(t, "steeple", "crack").ending = "early";
    }, /arcs\.yaml: \[0\]\.beats\[0\]\.ending.*only a last beat/);
  });

  it("arcs: appeals, tests and rewards that can work", () => {
    catches((t) => {
      beat(t, "steeple", "rebuilt").appeals = beat(t, "steeple", "crack").appeals ?? [];
    }, /arcs\.yaml: \[0\]\.beats\[2\]\.appeals.*never shown/);
    catches((t) => {
      const a = beat(t, "steeple", "crack").appeals?.[0];
      if (a) a.karma = -1;
    }, /arcs\.yaml: \[0\]\.beats\[0\]\.appeals\[0\]\.karma/);
    catches((t) => {
      const a = beat(t, "steeple", "crack").appeals?.[0];
      if (a) a.amount = 1234;
    }, /appeals\[0\]\.amount.*multiple of \$50/);
    catches((t) => {
      const b = beat(t, "cough", "quarantine");
      b.next = { test: { kind: "sideLeads", side: "evil" }, ifTrue: "flee", ifFalse: "hailed" };
    }, /arcs\.yaml: \[1\]\.beats\[1\]\.next\.test.*evil side leads/);
    catches((t) => {
      beat(t, "cough", "flee").rewards = [{ to: "evil", reward: { bp: 10 } }];
    }, /arcs\.yaml: \[1\]\.beats\[2\]\.rewards\[0\]\.to.*nobody gets this/);
    catches((t) => {
      beat(t, "cough", "credit").rewards = [{ to: "all", reward: { bp: 500, gold: 2 } }];
    }, /arcs\.yaml: \[1\]\.beats\[4\]\.rewards\[0\]\.reward\.(bp|gold)/);
    catches((t) => {
      const b = beat(t, "cough", "quarantine");
      b.next = { test: { kind: "walkouts", perPlayer: 99 }, ifTrue: "flee", ifFalse: "hailed" };
    }, /arcs\.yaml: \[1\]\.beats\[1\]\.next\.test.*perPlayer/);
  });

  it("injuries, the market, permits, monuments, the slot symbols and the cards", () => {
    catches((t) => {
      if (t.injuries[0]) t.injuries[0].hp = 40;
    }, /injuries\.yaml: \[0\]\.hp/);
    catches((t) => {
      if (t.injuries[0]) t.injuries[0].treatPrice = 425;
    }, /injuries\.yaml: \[0\]\.treatPrice.*\$50 grid/);
    catches((t) => {
      if (t.injuries[1]) t.injuries[1].id = "dog-bite";
    }, /injuries\.yaml: \[1\]\.id.*duplicate id/);
    catches((t) => {
      if (t.market[0]) t.market[0].price = 99_999;
    }, /market\.yaml: \[0\]\.price/);
    catches((t) => {
      if (t.market[0]) t.market[0].reward = { bp: 50 };
    }, /market\.yaml: \[0\]\.reward\.bp.*no bp rewards/);
    catches((t) => {
      if (t.market[0]) t.market[0].reward = { karma: 2 };
    }, /market\.yaml: \[0\]\.reward\.karma/);
    catches((t) => {
      if (t.market[0]) t.market[0].reward = {};
    }, /market\.yaml: \[0\].*does nothing/);
    catches((t) => {
      t.permits.helipad = { name: "Helipad", description: "For the Mayor." };
    }, /permits\.yaml: helipad.*no permit/);
    catches((t) => {
      t.monuments.pop();
    }, /monuments\.yaml.*one name per monument tier/);
    catches((t) => {
      delete t.text.club.symbols.worm;
    }, /club\.yaml: symbols.*'worm'/);
    catches((t) => {
      t.text.club.cards.pop();
    }, /club\.yaml: cards.*13 card names/);
  });

  it("every placeholder table entry names a real town text field", () => {
    const fields = new Set<string>();
    const walk = (v: unknown, path: string): void => {
      if (typeof v === "string") fields.add(path);
      else if (Array.isArray(v)) for (const x of v) walk(x, `${path}[]`);
      else if (typeof v === "object" && v !== null)
        for (const [k, x] of Object.entries(v)) walk(x, path === "" ? k : `${path}.${k}`);
    };
    walk(T.text, "");
    for (const k of Object.keys(TOWN_TEXT_TOKENS)) expect(fields.has(k), k).toBe(true);
  });
});

describe("the town's volume targets", () => {
  it("meets the counts of every table", () => {
    expect(T.news.length).toBeGreaterThanOrEqual(40);
    expect(T.weather.length).toBeGreaterThanOrEqual(14);
    for (const w of T.weather) expect(w.morning.length, w.id).toBeGreaterThanOrEqual(8);
    expect(T.ordinances.length).toBeGreaterThanOrEqual(24);
    expect(T.arcs.length).toBeGreaterThanOrEqual(10);
    expect(T.injuries.length).toBeGreaterThanOrEqual(16);
    expect(T.market.length).toBeGreaterThanOrEqual(20);
    expect(T.monuments).toHaveLength(EXPANDED.town.graveyard.monuments.length);
    expect(Object.keys(T.permits).sort()).toEqual(
      Object.keys(EXPANDED.town.cityHall.permits).sort(),
    );
    for (const v of Object.values(T.cast)) expect(v).not.toBe("");
  });

  it("every pool drawn at random has at least 8 lines", () => {
    const x = T.text;
    const pools = {
      "graveyard.tended": x.graveyard.tended,
      "graveyard.robFound": x.graveyard.robFound,
      "graveyard.look": x.graveyard.look,
      "church.greeting": x.church.greeting,
      "church.confessed": x.church.confessed,
      "church.tithed": x.church.tithed,
      "hospital.leadBought": x.hospital.leadBought,
      "club.inside": x.club.inside,
    };
    for (const [k, v] of Object.entries(pools)) expect(v.length, k).toBeGreaterThanOrEqual(8);
  });

  it("keeps the original design's daily news (Design Doc, 'Daily news stuff')", () => {
    const ids = new Set(T.news.map((n) => n.id));
    for (const id of ["small-quake", "big-quake", "dimart-sale", "burger", "speed-limit", "zoo"])
      expect(ids.has(id), id).toBe(true);
  });

  it("has good, bad and mixed days", () => {
    const sign = (key: string, op: "add" | "mul", value: number): number => {
      const up = op === "add" ? value > 0 : value > 1;
      const down = op === "add" ? value < 0 : value < 1;
      // Keys where a higher number is worse for the parlor.
      const bad =
        /mood|cheapness|patience$|stockPrice|upgradePrice|permitPrice|treatPrice|loanRate|cover|hitPrice|eventOdds/.test(
          key,
        );
      const better = key === "customer.patience" ? up : bad ? down : up;
      return better ? 1 : up || down ? -1 : 0;
    };
    let good = 0;
    let bad = 0;
    let mixed = 0;
    for (const n of T.news) {
      const s = n.modifiers.map((m) => sign(m.key, m.op, m.value));
      if (s.every((v) => v > 0)) good++;
      else if (s.every((v) => v < 0)) bad++;
      else mixed++;
    }
    expect(good).toBeGreaterThanOrEqual(10);
    expect(bad).toBeGreaterThanOrEqual(5);
    expect(mixed).toBeGreaterThanOrEqual(5);
  });

  it("every ordinance with two or more rules trades something for something", () => {
    // A ballot is a real choice: no ordinance is all upside on the starter's own reading.
    for (const o of T.ordinances) expect(o.modifiers.length, o.id).toBeGreaterThanOrEqual(1);
    expect(T.ordinances.filter((o) => o.modifiers.length >= 2).length).toBeGreaterThanOrEqual(20);
  });

  it("every arc has at least two endings, appeals at the town's places, and 5 to 12 days", () => {
    const places = new Set<string>();
    for (const a of T.arcs) {
      const { paths } = arcPaths(a);
      const endings = new Set(paths.map((p) => p.at(-1)?.ending));
      expect(endings.size, a.id).toBeGreaterThanOrEqual(2);
      for (const p of paths) {
        expect(pathDays(p), a.id).toBeGreaterThanOrEqual(5);
        expect(pathDays(p), a.id).toBeLessThanOrEqual(12);
      }
      const appeals = a.beats.flatMap((b) => b.appeals ?? []);
      expect(appeals.length, a.id).toBeGreaterThan(0);
      for (const ap of appeals) places.add(ap.place);
    }
    expect([...places].sort()).toEqual(["church", "city-hall", "reaper-club"]);
    const tests = new Set<string>(
      T.arcs.flatMap((a) =>
        a.beats.flatMap((b) => (typeof b.next === "object" ? [b.next.test.kind] : [])),
      ),
    );
    for (const k of ["sideLeads", "walkouts", "sales", "hasMayor"])
      expect(tests.has(k), k).toBe(true);
  });
});
