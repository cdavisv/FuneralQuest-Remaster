import { defineConfig } from "vitest/config";

// The whole-town simulations (Classic regression, Expanded multi-day runs)
// take a few seconds each; under parallel load the default 5 s is too tight.
export default defineConfig({
  test: { testTimeout: 240_000, hookTimeout: 240_000 },
});
