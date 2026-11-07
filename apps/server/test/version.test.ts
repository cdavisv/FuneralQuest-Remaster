import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { serverVersion } from "../src/version.js";
import { type Harness, startServer } from "./support/harness.js";

const rootPackage = JSON.parse(
  readFileSync(new URL("../../../package.json", import.meta.url), "utf8"),
) as { version: string };

describe("the server reports its version", () => {
  let h: Harness | null = null;
  afterEach(async () => {
    await h?.stop();
    h = null;
  });

  it("is the root package.json's version and a short build id", () => {
    const v = serverVersion();
    expect(v.version).toBe(rootPackage.version);
    expect(v.build).toMatch(/^([0-9a-f]{4,12}|dev|[\w.-]{1,12})$/);
  });

  it("on /health and /api/features", async () => {
    h = await startServer();
    const health = (await h.inject({ method: "GET", url: "/health" })).json() as Record<
      string,
      unknown
    >;
    const features = (await h.inject({ method: "GET", url: "/api/features" })).json() as Record<
      string,
      unknown
    >;
    expect(health.version).toBe(rootPackage.version);
    expect(features.version).toBe(rootPackage.version);
    expect(typeof health.build).toBe("string");
    expect(features.build).toBe(health.build);
  });

  it("is compiled into the bundle by build.mjs (FQ_BUILD overrides the commit)", () => {
    execFileSync(process.execPath, ["build.mjs"], {
      cwd: new URL("..", import.meta.url),
      env: { ...process.env, FQ_BUILD: "test1234" },
      stdio: "ignore",
    });
    const bundle = readFileSync(new URL("../dist/server.mjs", import.meta.url), "utf8");
    expect(bundle).toContain(JSON.stringify(rootPackage.version));
    expect(bundle).toContain('"test1234"');
    expect(bundle).not.toContain("__FQ_VERSION__");
  }, 60_000);
});
