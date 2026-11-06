import { defineConfig } from "vitest/config";

// A few tests render whole pieces of music (a few seconds each).
export default defineConfig({
  test: { testTimeout: 120_000, hookTimeout: 120_000 },
});
