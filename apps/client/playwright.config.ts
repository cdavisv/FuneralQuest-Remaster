import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices, type Project } from "@playwright/test";

/**
 * End-to-end tests against the real server and the production bundle:
 * `pnpm --filter @fq/client e2e` builds the client, starts @fq/server on a temporary database
 * (tools/run-server.mjs --test) and drives it with Chromium, Firefox and WebKit.
 *
 * Several runs may share a machine (two terminals, two agents): everything a run owns is unique
 * to it. The ports are found free at start-up, the test results go to e2e/results/<run>, the
 * bundle is built into a temporary directory of its own, and each server has a temporary
 * database. Set FQ_E2E_PORT, FQ_E2E_STATIC_PORT, FQ_E2E_MUSEUM_PORT, FQ_E2E_EXPANDED_PORT and
 * FQ_E2E_PAGES_PORT to pin the ports.
 *
 * Environment:
 *   FQ_E2E_BROWSERS=chromium,firefox,webkit   which engines to drive (default: all three)
 *   FQ_E2E_SKIP_BUILD=1                       reuse dist-build as it is (no build, no copy)
 *   FQ_E2E_RUN=<name>                         a name for the run's results folder
 *   PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1
 *                                             WebKit on a distribution Playwright does not
 *                                             support (see apps/client/README.md)
 */
const clientDir = import.meta.dirname;
const skipBuild = process.env.FQ_E2E_SKIP_BUILD === "1";

/** `n` free loopback ports, found now. Synchronous because a config cannot await. */
function freePorts(n: number): number[] {
  const script = `
    const net = require("node:net");
    const servers = [];
    for (let i = 0; i < ${n}; i++) {
      const s = net.createServer();
      s.listen(0, "127.0.0.1", () => {
        servers.push(s);
        if (servers.length === ${n}) {
          console.log(servers.map((x) => x.address().port).join(","));
          for (const x of servers) x.close();
        }
      });
    }`;
  return execFileSync(process.execPath, ["-e", script], { encoding: "utf8" })
    .trim()
    .split(",")
    .map(Number);
}

// The first load of this file (the test runner's own process) settles the run; the workers load
// it again and read the same answers from the environment they inherit.
if (!process.env.FQ_E2E_SETUP) {
  process.env.FQ_E2E_SETUP = "1";
  process.env.FQ_E2E_RUN ??= `${new Date().toISOString().replace(/[-:T]/g, "").slice(2, 13)}-${process.pid}`;
  const wanted = [
    "FQ_E2E_PORT",
    "FQ_E2E_STATIC_PORT",
    "FQ_E2E_MUSEUM_PORT",
    "FQ_E2E_EXPANDED_PORT",
    "FQ_E2E_PAGES_PORT",
  ];
  const missing = wanted.filter((name) => !process.env[name]);
  const ports = missing.length ? freePorts(missing.length) : [];
  missing.forEach((name, i) => {
    process.env[name] = String(ports[i]);
  });
  // Old results are not kept for ever.
  const results = join(clientDir, "e2e", "results");
  if (existsSync(results)) {
    for (const entry of readdirSync(results)) {
      const path = join(results, entry);
      if (Date.now() - statSync(path).mtimeMs > 2 * 86_400_000) {
        rmSync(path, { recursive: true, force: true });
      }
    }
  }
  if (!skipBuild) {
    process.env.FQ_E2E_DIST_TMP = join(tmpdir(), `fq-e2e-${process.env.FQ_E2E_RUN}`);
  }
  // The solo-only GitHub Pages build, served from a sub-path (e2e/pages.spec.ts); always built.
  process.env.FQ_E2E_PAGES_TMP = join(tmpdir(), `fq-e2e-pages-${process.env.FQ_E2E_RUN}`);
}
const run = process.env.FQ_E2E_RUN;
const port = Number(process.env.FQ_E2E_PORT);
// The same build on a plain file host with no server behind it, for the Solo tests.
const staticPort = Number(process.env.FQ_E2E_STATIC_PORT);
// The server again with museum mode on, for the front door's link to the original client.
const museumPort = Number(process.env.FQ_E2E_MUSEUM_PORT);
// The server again on its own database, for the Expanded towns and the Daily Challenge, so the
// other specs' town list stays as it was.
const expandedPort = Number(process.env.FQ_E2E_EXPANDED_PORT);
// The solo-only Pages build, on a plain file host under a sub-path, like https://<user>.github.io/<repo>/.
const pagesPort = Number(process.env.FQ_E2E_PAGES_PORT);
const PAGES_PATH = "/fq-pages/";
const pagesDir = process.env.FQ_E2E_PAGES_TMP ?? "";
const dist = process.env.FQ_E2E_DIST_TMP ? join(process.env.FQ_E2E_DIST_TMP, "dist") : null;
const distArgs = dist ? ` --out ${JSON.stringify(dist)}` : "";

