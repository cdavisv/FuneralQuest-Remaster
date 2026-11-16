import { describe, expect, it } from "vitest";
import { trimEntry } from "../src/components/SideLog.js";

describe("the Earlier log's entries", () => {
  it("drop the blank lines a screen's text starts and ends with", () => {
    expect(
      trimEntry([
        { text: "\n\n" },
        { text: "  The rankings\n", color: "white" },
        { text: "#1 Ned\n\n\n\n" },
        { text: "   \n" },
      ]),
    ).toEqual([{ text: "The rankings\n", color: "white" }, { text: "#1 Ned" }]);
  });

  it("keep the spaces and lines inside the text", () => {
    expect(trimEntry([{ text: "One\n\nTwo  three" }])).toEqual([{ text: "One\n\nTwo  three" }]);
  });

  it("are left out when nothing is left", () => {
    expect(trimEntry([{ text: "\n \n" }])).toBeNull();
    expect(trimEntry([])).toBeNull();
  });
});
