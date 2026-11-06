import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLASSIC_TEXT, type ContentPack } from "@fq/core";
import { afterAll, describe, expect, it } from "vitest";
import { legacyContent } from "../../core/test/support/legacyContent.js";
import {
  bannedTerms,
  checkOriginal,
  classicPack,
  expandedPack,
  formatIssue,
  INDEXED_TEXT,
  lintPack,
  PackValidationError,
  POOLED_TEXT,
  vintagePack,
} from "../src/index.js";
import {
  CLASSIC_DIR,
  EXPANDED_DIR,
  importOriginal,
  loadBuiltInSources,
  PACKAGE_ROOT,
  renderBuiltPacks,
} from "../src/node.js";
import { assetIds } from "./support.js";

/**
 * The owner's rule (2026-11-06, CLAUDE.md): the original dialog, even if dated or controversial,
 * must remain. These tests prove it for every built-in pack, against a fresh import of
 * `legacy/dist/*.txt` and `CLASSIC_TEXT`, and plant violations to prove each check fires.
 */

const original = importOriginal({ assetIds }).pack;
const clone = (p: ContentPack): ContentPack => structuredClone(p);
const texts = (p: ContentPack, exact = false): string[] =>
  checkOriginal(p, original, { exact }).map(formatIssue);

/** Every file below `dir`, relative. */
function walk(dir: string, prefix = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path, `${prefix}${name}/`) : [`${prefix}${name}`];
  });
}

describe("Classic is the untouched original", () => {
  it("is identical to a fresh import of legacy/dist and CLASSIC_TEXT, table by table", () => {
    for (const key of Object.keys(original) as (keyof ContentPack)[]) {
      if (key === "id") continue;
      expect(classicPack[key], key).toStrictEqual(original[key]);
    }
    expect(classicPack.id).toBe("classic");
    expect(classicPack.text).toStrictEqual(CLASSIC_TEXT);
    expect(classicPack.expanded).toBeUndefined();
    expect(Object.keys(classicPack)).toEqual(Object.keys(original));
  });

  it("is also identical to the independent reference loader (core's test parser)", () => {
    const reference = legacyContent();
    for (const key of Object.keys(reference) as (keyof ContentPack)[]) {
      if (key === "id") continue;
      expect(classicPack[key], key).toStrictEqual(reference[key]);
    }
  });

  it("passes the original-text check in exact mode, against both originals", () => {
    expect(checkOriginal(classicPack, original, { exact: true })).toEqual([]);
    expect(checkOriginal(classicPack, legacyContent(), { exact: true })).toEqual([]);
  });

  it("has no overrides file and no second source: packs/classic is the importer's output", () => {
    const files = walk(join(PACKAGE_ROOT, "packs"));
    expect(files.filter((f) => /(^|\/)overrides\.(ya?ml|json)$/.test(f))).toEqual([]);
    expect(existsSync(join(PACKAGE_ROOT, "packs/vintage"))).toBe(false);
    expect(existsSync(join(CLASSIC_DIR, "overrides.yaml"))).toBe(false);
  });
});

describe("Vintage is a deprecated alias of Classic", () => {
  it("is the same data under the id vintage", () => {
    expect(vintagePack.id).toBe("vintage");
    expect(vintagePack).toStrictEqual({ ...classicPack, id: "vintage" });
    expect(checkOriginal(vintagePack, original, { exact: true })).toEqual([]);
  });
});

