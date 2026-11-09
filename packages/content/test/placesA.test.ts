import { PLACES_A_STARTER } from "@fq/core";
import { describe, expect, it } from "vitest";
import { bannedTerms } from "../src/banned.js";

/** Every string of a value, with its path. */
function strings(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => strings(v, path === "" ? k : `${path}.${k}`));
  return [];
}

describe("the batch-A places' text (core townPlacesA.ts)", () => {
  it("passes the banned-terms policy (it is new text)", () => {
    const hits = strings(PLACES_A_STARTER).flatMap(([path, text]) =>
      bannedTerms(text).map((h) => `${path}: ${h.term}`),
    );
    expect(hits).toEqual([]);
  });

  it("has balanced braces and no empty strings", () => {
    for (const [path, text] of strings(PLACES_A_STARTER)) {
      expect(text.trim(), path).not.toBe("");
      expect((text.match(/\{/g) ?? []).length, path).toBe((text.match(/\}/g) ?? []).length);
    }
  });
});
