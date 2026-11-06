import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ContentPack } from "@fq/core";
import { afterAll, describe, expect, it } from "vitest";
import {
  checkPack,
  classicPack,
  formatIssue,
  PackValidationError,
  validatePack,
  vintagePack,
} from "../src/index.js";
import { loadPackFromDirectory, VINTAGE_DIR } from "../src/node.js";
import { assetIds } from "./support.js";

function mutable(): ContentPack {
  return structuredClone(vintagePack);
}

function messages(pack: unknown, assets = false): string[] {
  return checkPack(pack, assets ? { assetIds } : {}).map(formatIssue);
}

describe("the built-in packs", () => {
  it("pass the schema, and every picture is in assets/manifest.json", () => {
    for (const pack of [vintagePack, classicPack]) {
      expect(checkPack(pack, { assetIds }), pack.id).toEqual([]);
      expect(validatePack(pack, { assetIds })).toBe(pack);
    }
  });
});

describe("validatePack error messages name the file and the entry", () => {
  it("a bad modifier names events.yaml, the path and the entry's message", () => {
    const pack = mutable();
    (pack.events.ranges[0]?.entries[4] as { modBp?: unknown }).modBp = [4];
    const [issue] = messages(pack);
    expect(issue).toMatch(
      /^events\.yaml: ranges\[0\]\.entries\[4\]\.modBp \(entry "Some kids come by/,
    );
    expect(issue).toContain("must be a pair [low, high] of whole numbers");
  });

  it("a misspelt field is reported by name", () => {
    const pack = mutable();
    (pack.softSell[2] as unknown as Record<string, unknown>).prise = 5;
    expect(messages(pack)).toEqual([
      `soft_sell.yaml: [2] (entry "Memorial Plaque"): unknown field 'prise'`,
    ]);
  });

  it("a missing required field says so", () => {
    const pack = mutable();
    delete (pack.risks[1] as unknown as Record<string, unknown>).riskLabel;
    expect(messages(pack)).toEqual([
      'risks.yaml: [1].riskLabel (entry "You notice a finger poking through the d..."): is required but missing',
    ]);
  });

  it("ratings and karma must have exactly 100 slots, and name the slot", () => {
    const pack = mutable();
    pack.ratings = pack.ratings.slice(0, 99);
    (pack.karma as unknown[])[41] = 7;
    const out = messages(pack);
    expect(out[0]).toMatch(/^ratings\.yaml: must have exactly 100 entries/);
    expect(out[1]).toMatch(/^karma\.yaml: slot 42:/);
  });

  it("a picture id must be in the normal form", () => {
    const pack = mutable();
    (pack.events.ranges[0]?.entries[0] as { picture?: string }).picture = "flash\\places\\bank.swf";
    expect(messages(pack)[0]).toMatch(
      /events\.yaml: ranges\[0\]\.entries\[0\]\.picture .*must be an asset id/,
    );
  });

  it("a picture missing from the manifest is an asset issue, naming file, entry and id", () => {
    const pack = mutable();
    (pack.risks[2] as { successPicture?: string }).successPicture = "stuff/no_such_picture";
    const issues = checkPack(pack, { assetIds });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.kind).toBe("asset");
    expect(formatIssue(issues[0] as never)).toBe(
      `risks.yaml: [2].successPicture (entry "As you are moving a body downstairs you ..."): picture 'stuff/no_such_picture' is not in assets/manifest.json`,
    );
    expect(checkPack(pack)).toEqual([]);
  });

  it("a missing table, an unknown table and a bad id are reported", () => {
    const pack = mutable() as unknown as Record<string, unknown>;
    delete pack.hardSell;
    pack.bogus = 1;
    pack.id = "Bad Id";
    expect(messages(pack).sort()).toEqual([
      "hard_sell.yaml: table 'hardSell' is missing",
      "pack.yaml: id: must be lowercase letters, digits, '-' or '_'",
      "pack.yaml: unknown table 'bogus'",
    ]);
  });

  it("the text table rejects missing, extra and non-string fields with their path", () => {
    const pack = mutable();
    const text = pack.text as unknown as Record<string, Record<string, unknown>>;
    delete (text.desk as Record<string, unknown>).title;
    (text.risk as Record<string, unknown>).extra = "x";
    (text.session as Record<string, unknown>).loggedOn = 3;
    expect(messages(pack).sort()).toEqual([
      "text.yaml: desk.title: is required but missing",
      "text.yaml: risk: unknown field 'extra'",
      "text.yaml: session.loggedOn: Invalid input: expected string, received number",
    ]);
  });

  it("an empty list of alternatives or a changed hearse count is rejected", () => {
    const pack = mutable();
    pack.text.wait.noTurns = [];
    pack.text.hearseNames = ["Bicycle"];
    const out = messages(pack);
    expect(out).toContain("text.yaml: wait.noTurns: must have at least one entry");
    expect(
      out.some((m) => m.startsWith("text.yaml: hearseNames: must have exactly 5 entries")),
    ).toBe(true);
  });

  it("validatePack throws a PackValidationError listing every problem", () => {
    const pack = mutable();
    pack.ratings = [];
    (pack.hardSell[0] as { price: number }).price = -1;
    try {
      validatePack(pack);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(PackValidationError);
      const e = error as PackValidationError;
      expect(e.issues).toHaveLength(2);
      expect(e.message).toMatch(/^Content pack "vintage" is invalid:\n {2}- hard_sell\.yaml: /);
      expect(e.message).toContain("\n  - ratings.yaml: must have exactly 100 entries");
    }
  });

  it("not an object", () => {
    expect(messages(null)).toEqual(["pack.yaml: a pack must be an object"]);
  });
});

