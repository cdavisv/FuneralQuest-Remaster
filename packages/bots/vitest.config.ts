import { defineConfig } from "vitest/config";

// Whole towns of bots (Classic careers, Expanded seasons) take seconds each, more under load.
export default defineConfig({
  test: { testTimeout: 60_000, hookTimeout: 60_000 },
});
