import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the real server and the production bundle:
 * `pnpm --filter @fq/client e2e` builds the client, starts @fq/server on a temporary database
 * (tools/run-server.mjs --test) and drives it with Chromium. Set FQ_E2E_SKIP_BUILD=1 to reuse
 * the last build.
 */
const port = Number(process.env.FQ_E2E_PORT ?? 18765);
// The same build on a plain file host with no server behind it, for the Solo tests.
const staticPort = Number(process.env.FQ_E2E_STATIC_PORT ?? 18766);
// The server again with museum mode on, for the front door's link to the original client.
const museumPort = Number(process.env.FQ_E2E_MUSEUM_PORT ?? 18767);
// The server again on its own database, for the Expanded towns and the Daily Challenge, so the
// other specs' town list stays as it was.
const expandedPort = Number(process.env.FQ_E2E_EXPANDED_PORT ?? 18769);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/results",
  // One server and one town are shared, so the specs run one after another; each uses its own
  // accounts, so they do not depend on each other.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // Reduced motion turns the typewriter text reveal off, so a screen's text is complete the
    // moment it arrives; the service worker is not part of what these tests are about.
    reducedMotion: "reduce",
    serviceWorkers: "block",
    // moderation hook: players have already agreed to the house rules (e2e/moderation.spec.ts
    // starts from an empty storage to test the notice). The key and version are
    // CONDUCT_KEY and CONDUCT_VERSION in src/moderation/conduct.ts.
    storageState: {
      cookies: [],
      origins: [port, museumPort, expandedPort].map((p) => ({
        origin: `http://127.0.0.1:${p}`,
        localStorage: [{ name: "fq.conduct", value: "1" }],
      })),
    },
  },
  // Two suites. "online" plays against the real server, which serves the client itself.
  // "solo" plays the same build from a plain file host with no server behind it.
  projects: [
    {
      name: "online",
      testIgnore: /(solo|museum|expanded-server)\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } },
    },
    {
      name: "museum",
      testMatch: /museum\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        baseURL: `http://127.0.0.1:${museumPort}`,
        // Ruffle compiles WebAssembly and the Flash movie asks for its pages one by one.
        actionTimeout: 20_000,
      },
    },
    {
      name: "expanded",
      testMatch: /expanded-server\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        baseURL: `http://127.0.0.1:${expandedPort}`,
      },
    },
    {
      name: "solo",
      testMatch: /solo\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
        baseURL: `http://127.0.0.1:${staticPort}`,
      },
    },
  ],
  webServer: [
    {
      command: `node tools/run-server.mjs --test --port ${port}${process.env.FQ_E2E_SKIP_BUILD === "1" ? " --no-build" : ""}`,
      url: `http://127.0.0.1:${port}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `node tools/run-server.mjs --test --museum --no-build --port ${museumPort} --after http://127.0.0.1:${port}/health`,
      url: `http://127.0.0.1:${museumPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `node tools/run-server.mjs --test --towns both --no-build --port ${expandedPort} --after http://127.0.0.1:${port}/health`,
      url: `http://127.0.0.1:${expandedPort}/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `node e2e/static-host.mjs --port ${staticPort} --after http://127.0.0.1:${port}/health`,
      url: `http://127.0.0.1:${staticPort}/index.html`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
