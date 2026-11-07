import { describe, it } from "vitest";

/**
 * Minimal reproductions of bugs the soak runs found in packages this package does not own
 * (`packages/core`, `packages/bots`). Each is skipped here and listed in the report for the
 * owner of that package to fix; un-skip it when the fix lands.
 */
describe("upstream bugs found by the soak runs", () => {
  it.skip("none found so far", () => undefined);
});
