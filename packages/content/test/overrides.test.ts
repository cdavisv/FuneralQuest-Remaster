import { describe, expect, it } from "vitest";
import {
  applyOverrides,
  classicPack,
  type Edit,
  OverrideError,
  overridesFileSchema,
} from "../src/index.js";

/**
 * The override mechanism is kept for a sysop's own packs (`FQ_PACKS_DIR`); the built-in packs may
 * not use it, because the original game text must remain (original.test.ts proves the Classic pack
 * has no edits and that an overrides file in a built-in pack fails the build). These tests use
 * Classic only as a convenient table of real text to edit a copy of.
 */

function edit(partial: Partial<Edit> & Pick<Edit, "original" | "replacement">): Edit {
  return {
    id: "t",
    category: "real-brand",
    in: "karma",
    reason: "test",
    ...partial,
  };
}

describe("applyOverrides", () => {
  it("replaces part of a string", () => {
    const out = applyOverrides(
      classicPack,
      [edit({ original: "Angelic", replacement: "Saintly" })],
      "x",
    );
    expect(out.karma[99]).toBe("Saintly ");
    expect(classicPack.karma[99]).toBe("Angelic ");
  });

  it("fails when the original is not found, naming the edit", () => {
    expect(() =>
      applyOverrides(
        classicPack,
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
        classicPack,
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
        classicPack,
        [edit({ id: "wrong", original: "Paul Crouch", replacement: "x", in: "ratings" })],
        "x",
      ),
    ).toThrow(/found 0 times in 'ratings'/);
  });

  it("checks against the untouched base, so one edit cannot satisfy another", () => {
    const a = edit({ id: "a", original: "Angelic", replacement: "Satan Himself" });
    const b = edit({ id: "b", original: "Satan Himself", replacement: "Angelic" });
    const out = applyOverrides(classicPack, [a, b], "x");
    expect(out.karma[99]).toBe("Satan Himself ");
    expect(out.karma[1]).toBe("Angelic");
  });

  it("refuses two edits that overlap", () => {
    expect(() =>
      applyOverrides(
        classicPack,
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
      classicPack,
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
      classicPack,
      [edit({ in: "text", original, replacement: "close." })],
      "x",
    );
    expect(ok.text.negotiation.sympathyLoved[2]).toContain("close.");
    expect(() =>
      applyOverrides(
        classicPack,
        [edit({ id: "ph", in: "text", original: '{customer}"Um, no."', replacement: '"Um, no."' })],
        "x",
      ),
    ).toThrow(/Edit "ph": replacement changes the placeholders \(\{customer\} became none\)/);
    expect(
      applyOverrides(
        classicPack,
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
      applyOverrides(classicPack, [edit({ original: "Angelic", replacement: "Angelic" })], "x"),
    ).toThrow(/same as the original/);
    const a = edit({ id: "a", original: "Angelic", replacement: "A" });
    expect(() =>
      applyOverrides(classicPack, [a, { ...a, original: "Mobster", replacement: "M" }], "x"),
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
