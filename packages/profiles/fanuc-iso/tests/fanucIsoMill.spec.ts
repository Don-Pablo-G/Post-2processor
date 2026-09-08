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

  it("attaches documented codes for Fanuc mill lint slice 2", () => {
    const samples: Array<[string, string]> = [
      ["fanuc.m00-while-coolant-on", "O1234\nT1 M6\nS1200 M3\nM8\nM00\nM9\nM5\nM30\n"],
      ["fanuc.m00-while-cutter-comp", "O1234\nT1 M6\nS1200 M3\nG41 D1\nM00\nG40\nM5\nM30\n"],
      ["fanuc.m00-while-canned", "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nM00\nG80\nM5\nM30\n"],
      ["fanuc.m00-while-tool-length", "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM00\nG49\nM5\nM30\n"],
      ["fanuc.m30-while-coolant-on", "O1234\nT1 M6\nS1200 M3\nM8\nM5\nM30\n"],
      ["fanuc.m30-while-cutter-comp", "O1234\nT1 M6\nS1200 M3\nG41 D1\nM5\nM30\n"],
      ["fanuc.m30-while-canned", "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nM30\n"],
      ["fanuc.m30-while-tool-length", "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM5\nM30\n"],
      ["fanuc.m02-while-coolant-on", "O1234\nT1 M6\nS1200 M3\nM8\nM5\nM02\n"],
      ["fanuc.m02-while-cutter-comp", "O1234\nT1 M6\nS1200 M3\nG41 D1\nM5\nM02\n"],
      ["fanuc.m02-while-canned", "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nM02\n"],
      ["fanuc.m02-while-tool-length", "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM5\nM02\n"],
      ["fanuc.m6-while-rotation", "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nT2 M6\nG69\nM5\nM30\n"],
      ["fanuc.m6-while-scaling", "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2.\nT2 M6\nG50\nM5\nM30\n"],
      ["fanuc.g28-while-cutter-comp", "O1234\nT1 M6\nS1200 M3\nG41 D1\nG28 Z0.\nG40\nM5\nM30\n"],
      ["fanuc.g28-while-canned", "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG28 Z0.\nG80\nM5\nM30\n"],
      ["fanuc.g53-while-cutter-comp", "O1234\nT1 M6\nS1200 M3\nG41 D1\nG53 Z0.\nG40\nM5\nM30\n"],
      ["fanuc.g53-while-canned", "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG53 Z0.\nG80\nM5\nM30\n"],
      ["fanuc.m98-without-p", "O1234\nM98\nM30\n"],
      ["fanuc.g68-and-g69-same-block", "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15. G69\nM5\nM30\n"],
      ["fanuc.g50-and-g51-same-block", "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2. G50\nM5\nM30\n"],
      ["fanuc.g41-and-g42-same-block", "O1234\nT1 M6\nS1200 M3\nG41 D1 G42\nM5\nM30\n"]
    ];

    for (const [code, program] of samples) {
      const codes = lintFanucIsoMillWithCodes(parse(program, fanucIsoProfile)).map((issue) => issue.code);
      expect(codes, `${code} should be emitted`).toContain(code);
    }
  });

  it("attaches documented codes for Fanuc mill lint slice 3", () => {
    const samples: Array<[string, string]> = [
      ["fanuc.m01-while-coolant-on", "O1234\nT1 M6\nS1200 M3\nM8\nM01\nM9\nM5\nM30\n"],
      ["fanuc.m01-while-cutter-comp", "O1234\nT1 M6\nS1200 M3\nG41 D1\nM01\nG40\nM5\nM30\n"],
      ["fanuc.m01-while-canned", "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nM01\nG80\nM5\nM30\n"],
      ["fanuc.m01-while-tool-length", "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM01\nG49\nM5\nM30\n"],
      ["fanuc.m01-while-rotation", "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nM01\nG69\nM5\nM30\n"],
      ["fanuc.m00-while-rotation", "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nM00\nG69\nM5\nM30\n"],
      ["fanuc.m02-while-rotation", "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nM5\nM02\nG69\n"],
      ["fanuc.m30-while-rotation", "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nM5\nM30\n"],
      ["fanuc.g30-while-cutter-comp", "O1234\nT1 M6\nS1200 M3\nG41 D1\nG30 Z0.\nG40\nM5\nM30\n"],
      ["fanuc.g30-while-canned", "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG30 Z0.\nG80\nM5\nM30\n"],
      ["fanuc.g28-while-tool-length", "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG28 Z0.\nG49\nM5\nM30\n"],
      ["fanuc.g53-while-tool-length", "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG53 Z0.\nG49\nM5\nM30\n"],
      ["fanuc.g28-while-rotation", "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG28 Z0.\nG69\nM5\nM30\n"],
      ["fanuc.g53-while-rotation", "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG53 Z0.\nG69\nM5\nM30\n"],
      ["fanuc.m5-while-coolant-on", "O1234\nT1 M6\nS1200 M3\nM8\nM5\nM9\nM30\n"],
      ["fanuc.m5-while-cutter-comp", "O1234\nT1 M6\nS1200 M3\nG41 D1\nM5\nG40\nM30\n"],
      ["fanuc.g0-while-cutter-comp", "O1234\nT1 M6\nS1200 M3\nG41 D1\nG0 X1.\nG40\nM5\nM30\n"],
      ["fanuc.g0-while-canned", "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG0 Z1.\nG80\nM5\nM30\n"],
      ["fanuc.coolant-on-while-spindle-off", "O1234\nT1 M6\nS1200 M3\nM5\nM8\nM9\nM30\n"],
      ["fanuc.g43-and-g41-same-block", "O1234\nT1 M6\nS1200 M3\nG43 H1 G41 D1 Z25.\nG40\nG49\nM5\nM30\n"],
      ["fanuc.g68-and-g51-same-block", "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15. G51 P2.\nG69\nG50\nM5\nM30\n"],
      ["fanuc.g4-and-m6-same-block", "O1234\nT1\nG4 P1. M6\nM30\n"]
    ];

    for (const [code, program] of samples) {
      const codes = lintFanucIsoMillWithCodes(parse(program, fanucIsoProfile)).map((issue) => issue.code);
      expect(codes, `${code} should be emitted`).toContain(code);
    }
  });

  it("attaches documented codes for Fanuc mill lint slice 4", () => {
    const samples: Array<[string, string]> = [
      ["fanuc.m00-while-scaling", "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2.\nM00\nG50\nM5\nM30\n"],
      ["fanuc.m01-while-scaling", "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2.\nM01\nG50\nM5\nM30\n"],
      ["fanuc.m02-while-scaling", "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2.\nM5\nM02\nG50\n"],
      ["fanuc.m30-while-scaling", "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2.\nM5\nM30\n"],
      ["fanuc.m00-while-incremental", "O1234\nT1 M6\nS1200 M3\nG91\nM00\nG90\nM5\nM30\n"],
      ["fanuc.m01-while-incremental", "O1234\nT1 M6\nS1200 M3\nG91\nM01\nG90\nM5\nM30\n"],
      ["fanuc.m02-while-incremental", "O1234\nT1 M6\nS1200 M3\nG91\nM5\nM02\nG90\n"],
      ["fanuc.m30-while-incremental", "O1234\nT1 M6\nS1200 M3\nG91\nM5\nM30\n"],
      ["fanuc.g30-while-tool-length", "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG30 Z0.\nG49\nM5\nM30\n"],
      ["fanuc.g30-while-rotation", "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nG30 Z0.\nG69\nM5\nM30\n"],
      ["fanuc.g28-while-scaling", "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2.\nG28 Z0.\nG50\nM5\nM30\n"],
      ["fanuc.g53-while-scaling", "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2.\nG53 Z0.\nG50\nM5\nM30\n"],
      ["fanuc.m5-while-tool-length", "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nM5\nG49\nM30\n"],
      ["fanuc.m5-while-rotation", "O1234\nT1 M6\nS1200 M3\nG68 X0. Y0. R15.\nM5\nG69\nM30\n"],
      ["fanuc.m5-while-scaling", "O1234\nT1 M6\nS1200 M3\nG51 X0. Y0. P2.\nM5\nG50\nM30\n"],
      ["fanuc.g0-while-tool-length", "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25.\nG0 X1.\nG49\nM5\nM30\n"],
      ["fanuc.canned-without-z", "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. R1. F50.\nG80\nM5\nM30\n"],
      ["fanuc.canned-without-r", "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. F50.\nG80\nM5\nM30\n"],
      ["fanuc.g65-while-cutter-comp", "O1234\nT1 M6\nS1200 M3\nG41 D1\nG65 P9100\nG40\nM5\nM30\n"],
      ["fanuc.g65-while-canned", "O1234\nT1 M6\nS1200 M3\nG81 X1. Y1. Z-1. R1. F50.\nG65 P9100\nG80\nM5\nM30\n"],
      ["fanuc.g43-and-g80-same-block", "O1234\nT1 M6\nS1200 M3\nG43 H1 Z25. G80\nG49\nM5\nM30\n"],
      ["fanuc.g41-and-g80-same-block", "O1234\nT1 M6\nS1200 M3\nG41 D1 G80\nG40\nM5\nM30\n"]
    ];

    for (const [code, program] of samples) {
      const codes = lintFanucIsoMillWithCodes(parse(program, fanucIsoProfile)).map((issue) => issue.code);
      expect(codes, `${code} should be emitted`).toContain(code);
    }
  });

  it("does not warn for stop while incremental when G90 is restored on the stop block", () => {
    const codes = lintFanucIsoMillWithCodes(
      parse("O1234\nT1 M6\nS1200 M3\nG91\nG90 M00\nM5\nM30\n", fanucIsoProfile)
    ).map((issue) => issue.code);

    expect(codes).not.toContain("fanuc.m00-while-incremental");
  });
});
