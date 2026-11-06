import { describe, expect, it } from "vitest";
import { centerLabel, layoutButtons, slotKey } from "../src/buttons.js";

describe("button slots (add_button, funeral_util.cpp:10-31)", () => {
  it("maps slot numbers to the client's key letters", () => {
    expect([1, 2, 3, 4, 5].map(slotKey)).toEqual(["3", "2", "1", "0", "a"]);
    expect(() => slotKey(0)).toThrow();
    expect(() => slotKey(6)).toThrow();
  });

  it("puts a row of five left to right in slots 5 to 1 (keys a, 0, 1, 2, 3)", () => {
    const { placed, dropped } = layoutButtons([
      "Guilt",
      "Sympathy",
      "Hard Sell",
      "Soft Sell",
      "Done",
    ]);
    expect(placed.map((p) => [p.item, p.slot, p.key])).toEqual([
      ["Guilt", 5, "a"],
      ["Sympathy", 4, "0"],
      ["Hard Sell", 3, "1"],
      ["Soft Sell", 2, "2"],
      ["Done", 1, "3"],
    ]);
    expect(dropped).toEqual([]);
  });

  it("anchors a shorter row at the right: one button is slot 1, two are slots 2 and 1", () => {
    expect(layoutButtons(["Continue"]).placed.map((p) => p.key)).toEqual(["3"]);
    expect(layoutButtons(["Back", "Buy it"]).placed.map((p) => p.key)).toEqual(["2", "3"]);
  });

  it("drops what does not fit", () => {
    const { placed, dropped } = layoutButtons([1, 2, 3, 4, 5, 6, 7]);
    expect(placed).toHaveLength(5);
    expect(dropped).toEqual([6, 7]);
  });

  it("centres short labels like cbut", () => {
    expect(centerLabel("Done")).toBe("     Done");
    expect(centerLabel("Guilt")).toBe("     Guilt");
    expect(centerLabel("Continue")).toBe("   Continue");
    expect(centerLabel("Hard Sell")).toBe("   Hard Sell");
    expect(centerLabel("Make Announcement")).toBe("Make Announcement");
    expect(centerLabel("Ten chars!!")).toBe("Ten chars!!");
  });
});