describe("the Expanded pack adds to the original and replaces nothing", () => {
  it("keeps every original line, table by table, in the positions the engine reads", () => {
    expect(texts(expandedPack)).toEqual([]);
    // Not exact: it has additions.
    expect(texts(expandedPack, true)).not.toEqual([]);
  });

  it("also holds against the independent reference loader", () => {
    expect(checkOriginal(expandedPack, legacyContent())).toEqual([]);
  });

  it("keeps the three repeated rating lines, and fills only the slots the original left empty", () => {
    const line = "Your parlor is in the top 20 percent.";
    for (const slot of [86, 88, 89, 90]) expect(expandedPack.ratings[slot - 1]).toBe(line);
    const filled = expandedPack.ratings.flatMap((l, i) =>
      original.ratings[i] === "" && l !== "" ? [i + 1] : [],
    );
    expect(filled).toEqual([67, 68, 69]);
    const changed = expandedPack.karma.flatMap((l, i) =>
      original.karma[i] !== "" && original.karma[i] !== l ? [i + 1] : [],
    );
    expect(changed).toEqual([]);
  });

  it("keeps the original hard-sell upgrades first, in file order, with the new ones after", () => {
    expect(expandedPack.hardSell.slice(0, original.hardSell.length)).toStrictEqual(
      original.hardSell,
    );
    expect(expandedPack.hardSell.length).toBeGreaterThan(original.hardSell.length);
    expect(expandedPack.hardSell[0]?.name).toBe("Forest Lawn Premier Double Plot");
  });
});

describe("every text array is classified for the engine", () => {
  function arrays(value: unknown, path = ""): string[] {
    if (Array.isArray(value)) return [path];
    if (typeof value === "object" && value !== null) {
      return Object.entries(value).flatMap(([k, v]) => arrays(v, path ? `${path}.${k}` : k));
    }
    return [];
  }

  it("lists each array of CLASSIC_TEXT as indexed or random, exactly once", () => {
    const all = arrays(CLASSIC_TEXT).sort();
    expect([...INDEXED_TEXT, ...POOLED_TEXT].sort()).toEqual(all);
  });
});

