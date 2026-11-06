import { describe, expect, it } from "vitest";
import {
  decodeBody,
  decodeResidual,
  encodeBody,
  encodeValue,
  formatForLocal,
  formatForLocalCst,
  parseRequestQuery,
} from "../src/escape.js";

/** Every `Replace` of `format_for_local` (legacy/source/shared_util.cpp:41-82), as [encoded, decoded]. */
const CASES: [string, string][] = [
  ["+", " "],
  ["%5F", "_"],
  ["%40", "@"],
  ["%21", "!"],
  ["%22", '"'],
  ["%23", "#"],
  ["%24", "$"],
  ["%26", ""],
  ["%2C", ","],
  ["%2E", "."],
  ["%5E", ""],
  ["%2A", ""],
  ["%28", "("],
  ["%29", ")"],
  ["%2B", ""],
  ["%2D", "-"],
  ["%60", "`"],
  ["%7E", "~"],
  ["%27", "'"],
  ["%3A", ":"],
  ["%3B", ";"],
  ["%3E", ">"],
  ["%3C", ""],
  ["%2F", "/"],
  ["%3D", "="],
  ["%3F", "?"],
  ["%7C", "|"],
  ["%7B", "{"],
  ["%7D", "}"],
  ["%5BD", "["],
  ["%0D", "\r\n"],
  ["%25", "%%"],
];

describe("format_for_local (shared_util.cpp:41-82)", () => {
  for (const [encoded, decoded] of CASES) {
    it(`${encoded} becomes ${JSON.stringify(decoded)}`, () => {
      expect(formatForLocal(`a${encoded}b`)).toBe(`a${decoded}b`);
    });
  }

  it("has the original's typo: %5B and %5D are left alone, and %5BD becomes only '['", () => {
    expect(formatForLocal("%5B")).toBe("%5B");
    expect(formatForLocal("%5D")).toBe("%5D");
    expect(formatForLocal("x%5BDy")).toBe("x[y");
  });

  it("runs the replacements one pass at a time, in the original order", () => {
    // "+" goes first, so a real space and "%2B" (stripped) never meet.
    expect(formatForLocal("a+b%2Bc")).toBe("a bc");
    // "%25" goes last: its output is never decoded again.
    expect(formatForLocal("%2541")).toBe("%%41");
    // "%2523" holds "%23" only after "%25" would have been decoded, so it stays.
    expect(formatForLocal("%2523")).toBe("%%23");
  });

  it("only knows upper-case hex digits, as the original did", () => {
    expect(formatForLocal("%2c")).toBe("%2c");
  });

  it("leaves sequences it does not know (non-ASCII bytes, %20)", () => {
    expect(formatForLocal("caf%E9%20x")).toBe("caf%E9%20x");
  });
});

describe("format_for_local_cst (shared_util.cpp:84-120)", () => {
  it("is the same list with %5B and %5D fixed", () => {
    expect(formatForLocalCst("%5Bx%5D")).toBe("[x]");
    for (const [encoded, decoded] of CASES) {
      if (encoded === "%5BD") continue;
      expect(formatForLocalCst(`a${encoded}b`)).toBe(`a${decoded}b`);
    }
  });
});

describe("decodeResidual", () => {
  it("turns what the original left as %%  back into one percent sign", () => {
    expect(decodeResidual("50%%")).toBe("50%");
    expect(decodeResidual("%%41")).toBe("%41");
  });

  it("reads Windows-1252 and UTF-8 bytes", () => {
    expect(decodeResidual("caf%E9")).toBe("café");
    expect(decodeResidual("caf%C3%A9")).toBe("café");
    expect(decodeResidual("%80%99")).toBe("€™");
  });
});

describe("request parsing (request_process and tokenize_input)", () => {
  it("reads the verb up to the first & or ?", () => {
    expect(parseRequestQuery("checklogon&key=0.5&i_sent=0").verb).toBe("checklogon");
    expect(parseRequestQuery("command").verb).toBe("command");
    expect(parseRequestQuery("command?i_command=2").params.get("i_command")).toBe("2");
  });

  it("decodes names and values with the original rules", () => {
    const r = parseRequestQuery("command&st_input=Hi+there%2C+%22you%22%21&i_command=24&key=0.25");
    expect(r.params.get("st_input")).toBe('Hi there, "you"!');
    expect(r.params.get("i_command")).toBe("24");
    expect(r.params.get("key")).toBe("0.25");
  });

  it("removes characters the original removed", () => {
    const r = parseRequestQuery("command&st_input=a%26b%2Bc%3Cd%5Ee%2Af");
    expect(r.params.get("st_input")).toBe("abcdef");
  });

  it("skips tokens without '=' instead of failing the request", () => {
    const r = parseRequestQuery("command&oops&i_command=3");
    expect(r.malformed).toEqual(["oops"]);
    expect(r.params.get("i_command")).toBe("3");
  });

  it("splits values at the first '='", () => {
    expect(parseRequestQuery("command&st_note=a%3Db").params.get("st_note")).toBe("a=b");
    expect(parseRequestQuery("command&x=a=b").params.get("x")).toBe("a=b");
  });
});

describe("response encoding", () => {
  it("survives & = % + and the other awkward characters", () => {
    const awkward = 'a&b=c%d+e f"g,h;i:j!k\nl\tm<n>o#p/q?r';
    const body = encodeBody([
      ["st_main", awkward],
      ["i_sent", 10],
    ]);
    expect(body).not.toMatch(/[ "\n]/);
    expect(body.split("&").filter(Boolean)).toHaveLength(2);
    const back = decodeBody(body);
    expect(back.get("st_main")).toBe(awkward);
    expect(back.get("i_sent")).toBe("10");
  });

  it("writes spaces as + and every pair ends with &, with no trailer", () => {
    expect(encodeBody([["a", "b c"]])).toBe("a=b+c&");
    expect(encodeBody([])).toBe("");
  });

  it("encodes non-ASCII as UTF-8 bytes (what Ruffle reads)", () => {
    expect(encodeValue("café")).toBe("caf%C3%A9");
    expect(encodeValue("€")).toBe("%E2%82%AC");
    expect(decodeBody(encodeBody([["a", "José Müller 日本"]])).get("a")).toBe("José Müller 日本");
  });

  it("keeps unreserved characters as they are", () => {
    expect(encodeValue("Az09-_.~")).toBe("Az09-_.~");
  });
});
