import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Harness, startServer } from "./support/harness.js";

let h: Harness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

describe("serving the built client (FQ_CLIENT_DIR)", () => {
  it("starts, serves the shell for unknown pages, and keeps JSON 404s for the API", async () => {
    const clientDir = mkdtempSync(join(tmpdir(), "fq-client-"));
    writeFileSync(join(clientDir, "index.html"), "<!doctype html><title>shell</title>");
    writeFileSync(join(clientDir, "app.js"), "console.log('app');");
    h = await startServer({ config: { clientDir } });

    const shell = await h.inject({ method: "GET", url: "/" });
    expect(shell.statusCode).toBe(200);
    expect(shell.body).toContain("shell");

    const asset = await h.inject({ method: "GET", url: "/app.js" });
    expect(asset.statusCode).toBe(200);

    const deepLink = await h.inject({ method: "GET", url: "/rules" });
    expect(deepLink.statusCode).toBe(200);
    expect(deepLink.body).toContain("shell");

    const api = await h.inject({ method: "GET", url: "/api/nope" });
    expect(api.statusCode).toBe(404);
    expect(api.json()).toMatchObject({ error: "not_found" });

    const post = await h.inject({ method: "POST", url: "/rules" });
    expect(post.statusCode).toBe(404);
  });

  it("answers unknown paths with a JSON 404 when no client is configured", async () => {
    h = await startServer();
    const res = await h.inject({ method: "GET", url: "/rules" });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: "not_found" });
  });
});
