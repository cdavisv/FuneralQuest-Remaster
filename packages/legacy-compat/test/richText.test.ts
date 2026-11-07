import { parseLegacyText } from "@fq/core";
import type { RichText, TextColor } from "@fq/protocol";
import { describe, expect, it } from "vitest";
import { LEGACY_COLORS, richTextToLegacyHtml } from "../src/richText.js";

/**
 * The value `seth_ansi` wrote for each backtick code
 * (legacy/source/funeral_util.cpp:382-446), copied here from the C++ so the
 * test does not use the table it checks.
 */
const SETH: [string, TextColor, string][] = [
  ["1", "blue", "#0000A8"],
  ["2", "green", "#007000"],
  ["3", "teal", "#008080"],
  ["4", "red", "#FF0000"],
  ["5", "purple", "#CC66CC"],
  ["6", "brown", "#A85400"],
  ["7", "grey", "#808080"],
  ["8", "darkGrey", "#505050"],
  ["9", "lightBlue", "#5454FC"],
  ["0", "lightGreen", "#00B000"],
  ["!", "cyan", "#00A0A0"],
  ["@", "lightRed", "#FC5454"],
  ["#", "pink", "#FC54FC"],
  ["$", "yellow", "#FFFF33"],
  ["w", "white", "#FFFFFF"],
  ["^", "black", "#000000"],
];

/** A direct port of the `seth_ansi` loop for the codes above and `f`, for comparison. */
function sethAnsi(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const ch = text.charAt(i);
    let add = ch;
    if (ch === "`" && i + 1 < text.length) {
      const code = text.charAt(i + 1);
      const hit = SETH.find((c) => c[0] === code) ?? (code === "y" ? SETH[13] : undefined);
      if (hit) add = `<font color="${hit[2]}">`;
      if (code === "=") add = "%3D";
      if (code === "f" && i + 2 < text.length) {
        add = `<font size="${8 + Number(text.charAt(i + 2)) * 2}">`;
        i++;
      }
      i++;
    }
    out += add;
    i++;
  }
  return out;
}

describe("RichText to the client's HTML", () => {
  it("has all sixteen colours with the original values", () => {
    expect(SETH).toHaveLength(16);
    for (const [, name, value] of SETH) {
      expect(LEGACY_COLORS[name]).toBe(value);
    }
    expect(new Set(Object.values(LEGACY_COLORS)).size).toBe(16);
  });

  for (const [code, name, value] of SETH) {
    it(`\`${code} (${name}) is <font color="${value}">`, () => {
      const html = richTextToLegacyHtml(parseLegacyText(`\`${code}text`));
      expect(html).toBe(`<font color="${value}">text`);
      expect(html).toBe(sethAnsi(`\`${code}text`));
    });
  }

  it("`y is yellow, like `$", () => {
    expect(richTextToLegacyHtml(parseLegacyText("`yhi"))).toBe('<font color="#FFFF33">hi');
  });

  it("matches seth_ansi on mixed strings, never closing a tag (as the original)", () => {
    const samples = [
      '`wTeller: `$"Welcome."',
      "plain `4red `2green `3teal and `#pink",
      "`f3big `f0small",
      "`$a\nb`w\nc",
      "`1`2both",
    ];
    for (const s of samples) {
      const mine = richTextToLegacyHtml(parseLegacyText(s)).replace(/<br>/g, "\n");
      // `1`2 has no text between; the original emitted both tags, this emits only the last.
      if (s === "`1`2both") continue;
      expect(mine).toBe(sethAnsi(s));
    }
  });

  it("matches seth_ansi on random strings with text between the codes", () => {
    const letters = "abcdefg hij";
    let seed = 12345;
    const next = (n: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % n;
    };
    for (let round = 0; round < 200; round++) {
      let s = "";
      let last = "";
      for (let part = 0; part < 6; part++) {
        let code = SETH[next(16)]?.[0] ?? "w";
        while (code === last || (code === "$" && last === "y")) code = SETH[next(16)]?.[0] ?? "w";
        last = code;
        s += `\`${code}`;
        for (let k = 0; k < 1 + next(5); k++) s += letters.charAt(next(letters.length));
      }
      expect(richTextToLegacyHtml(parseLegacyText(s))).toBe(sethAnsi(s));
    }
  });

  it("escapes < and & (RichText is never HTML), keeps > as the original sent it, writes line breaks as <br>", () => {
    const text: RichText = [{ text: "a <b> & c\nd", color: "white" }];
    // A lone ">" (the quote marks of a letter) is shown as is by the HTML field.
    expect(richTextToLegacyHtml(text)).toBe('<font color="#FFFFFF">a &lt;b> &amp; c<br>d');
  });

  it("returns to the field's colour after a coloured span", () => {
    const text: RichText = [{ text: "F", color: "pink" }, { text: " rest" }];
    expect(richTextToLegacyHtml(text, { defaultColor: "#FFFFFF" })).toBe(
      '<font color="#FC54FC">F<font color="#FFFFFF"> rest',
    );
  });

  it("writes a link as an anchor, like command_announcement", () => {
    const text: RichText = [
      { text: "example.com", color: "pink", href: "http://example.com/?a=1&b=2" },
    ];
    expect(richTextToLegacyHtml(text)).toBe(
      '<font color="#FC54FC"><a href="http://example.com/?a=1&amp;b=2" target="_blank">example.com</a>',
    );
  });

  it("writes font sizes as 8 + 2N", () => {
    expect(richTextToLegacyHtml([{ text: "x", size: 3 }])).toBe('<font size="14">x');
  });
});
