import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Request } from "../src/commands.js";
import { REPO_ROOT } from "../src/content.js";
import { createDevHost } from "../src/devHost.js";
import { decodeBody, encodeBody, encodeValue } from "../src/escape.js";
import { legacyCompat } from "../src/plugin.js";
import { htmlText } from "../src/richText.js";
import { FlashClient, type Reply } from "./support/flashClient.js";

/**
 * What the original put on the wire for a `request.xp` response, built from the original's own
 * source, against what the bridge sends.
 *
 * The original (`send_msg`, `legacy/source/httpa.c:104-139`) took the string the command had built
 * with `add_var` (`name=value&`, `funeral_util.cpp:315-334`, nothing escaped there), appended the
 * four characters `/r/n` (a slash, an r, a slash, an n: not a carriage return and a line feed),
 * ran `format_for_web_cst` over the whole thing (`shared_util.cpp:4-17`: space to `+`, and `"`
 * `!` `,` `;` `:` to `%22` `%21` `%2C` `%3B` `%3A`; nothing else) and `send`-ed the bytes down the
 * socket as they were. There was no status line and no header (`HTTP/1.0 200 OK`... is written
 * only for files, `httpa.c:853`), and no character set: the bytes were whatever the text held,
 * and the game's text files and source hold only ASCII (checked below), so only a name a player
 * typed could be anything else (the client sent Windows-1252 bytes, which the bridge reads).
 */

const SOURCE = resolve(REPO_ROOT, "legacy/source");

/** The body of the C function that starts at `header`, up to the closing brace in column 0. */
function functionBody(file: string, header: string): string {
  const text = readFileSync(resolve(SOURCE, file), "latin1");
  const start = text.indexOf(header);
  if (start === -1) throw new Error(`${header} not found in ${file}`);
  const end = text.indexOf("\n}", start);
  return text.slice(start, end);
}

