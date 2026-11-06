import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContentPack } from "@fq/core";
import { afterAll, describe, expect, it } from "vitest";
import {
  appendTable,
  BANNED_BRANDS,
  bannedTerms,
  checkPack,
  classicPack,
  expandedPack,
  formatIssue,
  lintPack,
  SLUR_HASHES,
  slurHash,
  visibleLength,
} from "../src/index.js";
import { loadPackFromDirectory } from "../src/node.js";
import { expandedIds } from "./support.js";

function pack(): ContentPack {
  return structuredClone(expandedPack);
}
function xp(p: ContentPack) {
  if (!p.expanded) throw new Error("no expanded");
  return p.expanded;
}
function lint(p: ContentPack): string[] {
  return lintPack(p).map(formatIssue);
}
/** The same pack with every string emptied: nothing in it exempts any text. */
function blanked(p: ContentPack): ContentPack {
  return JSON.parse(JSON.stringify(p, (_k, v: unknown) => (typeof v === "string" ? "" : v)));
}
const event = (p: ContentPack) => {
  const e = p.events.ranges[1]?.entries.at(-1);
  if (!e) throw new Error("no event");
  return e;
};

describe("the content lint", () => {
  it("passes the built-in Expanded pack and exempts every original line", () => {
    expect(lint(expandedPack)).toEqual([]);
    // Without the original to exempt, its own quirks show up (Elvis, the unfilled *NAME*).
    const raw = lintPack(expandedPack, { original: blanked(classicPack) });
    expect(raw.some((i) => i.message.includes("Elvis"))).toBe(true);
    expect(raw.some((i) => i.message.includes("*NAME* is not filled in"))).toBe(true);
  });

  it("rejects placeholders the engine does not fill for that field", () => {
    const p = pack();
    event(p).message = "You win *NAME* a prize for {player}.";
    xp(p).text.negotiation.coffeePitch.push('`w{player}: `$"Coffee, {dHisCap}?"\\n\\n');
    const option = xp(p).prep[0]?.options[0];
    if (option) option.text = "{customer} watches.";
    p.text.negotiation.guiltLoved.push('{customer}"You never knew {dFirst}!"');
    const out = lint(p);
    expect(out).toContainEqual(
      expect.stringMatching(/events\.yaml: .*placeholder \{player\}: this field takes none/),
    );
    expect(out).toContainEqual(
      expect.stringMatching(/events\.yaml: .*\*NAME\* is not filled in here/),
    );
    expect(out).toContainEqual(
      expect.stringMatching(/expanded\/text\/negotiation\.yaml: coffeePitch\[\d+\].*\{dHisCap\}/),
    );
    expect(out).toContainEqual(
      expect.stringMatching(/expanded\/prep\.yaml: .*\{customer\} is not filled in/),
    );
    // The Classic ruleset reads text.yaml too, and fills no {dFirst}.
    expect(out).toContainEqual(
      expect.stringMatching(/text\.yaml: negotiation\.guiltLoved.*\{dFirst\}/),
    );
  });

  it("rejects bad colour codes and unbalanced braces", () => {
    const p = pack();
    event(p).message = "A `zstrange colour and a {brace.";
    const out = lint(p);
    expect(out).toContainEqual(expect.stringMatching(/colour code '`z'/));
    expect(out).toContainEqual(expect.stringMatching(/unbalanced brace/));
  });

  it("rejects pictures missing from the manifest (schema) and interface art (lint)", () => {
    const p = pack();
    event(p).picture = "stuff/no_such_thing";
    const ring = xp(p).prep.find((e) => e.picture);
    if (ring) ring.picture = "stuff/also_missing";
    const issues = checkPack(p, { assetIds: expandedIds });
    expect(issues.filter((i) => i.kind === "asset").map((i) => i.file)).toEqual([
      "events.yaml",
      "expanded/",
    ]);
    event(p).picture = "ui/logo";
    expect(lint(p)).toContainEqual(expect.stringMatching(/'ui\/logo' is interface art/));
  });

  it("rejects duplicate lines within a table and within one pool", () => {
    const p = pack();
    const r = p.events.ranges[2];
    r?.entries.push({ ...(r.entries.at(-1) as object), message: `${r.entries.at(-1)?.message}` });
    // The engine draws Soft Sell pitches from Classic's and Expanded's pools together.
    p.text.negotiation.softPitch.push(xp(p).text.negotiation.softPitch.at(-1) as string);
    xp(p).names.surnames.push(xp(p).names.surnames[3] as string);
    const out = lint(p);
    expect(out.filter((l) => l.includes("duplicate line"))).toHaveLength(3);
    expect(out).toContainEqual(expect.stringMatching(/^events\.yaml: ranges\[2\]/));
  });

  it("checks price grids and ranges, and articles", () => {
    const p = pack();
    p.softSell.push({ article: "a", name: "Gilded Ear Trumpet", price: 625 });
    p.softSell.push({ article: "a", name: "Embroidered Hanky", price: 650 });
    p.hardSell.push({ article: "a", name: "Opera Encore", price: 900 });
    p.softSell.push({ article: "a", name: "Ostrich Plume", price: 100 });
    xp(p).softSell.push({ article: "a", name: "Velvet Rope", price: 1250, tags: ["prestige"] });
    xp(p).softSell.push({ article: "some", name: "Glitter", price: 100, tags: ["sparkle"] });
    const out = lint(p);
    expect(out.filter((l) => l.includes("multiple of $50 from $50 to $600"))).toHaveLength(2);
    expect(out).toContainEqual(expect.stringMatching(/hard_sell\.yaml: .*from \$1500 to \$4000/));
    expect(out).toContainEqual(expect.stringMatching(/article 'a' before 'Ostrich Plume'/));
    expect(out).toContainEqual(expect.stringMatching(/expanded\/softSell\.yaml: .*\$50 to \$1000/));
    expect(out).toContainEqual(expect.stringMatching(/tag 'sparkle' is not in the vocabulary/));
  });

  it("checks event and news mechanics against the originals' ranges", () => {
    const p = pack();
    event(p).modBp = [10, 40];
    event(p).modTurns = [1, 1];
    const blurb = p.newsBlurbs.ranges[0]?.entries.at(-1);
    if (blurb) {
      blurb.title = "lower case headline";
      delete blurb.giveRandom;
      blurb.modBp = [20, 30];
    }
    const mid = p.newsBlurbs.ranges[1];
    if (mid) mid.low = 3;
    const out = lint(p);
    expect(out).toContainEqual(expect.stringMatching(/modBp must be low <= high within -15 to 15/));
    expect(out).toContainEqual(expect.stringMatching(/no turn rewards in events/));
    expect(out).toContainEqual(expect.stringMatching(/headlines are in capitals/));
    expect(out).toContainEqual(expect.stringMatching(/only work with giveRandom/));
    expect(out).toContainEqual(expect.stringMatching(/range overlaps the one before/));
  });

  it("requires every trait to have its tells and affinities that mean something", () => {
    const p = pack();
    const t = xp(p).traits[5];
    if (t) {
      t.lines = [t.lines[0] as string];
      t.effects.affinity = { vanity: -1, glitter: 2 };
    }
    const out = lint(p);
    expect(out).toContainEqual(expect.stringMatching(/at least two tell lines/));
    expect(out).toContainEqual(expect.stringMatching(/affinity 'glitter' is not a tag/));
  });

  it("requires opposite loved flags to exclude each other", () => {
    const p = pack();
    const traits = xp(p).traits;
    const a = traits.find((t) => t.effects.loved === true);
    const b = traits.find((t) => t.effects.loved === false);
    if (!a || !b) throw new Error("need both");
    a.excludes = (a.excludes ?? []).filter((id) => id !== b.id);
    b.excludes = (b.excludes ?? []).filter((id) => id !== a.id);
    expect(lint(p)).toContainEqual(expect.stringMatching(/does not exclude/));
  });

  it("limits line lengths to what fits the text panel", () => {
    const p = pack();
    event(p).message = "A".repeat(201);
    expect(lint(p)).toContainEqual(
      expect.stringMatching(/too long for the text panel: 201 characters \(at most 200\)/),
    );
    expect(visibleLength("`$Hi`w there\\n")).toBe(8);
  });

  it("checks reward ranges of body-preparation choices and specials", () => {
    const p = pack();
    const opt = xp(p).prep[3]?.options[0];
    if (opt) opt.effects = { money: 5000, karma: -9 };
    const evil = xp(p)
      .prep.flatMap((e) => e.options)
      .find((o) => o.evil);
    if (evil) evil.effects = { money: 100, karma: 1 };
    const out = lint(p);
    expect(out).toContainEqual(expect.stringMatching(/money 5000 is outside -500 to 800/));
    expect(out).toContainEqual(expect.stringMatching(/karma -9 is outside -4 to 3/));
    expect(out).toContainEqual(expect.stringMatching(/a dishonest \(evil\) choice costs karma/));
  });

  it("requires every rating and karma slot", () => {
    const p = pack();
    p.karma[61] = "";
    expect(lint(p)).toContainEqual(expect.stringMatching(/karma\.yaml: \[61\]: slot 62 is empty/));
  });

  it("runs core's checkExpandedContent", () => {
    const p = pack();
    const cat = xp(p).packages[0];
    if (cat?.tiers[1]) cat.tiers[1].price = 0;
    expect(lint(p)).toContainEqual(
      expect.stringMatching(/checkExpandedContent: packages\.\w+: tiers must get dearer/),
    );
  });

  it("bans real brands, real people and slurs in new lines", () => {
    const p = pack();
    event(p).message = "You clean the viewing room with Windex while humming Elvis.";
    const out = lint(p);
    expect(out).toContainEqual(expect.stringMatching(/banned brand 'Windex'/));
    expect(out).toContainEqual(expect.stringMatching(/banned person 'Elvis'/));
    // Slurs are hashed; test with an invented word in a private set.
    const fake = new Set([slurHash("zorblaxian"), slurHash("glorpwump")]);
    expect(bannedTerms("Those Zorblaxian mourners", fake)).toEqual([
      { term: "(a slur)", kind: "slur" },
    ]);
    expect(bannedTerms("a glorp wump funeral", fake)).toEqual([{ term: "(a slur)", kind: "slur" }]);
    expect(bannedTerms("Those Zorblaxian mourners")).toEqual([]);
    expect(SLUR_HASHES.size).toBeGreaterThan(40);
    // Whole words only: "Harleyville" and "Sonya" are fine; brands in the middle of a line are not.
    expect(bannedTerms("Harleyville and Sonya")).toEqual([]);
    expect(bannedTerms("a can of Pepsi-flavoured embalming fluid").map((h) => h.term)).toEqual([
      "Pepsi",
    ]);
    expect(BANNED_BRANDS).toContain("Windex");
  });

  it("finds no banned term in ordinary words of the whole Expanded pack (no false positives)", () => {
    const words = new Set<string>();
    const walk = (v: unknown): void => {
      if (typeof v === "string") for (const w of v.split(/\s+/)) words.add(w);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
    };
    walk(xp(expandedPack));
    const hits = [...words].flatMap((w) => bannedTerms(w).map((h) => `${w}: ${h.term}`));
    expect(hits).toEqual([]);
  });
});

