import { describe, expect, it } from "vitest";
import { parse } from "@cnc/core";
import { fanucIsoProfile, lintFanucIsoMill, lintFanucIsoMillWithCodes } from "../src/index.js";

describe("@cnc/profile-fanuc-iso lintFanucIsoMill", () => {
  it("warns when a Fanuc program lacks an O#### header before the first motion block", () => {
    const ast = parse("G0 X1.\nG1 X2.\nM30\n", fanucIsoProfile);
    const issues = lintFanucIsoMill(ast);
    const missingHeader = issues.find((i) =>
      i.message.includes("Fanuc program lacks an explicit O####")
    );
    expect(missingHeader).toBeDefined();
    expect(missingHeader?.severity).toBe("warning");
    expect(missingHeader?.blockIndex).toBe(0);
  });

  it("does not warn when the program starts with a valid O#### header", () => {
    const ast = parse("O1000\nG0 X1.\nM30\n", fanucIsoProfile);
    const issues = lintFanucIsoMill(ast);
    expect(
      issues.some((i) => i.message.includes("Fanuc program lacks an explicit O####"))
    ).toBe(false);
  });

  it("does not warn when the O header sits after pure-comment blocks", () => {
    const ast = parse("(HEADER COMMENT)\n(ANOTHER COMMENT)\nO1234\nG0 X1.\nM30\n", fanucIsoProfile);
    const issues = lintFanucIsoMill(ast);
    expect(
      issues.some((i) => i.message.includes("Fanuc program lacks an explicit O####"))
    ).toBe(false);
  });

  it("emits no issues for an empty program (idempotent + safe on degenerate input)", () => {
    const ast = parse("", fanucIsoProfile);
    const issues = lintFanucIsoMill(ast);
    expect(issues).toEqual([]);
  });

  it("emits no issues for a program that contains only blank/comment blocks", () => {
    const ast = parse("(STILL ONLY COMMENTS)\n\n", fanucIsoProfile);
    const issues = lintFanucIsoMill(ast);
    expect(issues).toEqual([]);
  });

  it("ignores leading N-only sequence-number blocks when deciding 'meaningful'", () => {
    // N-only blocks alone are not motion; the warning fires on the first block
    // that carries a real word (G/M/X/etc.) without a prior O header.
    const ast = parse("N0010\nN0020\nG0 X1.\nM30\n", fanucIsoProfile);
    const issues = lintFanucIsoMill(ast);
    const missingHeader = issues.find((i) =>
      i.message.includes("Fanuc program lacks an explicit O####")
    );
    expect(missingHeader).toBeDefined();
    expect(missingHeader?.blockIndex).toBe(2);
  });

  it("warns when a G65 macro call is missing its P (program number) word", () => {
    const ast = parse("O1000\nG65 A1. B2.\nM30\n", fanucIsoProfile);
    const issues = lintFanucIsoMill(ast);
    const missingP = issues.find((i) =>
      i.message.includes("Fanuc G65 macro call missing P")
    );
    expect(missingP).toBeDefined();
    expect(missingP?.severity).toBe("warning");
    expect(missingP?.blockIndex).toBe(1);
  });

  it("does not warn for a G65 macro call that has both P and integer L", () => {
    const ast = parse("O1000\nG65 P9100 L2 A1.\nM30\n", fanucIsoProfile);
    const issues = lintFanucIsoMill(ast);
    expect(issues.some((i) => i.message.includes("Fanuc G65 macro call missing P"))).toBe(false);
    expect(issues.some((i) => i.message.includes("Fanuc G65 L (loop count)"))).toBe(false);
  });

  it("warns when G65 L is fractional or negative (non-negative integer required)", () => {
    const astFractional = parse("O1000\nG65 P9100 L1.5 A1.\nM30\n", fanucIsoProfile);
    const fractional = lintFanucIsoMill(astFractional).find((i) =>
      i.message.includes("Fanuc G65 L (loop count)")
    );
    expect(fractional).toBeDefined();
    expect(fractional?.blockIndex).toBe(1);

    const astNegative = parse("O1000\nG65 P9100 L-1 A1.\nM30\n", fanucIsoProfile);
    const negative = lintFanucIsoMill(astNegative).find((i) =>
      i.message.includes("Fanuc G65 L (loop count)")
    );
    expect(negative).toBeDefined();
    expect(negative?.blockIndex).toBe(1);
  });

  it("does not flag G65 L when the value is a macro variable or bracketed expression (run-time resolved)", () => {
    const astVar = parse("O1000\nG65 P9100 L#100 A1.\nM30\n", fanucIsoProfile);
    expect(
      lintFanucIsoMill(astVar).some((i) => i.message.includes("Fanuc G65 L (loop count)"))
    ).toBe(false);

    const astExpr = parse("O1000\nG65 P9100 L[#100+1] A1.\nM30\n", fanucIsoProfile);
    expect(
      lintFanucIsoMill(astExpr).some((i) => i.message.includes("Fanuc G65 L (loop count)"))
    ).toBe(false);
  });

  it("warns when T0 (tool cancel) appears before any prior real tool selection", () => {
    const ast = parse("O1000\nT0 M6\nM30\n", fanucIsoProfile);
    const issues = lintFanucIsoMill(ast);
    const t0Early = issues.find((i) => i.message.includes("T0 (tool cancel) issued before any real tool selection"));
    expect(t0Early).toBeDefined();
    expect(t0Early?.severity).toBe("warning");
    expect(t0Early?.blockIndex).toBe(1);
  });

  it("does not warn for T0 that follows a prior Tn (n>0) selection", () => {
    const ast = parse("O1000\nT1 M6\nG0 X1.\nT0\nM30\n", fanucIsoProfile);
    const issues = lintFanucIsoMill(ast);
    expect(
      issues.some((i) => i.message.includes("T0 (tool cancel) issued before any real tool selection"))
    ).toBe(false);
  });

  it("attaches documented codes for legacy Fanuc checks and the new mill slice", () => {
    const ast = parse("G65 L1\nM6\nM30\n", fanucIsoProfile);
    const codes = lintFanucIsoMillWithCodes(ast).map((issue) => issue.code);
    expect(codes).toContain("fanuc.missing-o-header");
    expect(codes).toContain("fanuc.g65-missing-p");
    expect(codes).toContain("fanuc.m6-without-t");
  });
});
