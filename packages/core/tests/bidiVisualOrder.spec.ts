import { describe, expect, it } from "vitest";

import {
  applyBidiVisualOrder,
  applyBidiVisualOrderMultiline,
  containsRtlText
} from "../src/workshop/bidiVisualOrder.js";

describe("bidiVisualOrder", () => {
  it("detects RTL strong characters", () => {
    expect(containsRtlText("מפעל")).toBe(true);
    expect(containsRtlText("Shop name")).toBe(false);
  });

  it("reverses pure RTL lines for PDF visual placement", () => {
    expect(applyBidiVisualOrder("מפעל", "rtl")).toBe("לעפמ");
  });

  it("leaves pure LTR lines unchanged in auto mode", () => {
    expect(applyBidiVisualOrder("Haas Shop 42", "auto")).toBe("Haas Shop 42");
  });

  it("preserves line breaks in multiline text", () => {
    const input = "Line A\nמפעל\nLine C";
    const out = applyBidiVisualOrderMultiline(input, "auto");
    expect(out.split("\n")).toHaveLength(3);
    expect(out.split("\n")[0]).toBe("Line A");
    expect(out.split("\n")[2]).toBe("Line C");
  });

  it("assigns digit runs to the preceding RTL segment on LTR-dominant lines", () => {
    const line = "Shop מפעל 42";
    const out = applyBidiVisualOrder(line, "auto");
    expect(out).toBe("Shop 24 לעפמ");
  });
});
