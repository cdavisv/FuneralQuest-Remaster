import { describe, expect, it } from "vitest";
import { Blocklist, hashLine, hashWord } from "../src/moderation/blocklist.js";

describe("the strict word list", () => {
  it("treats a hashed entry exactly like the plain word, without keeping the word", () => {
    const plain = Blocklist.parse("snorkel\n~wibblewobble\n");
    const hashed = Blocklist.parse(
      ["snorkel", "~wibblewobble"].map((l) => hashLine(l) ?? "").join("\n"),
    );
    for (const list of [plain, hashed]) {
      expect(list.check("a Snorkel appears").blocked).toBe(true);
      expect(list.check("sn0rkel!").blocked).toBe(true);
      expect(list.check("snörkel").blocked).toBe(true);
      expect(list.check("s n o r k e l").blocked).toBe(true);
      expect(list.check("snorkeling").blocked).toBe(false); // whole word only
      expect(list.check("xxwibble-wobblexx").blocked).toBe(true); // anywhere
      expect(list.check("a perfectly nice announcement").blocked).toBe(false);
    }
    expect(hashLine("snorkel")).toBe(`sha256:${hashWord("snorkel")}`);
    expect(hashLine("~wibblewobble")).toMatch(/^~sha256:[0-9a-f]{64}$/);
    expect(hashLine("# a comment")).toBeNull();
    expect(JSON.stringify(plain)).not.toContain("snorkel");
  });

  it("reports a hash prefix and never the word", () => {
    const list = Blocklist.parse("snorkel");
    const verdict = list.check("snorkel");
    expect(verdict).toMatchObject({ blocked: true });
    expect(JSON.stringify(verdict)).not.toContain("snorkel");
  });

  it("ignores blanks, comments and malformed hashes", () => {
    const list = Blocklist.parse("\n# nothing here\n sha256:nothex \n\n");
    expect(list.size).toBe(0);
    expect(list.check("anything").blocked).toBe(false);
  });
});
