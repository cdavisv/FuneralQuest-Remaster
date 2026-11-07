/**
 * The static text audit (src/textAudit.ts): every player-facing literal of the
 * original C++ and scripts is in the port verbatim, or listed with a reason;
 * every line of the port's Classic text table comes from the original, or is
 * listed with a reason. Needs no compiler.
 */
import { CLASSIC_TEXT } from "@fq/core";
import { describe, expect, it } from "vitest";
import { ADDED_IN_PORT, auditAdded, auditText, NOT_IN_PORT } from "../src/textAudit.js";

describe("original text against the port's text", () => {
  it("every player-facing literal is in the port, or explained", () => {
    const r = auditText();
    expect(r.checked).toBeGreaterThan(850);
    const unexplained = r.missing
      .filter((h) => NOT_IN_PORT[`${h.file}:${h.line}`] === undefined)
      .map((h) => `${h.file}:${h.line} ${JSON.stringify(h.literal)}`);
    expect(unexplained).toEqual([]);
  });

  it("every line of the Classic text table comes from the original, or is explained", () => {
    const unexplained = auditAdded(CLASSIC_TEXT)
      .filter((a) => ADDED_IN_PORT[a.path] === undefined)
      .map((a) => `${a.path}: ${JSON.stringify(a.missing)}`);
    expect(unexplained).toEqual([]);
  });
});