describe("merge: append", () => {
  const dirs: string[] = [];
  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("splits a base range into brackets that each keep the base entries", () => {
    const base = { ranges: [{ low: -9, high: 9, entries: [{ message: "old" }] }] };
    const out = appendTable(
      "events",
      base,
      {
        ranges: [
          { low: -9, high: 0, entries: [{ message: "early" }] },
          { low: 1, high: 9, entries: [{ message: "late" }] },
        ],
      },
      "events.yaml",
    );
    expect(out).toEqual({
      ranges: [
        { low: -9, high: 0, entries: [{ message: "old" }, { message: "early" }] },
        { low: 1, high: 9, entries: [{ message: "old" }, { message: "late" }] },
      ],
    });
  });

  it("appends lists and text arrays, replaces strings and the slots given", () => {
    expect(appendTable("risks", [1], [2], "r")).toEqual([1, 2]);
    expect(
      appendTable(
        "text",
        { a: ["x"], b: "keep", c: { d: ["y"] } },
        { a: ["z"], b: "new", c: { d: ["w"] } },
        "t",
      ),
    ).toEqual({ a: ["x", "z"], b: "new", c: { d: ["y", "w"] } });
    const slots = appendTable("karma", Array(100).fill("old"), { "62": "new" }, "k") as string[];
    expect(slots[61]).toBe("new");
    expect(slots.filter((s) => s === "old")).toHaveLength(99);
    expect(() => appendTable("karma", [], { "101": "x" }, "k.yaml")).toThrow(/outside 1 to 100/);
  });

  it("a sysop pack can extend expanded and add a few lines, and the Expanded section is inherited", () => {
    const dir = mkdtempSync(join(tmpdir(), "fq-append-"));
    dirs.push(dir);
    writeFileSync(join(dir, "pack.yaml"), "id: mine\nextends: expanded\nmerge: append\n");
    writeFileSync(
      join(dir, "yangs.yaml"),
      "ranges:\n  - low: -229999999\n    high: 299999999\n    entries:\n      - message: 'Your soup is watching you.'\n",
    );
    const mine = loadPackFromDirectory(dir, { assetIds: expandedIds });
    expect(mine.fortunes.ranges[0]?.entries.at(-1)?.message).toBe("Your soup is watching you.");
    expect(mine.fortunes.ranges[0]?.entries.length).toBe(
      (expandedPack.fortunes.ranges[0]?.entries.length ?? 0) + 1,
    );
    expect(mine.expanded).toStrictEqual(expandedPack.expanded);
    // An empty expanded/ directory is an Expanded section with nothing in it, which the schema rejects.
    mkdirSync(join(dir, "expanded"));
    expect(() => loadPackFromDirectory(dir, { assetIds: expandedIds })).toThrow(
      /expanded\/: names: is required/,
    );
  });

  it("refuses merge: append without extends", () => {
    const dir = mkdtempSync(join(tmpdir(), "fq-append-"));
    dirs.push(dir);
    writeFileSync(join(dir, "pack.yaml"), "id: mine\nmerge: append\n");
    expect(() => loadPackFromDirectory(dir)).toThrow(/merge: append needs 'extends'/);
  });

  it("tolerates Expanded fields this package does not know yet, unless strict", () => {
    const p = pack();
    (xp(p) as unknown as Record<string, unknown>).weather = { sunny: ["It is sunny."] };
    expect(checkPack(p)).toEqual([]);
    expect(checkPack(p, { strictExpanded: true }).map(formatIssue)).toEqual([
      "expanded/: unknown field 'weather'",
    ]);
  });
});
