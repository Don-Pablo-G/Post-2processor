import { describe, expect, it } from "vitest";

import {
  applyBidiVisualOrder,
  applyBidiVisualOrderMultiline,
  applyBidiVisualOrderParagraphs,
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
    expect(out).toBe("Shop 42 לעפמ");
  });

  it("preserves embedded LTR islands inside RTL-dominant runs", () => {
    const line = "אב Shop גד";
    const out = applyBidiVisualOrder(line, "auto");
    expect(out).toContain("Shop");
    expect(out).not.toContain("pohS");
  });

  it("preserves parenthesized Latin islands inside RTL runs", () => {
    const line = "מפעל (CNC) שם";
    const out = applyBidiVisualOrder(line, "rtl");
    expect(out).toContain("(CNC)");
    expect(out).not.toContain(")CNC(");
  });

  it("reverses visual line order in RTL-dominant paragraphs", () => {
    const input = "שורה א\nשורה ב";
    const out = applyBidiVisualOrderParagraphs(input, "rtl");
    const lines = out.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).not.toBe("שורה א");
  });

  it("applyBidiVisualOrderMultiline paragraphs option delegates to paragraph helper", () => {
    const input = "שורה א\nשורה ב";
    expect(applyBidiVisualOrderMultiline(input, "rtl", { paragraphs: true })).toBe(
      applyBidiVisualOrderParagraphs(input, "rtl")
    );
  });
});
