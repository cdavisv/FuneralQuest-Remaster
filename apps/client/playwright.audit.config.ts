import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.AUDIT_PORT ?? 19001);
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/results/audit",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    actionTimeout: 4000,
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1280, height: 720 },
    reducedMotion: "reduce",
    serviceWorkers: "block",
    storageState: {
      cookies: [],
      origins: [{ origin: `http://127.0.0.1:${port}`, localStorage: [
        { name: "fq.conduct", value: "2" },
        { name: "fq.settings.v1", value: JSON.stringify({ muted: true }) },
      ] }],
    },
  },
});
