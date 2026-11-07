import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { legacyUptime, ORIGINAL_SERVER_VERSION, originalBanner } from "../src/banner.js";
import { createDevHost } from "../src/devHost.js";
import { legacyCompat } from "../src/plugin.js";
import { FlashClient, plain } from "./support/flashClient.js";

/** The log-on banner against the strings of legacy/source/funeral.cpp:191-193 and maint.cpp:336-361. */

const here = dirname(fileURLToPath(import.meta.url));
const cpp = (file: string) =>
  readFileSync(resolve(here, "../../../legacy/source", file), "latin1").replace(/\r/g, "");

describe("the original banner", () => {
  it("is built from the literals in funeral.cpp", () => {
    const source = cpp("funeral.cpp");
    // The format string, adjacent literals joined, as the compiler saw it.
    const lines = source.split("\n");
    const start = lines.findIndex((l) => l.includes('cst_temp.Format("           <u><a href='));
    expect(start).toBeGreaterThan(0);
    const literals = [lines[start], lines[start + 1]]
      .map((l) => [...(l ?? "").matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).join(""))
      .join("")
      .replace(/\\"/g, '"');
    // "%d.%d." and "%s" are the version and the uptime.
    const format = literals.replace("%d.%d.", "{v}.").replace("%s", "{uptime}");
    const { major, minor } = ORIGINAL_SERVER_VERSION;
    expect(cpp("funeral_file.h")).toContain(`const int i_min_version = ${minor};`);
    expect(cpp("funeral_file.h")).toContain(`const int i_max_version = ${major};`);
    const built = format.replace("{v}", `${major}.${minor}`).replace("{uptime}", legacyUptime(125));
    expect(originalBanner(125)).toBe(built);
  });

  it("has the original spacing, links and copyright", () => {
    const html = originalBanner(125);
    expect(html).toBe(
      '           <u><a href="http://www.rtsoft.com/fq">FQServer 1.0.</a></u> Copyright 2001-2011: ' +
        '<u><a href="http://www.rtsoft.com">Robinson Technologies</a></u>  Uptime:     2 Min',
    );
    expect(html.startsWith(`${" ".repeat(11)}<u>`)).toBe(true);
  });
});

describe("get_uptime (maint.cpp:336-361)", () => {
  it("counts a boot under a second ago as one second", () => {
    expect(legacyUptime(0)).toBe("     1 Sec");
    expect(legacyUptime(0.4)).toBe("     1 Sec");
  });
  it("shows seconds up to 59, minutes up to 59, then hours", () => {
    expect(legacyUptime(59)).toBe("    59 Sec");
    expect(legacyUptime(60)).toBe("     1 Min");
    expect(legacyUptime(90)).toBe("     2 Min"); // 1.5 rounds to even, as printf does
    expect(legacyUptime(150)).toBe("     2 Min"); // 2.5 rounds to even
    expect(legacyUptime(59 * 60)).toBe("    59 Min");
    expect(legacyUptime(59 * 60 + 59)).toBe("     1 Hour(s)"); // 59.98 minutes is over 59
    expect(legacyUptime(60 * 60)).toBe("     1 Hour(s)");
    expect(legacyUptime(60 * 60 + 60)).toBe("     1 Hour(s)");
    expect(legacyUptime(3 * 3600 + 7)).toBe("     3 Hour(s)");
    expect(legacyUptime(26 * 3600)).toBe("    26 Hour(s)");
  });
});

describe("the bridge's log-on reply", () => {
  it("sends the original banner, then a line naming the remaster engine", async () => {
    const host = await createDevHost({ seed: 1, rivals: 0 });
    host.bootTime = () => Date.now() - 3 * 3600 * 1000;
    const app = Fastify();
    await app.register(legacyCompat, { host, enabled: true });
    await app.ready();
    const flash = new FlashClient(app);
    await flash.checkLogon();
    const intro = flash.get("st_intro_news");
    expect(intro.startsWith(originalBanner(3 * 3600))).toBe(true);
    expect(intro).toContain("Uptime:     3 Hour(s)");
    const rest = intro.slice(originalBanner(3 * 3600).length);
    expect(rest.startsWith("<br>")).toBe(true);
    expect(plain(rest)).toContain("Funeral Quest Remastered engine");
    // The client's field does not wrap: the whole line must fit where the banner's own does.
    expect(plain(rest).length).toBeLessThanOrEqual(
      originalBanner(3 * 3600).replace(/<[^>]*>/g, "").length,
    );
    expect(plain(rest)).toContain("not the original FQServer");
    await app.close();
  });
});