const BROWSERS = {
  // Headless Chromium plays sound without a gesture unless told otherwise; a real one does not
  // (e2e/audio.spec.ts checks that nothing starts before the first click).
  chromium: {
    ...devices["Desktop Chrome"],
    launchOptions: { args: ["--autoplay-policy=user-gesture-required"] },
  },
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
} as const;
type Engine = keyof typeof BROWSERS;
// Playwright's WebKit is an Ubuntu build. On other distributions it loads its own ICU 74 and
// libxml2 next to the system's newer ones and crashes (SIGSEGV in utext_setup), so it runs there
// only when asked for: FQ_E2E_BROWSERS=webkit or `e2e:webkit`. CI (Ubuntu) still runs all three.
const supportedLinux =
  process.platform !== "linux" || /^(ID|ID_LIKE)=.*(ubuntu|debian)/m.test(osRelease());
const defaultEngines = supportedLinux ? "chromium,firefox,webkit" : "chromium,firefox";
const engines = (process.env.FQ_E2E_BROWSERS ?? defaultEngines)
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean) as Engine[];
for (const engine of engines) {
  if (!(engine in BROWSERS)) throw new Error(`FQ_E2E_BROWSERS: unknown browser "${engine}"`);
}

// Playwright only knows the system libraries of Debian and Ubuntu, and its WebKit and Firefox
// builds for other distributions are the Ubuntu ones. Its own check would refuse them on a
// distribution (Arch, Fedora) that has the libraries under other names; if one is really
// missing, the browser's own error names it.
if (process.platform === "linux" && !/^(ID|ID_LIKE)=.*(ubuntu|debian)/m.test(osRelease())) {
  process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS ??= "1";
}
function osRelease(): string {
  try {
    return readFileSync("/etc/os-release", "utf8");
  } catch {
    return "";
  }
}

const viewport = { width: 1280, height: 720 };

/** Every suite, once for each engine: `online-firefox`, `solo-webkit` and so on. */
const projects: Project[] = engines.flatMap((engine) => {
  const device = { ...BROWSERS[engine], viewport };
  return [
    // "online" plays against the real server, which serves the client itself.
    {
      name: `online-${engine}`,
      testIgnore: /(solo|museum|expanded-server|pages)\.spec\.ts/,
      use: device,
    },
    {
      name: `museum-${engine}`,
      testMatch: /museum\.spec\.ts/,
      use: {
        ...device,
        baseURL: `http://127.0.0.1:${museumPort}`,
        // Ruffle compiles WebAssembly and the Flash movie asks for its pages one by one.
        actionTimeout: 20_000,
      },
    },
    {
      name: `expanded-${engine}`,
      testMatch: /expanded-server\.spec\.ts/,
      use: { ...device, baseURL: `http://127.0.0.1:${expandedPort}` },
    },
    // "pages" plays the solo-only build from a sub-path, the way GitHub Pages serves it.
    {
      name: `pages-${engine}`,
      testMatch: /pages\.spec\.ts/,
      use: { ...device, baseURL: `http://127.0.0.1:${pagesPort}${PAGES_PATH}` },
    },
    // "solo" plays the same build from a plain file host with no server behind it.
    {
      name: `solo-${engine}`,
      testMatch: /solo\.spec\.ts/,
      use: { ...device, baseURL: `http://127.0.0.1:${staticPort}` },
    },
  ];
});

export default defineConfig({
  testDir: "./e2e",
  outputDir: `./e2e/results/${run}`,
  globalTeardown: "./e2e/global-teardown.ts",
  // One server and one town are shared, so the specs run one after another; each uses its own
  // accounts, so they do not depend on each other.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // A test that fails once is a bug to find, not something to run again: no retries on a
  // developer's machine. CI allows one, and the report names every test that needed it.
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport,
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
      origins: [port, museumPort, expandedPort, staticPort, pagesPort].map((p) => ({
        origin: `http://127.0.0.1:${p}`,
        localStorage: [
          { name: "fq.conduct", value: "2" },
          // Sound is on by default (decision 16), so a test run starts muted and stays silent;
          // e2e/audio.spec.ts is the one spec that listens, and starts without this.
          { name: "fq.settings.v1", value: JSON.stringify({ muted: true }) },
        ],
      })),
    },
  },
  projects,
  webServer: [
    {
      command: `node tools/run-server.mjs --test --port ${port}${distArgs}${skipBuild ? " --no-build" : ""}`,
      url: `http://127.0.0.1:${port}/health`,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `node tools/run-server.mjs --test --museum --no-build${distArgs} --port ${museumPort} --after http://127.0.0.1:${port}/health`,
      url: `http://127.0.0.1:${museumPort}/health`,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `node tools/run-server.mjs --test --towns both --no-build${distArgs} --port ${expandedPort} --after http://127.0.0.1:${port}/health`,
      url: `http://127.0.0.1:${expandedPort}/health`,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `node tools/build-pages.mjs --base ${PAGES_PATH} --out ${JSON.stringify(pagesDir)} --after http://127.0.0.1:${port}/health && node e2e/static-host.mjs --port ${pagesPort} --root ${JSON.stringify(pagesDir)} --prefix ${PAGES_PATH}`,
      url: `http://127.0.0.1:${pagesPort}${PAGES_PATH}index.html`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
    {
      command: `node e2e/static-host.mjs --port ${staticPort}${dist ? ` --root ${JSON.stringify(dist)}` : ""} --after http://127.0.0.1:${port}/health`,
      url: `http://127.0.0.1:${staticPort}/index.html`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
