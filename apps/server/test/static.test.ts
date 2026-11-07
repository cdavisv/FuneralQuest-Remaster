import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
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

describe("the client's files are compressed and cached sensibly", () => {
  const big = `${"console.log('a long enough script to be worth compressing');\n".repeat(60)}`;
  const setup = async () => {
    const clientDir = mkdtempSync(join(tmpdir(), "fq-client-"));
    writeFileSync(join(clientDir, "index.html"), `<!doctype html><title>shell</title>${big}`);
    writeFileSync(join(clientDir, "sw.js"), big);
    mkdirSync(join(clientDir, "assets"));
    writeFileSync(join(clientDir, "assets", "index-abc123.js"), big);
    writeFileSync(join(clientDir, "tiny.js"), "x=1");
    writeFileSync(join(clientDir, "pic.png"), Buffer.alloc(4000, 7));
    h = await startServer({ config: { clientDir } });
  };

  it("sends brotli, then gzip, to a browser that accepts them, and the plain file to one that does not", async () => {
    await setup();
    const br = await h?.inject({
      method: "GET",
      url: "/assets/index-abc123.js",
      headers: { "accept-encoding": "gzip, deflate, br" },
    });
    expect(br?.headers["content-encoding"]).toBe("br");
    expect(br?.headers.vary).toContain("Accept-Encoding");
    expect(brotliDecompressSync(br?.rawPayload ?? Buffer.alloc(0)).toString()).toBe(big);
    expect(Number(br?.headers["content-length"])).toBe(br?.rawPayload.length);
    expect(br?.rawPayload.length).toBeLessThan(big.length / 4);

    const zipped = await h?.inject({
      method: "GET",
      url: "/assets/index-abc123.js",
      headers: { "accept-encoding": "gzip" },
    });
    expect(zipped?.headers["content-encoding"]).toBe("gzip");
    expect(gunzipSync(zipped?.rawPayload ?? Buffer.alloc(0)).toString()).toBe(big);

    const plain = await h?.inject({ method: "GET", url: "/assets/index-abc123.js" });
    expect(plain?.headers["content-encoding"]).toBeUndefined();
    expect(plain?.body).toBe(big);
  });

  it("leaves small files, binary files and every API and admin response alone", async () => {
    await setup();
    const headers = { "accept-encoding": "br, gzip" };
    expect(
      (await h?.inject({ method: "GET", url: "/tiny.js", headers }))?.headers["content-encoding"],
    ).toBeUndefined();
    expect(
      (await h?.inject({ method: "GET", url: "/pic.png", headers }))?.headers["content-encoding"],
    ).toBeUndefined();
    for (const url of ["/api/towns", "/health", "/admin/"]) {
      const res = await h?.inject({ method: "GET", url, headers });
      expect(res?.headers["content-encoding"], url).toBeUndefined();
    }
  });

  it("lets hashed files be cached for good and makes the page and the service worker revalidate", async () => {
    await setup();
    const hashed = await h?.inject({ method: "GET", url: "/assets/index-abc123.js" });
    expect(hashed?.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    for (const url of ["/", "/index.html", "/sw.js"]) {
      const res = await h?.inject({ method: "GET", url });
      expect(res?.headers["cache-control"], url).toBe("no-cache");
    }
  });

  it("answers a conditional request for a compressed file with 304", async () => {
    await setup();
    const first = await h?.inject({
      method: "GET",
      url: "/assets/index-abc123.js",
      headers: { "accept-encoding": "br" },
    });
    const etag = String(first?.headers.etag ?? "");
    expect(etag).not.toBe("");
    const again = await h?.inject({
      method: "GET",
      url: "/assets/index-abc123.js",
      headers: { "accept-encoding": "br", "if-none-match": etag },
    });
    expect(again?.statusCode).toBe(304);
  });
});