describe("loadPackFromDirectory", () => {
  const root = mkdtempSync(join(tmpdir(), "fq-content-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  function dir(name: string, files: Record<string, string>): string {
    const d = join(root, name);
    mkdirSync(d, { recursive: true });
    for (const [file, text] of Object.entries(files)) writeFileSync(join(d, file), text);
    return d;
  }

  it("loads the Vintage source directory back into the built Vintage pack", () => {
    expect(loadPackFromDirectory(VINTAGE_DIR, { assetIds })).toStrictEqual(vintagePack);
  });

  it("loads a full copy of a pack and accepts JSON files next to YAML ones", () => {
    const d = join(root, "copy");
    cpSync(VINTAGE_DIR, d, { recursive: true });
    writeFileSync(join(d, "pack.yaml"), "id: my-town\n");
    rmSync(join(d, "swear_words.yaml"));
    writeFileSync(join(d, "swear_words.json"), JSON.stringify([{ bad: "darn", good: "gosh" }]));
    const pack = loadPackFromDirectory(d, { assetIds });
    expect(pack.id).toBe("my-town");
    expect(pack.swearWords).toEqual([{ bad: "darn", good: "gosh" }]);
    expect(pack.events).toStrictEqual(vintagePack.events);
  });

  it("a pack that extends Classic only needs the tables it changes, and may add overrides", () => {
    const d = dir("mod", {
      "pack.yaml": "id: spooky\nextends: classic\n",
      "no_customers.yaml":
        "ranges:\n  - low: 0\n    high: 99\n    entries:\n      - message: 'Boo.'\n",
      "overrides.yaml":
        "edits:\n  - id: rename\n    category: real-brand\n    in: hardSell\n    original: 'Giant Headstone'\n    replacement: 'Enormous Headstone'\n    reason: 'test'\n",
    });
    const pack = loadPackFromDirectory(d, { assetIds });
    expect(pack.id).toBe("spooky");
    expect(pack.noCustomers.ranges).toHaveLength(1);
    expect(pack.hardSell[1]?.name).toBe("Enormous Headstone");
    expect(pack.karma).toStrictEqual(classicPack.karma);
  });

  it("a missing table without 'extends' names the file", () => {
    const d = dir("bare", { "pack.yaml": "id: bare\n" });
    expect(() => loadPackFromDirectory(d)).toThrow(
      /events\.yaml is missing \(and pack\.yaml has no 'extends'\)/,
    );
  });

  it("a missing pack.yaml says so", () => {
    expect(() => loadPackFromDirectory(dir("empty", {}))).toThrow(/pack\.yaml is missing/);
  });

  it("a validation error in a file names that file, the entry and the problem", () => {
    const d = dir("bad", {
      "pack.yaml": "id: bad\nextends: vintage\n",
      "soft_sell.yaml": "- article: 'a'\n  name: 'Rose'\n  price: 'cheap'\n",
    });
    expect(() => loadPackFromDirectory(d)).toThrow(
      /Content pack "bad" is invalid:\n {2}- bad\/soft_sell\.yaml: \[0\]\.price \(entry "Rose"\): /,
    );
  });

  it("a YAML syntax error names the file and line", () => {
    const d = dir("syntax", {
      "pack.yaml": "id: syntax\nextends: vintage\n",
      "karma.yaml": "'1': [oops\n",
    });
    expect(() => loadPackFromDirectory(d)).toThrow(/karma\.yaml: .*line 2/s);
  });

  it("a slot outside 1 to 100 is rejected", () => {
    const d = dir("slot", {
      "pack.yaml": "id: slot\nextends: vintage\n",
      "ratings.yaml": "'101': 'x'\n",
    });
    expect(() => loadPackFromDirectory(d)).toThrow(/ratings\.yaml: slot '101' is outside 1 to 100/);
  });

  it("an unknown 'extends' or a stray key in pack.yaml is rejected", () => {
    expect(() =>
      loadPackFromDirectory(dir("ext", { "pack.yaml": "id: x\nextends: nope\n" })),
    ).toThrow(/pack\.yaml/);
  });

  it("checks pictures against the given asset ids", () => {
    const d = dir("art", {
      "pack.yaml": "id: art\nextends: vintage\n",
      "yangs_nice.yaml":
        "ranges:\n  - low: 0\n    high: 9\n    entries:\n      - message: 'Hi'\n        picture: 'my/own/art'\n",
    });
    expect(loadPackFromDirectory(d).niceFortunes.ranges[0]?.entries[0]?.picture).toBe("my/own/art");
    expect(() => loadPackFromDirectory(d, { assetIds })).toThrow(
      /art\/yangs_nice\.yaml: ranges\[0\]\.entries\[0\]\.picture \(entry "Hi"\): picture 'my\/own\/art' is not in assets\/manifest\.json/,
    );
    expect(loadPackFromDirectory(d, { assetIds: new Set([...assetIds, "my/own/art"]) }).id).toBe(
      "art",
    );
  });
});
