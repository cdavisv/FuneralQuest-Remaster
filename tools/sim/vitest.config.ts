import { defineConfig } from "vitest/config";

// Whole-town simulations and worker-thread tests take several seconds on a
// slow machine (CI); the default 5 s is too tight.
export default defineConfig({
  test: { testTimeout: 60_000, hookTimeout: 60_000 },
});