describe("planted violations: each check fires", () => {
  it("an edited slot line (karma, ratings)", () => {
    const p = clone(expandedPack);
    p.karma[17] = "PLANTED EDIT";
    p.ratings[39] = "PLANTED EDIT";
    const out = texts(p);
    expect(out).toContainEqual(
      expect.stringMatching(/karma\.yaml: slot 18 .*original line in slot 18 was edited/),
    );
    expect(out).toContainEqual(expect.stringMatching(/ratings\.yaml: slot 40 .*was edited/));
    expect(out).toHaveLength(2);
  });

  it("a dropped slot line, and a repeat replaced by a new line (ratings 88 to 90)", () => {
    const p = clone(expandedPack);
    p.karma[2] = "";
    p.ratings[87] = "Old Man Withers has put down a deposit.";
    const out = texts(p);
    expect(out).toContainEqual(expect.stringMatching(/karma\.yaml: slot 3 .*was removed/));
    expect(out).toContainEqual(expect.stringMatching(/ratings\.yaml: slot 88 .*was edited/));
  });

  it("a slot the original left empty may be filled in Expanded, but not in Classic (exact)", () => {
    expect(original.karma[59]).toBe("");
    const p = clone(classicPack);
    p.karma[59] = "Returns shopping carts";
    expect(texts(p)).toEqual([]);
    expect(texts(p, true)).toContainEqual(expect.stringMatching(/karma\.yaml: slot 60 /));
  });

  it("an edited field of a ranged entry, not just its message", () => {
    const p = clone(expandedPack);
    const first = p.events.ranges[0]?.entries[0];
    if (!first) throw new Error("no event");
    first.modBp = [first.modBp?.[0] ?? 0, (first.modBp?.[1] ?? 0) + 1];
    const out = texts(p);
    expect(out).toContainEqual(
      expect.stringMatching(/events\.yaml: ranges\[0\]\.entries\[0\] .*was edited \(field 'modBp'/),
    );
  });

  it("an edited ranged message (news, fortunes)", () => {
    const p = clone(expandedPack);
    const news = p.newsBlurbs.ranges[1]?.entries[2];
    const fortune = p.fortunes.ranges[0]?.entries[4];
    if (!news || !fortune) throw new Error("no entries");
    fortune.message = "Whoever drops a watch in the toilet is bound to have a crappy time.";
    news.title = `${news.title}!`;
    const out = texts(p);
    expect(out).toContainEqual(
      expect.stringMatching(/yangs\.yaml: ranges\[0\]\.entries\[4\] .*was replaced/),
    );
    expect(out).toContainEqual(
      expect.stringMatching(/news_blurbs\.yaml: ranges\[1\]\.entries\[2\] .*was edited/),
    );
  });

  it("a dropped ranged entry", () => {
    const p = clone(expandedPack);
    p.noCustomers.ranges[0]?.entries.splice(3, 1);
    p.events.ranges[2]?.entries.splice(0, 1);
    const out = texts(p);
    expect(out).toContainEqual(
      expect.stringMatching(/no_customers\.yaml: ranges\[0\]\.entries\[3\] .*is missing/),
    );
    expect(out).toContainEqual(
      expect.stringMatching(/events\.yaml: ranges\[2\]\.entries\[0\] .*is missing/),
    );
  });

  it("a reordered ranged table", () => {
    const p = clone(expandedPack);
    const entries = p.niceFortunes.ranges[0]?.entries;
    if (!entries) throw new Error("no entries");
    [entries[0], entries[1]] = [entries[1], entries[0]] as [
      (typeof entries)[0],
      (typeof entries)[0],
    ];
    expect(texts(p)).toContainEqual(expect.stringMatching(/ranges\[0\]\.entries\[1\] .*moved/));
  });

  it("a range split that leaves part of the original range unanswered", () => {
    const p = clone(expandedPack);
    p.events.ranges.splice(1, 1);
    expect(texts(p)).toContainEqual(expect.stringMatching(/1000 to 4999\) is no longer covered/));
  });

  it("a reordered, dropped or edited hard-sell upgrade (the engine offers them by position)", () => {
    const swapped = clone(expandedPack);
    [swapped.hardSell[1], swapped.hardSell[2]] = [swapped.hardSell[2], swapped.hardSell[1]] as [
      (typeof swapped.hardSell)[0],
      (typeof swapped.hardSell)[0],
    ];
    const out = texts(swapped);
    expect(out).toContainEqual(
      expect.stringMatching(/hard_sell\.yaml: \[1\] .*moved: entry 1 is now at 2/),
    );
    expect(out).toContainEqual(
      expect.stringMatching(/hard_sell\.yaml: \[2\] .*moved: entry 2 is now at 1/),
    );

    const dropped = clone(expandedPack);
    dropped.hardSell.splice(4, 1);
    const droppedOut = texts(dropped);
    expect(droppedOut.length).toBeGreaterThan(0);
    expect(droppedOut.every((m) => m.startsWith("hard_sell.yaml: "))).toBe(true);

    const edited = clone(expandedPack);
    const first = edited.hardSell[0];
    if (!first) throw new Error("no upgrade");
    edited.hardSell[0] = { ...first, name: "PLANTED EDIT" };
    const price = clone(expandedPack);
    const second = price.hardSell[1];
    if (!second) throw new Error("no upgrade");
    price.hardSell[1] = { ...second, price: second.price + 50 };
    expect(texts(edited)).toContainEqual(
      expect.stringMatching(/hard_sell\.yaml: \[0\] .*was edited \(field 'name'/),
    );
    expect(texts(price)).toContainEqual(
      expect.stringMatching(/hard_sell\.yaml: \[1\] .*was edited \(field 'price'/),
    );
  });

  it("an edited risk, soft sell or swear word, and a dropped one", () => {
    const p = clone(expandedPack);
    const risk = p.risks[3];
    const item = p.softSell[7];
    const swear = p.swearWords[2];
    if (!risk || !item || !swear) throw new Error("missing entries");
    p.risks[3] = { ...risk, failMessage: `${risk.failMessage} (softened)` };
    p.softSell[7] = { ...item, name: "Something Else" };
    p.swearWords.splice(2, 1);
    const out = texts(p);
    expect(out).toContainEqual(expect.stringMatching(/risks\.yaml: \[3\] .*field 'failMessage'/));
    expect(out).toContainEqual(expect.stringMatching(/soft_sell\.yaml: \[7\] .*field 'name'/));
    expect(out).toContainEqual(expect.stringMatching(/swear_words\.yaml: \[2\] /));
  });

  it("an edited text string", () => {
    const p = clone(expandedPack);
    p.text.negotiation.sympathyLoved[2] = '{customer}"PLANTED EDIT"';
    p.text.places.yangs.news[1] = "Mr Yang delivers.";
    const out = texts(p);
    expect(out).toContainEqual(
      expect.stringMatching(/text\.yaml: negotiation\.sympathyLoved\[2\] .*was replaced/),
    );
    expect(out.some((m) => m.includes("places.yangs.news"))).toBe(true);
  });

  it("a text string replaced where the pack gives a plain string", () => {
    const p = clone(expandedPack);
    p.text.places.bank.location = "A Bank";
    expect(texts(p)).toContainEqual(
      expect.stringMatching(
        /text\.yaml: places\.bank\.location .*at places\.bank\.location was edited/,
      ),
    );
  });

  it("a dropped line of a random pool, and a pool line moved out of order", () => {
    const p = clone(expandedPack);
    p.text.negotiation.softRefuse.splice(1, 1);
    const q = clone(expandedPack);
    const pool = q.text.wait.noTurns;
    [pool[0], pool[1]] = [pool[1], pool[0]] as [string, string];
    expect(texts(p)).toContainEqual(
      expect.stringMatching(/text\.yaml: negotiation\.softRefuse\[1\] .*is missing/),
    );
    expect(texts(q)).toContainEqual(
      expect.stringMatching(/text\.yaml: wait\.noTurns\[1\] .*moved/),
    );
  });

  it("a reordered or lengthened index-sensitive array (mood band, vehicle, skill, damage)", () => {
    const band = clone(expandedPack);
    [band.text.negotiation.softAccept[0], band.text.negotiation.softAccept[1]] = [
      band.text.negotiation.softAccept[1],
      band.text.negotiation.softAccept[0],
    ] as [string, string];
    expect(texts(band)).toContainEqual(expect.stringMatching(/negotiation\.softAccept\[0\] /));

    const longer = clone(expandedPack);
    longer.text.negotiation.softAccept.push("An extra band that would never show.");
    expect(texts(longer)).toContainEqual(
      expect.stringMatching(
        /negotiation\.softAccept is read by position and must keep its 5 entries \(has 6\)/,
      ),
    );

    for (const path of [
      ["hearseNames"],
      ["hearseDescriptions"],
      ["places", "university", "psychSkills"],
      ["social", "visit", "tagTypes"],
      ["social", "battle", "verbsMe"],
      ["social", "battle", "verbsHim"],
    ]) {
      const p = clone(expandedPack);
      let node = p.text as unknown as Record<string, unknown>;
      for (const key of path.slice(0, -1)) node = node[key] as Record<string, unknown>;
      const list = node[path.at(-1) as string] as string[];
      [list[0], list[1]] = [list[1], list[0]] as [string, string];
      expect(texts(p), path.join(".")).toContainEqual(
        expect.stringContaining(`${path.join(".")}[0] `),
      );
    }
  });

  it("a removed text key", () => {
    const p = clone(expandedPack);
    delete (p.text.places as unknown as Record<string, unknown>).bank;
    expect(
      texts(p).some((m) => m.includes("places.bank.location") && m.includes("was removed")),
    ).toBe(true);
  });

  it("an array in the original text that the check does not know how to read", () => {
    const o = clone(original);
    (o.text as unknown as Record<string, unknown>).brandNew = ["a", "b"];
    const p = clone(classicPack);
    (p.text as unknown as Record<string, unknown>).brandNew = ["a", "b"];
    expect(checkOriginal(p, o).map(formatIssue)).toContainEqual(
      expect.stringMatching(/brandNew is not classified as indexed or random/),
    );
  });

  it("Classic and Vintage (exact) reject any addition, edit, or an Expanded section", () => {
    const added = clone(classicPack);
    added.hardSell.push({ article: "a", name: "Gilded Plot", price: 2000 });
    expect(texts(added, true)).toContainEqual(
      expect.stringMatching(/hard_sell\.yaml: .*table has 11 entries, the original has 10/),
    );
    const extra = clone(classicPack);
    extra.text.negotiation.softPitch.push("A brand new pitch.");
    expect(texts(extra, true)).toContainEqual(
      expect.stringMatching(/text\.yaml: .*not identical to the original/),
    );
    const eventAdded = clone(classicPack);
    eventAdded.events.ranges[0]?.entries.push({ message: "A new event." });
    expect(texts(eventAdded, true)).toContainEqual(
      expect.stringMatching(/events\.yaml: .*not identical to the original/),
    );
    const edited = clone(vintagePack);
    edited.karma[17] = "PLANTED EDIT";
    expect(texts(edited, true)).toContainEqual(expect.stringMatching(/karma\.yaml: slot 18 /));
    const withExpanded = clone(classicPack);
    withExpanded.expanded = structuredClone(expandedPack.expanded) as NonNullable<
      ContentPack["expanded"]
    >;
    expect(texts(withExpanded, true)).toContainEqual(
      expect.stringMatching(/pack\.yaml: expanded: /),
    );
  });
});

describe("planted violations fail the pack build", () => {
  const roots: string[] = [];
  const plant = (src: string): string => {
    const root = mkdtempSync(join(tmpdir(), "fq-original-"));
    roots.push(root);
    const dir = join(root, "pack");
    cpSync(src, dir, { recursive: true });
    return dir;
  };
  afterAll(() => {
    for (const r of roots) rmSync(r, { recursive: true, force: true });
  });
  const failure = (run: () => unknown): string => {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(PackValidationError);
      return (error as Error).message;
    }
    throw new Error("the build should have failed");
  };

  it("builds the real sources", () => {
    expect(() => renderBuiltPacks({ assetIds })).not.toThrow();
  });

  it("an edited line in packs/classic", () => {
    const dir = plant(CLASSIC_DIR);
    const file = join(dir, "karma.yaml");
    const text = readFileSync(file, "utf8");
    expect(text).toContain("'Beats kids'");
    writeFileSync(file, text.replace("'Beats kids'", "'PLANTED EDIT'"));
    const message = failure(() => renderBuiltPacks({ assetIds, dirs: { classic: dir } }));
    expect(message).toMatch(/Content pack "classic" is invalid/);
    expect(message).toMatch(
      /karma\.yaml: slot 18 .*was edited \(was "Beats kids", now "PLANTED EDIT"\)/,
    );
  });

  it("a dropped line in packs/classic", () => {
    const dir = plant(CLASSIC_DIR);
    const file = join(dir, "hard_sell.yaml");
    const text = readFileSync(file, "utf8");
    const at = text.indexOf("- article:");
    // Drop the first upgrade: the rest shift down by one.
    const next = text.indexOf("- article:", at + 1);
    writeFileSync(file, text.slice(0, at) + text.slice(next));
    const message = failure(() => renderBuiltPacks({ assetIds, dirs: { classic: dir } }));
    expect(message).toMatch(/hard_sell\.yaml: \[0\] /);
  });

  it("an overrides file reappearing in packs/classic, even one that would apply cleanly", () => {
    const dir = plant(CLASSIC_DIR);
    writeFileSync(
      join(dir, "overrides.yaml"),
      "edits:\n  - id: soften\n    category: real-brand\n    in: karma\n    original: 'Eats at KFC'\n    replacement: 'Eats at a chicken place'\n    reason: 'test'\n",
    );
    const message = failure(() => loadBuiltInSources({ assetIds, dirs: { classic: dir } }));
    expect(message).toMatch(/overrides\.yaml: a built-in pack may not have an overrides file/);
    expect(failure(() => renderBuiltPacks({ assetIds, dirs: { classic: dir } }))).toMatch(
      /overrides file/,
    );
  });

  it("an overrides file in packs/expanded", () => {
    const dir = plant(EXPANDED_DIR);
    writeFileSync(join(dir, "overrides.json"), '{"edits": []}');
    expect(failure(() => loadBuiltInSources({ assetIds, dirs: { expanded: dir } }))).toMatch(
      /overrides\.json: a built-in pack may not have an overrides file/,
    );
  });

  it("an Expanded rating that replaces one of the original repeats", () => {
    const dir = plant(EXPANDED_DIR);
    const file = join(dir, "ratings.yaml");
    writeFileSync(
      file,
      `${readFileSync(file, "utf8")}'88': 'Old Man Withers has put down a deposit.'\n`,
    );
    const message = failure(() => renderBuiltPacks({ assetIds, dirs: { expanded: dir } }));
    expect(message).toMatch(/Content pack "expanded" is invalid/);
    expect(message).toMatch(/ratings\.yaml: slot 88 .*was edited/);
  });

  it("an Expanded text string that replaces an original one", () => {
    const dir = plant(EXPANDED_DIR);
    const file = join(dir, "text.yaml");
    writeFileSync(
      file,
      `${readFileSync(file, "utf8")}\nplaces:\n  yangs:\n    logTiger: 'Yang sends a fortune.'\n`,
    );
    const message = failure(() => renderBuiltPacks({ assetIds, dirs: { expanded: dir } }));
    expect(message).toMatch(/text\.yaml: places\.yangs\.logTiger .*was edited/);
  });
});

describe("content policy applies only to new text", () => {
  it("the policy lints never flag a line of the original", () => {
    // Every original string, in the original pack, is exempt: no banned term, placeholder, length
    // or duplicate finding on any of it (slots the original left empty are not lines).
    expect(lintPack(classicPack, { fullSlots: false }).map(formatIssue)).toEqual([]);
    expect(lintPack(vintagePack, { fullSlots: false }).map(formatIssue)).toEqual([]);
    expect(lintPack(original, { fullSlots: false }).map(formatIssue)).toEqual([]);
  });

  it("the exemption is automatic: no option is needed to keep the built-in Expanded pack clean", () => {
    expect(lintPack(expandedPack).map(formatIssue)).toEqual([]);
  });

  it("original lines that the banned-terms list would flag are exempt, and stay", () => {
    for (const line of ["Eats at KFC", "Enjoys Coors light", "Paul Crouch", "Sony Executive"]) {
      expect(bannedTerms(line).length, line).toBeGreaterThan(0);
      expect(classicPack.karma, line).toContain(line);
      expect(expandedPack.karma, line).toContain(line);
    }
    expect(bannedTerms("You listen to Milli Vanilli").length).toBeGreaterThan(0);
    expect(expandedPack.ratings).toContain("You listen to Milli Vanilli");
    expect(expandedPack.ratings).toContain("Fairly popular for white trash funerals.");
    expect(expandedPack.hardSell[0]?.name).toBe("Forest Lawn Premier Double Plot");
  });

  it("the exemption is exact: a new line, or an original with one character changed, is checked", () => {
    const p = clone(expandedPack);
    p.karma[59] = "Eats at KFC every day";
    p.ratings[66] = "Eats at KFC ";
    const out = lintPack(p).map(formatIssue);
    expect(out.filter((m) => m.includes("banned"))).toHaveLength(2);
    // The same words exactly as the original are fine anywhere.
    const q = clone(expandedPack);
    q.karma[59] = "Eats at KFC";
    expect(
      lintPack(q)
        .map(formatIssue)
        .filter((m) => m.includes("banned")),
    ).toHaveLength(0);
  });

  it("new Expanded writing is still held to the policy", () => {
    const p = clone(expandedPack);
    p.karma[59] = "Eats at Walmart daily";
    expect(lintPack(p).map(formatIssue)).toContainEqual(expect.stringMatching(/banned brand/));
  });
});
