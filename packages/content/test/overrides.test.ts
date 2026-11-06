import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLASSIC_TEXT, type ContentPack } from "@fq/core";
import { describe, expect, it } from "vitest";
import {
  applyOverrides,
  classicPack,
  type Edit,
  OverrideError,
  overridesFileSchema,
  TABLE_KEYS,
  vintagePack,
} from "../src/index.js";
import { fromYaml } from "../src/yamlio.js";
import { PACKAGE_ROOT } from "./support.js";

const overridesPath = join(PACKAGE_ROOT, "packs/classic/overrides.yaml");
const file = overridesFileSchema.parse(
  fromYaml(readFileSync(overridesPath, "utf8"), overridesPath),
);
const edits = file.edits;

function edit(partial: Partial<Edit> & Pick<Edit, "original" | "replacement">): Edit {
  return {
    id: "t",
    category: "real-brand",
    in: "karma",
    reason: "test",
    ...partial,
  };
}

/** Every string in a table, with its path. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

describe("the Classic edit list", () => {
  it("is short, and each edit says why in one line", () => {
    expect(edits.length).toBeGreaterThan(0);
    expect(edits.length).toBeLessThanOrEqual(25);
    expect(new Set(edits.map((e) => e.id)).size).toBe(edits.length);
    for (const e of edits) expect(e.reason).not.toMatch(/[\r\n]/);
  });

  it("finds every original exactly once in the Vintage table it names", () => {
    for (const e of edits) {
      const hits = strings(vintagePack[e.in]).filter(([, s]) => s.includes(e.original));
      expect(hits, e.id).toHaveLength(1);
      expect(hits[0]?.[1].split(e.original), e.id).toHaveLength(2);
    }
  });

  it("is what classicPack is: Vintage with those edits and no others", () => {
    expect(classicPack).toStrictEqual(applyOverrides(vintagePack, edits, "classic"));
    const changed: string[] = [];
    for (const table of TABLE_KEYS) {
      const before = strings(vintagePack[table]);
      const after = strings(classicPack[table]);
      expect(after.map(([p]) => p)).toEqual(before.map(([p]) => p));
      before.forEach(([path, text], i) => {
        if (after[i]?.[1] !== text) changed.push(`${table}.${path}`);
      });
    }
    expect(changed).toHaveLength(edits.length);
  });

  it("keeps every number, picture and table length", () => {
    const strip = (pack: ContentPack): string =>
      JSON.stringify(pack, (_k, v: unknown) => (typeof v === "string" ? "" : v));
    expect(strip(classicPack)).toBe(strip({ ...vintagePack, id: "classic" }));
  });

  it("leaves Vintage's text as the untouched CLASSIC_TEXT and Classic's edited", () => {
    expect(vintagePack.text).toStrictEqual(CLASSIC_TEXT);
    expect(classicPack.text).not.toStrictEqual(CLASSIC_TEXT);
    expect(classicPack.id).toBe("classic");
    expect(vintagePack.id).toBe("vintage");
  });

  it("removes the originals from Classic and puts the replacements in", () => {
    for (const e of edits) {
      const text = strings(classicPack[e.in]).map(([, s]) => s);
      expect(
        text.some((s) => s.includes(e.original)),
        e.id,
      ).toBe(false);
      expect(
        text.some((s) => s.includes(e.replacement)),
        e.id,
      ).toBe(true);
    }
  });
});

describe("applyOverrides", () => {
  it("replaces part of a string", () => {
    const out = applyOverrides(
      vintagePack,
      [edit({ original: "Angelic", replacement: "Saintly" })],
      "x",
    );
    expect(out.karma[99]).toBe("Saintly ");
    expect(vintagePack.karma[99]).toBe("Angelic ");
  });

  it("fails when the original is not found, naming the edit", () => {
    expect(() =>
      applyOverrides(
        vintagePack,
        [edit({ id: "gone", original: "No such text", replacement: "x" })],
        "x",
      ),
    ).toThrow(
      /Edit "gone": original text "No such text" was found 0 times in 'karma', expected exactly once/,
    );
  });

  it("fails when the original is found more than once", () => {
    expect(() =>
      applyOverrides(
        vintagePack,
        [
          edit({
            id: "twice",
            original: "Your parlor is in the top 20 percent.",
            replacement: "x",
            in: "ratings",
          }),
        ],
        "x",
      ),
    ).toThrow(
      /Edit "twice": .*found 4 times in 'ratings'.* \(at slot 86, slot 88, slot 89, slot 90\)/,
    );
  });

  it("looks only in the table named by 'in'", () => {
    expect(() =>
      applyOverrides(
        vintagePack,
        [edit({ id: "wrong", original: "Paul Crouch", replacement: "x", in: "ratings" })],
        "x",
      ),
    ).toThrow(/found 0 times in 'ratings'/);
  });

  it("checks against the untouched base, so one edit cannot satisfy another", () => {
    const a = edit({ id: "a", original: "Angelic", replacement: "Satan Himself" });
    const b = edit({ id: "b", original: "Satan Himself", replacement: "Angelic" });
    const out = applyOverrides(vintagePack, [a, b], "x");
    expect(out.karma[99]).toBe("Satan Himself ");
    expect(out.karma[1]).toBe("Angelic");
  });

  it("refuses two edits that overlap", () => {
    expect(() =>
      applyOverrides(
        vintagePack,
        [
          edit({ id: "a", original: "Mobster", replacement: "x" }),
          edit({ id: "b", original: "bster", replacement: "y" }),
        ],
        "x",
      ),
    ).toThrow(OverrideError);
  });

  it("applies two edits in one string", () => {
    const out = applyOverrides(
      vintagePack,
      [
        edit({ id: "a", original: "Drug", replacement: "Cheese" }),
        edit({ id: "b", original: "dealer", replacement: "baron" }),
      ],
      "x",
    );
    expect(out.karma[11]).toBe("Cheese baron");
  });

  it("refuses a replacement that drops or adds a placeholder", () => {
    const original = "but we were REALLY close if you know what I mean.";
    const ok = applyOverrides(
      vintagePack,
      [edit({ in: "text", original, replacement: "close." })],
      "x",
    );
    expect(ok.text.negotiation.sympathyLoved[2]).toContain("close.");
    expect(() =>
      applyOverrides(
        vintagePack,
        [edit({ id: "ph", in: "text", original: '{customer}"Um, no."', replacement: '"Um, no."' })],
        "x",
      ),
    ).toThrow(/Edit "ph": replacement changes the placeholders \(\{customer\} became none\)/);
    expect(
      applyOverrides(
        vintagePack,
        [
          edit({
            id: "ph",
            in: "text",
            original: '{customer}"Um, no."',
            replacement: '"Um, no."',
            allowPlaceholderChange: true,
          }),
        ],
        "x",
      ).text.negotiation.softRefuse[2],
    ).toBe('"Um, no."');
  });

  it("refuses a no-op and a duplicate id", () => {
    expect(() =>
      applyOverrides(vintagePack, [edit({ original: "Angelic", replacement: "Angelic" })], "x"),
    ).toThrow(/same as the original/);
    const a = edit({ id: "a", original: "Angelic", replacement: "A" });
    expect(() =>
      applyOverrides(vintagePack, [a, { ...a, original: "Mobster", replacement: "M" }], "x"),
    ).toThrow(/id is used twice/);
  });
});

describe("the overrides file format", () => {
  it("rejects a category outside the policy, an unknown field and a multi-line reason", () => {
    const base = {
      id: "a",
      category: "real-brand",
      in: "karma",
      original: "x",
      replacement: "y",
      reason: "r",
    };
    expect(overridesFileSchema.safeParse({ edits: [base] }).success).toBe(true);
    expect(overridesFileSchema.safeParse({ edits: [{ ...base, category: "taste" }] }).success).toBe(
      false,
    );
    expect(overridesFileSchema.safeParse({ edits: [{ ...base, extra: 1 }] }).success).toBe(false);
    expect(overridesFileSchema.safeParse({ edits: [{ ...base, reason: "a\nb" }] }).success).toBe(
      false,
    );
    expect(overridesFileSchema.safeParse({ edits: [{ ...base, in: "nope" }] }).success).toBe(false);
  });
});