/** `format_for_web_cst`'s live `Replace` calls, in order (commented ones are dead code). */
function originalReplacements(): [string, string][] {
  const out: [string, string][] = [];
  for (const line of functionBody("shared_util.cpp", "void format_for_web_cst").split("\n")) {
    if (line.trim().startsWith("//")) continue;
    const m = line.match(/Replace\("((?:[^"\\]|\\.)*)","((?:[^"\\]|\\.)*)"\)/);
    if (m) out.push([(m[1] as string).replace(/\\"/g, '"'), m[2] as string]);
  }
  return out;
}

/** What the original sent for these variables: `add_var` for each, `/r/n`, then `format_for_web_cst`. */
function originalWire(vars: readonly (readonly [string, string | number])[]): string {
  let wire = "";
  for (const [name, value] of vars) wire += `${name}=${value}&`;
  wire += "/r/n";
  for (const [from, to] of originalReplacements()) wire = wire.split(from).join(to);
  return wire;
}

/** What Flash's `loadVariables` makes of a body whose bytes are Latin-1: `&` pairs, `+` and `%XX` decoded. */
function flashReads(wire: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of wire.split("&")) {
    const at = pair.indexOf("=");
    if (at === -1) continue;
    const value = pair
      .slice(at + 1)
      .replace(/\+/g, " ")
      .replace(/%([0-9A-Fa-f]{2})/g, (_m, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      );
    out.set(pair.slice(0, at), value);
  }
  return out;
}

describe("the original's response framing, from its source", () => {
  it("send_msg appends a literal /r/n, runs format_for_web_cst and sends the bytes with no HTTP header", () => {
    const body = functionBody("httpa.c", "void send_msg(LPREQUEST lpReq, CString cst_final)");
    expect(body).toContain('cst_final += "/r/n";');
    expect(body.indexOf('"/r/n"')).toBeLessThan(body.indexOf("format_for_web_cst(&cst_final);"));
    expect(body).toContain("send(lpReq->Socket,");
    expect(body).not.toContain("HTTP/");
    expect(body).not.toContain("Content-type");
  });

  it("format_for_web_cst escapes six characters and nothing else", () => {
    expect(originalReplacements()).toEqual([
      [" ", "+"],
      ['"', "%22"],
      ["!", "%21"],
      [",", "%2C"],
      [";", "%3B"],
      [":", "%3A"],
    ]);
  });

  it("add_var writes name=value& with the value as it is", () => {
    const body = functionBody(
      "funeral_util.cpp",
      "void add_var(CString *cst_buff, CString cst_var_name, CString cst_var_value)",
    );
    expect(body).toContain('*cst_buff += "=";');
    expect(body).toContain('*cst_buff += "&";');
    expect(body).not.toContain("Replace");
  });

  it("the text the game sends is ASCII: the character set only matters for what players type", () => {
    const files = [
      ...readdirSync(resolve(REPO_ROOT, "legacy/dist"))
        .filter((f) => f.endsWith(".txt"))
        .map((f) => resolve(REPO_ROOT, "legacy/dist", f)),
      ...readdirSync(SOURCE)
        .filter((f) => /\.(cpp|h|c)$/.test(f))
        .map((f) => resolve(SOURCE, f)),
    ];
    const high: string[] = [];
    for (const file of files) {
      if (readFileSync(file).some((b) => b >= 0x80)) high.push(file);
    }
    expect(high).toEqual([]);
  });

  it("the original's bytes for a small reply, and the bridge's for the same variables", () => {
    const vars = [
      ["i_sent", 1],
      ["st_main", "You sell it, for $5."],
      ["g_st_error", "Bad name: try again!"],
    ] as const;
    // The original: `/r/n` after the last `&`, six characters escaped, `.` and `$` raw.
    expect(originalWire(vars)).toBe(
      "i_sent=1&st_main=You+sell+it%2C+for+$5.&g_st_error=Bad+name%3A+try+again%21&/r/n",
    );
    // The bridge: no trailer, every byte outside A-Za-z0-9-_.~ written as %XX (space is +).
    expect(encodeBody(vars)).toBe(
      "i_sent=1&st_main=You+sell+it%2C+for+%245.&g_st_error=Bad+name%3A+try+again%21&",
    );
    // Flash reads the same variables from both.
    const original = flashReads(originalWire(vars));
    const bridge = decodeBody(encodeBody(vars));
    for (const [name] of vars) expect(bridge.get(name)).toBe(original.get(name));
    // The bridge's reply has no carriage return or line feed anywhere (neither had the original's).
    expect(encodeBody(vars)).not.toMatch(/[\r\n]/);
    expect(originalWire(vars)).not.toMatch(/[\r\n]/);
  });
});

describe("what the bridge sends for real screens, read as Flash reads the original's", () => {
  let app: FastifyInstance;
  let flash: FlashClient;
  const replies: Reply[] = [];

  beforeAll(async () => {
    const host = await createDevHost({ seed: 4242, rivals: 2 });
    app = Fastify();
    await app.register(legacyCompat, { host, enabled: true });
    await app.ready();
    flash = new FlashClient(app);
    replies.push(await flash.checkLogon());
    replies.push(
      await flash.newUser({
        logon: "tester",
        password: "pw",
        name: "Tess Tester",
        parlor: "Tess and Sons",
        email: "tess@example.com",
      }),
    );
    replies.push(await flash.command(Request.main)); // the morning screen
    replies.push(await flash.click("3")); // the desk
    for (let i = 0; i < 20; i++) {
      const r = await flash.command(Request.waitForCustomer);
      replies.push(r);
      if (flash.get("st_option_a") !== "") break;
      if (flash.buttons().length > 0) replies.push(await flash.click("3"));
    }
    replies.push(await flash.command(Request.news));
    replies.push(await flash.command(Request.ranking));
  });

  afterAll(async () => {
    await app.close();
  });

  it("every reply is name=value& pairs with no trailer, header-framed by HTTP and free of CR and LF", () => {
    expect(replies.length).toBeGreaterThan(6);
    for (const r of replies) {
      expect(r.status).toBe(200);
      expect(r.raw.endsWith("&")).toBe(true);
      expect(r.raw).not.toMatch(/[\r\n]/);
      expect(r.raw).not.toContain("/r/n");
      // Only A-Za-z0-9-_.~ and the separators: nothing a header-splitting or a parser could trip on.
      expect(r.raw).toMatch(/^[A-Za-z0-9\-_.~%+=&]*$/);
    }
  });

  it("each variable reads the same through the original's escaping, except where the text holds & = % + (the original broke those)", () => {
    const plainAscii = /^[\x20-\x7e\n]*$/;
    const risky = /[&=%+]/;
    let compared = 0;
    const differing: string[] = [];
    for (const r of replies) {
      const vars = [...r.vars];
      const original = flashReads(originalWire(vars));
      for (const [name, value] of vars) {
        if (!plainAscii.test(value)) continue;
        if (risky.test(value)) {
          differing.push(name);
          continue;
        }
        compared++;
        expect(original.get(name), `${name} in ${r.raw.slice(0, 60)}`).toBe(value);
      }
    }
    // The vast majority of variables go through the original's six-character escaping unchanged.
    expect(compared).toBeGreaterThan(100);
    // The others carry an HTML entity the bridge adds for Ruffle (`&amp;`, `&lt;`).
    for (const name of differing) expect(name).toMatch(/^st_/);
  });

  it("text fields are HTML fields: a newline is <br> (the original sent a raw LF), & and < are entities", () => {
    expect(htmlText("one\ntwo")).toBe("one<br>two");
    expect(htmlText("Vance & Daughters <b>")).toBe("Vance &amp; Daughters &lt;b>");
    // On the wire the original's raw newline would be a raw LF byte, which Ruffle reads as white space.
    expect(originalWire([["st_main", "one\ntwo"]])).toContain("one\ntwo");
    expect(encodeBody([["st_main", htmlText("one\ntwo")]])).toBe("st_main=one%3Cbr%3Etwo&");
  });
});

describe("characters the original escaped by chance and the bridge by rule", () => {
  const awkward: [string, string][] = [
    ["Tom & Jerry", "the original sent a raw & and Flash started a new variable at it"],
    ["a=b", "a raw = is harmless to Flash after the first one"],
    ["50% off", "the original sent a raw % that Flash only decodes before two hex digits"],
    ["Level 50+ in EQ", "the original sent a raw + that Flash reads as a space"],
  ];

  it("the bridge returns each exactly; the original's wire did not for & and +", () => {
    for (const [text] of awkward) {
      expect(decodeBody(`v=${encodeValue(text)}&`).get("v")).toBe(text);
    }
    expect(flashReads(originalWire([["v", "Tom & Jerry"]])).get("v")).toBe("Tom ");
    expect(flashReads(originalWire([["v", "Level 50+ in EQ"]])).get("v")).toBe("Level 50  in EQ");
    expect(flashReads(originalWire([["v", "a=b"]])).get("v")).toBe("a=b");
    expect(flashReads(originalWire([["v", "50% off"]])).get("v")).toBe("50% off");
  });

  it("the Classic pack's own text with a + or a % (customer lines, the resistance line) is sent exactly", () => {
    // From legacy/dist (see packages/content): "Level 50+ in EQ", "Has 500+ NES roms",
    // "(Resistance: n%)". The original's client showed the + as a space; the bridge keeps the file's text.
    for (const text of ["Level 50+ in EQ", "Has 500+ NES roms", "(Resistance: 15%)"]) {
      expect(decodeBody(encodeBody([["st_main", text]])).get("st_main")).toBe(text);
    }
  });
});

describe("the character set", () => {
  it("writes non-ASCII as UTF-8 bytes, where the original wrote the single Windows-1252 byte it held", async () => {
    // Flash 5 sends a typed é as %E9; the bridge reads it (Windows-1252) and sends it back as UTF-8.
    const app = Fastify();
    const host = await createDevHost({ seed: 7, rivals: 1 });
    await app.register(legacyCompat, { host, enabled: true });
    await app.ready();
    try {
      const query = [
        "new",
        "logon=jose",
        "password=pw",
        "password_v=pw",
        "name=Jos%E9+Smith",
        "f_name=Smith+and+Sons",
        "b_male=1",
        "email=jose%40example.com",
        "key=1",
      ].join("&");
      const res = await app.inject({ method: "GET", url: `/request.xp?${query}` });
      expect(res.statusCode).toBe(200);
      // On the wire: C3 A9, a letter the client's HTML field shows once Ruffle decodes it as UTF-8.
      expect(res.body).toContain("Jos%C3%A9+Smith");
      expect(res.body).not.toContain("%E9");
      expect(decodeBody(res.body).get("st_news")).toContain("José Smith");
      // The original would have sent the one byte (Latin-1 0xE9) with nothing to say which set it was.
      expect(flashReads(originalWire([["st_news", "José"]])).get("st_news")).toBe("José");
      expect(originalWire([["st_news", "José"]])).toBe("st_news=José&/r/n");
    } finally {
      await app.close();
    }
  });
});
