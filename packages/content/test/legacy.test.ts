import { describe, expect, it } from "vitest";
import { vintagePack } from "../src/index.js";
import {
  atoi,
  legacyLines,
  parseItems,
  parseRanged,
  parseRisks,
  parseSlots,
  parseSwearWords,
  word,
} from "../src/legacy.js";

const crlf = (...lines: string[]): string => `${lines.join("\r\n")}\r\n`;

describe("line and word splitting (CTextParse)", () => {
  it("drops the CR of CRLF and keeps spaces", () => {
    expect(legacyLines("a|b \r\n  c\r\n")).toEqual(["a|b ", "  c", ""]);
  });

  it("get_word is 1-based, unsplit text is kept, a missing word is empty", () => {
    expect(word("key|  two spaces |x", 2)).toBe("  two spaces ");
    expect(word("key", 2)).toBe("");
  });

  it("atoi reads a leading number and otherwise 0", () => {
    expect([atoi(" 12abc"), atoi("-3"), atoi("+7"), atoi("abc"), atoi("")]).toEqual([
      12, -3, 7, 0, 0,
    ]);
  });
});

describe("text is kept byte for byte", () => {
  it("keeps literal backslash-n pairs, backtick codes and spacing", () => {
    const { table } = parseRanged(
      "x.txt",
      crlf("range|0|9", "start_entry", 'message|`4Hi\\n\\n`$there  "quoted" it\'s  '),
    );
    expect(table.ranges[0]?.entries[0]?.message).toBe('`4Hi\\n\\n`$there  "quoted" it\'s  ');
    expect(table.ranges[0]?.entries[0]?.message).not.toContain("\n");
  });

  it("keeps the real vintage texts as written", () => {
    const first = vintagePack.risks[0];
    expect(first?.startMessage).toContain('\\n\\n`wWoman: `$"Hello *SIR*');
    expect(first?.normalLabel).toBe("  Give ring");
    expect(first?.riskLabel).toBe("      Lie");
  });
});

describe("ranges and entries (CEvent)", () => {
  const text = crlf(
    "//comment",
    "range|-5|5",
    "start_entry",
    "message|one",
    "mod_bp|3|6",
    "mod_luck|2",
    "set_pic|flash\\places\\Bank.swf",
    "range|10|20",
    "start_entry",
    "message|two",
    "title|T",
    "message|two again",
  );

  it("builds ranges in file order, with modifiers, pictures and the last repeated key", () => {
    const { table, notes } = parseRanged("x.txt", text);
    expect(table.ranges.map((r) => [r.low, r.high, r.entries.length])).toEqual([
      [-5, 5, 1],
      [10, 20, 1],
    ]);
    expect(table.ranges[0]?.entries[0]).toEqual({
      message: "one",
      modBp: [3, 6],
      modLuck: [2, 0],
      picture: "places/bank",
    });
    expect(table.ranges[1]?.entries[0]).toEqual({ message: "two again", title: "T" });
    expect(notes.map((n) => n.message)).toEqual([
      "'message' repeated in one entry: the last value wins",
    ]);
  });

  it("an empty set_pic is no picture", () => {
    const { table } = parseRanged(
      "x.txt",
      crlf("range|0|1", "start_entry", "set_pic|", "message|m"),
    );
    expect(table.ranges[0]?.entries[0]).toEqual({ message: "m" });
  });

  it("reports unknown lines and dropped text, but not comments", () => {
    const { notes } = parseRanged(
      "x.txt",
      crlf("; note", "// note", "range|0|1", "start_entry", "mesage|typo", "message|a|b"),
    );
    expect(notes.map((n) => n.message)).toEqual([
      "unrecognised line ignored by the original: 'mesage|typo'",
      "'message' has extra '|' fields that the original drops (text after the second '|' is lost)",
    ]);
  });

  it("flags a picture the manifest does not have", () => {
    const { notes } = parseRanged(
      "x.txt",
      crlf("range|0|1", "start_entry", "set_pic|flash/nope.swf"),
      { assetIds: new Set(["places/bank"]) },
    );
    expect(notes).toEqual([
      expect.objectContaining({
        line: 3,
        level: "warning",
        message: expect.stringContaining("'nope'"),
      }),
    ]);
  });
});

