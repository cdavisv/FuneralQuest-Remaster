import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type CDPSession, chromium, expect, type Page, test } from "@playwright/test";
import { makeASale, plaque, reachDesk } from "../e2e/helpers";

/**
 * The client's performance measurements (see docs/performance.md):
 *  - the first load of the front door over a throttled connection and a slowed CPU, cold cache;
 *  - the same with nothing throttled;
 *  - a long Solo session (30 days, a sale each day, three rivals) with the heap of the page and
 *    of the Solo worker after every day.
 */
const results: Record<string, unknown> = {};
test.afterAll(() => {
  const file = join(import.meta.dirname, "results.json");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
});

interface Profile {
  name: string;
  /** bytes per second; 0 = unthrottled */
  down: number;
  up: number;
  rtt: number;
  cpu: number;
}
const PROFILES: Profile[] = [
  // Lighthouse's "slow 4G" mobile profile: 1.6 Mbit/s down, 0.75 up, 150 ms round trip, 4x CPU.
  { name: "slow-4g-cpu4x", down: (1.6 * 1024 * 1024) / 8, up: (750 * 1024) / 8, rtt: 150, cpu: 4 },
  // Home broadband on a phone: 9 Mbit/s, 40 ms, 2x CPU.
  {
    name: "fast-4g-cpu2x",
    down: (9 * 1024 * 1024) / 8,
    up: (3 * 1024 * 1024) / 8,
    rtt: 40,
    cpu: 2,
  },
  { name: "unthrottled", down: 0, up: 0, rtt: 0, cpu: 1 },
];

async function emulate(cdp: CDPSession, p: Profile): Promise<void> {
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (p.down > 0) {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: p.rtt,
      downloadThroughput: p.down,
      uploadThroughput: p.up,
    });
  }
  if (p.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: p.cpu });
}

for (const profile of PROFILES) {
  test(`first load: ${profile.name}`, async ({ baseURL }) => {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      ...(baseURL ? { baseURL } : {}),
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await emulate(cdp, profile);

    let transferred = 0;
    let requests = 0;
    cdp.on("Network.loadingFinished", (e) => {
      transferred += e.encodedDataLength;
      requests++;
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __perf: Record<string, number> };
      w.__perf = { longTasks: 0 };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.name === "first-contentful-paint") w.__perf.fcp = e.startTime;
        }
      }).observe({ type: "paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__perf.lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          w.__perf.longTasks = (w.__perf.longTasks ?? 0) + Math.max(0, e.duration - 50);
      }).observe({ type: "longtask", buffered: true });
      // The moment a button to play appears.
      const seen = new MutationObserver(() => {
        if (w.__perf.door) return;
        const found = [...document.querySelectorAll("button")].some((b) =>
          /^Play solo/.test(b.textContent ?? ""),
        );
        if (found) w.__perf.door = performance.now();
      });
      document.addEventListener("DOMContentLoaded", () =>
        seen.observe(document.documentElement, { childList: true, subtree: true }),
      );
    });

    const started = Date.now();
    await page.goto("/", { waitUntil: "commit" });
    const solo = page.getByRole("button", { name: /^Play solo/ });
    await solo.waitFor({ state: "visible", timeout: 120_000 });
    const doorMs = Date.now() - started;
    const bytesAtDoor = transferred;
    // Interactive: the click works, and the list of careers opens.
    const clicked = Date.now();
    await solo.click();
    await page.getByRole("heading", { name: "Your solo careers" }).waitFor({ timeout: 60_000 });
    const soloMenuMs = Date.now() - clicked;
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const perf = await page.evaluate(
      () => (window as unknown as { __perf: Record<string, number> }).__perf,
    );
    const decoded = await page.evaluate(() => {
      const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
      return Math.round(
        (nav.decodedBodySize + entries.reduce((n, e) => n + e.decodedBodySize, 0)) / 1024,
      );
    });
    results[`firstLoad.${profile.name}`] = {
      kbUncompressedTotal: decoded,
      frontDoorVisibleMs: doorMs,
      fcpMs: Math.round(perf.fcp ?? -1),
      lcpMs: Math.round(perf.lcp ?? -1),
      blockingMsOver50: Math.round(perf.longTasks ?? 0),
      clickToSoloListMs: soloMenuMs,
      kbTransferredAtFrontDoor: Math.round(bytesAtDoor / 1024),
      kbTransferredTotal: Math.round(transferred / 1024),
      requests,
    };
    await browser.close();
  });
}

