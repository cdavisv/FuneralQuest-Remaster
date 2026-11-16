import { describe, expect, it } from "vitest";
import { chooseFit, FIT_MIN_PX, FIT_STEPS } from "../src/util/useFitText.js";

describe("the text well's fit", () => {
  it("keeps the chosen size when the text fits", () => {
    expect(chooseFit(() => true, 17)).toBe(1);
  });

  it("takes the largest step that fits", () => {
    const tried: number[] = [];
    const step = chooseFit((s) => {
      tried.push(s);
      return s <= 0.89;
    }, 17);
    expect(step).toBe(0.89);
    expect(tried).toEqual([1, 0.94, 0.89]);
  });

  it("stops at the smallest step when nothing fits, so the text scrolls as before", () => {
    expect(chooseFit(() => false, 17)).toBe(FIT_STEPS[FIT_STEPS.length - 1]);
  });

  it("never goes under the smallest legible size", () => {
    // 14px at 0.89 would be 12.5px: the last step tried is 0.94 (13.2px).
    expect(chooseFit(() => false, 14)).toBe(0.94);
    expect(chooseFit(() => false, FIT_MIN_PX)).toBe(1);
  });
});
