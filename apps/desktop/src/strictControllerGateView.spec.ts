import { describe, expect, it } from "vitest";

import {
  evaluateStrictControllerGate,
  formatStrictControllerGateChip,
  STRICT_CONTROLLER_GATE_WATCH_PRESETS
} from "./strictControllerGateView";

describe("strictControllerGateView", () => {
  it("exposes the three CLI-aligned watch patterns", () => {
    expect(STRICT_CONTROLLER_GATE_WATCH_PRESETS).toEqual([
      "CG_N_AND_O_MIXED",
      "CG_DUPLICATE_O_HEADER",
      "CG_DUPLICATE_ADDRESSES_*"
    ]);
  });

  it("matches CG_N_AND_O_MIXED when present in lint issues", () => {
    const summary = evaluateStrictControllerGate(
      [{ code: "CG_N_AND_O_MIXED" }, { code: "CG_OTHER" }],
      ["CG_N_AND_O_MIXED"]
    );
    expect(summary.matchedCodes).toEqual(["CG_N_AND_O_MIXED"]);
    expect(summary.wouldBlock).toBe(true);
    expect(formatStrictControllerGateChip(summary)).toMatch(/CG_N_AND_O_MIXED/);
  });

  it("matches duplicate-address family by wildcard pattern", () => {
    const summary = evaluateStrictControllerGate(
      [{ code: "CG_DUPLICATE_ADDRESSES_X" }],
      ["CG_DUPLICATE_ADDRESSES_*"]
    );
    expect(summary.matchedCodes).toEqual(["CG_DUPLICATE_ADDRESSES_X"]);
  });
});
