import { describe, expect, it } from "vitest";

import {
  matchesAnyStrictControllerCodePattern,
  resolveStrictControllerCodesGate
} from "../src/cli/strictControllerCodesGate.js";

describe("strictControllerCodesGate", () => {
  it("matches exact codes and family wildcards", () => {
    expect(matchesAnyStrictControllerCodePattern("CG_N_AND_O_MIXED", ["CG_N_AND_O_MIXED"])).toBe(
      true
    );
    expect(
      matchesAnyStrictControllerCodePattern("CG_DUPLICATE_ADDRESSES_X", [
        "CG_DUPLICATE_ADDRESSES_*"
      ])
    ).toBe(true);
    expect(matchesAnyStrictControllerCodePattern("CG_OTHER", ["CG_N_AND_O_MIXED"])).toBe(false);
  });

  it("resolveStrictControllerCodesGate returns sorted unique matches", () => {
    expect(
      resolveStrictControllerCodesGate(
        ["CG_DUPLICATE_ADDRESSES_Y", "CG_N_AND_O_MIXED", "CG_OTHER"],
        ["CG_N_AND_O_MIXED", "CG_DUPLICATE_ADDRESSES_*"]
      )
    ).toEqual(["CG_DUPLICATE_ADDRESSES_Y", "CG_N_AND_O_MIXED"]);
  });
});