describe("risks.txt: a key a block omits keeps the previous block's value", () => {
  const text = crlf(
    "start_message|first",
    "start_url|flash/a.swf",
    "start_url_bg|flash/bg.swf",
    "normal|N1",
    "risk|R1",
    "normal_message|nm1",
    "normal_url|flash/n.swf",
    "normal_url_bg|",
    "fail_message|fm1",
    "fail_url|flash/f.swf",
    "fail_url_bg|flash/fbg.swf",
    "success_message|sm1",
    "success_url|flash/s.swf",
    "success_url_bg|",
    "add_risk|",
    "start_message|second",
    "normal|N2",
    "fail_url_bg|",
    "add_risk|",
  );

  it("resolves the inherited values, including pictures", () => {
    const { risks, notes } = parseRisks("risks.txt", text);
    expect(risks).toHaveLength(2);
    expect(risks[0]).toMatchObject({
      startMessage: "first",
      startPicture: "a",
      failBackground: "fbg",
    });
    expect(risks[1]).toEqual({
      startMessage: "second",
      startPicture: "a",
      startBackground: "bg",
      normalLabel: "N2",
      riskLabel: "R1",
      normalMessage: "nm1",
      normalPicture: "n",
      failMessage: "fm1",
      failPicture: "f",
      successMessage: "sm1",
      successPicture: "s",
    });
    expect(notes.filter((n) => n.level === "info")).toHaveLength(1);
  });

  it("an explicit blank value clears the inherited one", () => {
    const { risks } = parseRisks("risks.txt", text);
    expect(risks[1]?.failBackground).toBeUndefined();
    expect(risks[0]?.failBackground).toBe("fbg");
  });

  it("a key the first block never sets is empty and reported", () => {
    const { risks, notes } = parseRisks("risks.txt", crlf("start_message|only", "add_risk|"));
    expect(risks[0]?.normalLabel).toBe("");
    expect(notes[0]?.level).toBe("warning");
  });

  it("the real file: risk 8 inherits normal_url_bg from risk 7", () => {
    expect(vintagePack.risks[6]?.normalBackground).toBe("blank");
    expect(vintagePack.risks[7]?.normalBackground).toBe("blank");
  });

  it("the real file keeps only the first path of start_url_bg|path|comment", () => {
    expect(vintagePack.risks[3]?.startBackground).toBe("background/background_celemony");
  });
});

describe("soft_sell.txt and hard_sell.txt carry values the same way", () => {
  const text = crlf(
    "reference|a",
    "name|One",
    "price|10",
    "add_item|",
    "name|Two",
    "add_item|",
    "reference|some|",
    "price|oops",
    "add_item|",
  );

  it("an omitted key keeps the previous item's value; a trailing pipe is harmless", () => {
    const { items, notes } = parseItems("soft_sell.txt", text);
    expect(items).toEqual([
      { article: "a", name: "One", price: 10 },
      { article: "a", name: "Two", price: 10 },
      { article: "some", name: "Two", price: 0 },
    ]);
    expect(notes.map((n) => n.level)).toEqual(["info", "warning", "info"]);
  });
});

describe("ratings.txt and karma.txt are exactly 100 slots (load_strings)", () => {
  const text = crlf(
    "//comment",
    "1|first",
    "100|last",
    "101|too high",
    "0|zero",
    "-3|negative",
    "50|a|b",
    "50|again",
  );

  it("fills slots 1 to 100, ignores everything else, last line wins", () => {
    const { slots, notes } = parseSlots("ratings.txt", text);
    expect(slots).toHaveLength(100);
    expect(slots[0]).toBe("first");
    expect(slots[99]).toBe("last");
    expect(slots[49]).toBe("again");
    expect(slots.filter((s) => s !== "")).toHaveLength(3);
    expect(notes.filter((n) => n.level === "warning").map((n) => n.line)).toEqual([4, 5, 6, 7, 8]);
  });

  it("an empty file is 100 empty slots", () => {
    expect(parseSlots("karma.txt", "").slots).toEqual(new Array(100).fill(""));
  });

  it("the built packs have 100 slots; ratings fills 97 of them and karma 75", () => {
    for (const table of [vintagePack.ratings, vintagePack.karma]) expect(table).toHaveLength(100);
    expect(vintagePack.ratings.filter((s) => s !== "")).toHaveLength(97);
    expect(vintagePack.ratings[66]).toBe("");
    expect(vintagePack.ratings[65]).toBe("Mr Yang even remembers your name.");
    expect(vintagePack.karma.filter((s) => s !== "")).toHaveLength(75);
    expect(vintagePack.karma[59]).toBe("");
    expect(vintagePack.karma[99]).toBe("Angelic ");
  });
});

describe("swear_words.txt", () => {
  it("reads addword lines in order and skips the ; examples", () => {
    const { words } = parseSwearWords(
      "swear_words.txt",
      crlf(";addword|god|`%Seth`2", "addword|a|b", "addword|c|", ";c"),
    );
    expect(words).toEqual([
      { bad: "a", good: "b" },
      { bad: "c", good: "" },
    ]);
  });
});
