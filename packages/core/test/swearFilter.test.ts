import { describe, expect, it } from "vitest";
import { createPlayer, replaceNoCase, swearCheck } from "../src/index.js";
import { makeTown } from "./support/harness.js";
import { legacyContent } from "./support/legacyContent.js";

const words = legacyContent().swearWords;

describe("swear_words.txt loading (security.cpp:43-75)", () => {
  it("reads the active addword lines in file order and skips the commented ones", () => {
    expect(words).toHaveLength(11);
    expect(words[0]).toEqual({ bad: "fuck", good: "fudge" });
    expect(words.at(-1)).toEqual({ bad: "penis", good: "rod" });
    expect(words.map((w) => w.good)).toContain("she dog");
  });
});

describe("ReplaceNoCase (FakeCStringEx.cpp:7-28)", () => {
  it("ignores case and keeps the surrounding text", () => {
    expect(replaceNoCase("Oh FuCk me", "fuck", "fudge")).toBe("Oh fudge me");
  });
  it("replaces every occurrence", () => {
    expect(replaceNoCase("shitshit", "shit", "shoot")).toBe("shootshoot");
  });
  it("finds matches left to right without overlaps", () => {
    expect(replaceNoCase("aaa", "aa", "X")).toBe("Xa");
  });
  it("does not rescan its own replacement for the same word", () => {
    expect(replaceNoCase("aa", "a", "aa")).toBe("aaaa");
  });
  it("skips an empty word (the original would loop forever)", () => {
    expect(replaceNoCase("abc", "", "x")).toBe("abc");
  });
  it("does nothing when there is no match", () => {
    expect(replaceNoCase("hello", "fuck", "fudge")).toBe("hello");
  });
});

describe("swear_check (security.cpp:28-40)", () => {
  it("replaces inside words: it is a substring filter, not a whole-word one", () => {
    expect(swearCheck("Scunthorpe", words)).toBe("Smeanyhorpe");
    expect(swearCheck("Cocktail", words)).toBe("penciltail");
  });
  it("uses the replacements of the file", () => {
    const cases: [string, string][] = [
      ["fuck", "fudge"],
      ["Shit", "shoot"],
      ["DICK", "richard"],
      ["prick", "thorn"],
      ["pussy", "kitty"],
      ["cunt", "meany"],
      ["bitch", "she dog"],
      ["phuck", "bless"],
      ["cock", "pencil"],
      ["vagina", "wet place"],
      ["penis", "rod"],
    ];
    for (const [bad, good] of cases) expect(swearCheck(bad, words)).toBe(good);
  });
  it("applies the list in order, so a later word can match an earlier replacement", () => {
    const chain = [
      { bad: "a", good: "bb" },
      { bad: "bb", good: "c" },
    ];
    expect(swearCheck("xay", chain)).toBe("xcy");
    expect(swearCheck("xay", [...chain].reverse())).toBe("xbby");
  });
  it("is the identity when the filter is off or the list is empty", () => {
    expect(swearCheck("fuck", words, false)).toBe("fuck");
    expect(swearCheck("fuck", [])).toBe("fuck");
  });
  it("leaves clean text alone", () => {
    expect(swearCheck("Mortimer Graves", words)).toBe("Mortimer Graves");
  });
});

describe("applied to new players (new_user.cpp:22-25)", () => {
  const { town, ctx } = makeTown(5, 1);
  const form = {
    logon: "newbie",
    name: "Newbie",
    parlor: "New Rest",
    password: "x",
    passwordVerify: "x",
    male: true,
    email: "n@example.com",
  };

  it("cleans the name and the parlor but not the logon name", () => {
    const r = createPlayer(
      town,
      { ...form, logon: "fuckme", name: "Dickens", parlor: "Shit Happens" },
      ctx,
    );
    if (!r.ok) throw new Error("expected ok");
    const p = r.town.players[r.playerId];
    expect(p?.name).toBe("richardens");
    expect(p?.parlor).toBe("shoot Happens");
    expect(p?.logon).toBe("fuckme");
  });

  it("runs before the length checks, so a long result is refused", () => {
    const r = createPlayer(town, { ...form, name: "bitchbitchbitchb" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("name");
  });

  it("runs after stripping, so punctuation cannot hide a word", () => {
    const r = createPlayer(town, { ...form, name: "fu:ck man" }, ctx);
    if (!r.ok) throw new Error("expected ok");
    expect(r.town.players[r.playerId]?.name).toBe("fudge man");
  });

  it("can be switched off in the settings", () => {
    const off = makeTown(5, 1, { settings: { swearFilter: false } });
    const r = createPlayer(off.town, { ...form, name: "Dickens" }, off.ctx);
    if (!r.ok) throw new Error("expected ok");
    expect(r.town.players[r.playerId]?.name).toBe("Dickens");
  });
});