test("a long solo session: 30 days, the heap of the page and the worker", async () => {
  const cdpPort = Number(process.env.FQ_PERF_CDP);
  const browser = await chromium.launch({
    args: [
      "--js-flags=--expose-gc",
      "--enable-precise-memory-info",
      `--remote-debugging-port=${cdpPort}`,
    ],
  });
  const context = await browser.newContext({
    baseURL: `http://127.0.0.1:${process.env.FQ_PERF_PORT}`,
    viewport: { width: 1280, height: 720 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: /^Play solo/ }).click();
  await page.getByRole("button", { name: "New career" }).click();
  await page.getByLabel("What's your name?").fill("Perf Pat");
  await page.getByLabel("What is your parlor called?").fill("Perf Rest");
  await page.getByRole("radio", { name: "Female", exact: true }).check({ force: true });
  await page
    .getByRole("group", { name: "How many rivals?" })
    .getByRole("radio", { name: "3", exact: true })
    .check({ force: true });
  await page.getByRole("radio", { name: "Endless" }).check({ force: true });
  await page.getByRole("button", { name: "open the parlor" }).click();
  await expect(page.getByText(/has been opened/)).toBeVisible();
  await reachDesk(page);

  /**
   * The Solo worker's JS heap, after a full collection, read over the DevTools protocol (a worker
   * has no `performance.memory`): the debugger lists dedicated workers at /json/list.
   */
  const workerHeapKB = async (): Promise<number> => {
    const targets = (await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json()) as {
      type: string;
      url: string;
      webSocketDebuggerUrl?: string;
    }[];
    const target = targets.find((t) => t.type === "worker" && t.url.includes("soloWorker"));
    if (!target?.webSocketDebuggerUrl) return -1;
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      socket.onopen = () => resolve();
      socket.onerror = () => reject(new Error("worker debugger refused"));
    });
    let id = 0;
    const call = (method: string) =>
      new Promise<{ usedSize?: number }>((resolve) => {
        const mine = ++id;
        const onMessage = (e: MessageEvent) => {
          const m = JSON.parse(String(e.data)) as { id?: number; result?: { usedSize?: number } };
          if (m.id === mine) {
            socket.removeEventListener("message", onMessage);
            resolve(m.result ?? {});
          }
        };
        socket.addEventListener("message", onMessage);
        socket.send(JSON.stringify({ id: mine, method }));
      });
    await call("HeapProfiler.collectGarbage");
    const usage = await call("Runtime.getHeapUsage");
    socket.close();
    return Math.round((usage.usedSize ?? 0) / 1024);
  };

  const heap = async (p: Page) => {
    await p.evaluate(() => (globalThis as unknown as { gc?: () => void }).gc?.());
    const main = await p.evaluate(
      () =>
        (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize,
    );
    return { page: Math.round(main / 1024), worker: await workerHeapKB() };
  };

  const samples: { day: number; page: number; worker: number; endDayMs: number }[] = [];
  const first = await heap(page);
  samples.push({ day: 1, ...first, endDayMs: 0 });
  for (let day = 2; day <= 31; day++) {
    await makeASale(page);
    await reachDesk(page);
    const t = Date.now();
    await plaque(page, "End the Day").click();
    await expect(page.getByText(`A new day has dawned. It is day ${day}.`)).toBeVisible({
      timeout: 120_000,
    });
    const endDayMs = Date.now() - t;
    await reachDesk(page);
    samples.push({ day, ...(await heap(page)), endDayMs });
  }
  const dom = await page.evaluate(() => document.getElementsByTagName("*").length);
  const storage = await page.evaluate(async () => {
    const e = await navigator.storage.estimate();
    return Math.round((e.usage ?? 0) / 1024);
  });
  const early = samples[4] ?? first;
  const last = samples[samples.length - 1] ?? first;
  results.soloSession = {
    days: 30,
    rivals: 3,
    heapKBByDay: samples,
    pageHeapKB: { day1: first.page, day5: early.page, day31: last.page },
    workerHeapKB: { day1: first.worker, day5: early.worker, day31: last.worker },
    domNodesAtEnd: dom,
    storageKBAtEnd: storage,
    endDayMsMedian: [...samples.slice(1)].map((s) => s.endDayMs).sort((a, b) => a - b)[14],
    endDayMsMax: Math.max(...samples.map((s) => s.endDayMs)),
  };
  // Not unbounded: day 31 within a fixed margin of day 5, after the first days' warm-up.
  expect(last.page).toBeLessThan(early.page * 1.5 + 5_000);
  if (last.worker > 0) expect(last.worker).toBeLessThan(early.worker * 3 + 20_000);
  await browser.close();
});
