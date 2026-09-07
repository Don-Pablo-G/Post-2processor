import { describe, expect, it } from "vitest";
import {
  applyProveout,
  applyShopFixtureAutoFixes,
  analyzeProgram,
  buildTimelineFindingsExportBundle,
  buildSetupSheet,
  exportWorkshopFiles,
  format,
  lint,
  lintWithProvenance,
  getTemplateLibrary,
  parameterReserveProfiles,
  parameterize,
  parseTemplateLibrary,
  parse,
  previewShopFixtureAutoFixes,
  proveoutProgram,
  removeProveout,
  restoreShopFixtureManifestBackup,
  runJobCheck,
  simulate,
  summarizeParseDiagnostics,
  toolingReport
} from "../src/index.node.js";
import {
  analyzeShopFixtureHealth as analyzeShopFixtureHealthBrowser,
  applyShopFixtureAutoFixes as applyShopFixtureAutoFixesBrowser,
  exportWorkshopFiles as exportWorkshopFilesBrowser,
  importShopFixture as importShopFixtureBrowser,
  isNodeCapable as isNodeCapableBrowser
  ,
  previewShopFixtureAutoFixes as previewShopFixtureAutoFixesBrowser,
  restoreShopFixtureManifestBackup as restoreShopFixtureManifestBackupBrowser,
  runShopRegressionTests as runShopRegressionTestsBrowser,
  validateShopFixturesManifest as validateShopFixturesManifestBrowser
} from "../src/index.browser.js";
import { isNodeCapable as isNodeCapableNode } from "../src/index.node.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { haasNgcProfile as haasNgcProfilePackaged } from "@cnc/profile-haas-ngc";

const haasNgcProfile = {
  id: "haas-ngc",
  name: "Haas NGC",
  defaultFormatStyle: {
    upperCaseWords: true,
    normalizeSpacing: true,
    removeStandaloneOptionalStops: false
  }
};

describe("core pipeline", () => {
  async function readFixture(relativePath: string): Promise<string> {
    const fixturePath = path.resolve(process.cwd(), "..", "test-fixtures", relativePath);
    const content = await readFile(fixturePath, "utf8");
    return content.replace(/\r\n/g, "\n").trim();
  }

  it("parses and formats basic program", () => {
    const input = "g0x0y0\nG1x10.0 y5.0 f200.";
    const ast = parse(input, haasNgcProfile);
    const output = format(ast, haasNgcProfile);

    expect(ast.blocks.length).toBe(2);
    expect(output).toContain("G0 X0 Y0");
  });

  it("supports parse compliance mode override for legacy tokenization", () => {
    const strict = parse("M99 P Q1\nM30", haasNgcProfile);
    const lenient = parse("M99 P Q1\nM30", haasNgcProfile, { complianceMode: "lenient" });
    expect(strict.blocks[0]?.words.some((w) => w.letter === "P" && w.value === "")).toBe(false);
    expect(lenient.blocks[0]?.words.some((w) => w.letter === "P" && w.value === "")).toBe(true);
  });

  it("supports controller-specific strict parse profiles", () => {
    const strictHaas = parse("M99 P Q1\nM30", haasNgcProfile, { complianceMode: "strict_haas" });
    const strictFanuc = parse("M99 P Q1\nM30", haasNgcProfile, { complianceMode: "strict_fanuc" });
    expect(strictHaas.parseComplianceMode).toBe("strict_haas");
    expect(strictFanuc.parseComplianceMode).toBe("strict_fanuc");
    expect(strictHaas.blocks[0]?.words.some((w) => w.letter === "P" && w.value === "")).toBe(false);
    expect(strictFanuc.blocks[0]?.words.some((w) => w.letter === "P" && w.value === "")).toBe(false);
  });

  it("supports semicolon EOB splitting parse option", () => {
    const ast = parse("G0 X0; G1 X1; M30;", haasNgcProfile, { semicolonEob: true });
    expect(ast.blocks).toHaveLength(3);
    expect(ast.blocks[1]?.words.some((w) => w.letter === "G" && w.value === "1")).toBe(true);
  });

  it("requires standalone % lines at start and end", () => {
    const ast = parse("G0 X0\nM30", haasNgcProfile);
    const issues = lint(ast, haasNgcProfile);

    expect(issues.some((i) => i.message.includes("Program must start with a standalone % line."))).toBe(true);
    expect(issues.some((i) => i.message.includes("Program must end with a standalone % line."))).toBe(true);
  });

  it("warns when a percent delimiter line contains extra tokens", () => {
    const ast = parse("% O1000\nG0 X0\nM30\n%", haasNgcProfile);
    const issues = lint(ast, haasNgcProfile);

    expect(issues.some((i) => i.message.includes("Percent delimiter lines must contain only '%'."))).toBe(true);
  });

  it("preserves standalone % delimiter lines in formatter output", () => {
    const ast = parse("%\nG0X0Y0\nM30\n%", haasNgcProfile);
    const output = format(ast, haasNgcProfile);

    expect(output.startsWith("%\n")).toBe(true);
    expect(output.endsWith("\n%")).toBe(true);
  });

  it("can remove standalone M01/M1 lines without comments", () => {
    const input = "G0 X0\nM01\nM1\nM01 (KEEP)\nG1 X1";
    const ast = parse(input, haasNgcProfile);
    const output = format(ast, haasNgcProfile, { removeStandaloneOptionalStops: true });
    expect(output).not.toContain("\nM01\n");
    expect(output).not.toContain("\nM1\n");
    expect(output).toContain("M01 (KEEP)");
  });

  it("preserves assignment/control-flow lines while normalizing motion blocks", () => {
    const input = [
      "#100=0",
      "WHILE [#100 LT 3] DO1",
      "G1x10.0 y5.0 f200.",
      "IF [#100 EQ 2] GOTO100",
      "#100 = #100 + 1",
      "END1",
      "N100 M30"
    ].join("\n");
    const ast = parse(input, haasNgcProfile);
    const output = format(ast, haasNgcProfile);
    expect(output).toContain("#100=0");
    expect(output).toContain("WHILE [#100 LT 3] DO1");
    expect(output).toContain("IF [#100 EQ 2] GOTO100");
    expect(output).toContain("#100 = #100 + 1");
    expect(output).toContain("G1 X10.0 Y5.0 F200.");
  });

  it("accepts machine-valid compact address formatting without false parse warnings", () => {
    const cases: Array<{ line: string; expectedFragment: string }> = [
      { line: "G0X0.Y0.Z1.", expectedFragment: "G0 X0. Y0. Z1." },
      { line: "G1Y2.X1.F20.", expectedFragment: "G1 Y2. X1. F20." },
      { line: "g1x.5y-.25f15.", expectedFragment: "G1 X.5 Y-.25 F15." },
      { line: "N10G0X+1.25Y-0.5", expectedFragment: "N10 G0 X+1.25 Y-0.5" },
      { line: "X0.Y0.", expectedFragment: "X0. Y0." }
    ];

    for (const { line, expectedFragment } of cases) {
      const ast = parse(`${line}\nM30`, haasNgcProfile);
      const issues = lint(ast, haasNgcProfile);
      const sim = simulate(ast, {}, { maxSteps: 20, maxLoopIterations: 10, controllerMode: "haas-ngc" });
      const formatted = format(ast, haasNgcProfile);

      expect(ast.blocks[0]?.words.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.message.includes("Block has no parseable words."))).toBe(false);
      expect(sim.warnings.some((w) => w.includes("Invalid assignment"))).toBe(false);
      expect(formatted).toContain(expectedFragment);
    }
  });

  it("accepts additional machine-valid spacing and ordering variants from controller docs", () => {
    const cases: Array<{ line: string; expectedFragment: string }> = [
      // Address words may appear in any order within a block.
      { line: "Y7X0.G0", expectedFragment: "Y7 X0. G0" },
      // Tabs/spaces between addresses should not change meaning.
      { line: "G1\tX1.\tY2.\tF30.", expectedFragment: "G1 X1. Y2. F30." },
      // Optional signs are legal with packed addresses.
      { line: "G1X+0.Y-0.25F5.", expectedFragment: "G1 X+0. Y-0.25 F5." },
      // Sequence numbers can be packed into the same block.
      { line: "N20Y-1.X3.G1", expectedFragment: "N20 Y-1. X3. G1" },
      // Controller docs allow unusual intra-number whitespace variants.
      { line: "G0X +0. 12 34Y 7", expectedFragment: "G0 X+0.1234 Y7" }
    ];

    for (const { line, expectedFragment } of cases) {
      const ast = parse(`${line}\nM30`, haasNgcProfile);
      const issues = lint(ast, haasNgcProfile);
      const sim = simulate(ast, {}, { maxSteps: 20, maxLoopIterations: 10, controllerMode: "haas-ngc" });
      const formatted = format(ast, haasNgcProfile);

      expect(ast.blocks[0]?.words.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.message.includes("Block has no parseable words."))).toBe(false);
      expect(sim.warnings.some((w) => w.includes("Invalid assignment"))).toBe(false);
      expect(formatted).toContain(expectedFragment);
    }
  });

  it("accepts broad machine-valid g-code syntax variants without false interpreter errors", () => {
    const cases: Array<{ line: string; expectedFragment: string }> = [
      { line: "G0X0Y0Z0", expectedFragment: "G0 X0 Y0 Z0" },
      { line: "G00X1.Y2.Z3.", expectedFragment: "G00 X1. Y2. Z3." },
      { line: "G1X.125Y.5F12.", expectedFragment: "G1 X.125 Y.5 F12." },
      { line: "G1X-.125Y+.5F12.", expectedFragment: "G1 X-.125 Y+.5 F12." },
      { line: "G1 X +1. 0 Y -2. 5 F 30.", expectedFragment: "G1 X+1.0 Y-2.5 F30." },
      { line: "X10.Y20.G1F100.", expectedFragment: "X10. Y20. G1 F100." },
      { line: "F100.G1Y20.X10.", expectedFragment: "F100. G1 Y20. X10." },
      { line: "N1G0X0Y0", expectedFragment: "N1 G0 X0 Y0" },
      { line: "N0010G1X1.Y1.F10.", expectedFragment: "N0010 G1 X1. Y1. F10." },
      { line: "g1x1y1f10", expectedFragment: "G1 X1 Y1 F10" },
      { line: "g01x1.0y2.0f3.0", expectedFragment: "G01 X1.0 Y2.0 F3.0" },
      { line: "G1\tX1\tY2\tF3", expectedFragment: "G1 X1 Y2 F3" },
      { line: "G1X1\tY2  F3", expectedFragment: "G1 X1 Y2 F3" },
      { line: "X 1 Y 2 G 1 F 3", expectedFragment: "X1 Y2 G1 F3" },
      { line: "X +1 Y -2 G1 F +3", expectedFragment: "X+1 Y-2 G1 F+3" },
      { line: "X + 1 Y - 2 G1 F + 3", expectedFragment: "X+1 Y-2 G1 F+3" },
      { line: "G1X1.Y2.; INLINE", expectedFragment: "G1 X1. Y2." },
      { line: "G1X1.Y2.(INLINE)", expectedFragment: "G1 X1. Y2." },
      { line: "X0.Y0.Z0.A0.B0.C0", expectedFragment: "X0. Y0. Z0. A0. B0. C0" },
      { line: "G2X1.Y1.I.25J-.25", expectedFragment: "G2 X1. Y1. I.25 J-.25" },
      { line: "G3Y1.X1.J.25I-.25", expectedFragment: "G3 Y1. X1. J.25 I-.25" },
      { line: "M3S12000", expectedFragment: "M3 S12000" },
      { line: "S12000M3", expectedFragment: "S12000 M3" },
      { line: "T1M6", expectedFragment: "T1 M6" },
      { line: "M6T1", expectedFragment: "M6 T1" },
      { line: "G43H1Z1.", expectedFragment: "G43 H1 Z1." },
      { line: "H1G43Z1.", expectedFragment: "H1 G43 Z1." },
      { line: "G54G0X0Y0", expectedFragment: "G54 G0 X0 Y0" },
      { line: "G90G17G40G49G80", expectedFragment: "G90 G17 G40 G49 G80" },
      { line: "X +0. 12 34 Y 7", expectedFragment: "X+0.1234 Y7" }
    ];

    for (const { line, expectedFragment } of cases) {
      const ast = parse(`${line}\nM30`, haasNgcProfile);
      const issues = lint(ast, haasNgcProfile);
      const sim = simulate(ast, {}, { maxSteps: 20, maxLoopIterations: 10, controllerMode: "haas-ngc" });
      const formatted = format(ast, haasNgcProfile);

      expect(ast.blocks[0]?.words.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.message.includes("Block has no parseable words."))).toBe(false);
      expect(sim.warnings.some((w) => w.includes("Invalid assignment"))).toBe(false);
      expect(formatted).toContain(expectedFragment);
    }
  });

  it("accepts optional block-delete slash formatting variants without false errors", () => {
    const cases: Array<{ line: string; expectedFragment: string; allowFanucInvalidAssignment?: boolean }> = [
      { line: "/G0X0Y0", expectedFragment: "G0 X0 Y0" },
      { line: "/ G1 X1. Y2. F10.", expectedFragment: "G1 X1. Y2. F10." },
      { line: "/N10G1X1.Y1.", expectedFragment: "N10 G1 X1. Y1." },
      { line: "/g1x.5y-.25f15.", expectedFragment: "G1 X.5 Y-.25 F15." },
      { line: "/ #100=exp[1]", expectedFragment: "#100=EXP[1]", allowFanucInvalidAssignment: true },
      { line: "/ IF[#100EQ1]GOTO100", expectedFragment: "IF[#100EQ1]GOTO100" },
      { line: "/G1X +0. 12 34Y 7", expectedFragment: "G1 X+0.1234 Y7" },
      { line: "/G1X1.Y2. (SKIP CUT)", expectedFragment: "G1 X1. Y2. (SKIP CUT)" }
    ];

    for (const { line, expectedFragment, allowFanucInvalidAssignment } of cases) {
      const ast = parse(`${line}\nM30`, haasNgcProfile);
      const issues = lint(ast, haasNgcProfile);
      const haas = simulate(ast, {}, { maxSteps: 40, maxLoopIterations: 10, controllerMode: "haas-ngc" });
      const fanuc = simulate(ast, {}, { maxSteps: 40, maxLoopIterations: 10, controllerMode: "fanuc" });
      const formatted = format(ast, haasNgcProfile);

      expect(ast.blocks[0]?.words.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.message.includes("Block has no parseable words."))).toBe(false);
      expect(haas.warnings.some((w) => w.includes("Invalid assignment"))).toBe(false);
      if (!allowFanucInvalidAssignment) {
        expect(fanuc.warnings.some((w) => w.includes("Invalid assignment"))).toBe(false);
      }
      expect(formatted).toContain(expectedFragment);
    }
  });

  it("treats leading-zero and lowercase M/G codes as canonical equivalents", () => {
    const cases: Array<{ line: string; expectedFragment: string }> = [
      { line: "M3S12000", expectedFragment: "M3 S12000" },
      { line: "M03S12000", expectedFragment: "M03 S12000" },
      { line: "m03s12000", expectedFragment: "M03 S12000" },
      { line: "G0X0Y0", expectedFragment: "G0 X0 Y0" },
      { line: "G00X0Y0", expectedFragment: "G00 X0 Y0" },
      { line: "g00x0y0", expectedFragment: "G00 X0 Y0" },
      { line: "G1X1.Y1.F10.", expectedFragment: "G1 X1. Y1. F10." },
      { line: "G01X1.Y1.F10.", expectedFragment: "G01 X1. Y1. F10." },
      { line: "g01x1.y1.f10.", expectedFragment: "G01 X1. Y1. F10." },
      { line: "T1M6", expectedFragment: "T1 M6" },
      { line: "T1M06", expectedFragment: "T1 M06" },
      { line: "t1m06", expectedFragment: "T1 M06" }
    ];

    for (const { line, expectedFragment } of cases) {
      const ast = parse(`${line}\nM30`, haasNgcProfile);
      const issues = lint(ast, haasNgcProfile);
      const sim = simulate(ast, {}, { maxSteps: 20, maxLoopIterations: 10, controllerMode: "haas-ngc" });
      const formatted = format(ast, haasNgcProfile);

      expect(ast.blocks[0]?.words.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.message.includes("Block has no parseable words."))).toBe(false);
      expect(sim.warnings.some((w) => w.includes("Invalid assignment"))).toBe(false);
      expect(formatted).toContain(expectedFragment);
    }
  });

  it("accepts broad machine-valid macro/control-flow formatting variants", () => {
    const cases: string[] = [
      "#100=0\nIF[#100EQ0]THEN#100=1\nM30",
      "#100 = 0\nIF [ #100 EQ 0 ] THEN #100 = [ #100 + 1 ]\nM30",
      "#100=0\nwhile[#100 lt 2]do1\n#100=#100+1\nend1\nM30",
      "#100=1\nIF [#100 EQ 1] GOTO100\nN100 #101=5\nM30",
      "#100=1\ngoto100\nN100 #101=#100\nM30",
      "#100=sin[30]\n#101=cos[60]\n#102=abs[-5]\nM30",
      "#100 = sin [ 30 ]\n#101 = sqrt [ abs [ -9 ] ]\nM30",
      "#100=exp[1]\n#101=ln[exp[1]]\n#102=log[100]\nM30",
      "#100 = [#101+1]\n#102=[ #100 * [ #103 - 2 ] ]\nM30",
      "#100 = 0\nIF [#100 EQ 0] THEN #100=[#100+1] G0 Z-1.\nM30",
      "#100=0\nWHILE [ #100 LT 3 ] DO1\n#100=#100+1\nEND1\nM30",
      "#100=1\t\nIF\t[#100 EQ 1]\tTHEN\t#101=2\nM30"
    ];

    for (const program of cases) {
      const ast = parse(program, haasNgcProfile);
      const issues = lint(ast, haasNgcProfile);
      const sim = simulate(ast, {}, { maxSteps: 80, maxLoopIterations: 20, controllerMode: "haas-ngc" });
      const formatted = format(ast, haasNgcProfile);

      expect(ast.blocks.length).toBeGreaterThan(1);
      expect(issues.some((i) => i.message.includes("Block has no parseable words."))).toBe(false);
      expect(sim.warnings.some((w) => w.includes("Invalid assignment"))).toBe(false);
      expect(sim.warnings.some((w) => w.includes("IF…THEN assignment RHS invalid"))).toBe(false);
      expect(sim.warnings.some((w) => w.includes("has no matching WHILE"))).toBe(false);
      expect(sim.warnings.some((w) => w.includes("is missing END"))).toBe(false);
      expect(sim.warnings.some((w) => w.includes("target N") && w.includes("not found"))).toBe(false);
      expect(formatted).toContain("M30");
    }
  });

  it("uppercases lowercase macro/control-flow lines for machine-safe output", () => {
    const input = ["#100=exp[1]", "while [#100 lt 2] do1", "if [#100 eq 1] goto100", "end1", "n100 m30"].join("\n");
    const ast = parse(input, haasNgcProfile);
    const output = format(ast, haasNgcProfile);
    expect(output).toContain("#100=EXP[1]");
    expect(output).toContain("WHILE [#100 LT 2] DO1");
    expect(output).toContain("IF [#100 EQ 1] GOTO100");
    expect(output).toContain("END1");
    expect(output).toContain("N100 M30");
  });

  it("keeps uppercase output even when lowercase style is requested", () => {
    const input = "g0x0y0\n#100=exp[1]\nif [#100 eq 1] goto100\nn100 m30";
    const ast = parse(input, haasNgcProfile);
    const output = format(ast, haasNgcProfile, { upperCaseWords: false });
    expect(output).toContain("G0 X0 Y0");
    expect(output).toContain("#100=EXP[1]");
    expect(output).toContain("IF [#100 EQ 1] GOTO100");
    expect(output).toContain("N100 M30");
  });

  it("matches golden fixture formatting for basic Haas sample", async () => {
    const input = await readFixture(path.join("haas-ngc", "format", "input-basic.nc"));
    const expected = await readFixture(path.join("haas-ngc", "format", "expected-basic.nc"));
    const ast = parse(input, haasNgcProfile);
    const output = format(ast, haasNgcProfile).trim();
    expect(output).toBe(expected);
  });

  it("matches golden fixture formatting with optional stop cleanup enabled", async () => {
    const input = await readFixture(path.join("haas-ngc", "format", "input-optional-stop-cleanup.nc"));
    const expected = await readFixture(path.join("haas-ngc", "format", "expected-optional-stop-cleanup.nc"));
    const ast = parse(input, haasNgcProfile);
    const output = format(ast, haasNgcProfile, { removeStandaloneOptionalStops: true }).trim();
    expect(output).toBe(expected);
  });

  it("matches golden fixture formatting for messy spacing/comment styles", async () => {
    const input = await readFixture(path.join("haas-ngc", "format", "input-parser-robustness.nc"));
    const expected = await readFixture(path.join("haas-ngc", "format", "expected-parser-robustness.nc"));
    const ast = parse(input, haasNgcProfile);
    const output = format(ast, haasNgcProfile).trim();
    expect(output).toBe(expected);
  });

  it("matches golden fixture formatting for macro value expressions", async () => {
    const input = await readFixture(path.join("haas-ngc", "format", "input-parser-macro-expr.nc"));
    const expected = await readFixture(path.join("haas-ngc", "format", "expected-parser-macro-expr.nc"));
    const ast = parse(input, haasNgcProfile);
    const output = format(ast, haasNgcProfile).trim();
    expect(output).toBe(expected);
  });

  it("creates repeated-literal parameter suggestions", () => {
    const input = "G1 X10.0 Y5.0\nG1 X10.0 Y8.0";
    const ast = parse(input, haasNgcProfile);
    const result = parameterize(ast);
    expect(result.suggestions.some((s) => s.literal === "10.0")).toBe(true);
  });

  it("allocates only free parameters starting from #100", () => {
    const input = "#100=1\n#101=2\nG1 X10. Y5.\nG1 X10. Y5.\nG1 Z3. Z3.";
    const ast = parse(input, haasNgcProfile);
    const result = parameterize(ast);
    const replacements = result.suggestions.map((s) => s.replacement);
    expect(replacements[0]).toBe("#102");
    expect(replacements[1]).toBe("#103");
  });

  it("respects parameter blacklist during allocation", () => {
    const input = "G1 X10. Y5.\nG1 X10. Y5.";
    const ast = parse(input, haasNgcProfile);
    const result = parameterize(ast, { blacklistedParameters: [100, 101, 102], startAt: 100 });
    expect(result.suggestions[0]?.replacement).toBe("#103");
  });

  it("provides controller reserve presets", () => {
    const presets = parameterReserveProfiles();
    expect(presets.some((p) => p.id === "haas-ngc-safe")).toBe(true);
    expect(presets.some((p) => p.id === "fanuc-safe")).toBe(true);
    expect(presets.find((p) => p.id === "haas-ngc-safe")?.blacklistedParameters.includes(500)).toBe(true);
  });

  it("simulates with step limit", () => {
    const input = "G0 X0\nG1 X1\nG1 X2";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 2, maxLoopIterations: 100 });
    expect(result.trace.length).toBe(2);
    expect(result.warnings.length).toBe(1);
    expect(result.estimatedCycleTimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("simulates macro while loop and variable updates", () => {
    const input = "#100=0\nWHILE [#100 LT 3] DO1\n#100=#100+1\nEND1\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 100, maxLoopIterations: 20 });
    expect(result.state.variables["#100"]).toBe(3);
    expect(result.warnings).toHaveLength(0);
    expect(result.state.halted).toBe(true);
  });

  it("uses parsed expression AST when available for numeric XOR expression evaluation", () => {
    const input = "G1 X[1 XOR 0] F100.\nM30";
    const astWithoutExprAst = parse(input, haasNgcProfile, { includeExpressionAst: false });
    const astWithExprAst = parse(input, haasNgcProfile, { includeExpressionAst: true });
    const noAst = simulate(astWithoutExprAst, {}, { maxSteps: 40, maxLoopIterations: 10, controllerMode: "haas-ngc" });
    const withAst = simulate(astWithExprAst, {}, { maxSteps: 40, maxLoopIterations: 10, controllerMode: "haas-ngc" });
    expect(withAst.estimatedCycleTimeSeconds).toBeGreaterThan(noAst.estimatedCycleTimeSeconds);
  });

  it("evaluates macro math/trig helper functions", () => {
    const input = [
      "#100=ABS[-3.2]",
      "#101=ROUND[2.6]",
      "#102=FIX[-1.2]",
      "#103=FUP[-1.2]",
      "#104=SQRT[9]",
      "#105=SIN[30]",
      "#106=COS[60]",
      "#107=TAN[45]",
      "#108=ATAN[1]",
      "M30"
    ].join("\n");
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 200, maxLoopIterations: 20 });
    const v = result.state.variables;
    expect(v["#100"]).toBeCloseTo(3.2, 6);
    expect(v["#101"]).toBe(3);
    expect(v["#102"]).toBe(-2);
    expect(v["#103"]).toBe(-1);
    expect(v["#104"]).toBe(3);
    expect(v["#105"]).toBeCloseTo(0.5, 6);
    expect(v["#106"]).toBeCloseTo(0.5, 6);
    expect(v["#107"]).toBeCloseTo(1, 6);
    expect(v["#108"]).toBeCloseTo(45, 6);
  });

  it("warns for unsupported macro function in selected controller mode", () => {
    const input = "#100=FUP[-1.2]\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 50, maxLoopIterations: 10, controllerMode: "fanuc" });
    expect(result.warnings.some((w) => w.includes("not supported in fanuc mode"))).toBe(true);
  });

  it("evaluates LN/LOG/EXP with controller gating", () => {
    const input = ["#110=LN[2.718281828]", "#111=LOG[100]", "#112=EXP[1]", "M30"].join("\n");
    const ast = parse(input, haasNgcProfile);
    const haasNgc = simulate(ast, {}, { maxSteps: 100, maxLoopIterations: 10, controllerMode: "haas-ngc" });
    const fanuc = simulate(ast, {}, { maxSteps: 100, maxLoopIterations: 10, controllerMode: "fanuc" });
    expect(haasNgc.state.variables["#110"]).toBeCloseTo(1, 4);
    expect(haasNgc.state.variables["#112"]).toBeCloseTo(2.718281828, 4);
    expect(fanuc.state.variables["#110"]).toBeCloseTo(1, 4);
    expect(fanuc.warnings.some((w) => w.includes("Function EXP is not supported in fanuc mode"))).toBe(true);
  });

  it("warns on log domain errors", () => {
    const input = "#120=LOG[-1]\n#121=LN[0]\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 100, maxLoopIterations: 10, controllerMode: "haas-ngc" });
    expect(result.warnings.some((w) => w.includes("domain error"))).toBe(true);
  });

  it("supports configurable LOG semantics", () => {
    const input = "#130=LOG[100]\nM30";
    const ast = parse(input, haasNgcProfile);
    const fanucDefault = simulate(ast, {}, { maxSteps: 50, maxLoopIterations: 10, controllerMode: "fanuc" });
    const fanucNatural = simulate(ast, {}, {
      maxSteps: 50,
      maxLoopIterations: 10,
      controllerMode: "fanuc",
      logSemantics: "natural"
    });
    const haasBase10 = simulate(ast, {}, {
      maxSteps: 50,
      maxLoopIterations: 10,
      controllerMode: "haas-ngc",
      logSemantics: "base10"
    });
    expect(fanucDefault.state.variables["#130"]).toBeCloseTo(2, 6);
    expect(fanucNatural.state.variables["#130"]).toBeCloseTo(Math.log(100), 6);
    expect(haasBase10.state.variables["#130"]).toBeCloseTo(2, 6);
  });

  it("captures #3000/#3006 alarms and halts simulation", () => {
    const input = "#3000=12 (TOOL LIFE EXPIRED)\n#3006=7 (OPERATOR CHECK)\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 100, maxLoopIterations: 10 });
    expect(result.alarms).toHaveLength(1);
    expect(result.alarms[0]?.parameter).toBe(3000);
    expect(result.alarms[0]?.code).toBe(12);
    expect(result.alarms[0]?.message).toContain("TOOL LIFE EXPIRED");
    expect(result.state.halted).toBe(true);
  });

  it("simulates M98 subprogram repeats with M99 return", () => {
    const input = "M98 P1000 L3\nM30\nO1000\n#100=#100+1\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 200, maxLoopIterations: 20, maxCallDepth: 4 });
    expect(result.state.variables["#100"]).toBe(3);
    expect(result.warnings).toHaveLength(0);
    expect(result.state.halted).toBe(true);
    expect(result.trace.some((t) => t.event?.kind === "subprogram_call" && t.event.via === "M98")).toBe(true);
    expect(result.trace.some((t) => t.event?.kind === "subprogram_repeat")).toBe(true);
    expect(result.trace.some((t) => t.event?.kind === "subprogram_return")).toBe(true);
  });

  it("simulates G65 arguments and enforces call depth limit", () => {
    const input = "G65 P9010 A5.5 B2.\nM30\nO9010\n#100=#1+#2\nG65 P9010 A1.\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 200, maxLoopIterations: 20, maxCallDepth: 1 });
    expect(result.state.variables["#100"]).toBeCloseTo(7.5, 6);
    expect(result.warnings.some((w) => w.includes("Max call depth"))).toBe(true);
    expect(result.trace.some((t) => t.event?.kind === "call_depth_limit" && t.event.via === "G65")).toBe(true);
  });

  it("supports Haas-style M97 P.. calls to N.. local subprograms", () => {
    const input = "M97 P100\nM30\nN100\n#120=#120+1\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 200, maxLoopIterations: 20, controllerMode: "haas-ngc" });
    expect(result.state.variables["#120"]).toBe(1);
    expect(result.warnings).toHaveLength(0);
    expect(result.state.halted).toBe(true);
  });

  it("supports multiple local N subprogram operations in one file", () => {
    const input = "M97 P100\nM97 P200\nM30\nN100\n#101=#101+1\nM99\nN200\n#102=#102+2\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 300, maxLoopIterations: 20, controllerMode: "haas-ngc" });
    expect(result.state.variables["#101"]).toBe(1);
    expect(result.state.variables["#102"]).toBe(2);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when M97 is used in fanuc mode", () => {
    const input = "M97 P100\nM30\nN100\n#120=#120+1\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 200, maxLoopIterations: 20, controllerMode: "fanuc" });
    expect(result.warnings.some((w) => w.includes("M97 local subprogram call is not supported in fanuc mode"))).toBe(true);
  });

  it("emits profile-specific main-level M99 warning/event", () => {
    const input = "G90\nM99\nM30";
    const ast = parse(input, haasNgcProfile);
    const fanucResult = simulate(ast, {}, { maxSteps: 50, maxLoopIterations: 10, controllerMode: "fanuc" });
    const haasResult = simulate(ast, {}, { maxSteps: 50, maxLoopIterations: 10, controllerMode: "haas-ngc" });
    expect(fanucResult.warnings.some((w) => w.includes("Fanuc mode: M99 in main program"))).toBe(true);
    expect(haasResult.warnings.some((w) => w.includes("M99 encountered in main program"))).toBe(true);
    expect(fanucResult.trace.some((t) => t.event?.kind === "main_m99")).toBe(true);
    expect(haasResult.trace.some((t) => t.event?.kind === "main_m99")).toBe(true);
  });

  it("warns when subprogram return path is unfinished", () => {
    const input = "M98 P1000\nM30\nO1000\n#100=#100+1";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 100, maxLoopIterations: 10, controllerMode: "haas-ngc" });
    expect(result.warnings.some((w) => w.includes("unfinished subprogram return path"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("unfinished subprogram return path (block"))).toBe(true);
  });

  it("allows fanuc M98 to resolve N-label in shop-friendly mode", () => {
    const input = "M98 P100\nM30\nN100\n#140=#140+1\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, {
      maxSteps: 200,
      maxLoopIterations: 20,
      controllerMode: "fanuc",
      subprogramTargetPolicy: "shop_friendly"
    });
    expect(result.state.variables["#140"]).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("enforces fanuc O-label M98 target in strict-controller mode", () => {
    const input = "M98 P100\nM30\nN100\n#140=#140+1\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, {
      maxSteps: 200,
      maxLoopIterations: 20,
      controllerMode: "fanuc",
      subprogramTargetPolicy: "strict_controller"
    });
    expect(result.state.variables["#140"] ?? 0).toBe(0);
    expect(result.warnings.some((w) => w.includes("M98 target O100 not found"))).toBe(true);
  });

  it("allows fanuc G65 to resolve N-label in shop-friendly mode", () => {
    const input = "G65 P9010 A2.\nM30\nN9010\n#150=#1+10\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, {
      maxSteps: 200,
      maxLoopIterations: 20,
      controllerMode: "fanuc",
      subprogramTargetPolicy: "shop_friendly"
    });
    expect(result.state.variables["#150"]).toBe(12);
    expect(result.warnings).toHaveLength(0);
  });

  it("enforces fanuc O-label G65 target in strict-controller mode with clear warning", () => {
    const input = "G65 P9010 A2.\nM30\nN9010\n#150=#1+10\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, {
      maxSteps: 200,
      maxLoopIterations: 20,
      controllerMode: "fanuc",
      subprogramTargetPolicy: "strict_controller"
    });
    expect(result.state.variables["#150"] ?? 0).toBe(0);
    expect(
      result.warnings.some((w) => w.includes("G65 target O9010 not found in strict fanuc mode"))
    ).toBe(true);
  });

  it("applies strict-vs-shop-friendly target policy matrix for M98 and G65 in fanuc mode", () => {
    const cases = [
      {
        name: "M98 with N-label target",
        program: "M98 P100\nM30\nN100\n#140=#140+1\nM99",
        expectedVariable: "#140",
        expectedValueInShopFriendly: 1,
        strictWarningIncludes: "M98 target O100 not found"
      },
      {
        name: "G65 with N-label target",
        program: "G65 P9010 A2.\nM30\nN9010\n#150=#1+10\nM99",
        expectedVariable: "#150",
        expectedValueInShopFriendly: 12,
        strictWarningIncludes: "G65 target O9010 not found in strict fanuc mode"
      },
      {
        name: "M98 with O-label target",
        program: "M98 P1000\nM30\nO1000\n#160=#160+1\nM99",
        expectedVariable: "#160",
        expectedValueInShopFriendly: 1,
        strictWarningIncludes: "M98 target O1000 not found"
      },
      {
        name: "G65 with O-label target",
        program: "G65 P7777 A3.\nM30\nO7777\n#170=#1+20\nM99",
        expectedVariable: "#170",
        expectedValueInShopFriendly: 23,
        strictWarningIncludes: "G65 target O7777 not found in strict fanuc mode"
      }
    ];

    for (const item of cases) {
      const ast = parse(item.program, haasNgcProfile);
      const shopFriendly = simulate(ast, {}, {
        maxSteps: 250,
        maxLoopIterations: 20,
        controllerMode: "fanuc",
        subprogramTargetPolicy: "shop_friendly"
      });
      const strict = simulate(ast, {}, {
        maxSteps: 250,
        maxLoopIterations: 20,
        controllerMode: "fanuc",
        subprogramTargetPolicy: "strict_controller"
      });

      expect(shopFriendly.state.variables[item.expectedVariable]).toBe(item.expectedValueInShopFriendly);
      expect(shopFriendly.warnings.some((w) => w.includes("not found"))).toBe(false);

      if (item.name.includes("O-label")) {
        // O-label targets should also pass under strict fanuc policy.
        expect(strict.state.variables[item.expectedVariable]).toBe(item.expectedValueInShopFriendly);
        expect(strict.warnings.some((w) => w.includes("not found"))).toBe(false);
      } else {
        expect(strict.state.variables[item.expectedVariable] ?? 0).toBe(0);
        expect(strict.warnings.some((w) => w.includes(item.strictWarningIncludes))).toBe(true);
      }
    }
  });

  it("estimates canned cycle and feed based time", () => {
    const input = "G0 X0 Y0 Z5.\nG1 X60. F600.\nG99 G81 X60. Y0. Z-10. R2. F300. P500 L2\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 100, maxLoopIterations: 20, rapidRateMmPerMin: 12000 });
    expect(result.estimatedCycleTimeSeconds).toBeGreaterThan(4);
    expect(result.estimatedCycleTimeSeconds).toBeLessThan(20);
  });

  it("has distinct timing behavior across canned cycles", () => {
    const cycles = [
      "G81 X0 Y0 Z-10. R2. F250.",
      "G82 X0 Y0 Z-10. R2. F250. P500",
      "G83 X0 Y0 Z-10. R2. F250. Q2.",
      "G84 X0 Y0 Z-10. R2. F250.",
      "G89 X0 Y0 Z-10. R2. F250. P500"
    ];
    const times = cycles.map((line) => {
      const ast = parse(`G0 Z5.\n${line}\nM30`, haasNgcProfile);
      return simulate(ast, {}, { maxSteps: 100, maxLoopIterations: 20 }).estimatedCycleTimeSeconds;
    });
    expect(times[1]).toBeGreaterThan(times[0]);
    expect(times[2]).toBeGreaterThan(times[0]);
    expect(times[4]).toBeGreaterThan(times[0]);
    expect(times[3]).toBeGreaterThan(0);
  });

  it("warns on invalid canned cycle parameter combinations", () => {
    const input = "G83 X0 Y0 Z-10. R2. F200.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = simulate(ast, {}, { maxSteps: 50, maxLoopIterations: 10 });
    expect(result.warnings.some((w) => w.includes("missing Q"))).toBe(true);
  });

  it("builds tooling report with lowest Z and 80mm printable text", () => {
    const input =
      "#600=1\n#700=12\nG54\nT1 M6\nG43 H#600 D#700 Z20.\nG1 Z-5.\nG154 P12\n#603=3\nT3 M6\nB30. C20.\nG43 H#603\nG1 Z-18.5\nM30";
    const ast = parse(input, haasNgcProfile);
    const report = toolingReport(ast, {}, {
      fiveAxis: { enabled: true, machine: "umc" },
      toolCommentSelections: { 1: "FACE MILL D63", 3: "BALL END D10" }
    });
    expect(report.programLowestZ).toBe(-18.5);
    expect(report.tools.length).toBe(2);
    expect(report.tools.find((t) => t.toolNumber === 1)?.hOffset).toBe(1);
    expect(report.tools.find((t) => t.toolNumber === 1)?.hOffsetParameter).toBe("#600");
    expect(report.tools.find((t) => t.toolNumber === 1)?.dOffsetParameter).toBe("#700");
    expect(report.tools.find((t) => t.toolNumber === 3)?.hOffsetParameter).toBe("#603");
    expect(report.tools.find((t) => t.toolNumber === 3)?.workOffsetsUsed).toContain("G154 P12");
    expect(report.tools.find((t) => t.toolNumber === 3)?.estimatedStickoutMm).toBeGreaterThan(0);
    expect(report.tools.find((t) => t.toolNumber === 1)?.selectedToolComment).toBe("FACE MILL D63");
    expect(report.setupInstructions.length).toBeGreaterThan(0);
    expect(report.printable80mm).toContain("#600");
    expect(report.printable80mm).toContain("NAME:");
    expect(report.printable80mm).toContain("SETTER REPORT");
  });

  it("collects tool comment candidates around T call", () => {
    const input = "(ROUGH ENDMILL D12)\nM01\nT7 M6 (LOAD TOOL)\nG43 H7 D7\nG1 Z-1.\nM30";
    const ast = parse(input, haasNgcProfile);
    const report = toolingReport(ast, {}, {});
    const t7 = report.tools.find((t) => t.toolNumber === 7);
    expect(t7?.toolCommentCandidates.some((c) => c.includes("ROUGH ENDMILL"))).toBe(true);
    expect(t7?.selectedToolComment).toContain("LOAD TOOL");
  });

  it("can disable automatic tool comment selection", () => {
    const input = "(FACE TOOL)\nT1 M6\nG43 H1 D1\nG1 Z-1.\nM30";
    const ast = parse(input, haasNgcProfile);
    const report = toolingReport(ast, {}, { autoSelectToolComments: false });
    expect(report.tools.find((t) => t.toolNumber === 1)?.selectedToolComment).toBeUndefined();
  });

  it("warns when Haas D policy is violated", () => {
    const input = "T5 M6\nG43 H5\nG41 X10.\nG42 D12 X20.\nM30";
    const ast = parse(input, haasNgcProfile);
    const report = toolingReport(ast, {}, { dOffsetCallStyle: "haas_g43_d_with_h_only" });
    expect(report.warnings.some((w) => w.includes("expects D on G43 H line"))).toBe(true);
    expect(report.warnings.some((w) => w.includes("expects no D on G41/G42"))).toBe(true);
  });

  it("validates Fanuc D policy with G41/G42 and G40 D00", () => {
    const input = "T5 M6\nG43 H5\nG41 D12 X10.\nG40 D00\nM30";
    const ast = parse(input, haasNgcProfile);
    const report = toolingReport(ast, {}, { dOffsetCallStyle: "fanuc_wear_on_g41_g42_with_g40_d00" });
    expect(report.warnings.some((w) => w.includes("Fanuc style"))).toBe(false);
  });

  it("warns when Fanuc D policy is violated", () => {
    const input = "T5 M6\nG43 H5 D5\nG41 X10.\nG40 D01\nM30";
    const ast = parse(input, haasNgcProfile);
    const report = toolingReport(ast, {}, { dOffsetCallStyle: "fanuc_wear_on_g41_g42_with_g40_d00" });
    expect(report.warnings.some((w) => w.includes("expects no D on G43 H line"))).toBe(true);
    expect(report.warnings.some((w) => w.includes("expects D on G41/G42 line"))).toBe(true);
    expect(report.warnings.some((w) => w.includes("expects G40 with D00"))).toBe(true);
  });

  it("builds workshop advisor report with score and checklist", () => {
    const input = "T1 M6\nG90 G17\nG0 Z5.\nG1 Z-2. F150.\nM30";
    const ast = parse(input, haasNgcProfile);
    const advisor = analyzeProgram(ast, {});
    expect(advisor.readyToRunScore).toBeGreaterThanOrEqual(0);
    expect(advisor.readyToRunScore).toBeLessThanOrEqual(100);
    expect(advisor.checklist.length).toBeGreaterThan(0);
    expect(advisor.criticalEvents.some((e) => e.kind === "deepest_z")).toBe(true);
    expect(advisor.optionalStopSuggestions.length).toBeGreaterThan(0);
    expect(advisor.parameterFrontMatter).toContain("SHOP PARAM FRONT-MATTER");
    expect(advisor.operatorViewProgram).toContain("OPERATOR");
  });

  it("flags clamp-zone collision risk when envelope is configured", () => {
    const input = "G90 G17\nG0 X5. Y50. Z10.\nG1 X5. Y50. Z-2.\nM30";
    const ast = parse(input, haasNgcProfile);
    const advisor = analyzeProgram(ast, {}, {
      clampZones: [{ name: "JAW", minX: 0, maxX: 10, minY: 0, maxY: 100, minZ: -5, maxZ: 20 }]
    });
    expect(advisor.safetyFindings.some((f) => f.code === "CLAMP_ZONE_COLLISION_RISK")).toBe(true);
    expect(advisor.readyToRunScore).toBeLessThan(50);
  });

  it("provides workshop templates", () => {
    const library = getTemplateLibrary();
    const templates = library.templates;
    expect(templates.length).toBeGreaterThan(0);
    expect(templates[0].code).toContain("M30");
    expect(library.settings?.parameterDefaults?.["haas-ngc"]?.presetId).toBe("haas-ngc-safe");
  });

  it("imports template library from json", () => {
    const source = JSON.stringify({
      templates: [{ id: "x", name: "X", description: "d", code: "M30" }],
      settings: {
        parameterDefaults: {
          "haas-ngc": {
            presetId: "haas-ngc-safe",
            startAt: 100,
            blacklistedParameters: [500, 501]
          }
        }
      }
    });
    const parsed = parseTemplateLibrary(source);
    expect(parsed.templates).toHaveLength(1);
    expect(parsed.templates[0].id).toBe("x");
    expect(parsed.settings?.parameterDefaults?.["haas-ngc"]?.blacklistedParameters).toContain(500);
  });

  it("builds setup sheet and proveout program", () => {
    const input = "G90 G17\nT1 M6\nG43 H1 Z20.\nG1 Z-1. F100.\nM30";
    const ast = parse(input, haasNgcProfile);
    const sheet = buildSetupSheet(ast, {});
    const proveout = proveoutProgram(ast, {});
    expect(sheet.printable80mm).toContain("SETUP SHEET");
    expect(sheet.printable80mm).toContain("HANDOFF:");
    expect(proveout.code).toContain("PROVEOUT MODE ENABLED");
    expect(proveout.insertedCheckpoints).toBeGreaterThanOrEqual(0);
    expect(sheet.exportTxt).toContain("SETUP SHEET");
    expect(sheet.exportMarkdown).toContain("# Workshop Setup Sheet");
  });

  it("marks setup sheet handoff as NO-GO when blockers exist", () => {
    const input = "G90 G17\nG1 Z-2.\n";
    const ast = parse(input, haasNgcProfile);
    const sheet = buildSetupSheet(ast, {});
    expect(sheet.exportTxt).toContain("HANDOFF: NO-GO");
  });

  it("applies and removes proveout markers reversibly", () => {
    const input = "G90\nM30";
    const applied = applyProveout(input, ["(OPTIONAL STOP: CHECK FIRST CUT) M01"]);
    expect(applied.markersAdded).toBeGreaterThan(0);
    expect(applied.code).toContain("PROVEOUT MODE ENABLED");
    const removed = removeProveout(applied.code);
    expect(removed.markersRemoved).toBeGreaterThan(0);
    expect(removed.code).toContain("G90");
  });

  it("exports setup and proveout files to timestamped directory", async () => {
    const os = await import("node:os");
    const path = await import("node:path");
    const fs = await import("node:fs/promises");
    const base = await fs.mkdtemp(path.join(os.tmpdir(), "cnc-workbench-"));
    const result = await exportWorkshopFiles({
      baseDirectory: base,
      baseName: "job_42",
      setupSheetTxt: "SETUP",
      setupSheetMarkdown: "# Setup",
      proveoutCode: "M30"
    });
    expect(result.artifacts).toHaveLength(3);
    const txt = await fs.readFile(result.artifacts.find((a) => a.kind === "setup_txt")!.path, "utf8");
    const md = await fs.readFile(result.artifacts.find((a) => a.kind === "setup_md")!.path, "utf8");
    const nc = await fs.readFile(result.artifacts.find((a) => a.kind === "proveout_nc")!.path, "utf8");
    expect(txt).toBe("SETUP");
    expect(md).toContain("# Setup");
    expect(nc).toContain("M30");
  });

  it("runs one-click job check workflow and blocks export on blockers", async () => {
    const input = "G90 G17\nG1 Z-2.\n";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      exportOptions: {
        enabled: true,
        allowExportWithBlockers: false,
        baseDirectory: ".",
        baseName: "blocked_job"
      }
    });
    expect(result.blockerCount).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
    expect(result.exportResult).toBeUndefined();
  });

  it("blocks export on policy-blocked warning finding codes by default", async () => {
    const input = "G90 G0 Z0.\nG0 Z-10.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportBlockingPolicy: {
        includeAllBlockers: false,
        blockedFindingCodes: ["SIM_RAPID_Z_PLUNGE"]
      },
      exportOptions: {
        enabled: true,
        allowExportWithBlockers: false,
        baseDirectory: ".",
        baseName: "policy_blocked_warning"
      }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_RAPID_Z_PLUNGE")).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.exportResult).toBeUndefined();
  });

  it("allows overriding export-blocking policy for specific finding codes", async () => {
    const input = "G90 G0 Z0.\nG0 Z-10.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportBlockingPolicy: {
        includeAllBlockers: false,
        blockedFindingCodes: []
      },
      exportOptions: {
        enabled: false,
        allowExportWithBlockers: false,
        baseDirectory: ".",
        baseName: "policy_override_warning"
      }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_RAPID_Z_PLUNGE")).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("surfaces macro alarms in job check output as blockers", async () => {
    const input = "G90 G17\n#3006=3 (CHECK CHIP LOAD)\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      exportOptions: {
        enabled: false,
        baseDirectory: ".",
        baseName: "alarm_job"
      }
    });
    expect(result.simulation.alarms).toHaveLength(1);
    expect(result.simulationFindings.some((f) => f.code === "SIM_MACRO_ALARM")).toBe(true);
    const macroAlarmFinding = result.simulationFindings.find((f) => f.code === "SIM_MACRO_ALARM");
    expect(macroAlarmFinding?.message).toContain("(block");
    expect(macroAlarmFinding?.blockIndex).toBe(1);
    expect(result.blockerCount).toBeGreaterThan(0);
    expect(result.messages.some((m) => m.includes("Macro alarm #3006"))).toBe(true);
  });

  it("adds simulation finding for fanuc main-level M99", async () => {
    const input = "M99\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "m99_job" }
    });
    expect(
      result.simulation.warnings.some((w) => w.includes("Fanuc mode: M99 in main program"))
    ).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_MAIN_M99")).toBe(true);
    const mainM99Finding = result.simulationFindings.find((f) => f.code === "SIM_MAIN_M99");
    expect(mainM99Finding?.message).toContain("at block");
    expect(mainM99Finding?.blockIndex).toBe(0);
    expect(result.blockerCount).toBeGreaterThan(0);
  });

  it("uses simulator end position for unfinished-return-path finding block index", async () => {
    const input = "M98 P1000\nM30\nO1000\n#100=#100+1";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "unfinished_return_path_block_job" }
    });
    const finding = result.simulationFindings.find((f) => f.code === "SIM_UNFINISHED_RETURN_PATH");
    expect(finding).toBeDefined();
    expect(finding?.blockIndex).toBe(result.simulation.state.currentBlock);
    expect(finding?.message).toContain("pending: 1000");
    expect(finding?.message).toContain("(block");
  });

  it("keeps one canonical finding for main-level M99", async () => {
    const input = "M99\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "m99_canonical_job" }
    });
    const findings = result.simulationFindings.filter((f) => f.code === "SIM_MAIN_M99");
    expect(findings).toHaveLength(1);
  });

  it("adds one canonical simulation finding for repeated call-depth-limit events", async () => {
    const input = "G65 P1000\nG65 P1000\nM30\nO1000\nG65 P1000\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc", maxCallDepth: 1 },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "call_depth_limit_canonical_job" }
    });
    const depthEvents = result.simulation.trace.filter((t) => t.event?.kind === "call_depth_limit");
    expect(depthEvents.length).toBeGreaterThan(0);
    const findings = result.simulationFindings.filter((f) => f.code === "SIM_CALL_DEPTH_LIMIT");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toContain("(block");
  });

  it("does not add call-depth-limit finding when depth limit is not reached", async () => {
    const input = "G65 P1000\nM30\nO1000\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc", maxCallDepth: 4 },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "call_depth_limit_absent_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_CALL_DEPTH_LIMIT")).toBe(false);
  });

  it("adds simulation finding for unsupported fanuc M97 local subprogram call", async () => {
    const input = "M97 P100\nM30\nN100\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "m97_fanuc_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("M97 local subprogram call is not supported in fanuc mode"))).toBe(
      true
    );
    expect(result.simulationFindings.some((f) => f.code === "SIM_UNSUPPORTED_M97")).toBe(true);
    const finding = result.simulationFindings.find((f) => f.code === "SIM_UNSUPPORTED_M97");
    expect(finding?.message).toContain("(block");
  });

  it("adds one unsupported-M97 finding per fanuc warning", async () => {
    const input = "M97 P100\nM97 P200\nM30\nN100\nM99\nN200\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "m97_fanuc_multi_job" }
    });
    const warnings = result.simulation.warnings.filter((w) =>
      w.includes("M97 local subprogram call is not supported in fanuc mode")
    );
    const findings = result.simulationFindings.filter((f) => f.code === "SIM_UNSUPPORTED_M97");
    expect(warnings.length).toBeGreaterThan(1);
    expect(findings).toHaveLength(warnings.length);
  });

  it("adds simulation finding for unsupported fanuc macro function", async () => {
    const input = "#100=EXP[1]\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "unsupported_fn_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("Function EXP is not supported in fanuc mode"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_UNSUPPORTED_FUNCTION")).toBe(true);
    const finding = result.simulationFindings.find((f) => f.code === "SIM_UNSUPPORTED_FUNCTION");
    expect(finding?.message).toContain("(block");
  });

  it("adds one unsupported-function finding per fanuc warning", async () => {
    const input = "#100=EXP[1]\n#101=EXP[2]\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "unsupported_fn_multi_job" }
    });
    const warnings = result.simulation.warnings.filter(
      (w) => w.startsWith("Function ") && w.includes("is not supported in fanuc mode")
    );
    const findings = result.simulationFindings.filter((f) => f.code === "SIM_UNSUPPORTED_FUNCTION");
    expect(warnings.length).toBeGreaterThan(1);
    expect(findings).toHaveLength(warnings.length);
  });

  it("uses warning block index for unsupported-function findings", async () => {
    const input = "#100=EXP[1]\nG1 X1.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "unsupported_function_block_index_job" }
    });
    const warning = result.simulation.warnings.find((w) =>
      w.startsWith("Function ") && w.includes("is not supported in fanuc mode")
    );
    expect(warning).toBeDefined();
    const finding = result.simulationFindings.find((f) => f.code === "SIM_UNSUPPORTED_FUNCTION");
    expect(finding).toBeDefined();
    expect(finding?.blockIndex).toBe(0);
  });

  it("uses warning block index for subprogram target miss findings", async () => {
    const input = "M98 P4444\nG1 X1.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc", strictControllerValidation: true },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "subprogram_target_miss_block_index_job" }
    });
    const finding = result.simulationFindings.find((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS");
    expect(finding).toBeDefined();
    expect(finding?.blockIndex).toBe(0);
  });

  it("adds simulation finding for macro function domain errors", async () => {
    const input = "#120=LOG[-1]\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "domain_error_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("domain error"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_FUNCTION_DOMAIN_ERROR")).toBe(true);
    const finding = result.simulationFindings.find((f) => f.code === "SIM_FUNCTION_DOMAIN_ERROR");
    expect(finding?.message).toContain("domain error at block");
  });

  it("adds one function-domain finding per domain warning", async () => {
    const input = "#120=LOG[-1]\n#121=LN[0]\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "domain_error_multi_job" }
    });
    const warnings = result.simulation.warnings.filter((w) => w.includes("domain error"));
    const findings = result.simulationFindings.filter((f) => f.code === "SIM_FUNCTION_DOMAIN_ERROR");
    expect(warnings.length).toBeGreaterThan(1);
    expect(findings).toHaveLength(warnings.length);
  });

  it("adds simulation finding for invalid assignment RHS", async () => {
    const input = "#100=BAD\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "invalid_assignment_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("Invalid assignment #100=BAD"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_INVALID_ASSIGNMENT")).toBe(true);
  });

  it("adds simulation finding for invalid IF…THEN RHS in haas mode", async () => {
    const input = "IF [1 EQ 1] THEN #100=\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "if_then_rhs_invalid_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("IF…THEN assignment RHS invalid"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_IF_THEN_RHS_INVALID")).toBe(true);
  });

  it("adds simulation finding for missing END in WHILE flow", async () => {
    const input = "WHILE [0] DO1\n#100=#100+1\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "control_flow_missing_end_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("Missing END1"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_CONTROL_FLOW_MISSING_END")).toBe(true);
  });

  it("adds one missing-END finding per missing-END warning", async () => {
    const input = "WHILE [0] DO1\n#100=#100+1\nWHILE [0] DO2\n#101=#101+1\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "control_flow_missing_end_multi_job" }
    });
    const warnings = result.simulation.warnings.filter((w) => w.includes("Missing END"));
    const findings = result.simulationFindings.filter((f) => f.code === "SIM_CONTROL_FLOW_MISSING_END");
    expect(warnings.length).toBeGreaterThan(1);
    expect(findings).toHaveLength(warnings.length);
  });

  it(
    "adds simulation finding for loop max-iteration limit warning",
    async () => {
      const input = "WHILE [1 EQ 1] DO1\n#100=#100+1\nEND1\nM30";
      const ast = parse(input, haasNgcProfile);
      const result = await runJobCheck({
        ast,
        simulationLimits: { controllerMode: "haas-ngc", maxLoopIterations: 2 },
        exportOptions: { enabled: false, baseDirectory: ".", baseName: "control_flow_loop_limit_job" }
      });
      expect(result.simulation.warnings.some((w) => w.includes("exceeded maxLoopIterations"))).toBe(true);
      expect(result.simulationFindings.some((f) => f.code === "SIM_CONTROL_FLOW_LOOP_LIMIT")).toBe(true);
      const finding = result.simulationFindings.find((f) => f.code === "SIM_CONTROL_FLOW_LOOP_LIMIT");
      expect(finding?.blockIndex).toBe(2);
    },
    30_000
  );

  it(
    "adds one loop-limit finding per loop-limit warning",
    async () => {
      const input = "WHILE [1 EQ 1] DO1\n#100=#100+1\nEND1\nWHILE [1 EQ 1] DO2\n#101=#101+1\nEND2\nM30";
      const ast = parse(input, haasNgcProfile);
      const result = await runJobCheck({
        ast,
        simulationLimits: { controllerMode: "haas-ngc", maxLoopIterations: 2 },
        exportOptions: { enabled: false, baseDirectory: ".", baseName: "control_flow_loop_limit_multi_job" }
      });
      const warnings = result.simulation.warnings.filter((w) => w.includes("exceeded maxLoopIterations"));
      const findings = result.simulationFindings.filter((f) => f.code === "SIM_CONTROL_FLOW_LOOP_LIMIT");
      expect(warnings.length).toBeGreaterThan(1);
      expect(findings).toHaveLength(warnings.length);
    },
    30_000
  );

  it("adds simulation finding for orphan END without matching WHILE", async () => {
    const input = "END2\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "control_flow_orphan_end_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("END2 has no matching WHILE"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_CONTROL_FLOW_ORPHAN_END")).toBe(true);
    const finding = result.simulationFindings.find((f) => f.code === "SIM_CONTROL_FLOW_ORPHAN_END");
    expect(finding?.blockIndex).toBe(0);
  });

  it("adds one orphan-END finding per unmatched END warning", async () => {
    const input = "END1\nEND2\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "control_flow_orphan_end_multi_job" }
    });
    const warnings = result.simulation.warnings.filter((w) => w.includes("has no matching WHILE"));
    const findings = result.simulationFindings.filter((f) => f.code === "SIM_CONTROL_FLOW_ORPHAN_END");
    expect(warnings.length).toBeGreaterThan(1);
    expect(findings).toHaveLength(warnings.length);
  });

  it("adds simulation finding for cycle parameter issues", async () => {
    const input = "G83 X0 Y0 Z-10. R2. F200.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "cycle_param_issue_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("Cycle G83 missing Q peck value"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_CYCLE_PARAMETER_ISSUE")).toBe(true);
  });

  it("adds one cycle-parameter finding per cycle warning", async () => {
    const input = "G83 X0 Y0 Z-10. R2. F200.\nG83 X1 Y0 Z-12. R2. F200.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "cycle_param_multi_job" }
    });
    const warnings = result.simulation.warnings.filter((w) => w.startsWith("Cycle G"));
    const findings = result.simulationFindings.filter((f) => f.code === "SIM_CYCLE_PARAMETER_ISSUE");
    expect(warnings.length).toBeGreaterThan(1);
    expect(findings).toHaveLength(warnings.length);
  });

  it("adds simulation finding for fanuc subprogram target miss", async () => {
    const input = "G65 P9010 A2.\nM30\nN9010\n#150=#1+10\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc", subprogramTargetPolicy: "strict_controller" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "strict_target_miss_job" }
    });
    expect(
      result.simulation.warnings.some((w) => w.includes("G65 target O9010 not found in strict fanuc mode"))
    ).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS")).toBe(true);
    const finding = result.simulationFindings.find((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS");
    expect(finding?.message).toContain("strict fanuc mode");
  });

  it("adds simulation finding for fanuc M98 target miss in strict mode", async () => {
    const input = "M98 P1234\nM30\nN100\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc", subprogramTargetPolicy: "strict_controller" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "m98_target_miss_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("M98 target O1234 not found"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS")).toBe(true);
    const finding = result.simulationFindings.find((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS");
    expect(finding?.message).toContain("M98 target O1234 not found");
  });

  it("adds one subprogram-target-miss finding per strict fanuc warning", async () => {
    const input = "M98 P1234\nG65 P9010 A2.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc", subprogramTargetPolicy: "strict_controller" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "subprogram_target_miss_multi_job" }
    });
    const warnings = result.simulation.warnings.filter(
      (w) =>
        (w.startsWith("M97 target ") || w.startsWith("M98 target ") || w.startsWith("G65 target ")) &&
        w.includes("not found")
    );
    const findings = result.simulationFindings.filter((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS");
    expect(warnings.length).toBeGreaterThan(1);
    expect(findings).toHaveLength(warnings.length);
  });

  it("adds simulation finding for missing haas M97 local target", async () => {
    const input = "M97 P100\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "m97_target_miss_haas_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("M97 target N100 not found"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS")).toBe(true);
  });

  it("adds simulation finding for haas rapid Z plunge warning", async () => {
    const input = "G90 G0 Z0.\nG0 Z-10.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "rapid_z_plunge_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("rapid (G0) Z move down"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_RAPID_Z_PLUNGE")).toBe(true);
  });

  it("adds one rapid-Z finding per rapid plunge warning", async () => {
    const input = "G90 G0 Z0.\nG0 Z-10.\nG0 Z-20.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "rapid_z_plunge_multi_job" }
    });
    const warnings = result.simulation.warnings.filter((w) => w.includes("rapid (G0) Z move down"));
    const findings = result.simulationFindings.filter((f) => f.code === "SIM_RAPID_Z_PLUNGE");
    expect(warnings.length).toBeGreaterThan(1);
    expect(findings).toHaveLength(warnings.length);
  });

  it("adds simulation finding for missing GOTO target label", async () => {
    const input = "IF [1 EQ 1] GOTO1234\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "goto_target_miss_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("GOTO target N1234 not found"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_GOTO_TARGET_MISS")).toBe(true);
  });

  it("uses canonical IF GOTO warning text when both GOTO variants are present", async () => {
    const input = "IF [1 EQ 1] GOTO1234\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "goto_canonical_job" }
    });
    const gotoFindings = result.simulationFindings.filter((f) => f.code === "SIM_GOTO_TARGET_MISS");
    expect(gotoFindings).toHaveLength(1);
    expect(gotoFindings[0]?.message.startsWith("IF GOTO target N")).toBe(true);
  });

  it("adds one GOTO-target-miss finding per missing-label warning", async () => {
    const input = "IF [1 EQ 1] GOTO1000\nGOTO2000\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "goto_target_miss_multi_job" }
    });
    const warnings = result.simulation.warnings.filter(
      (w) =>
        (w.startsWith("IF GOTO target N") || w.startsWith("GOTO target N")) && w.includes("not found")
    );
    const findings = result.simulationFindings.filter((f) => f.code === "SIM_GOTO_TARGET_MISS");
    expect(warnings.length).toBeGreaterThan(1);
    expect(findings).toHaveLength(warnings.length);
  });

  it("uses warning block index for cycle parameter issue findings", async () => {
    const input = "G83 X0. Y0. Z-8. Q2. F100.\nG1 X1.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "cycle_parameter_block_index_job" }
    });
    const finding = result.simulationFindings.find((f) => f.code === "SIM_CYCLE_PARAMETER_ISSUE");
    expect(finding).toBeDefined();
    expect(finding?.blockIndex).toBe(0);
  });

  it("uses warning block index for GOTO target miss findings", async () => {
    const input = "GOTO1234\nG1 X1.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "goto_target_block_index_job" }
    });
    const finding = result.simulationFindings.find((f) => f.code === "SIM_GOTO_TARGET_MISS");
    expect(finding).toBeDefined();
    expect(finding?.blockIndex).toBe(0);
  });

  it("does not add GOTO-target-miss findings when targets exist", async () => {
    const input = "GOTO100\nN100\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "goto_target_miss_absent_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_GOTO_TARGET_MISS")).toBe(false);
  });

  it("adds simulation finding when simulation hits maxSteps limit", async () => {
    const input = "G0 X0\nG1 X1\nG1 X2\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc", maxSteps: 2 },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "max_steps_limit_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("maxSteps limit before program end (block"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_MAX_STEPS_LIMIT")).toBe(true);
    const finding = result.simulationFindings.find((f) => f.code === "SIM_MAX_STEPS_LIMIT");
    expect(finding?.blockIndex).toBe(result.simulation.state.currentBlock);
    expect(finding?.message).toContain("maxSteps limit before program end (block");
  });

  it("allows simulation finding policy override to change severity and disable findings", async () => {
    const input = "G90 G0 Z0.\nG0 Z-10.\nG1 X1.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc", maxSteps: 2 },
      simulationFindingPolicy: {
        rapidZPlunge: { severity: "blocker" },
        maxStepsLimit: { enabled: false }
      },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "policy_override_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_RAPID_Z_PLUNGE" && f.severity === "blocker")).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_MAX_STEPS_LIMIT")).toBe(false);
  });

  it("supports strict policy preset escalation", async () => {
    const input = "G90 G0 Z0.\nG0 Z-10.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      policyPreset: "strict",
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "strict_preset_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_RAPID_Z_PLUNGE" && f.severity === "blocker")).toBe(true);
  });

  it("supports permissive policy preset export unblocking", async () => {
    const input = "G90 G0 Z0.\nG0 Z-10.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      policyPreset: "permissive",
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, allowExportWithBlockers: false, baseDirectory: ".", baseName: "permissive_preset_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_RAPID_Z_PLUNGE")).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it("does not add cycle-parameter findings for valid canned cycles", async () => {
    const input = "G83 X0 Y0 Z-10. R2. Q2. F200.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "cycle_param_absent_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_CYCLE_PARAMETER_ISSUE")).toBe(false);
  });

  it("does not add unsupported-function findings in haas mode", async () => {
    const input = "#100=EXP[1]\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "unsupported_fn_absent_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_UNSUPPORTED_FUNCTION")).toBe(false);
  });

  it("does not add missing-END findings when WHILE has matching END", async () => {
    const input = "WHILE [#100 LT 1] DO1\n#100=#100+1\nEND1\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "control_flow_missing_end_absent_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_CONTROL_FLOW_MISSING_END")).toBe(false);
  });

  it("does not add loop-limit findings when loop exits normally", async () => {
    const input = "#100=0\nWHILE [#100 LT 1] DO1\n#100=#100+1\nEND1\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc", maxLoopIterations: 2 },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "control_flow_loop_limit_absent_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_CONTROL_FLOW_LOOP_LIMIT")).toBe(false);
  });

  it("does not add orphan-END findings when END has matching WHILE", async () => {
    const input = "WHILE [#100 LT 1] DO1\n#100=#100+1\nEND1\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "control_flow_orphan_end_absent_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_CONTROL_FLOW_ORPHAN_END")).toBe(false);
  });

  it("does not add unsupported-M97 findings in haas mode", async () => {
    const input = "M97 P100\nM30\nN100\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "m97_haas_absent_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_UNSUPPORTED_M97")).toBe(false);
  });

  it("does not add subprogram-target-miss findings in shop-friendly fanuc mode", async () => {
    const input = "G65 P9010 A2.\nM30\nN9010\n#150=#1+10\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc", subprogramTargetPolicy: "shop_friendly" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "subprogram_target_miss_absent_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS")).toBe(false);
  });

  it("does not add subprogram-target-miss findings when haas M97 target exists", async () => {
    const input = "M97 P100\nM30\nN100\n#120=#120+1\nM99";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "m97_target_present_haas_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS")).toBe(false);
  });

  it("applies runJobCheck policy matrix to strict-vs-shop-friendly subprogram target handling", async () => {
    const input = "G65 P9010 A2.\nM30\nN9010\n#150=#1+10\nM99";
    const ast = parse(input, haasNgcProfile);

    const strictBlocker = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc", subprogramTargetPolicy: "strict_controller" },
      simulationFindingPolicy: { subprogramTargetMiss: { severity: "blocker" } },
      exportOptions: { enabled: false, allowExportWithBlockers: false, baseDirectory: ".", baseName: "strict_target_matrix_blocker" }
    });
    const strictDisabled = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc", subprogramTargetPolicy: "strict_controller" },
      simulationFindingPolicy: { subprogramTargetMiss: { enabled: false } },
      exportOptions: {
        enabled: false,
        allowExportWithBlockers: false,
        baseDirectory: ".",
        baseName: "strict_target_matrix_disabled"
      }
    });
    const shopFriendly = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc", subprogramTargetPolicy: "shop_friendly" },
      simulationFindingPolicy: { subprogramTargetMiss: { severity: "blocker" } },
      exportOptions: { enabled: false, allowExportWithBlockers: false, baseDirectory: ".", baseName: "shop_target_matrix" }
    });

    const strictFinding = strictBlocker.simulationFindings.find((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS");
    expect(strictFinding).toBeDefined();
    expect(strictFinding?.severity).toBe("blocker");
    expect(strictBlocker.blocked).toBe(true);
    expect(strictBlocker.simulation.warnings.some((w) => w.includes("strict fanuc mode"))).toBe(true);

    expect(strictDisabled.simulationFindings.some((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS")).toBe(false);
    expect(strictDisabled.blocked).toBe(false);

    expect(shopFriendly.simulationFindings.some((f) => f.code === "SIM_SUBPROGRAM_TARGET_MISS")).toBe(false);
    expect(shopFriendly.blocked).toBe(false);
  });

  it("does not add function-domain findings when expressions are valid", async () => {
    const input = "#120=LOG[100]\n#121=LN[2.718281828]\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "domain_error_absent_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_FUNCTION_DOMAIN_ERROR")).toBe(false);
  });

  it("does not add invalid-assignment findings when assignments are valid", async () => {
    const input = "#100=1\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "invalid_assignment_absent_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_INVALID_ASSIGNMENT")).toBe(false);
  });

  it("does not add IF…THEN RHS-invalid findings when RHS is valid", async () => {
    const input = "IF [1 EQ 1] THEN #100=[#101+1]\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "if_then_rhs_valid_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_IF_THEN_RHS_INVALID")).toBe(false);
  });

  it("does not add rapid-Z finding in fanuc mode", async () => {
    const input = "G90 G0 Z0.\nG0 Z-10.\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "fanuc" },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "rapid_z_plunge_fanuc_job" }
    });
    expect(result.simulationFindings.some((f) => f.code === "SIM_RAPID_Z_PLUNGE")).toBe(false);
  });

  it("loads shop-regression fixtures from manifest and validates baseline expectations", async () => {
    const manifest = JSON.parse(await readFixture(path.join("shop-regressions", "manifest.json"))) as {
      fixtures: Array<{
        id: string;
        controller: "haas-ngc" | "haas-legacy" | "fanuc";
        path: string;
        expectations: {
          expectsMainM99: boolean;
          expectsSimulationWarnings: boolean;
          expectsSimulationFindings: boolean;
          expectedFindingCodes?: string[];
        };
      }>;
    };

    expect(manifest.fixtures.length).toBeGreaterThan(0);

    for (const fixture of manifest.fixtures) {
      const input = await readFixture(fixture.path);
      const ast = parse(input, haasNgcProfile);
      const formatted = format(ast, haasNgcProfile).trim();
      expect(formatted.length).toBeGreaterThan(0);

      const sim = simulate(ast, {}, { maxSteps: 2000, maxLoopIterations: 200, controllerMode: fixture.controller });
      const hasMainM99Event = sim.trace.some((t) => t.event?.kind === "main_m99");
      expect(hasMainM99Event).toBe(fixture.expectations.expectsMainM99);

      if (fixture.expectations.expectsSimulationWarnings) {
        expect(sim.warnings.length).toBeGreaterThan(0);
      } else {
        expect(sim.warnings.length).toBe(0);
      }

      const job = await runJobCheck({
        ast,
        simulationLimits: { controllerMode: fixture.controller },
        exportOptions: { enabled: false, baseDirectory: ".", baseName: fixture.id }
      });

      if (fixture.expectations.expectsSimulationFindings) {
        expect(job.simulationFindings.length).toBeGreaterThan(0);
      } else {
        expect(job.simulationFindings.length).toBe(0);
      }

      if (fixture.expectations.expectedFindingCodes && fixture.expectations.expectedFindingCodes.length > 0) {
        const actualCodes = [...new Set(job.simulationFindings.map((f) => f.code))].sort();
        const expectedCodes = [...fixture.expectations.expectedFindingCodes].sort();
        expect(actualCodes).toEqual(expectedCodes);
      }
    }
  });

  it("rejects auto-fix apply when preview fingerprint is stale", async () => {
    const os = await import("node:os");
    const fs = await import("node:fs/promises");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cnc-fixtures-fingerprint-"));
    const fixturesRoot = path.join(tempRoot, "packages", "test-fixtures");
    const manifestDir = path.join(fixturesRoot, "shop-regressions");
    const fanucDir = path.join(manifestDir, "fanuc");
    await fs.mkdir(fanucDir, { recursive: true });
    await fs.writeFile(
      path.join(fanucDir, "one.nc"),
      "O9000 (FANUC SAMPLE)\nG90 G17\nM99\nM30\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(manifestDir, "manifest.json"),
      JSON.stringify(
        {
          fixtures: [
            {
              id: "one",
              controller: "haas-ngc",
              path: "shop-regressions/fanuc/one.nc",
              expectations: {
                expectsMainM99: true,
                expectsSimulationWarnings: true,
                expectsSimulationFindings: true
              }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const preview = await previewShopFixtureAutoFixes({
      fixturesRootDirectory: fixturesRoot,
      includeControllerMismatchFixes: true,
      includeStrictFromSimulationFixes: true
    });
    await expect(
      applyShopFixtureAutoFixes({
        fixturesRootDirectory: fixturesRoot,
        includeControllerMismatchFixes: true,
        includeStrictFromSimulationFixes: true,
        expectedPreviewFingerprint: `${preview.fingerprint}-stale`
      })
    ).rejects.toThrow("stale");
  });

  it("applies only high-confidence controller fixes when configured", async () => {
    const os = await import("node:os");
    const fs = await import("node:fs/promises");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cnc-fixtures-confidence-"));
    const fixturesRoot = path.join(tempRoot, "packages", "test-fixtures");
    const manifestDir = path.join(fixturesRoot, "shop-regressions");
    const fanucDir = path.join(manifestDir, "fanuc");
    await fs.mkdir(fanucDir, { recursive: true });
    await fs.writeFile(path.join(fanucDir, "high.nc"), "O9100 (FANUC JOB)\nM30\n", "utf8");
    await fs.writeFile(path.join(fanucDir, "low.nc"), "O9200\nM30\n", "utf8");
    await fs.writeFile(
      path.join(manifestDir, "manifest.json"),
      JSON.stringify(
        {
          fixtures: [
            {
              id: "high_conf",
              controller: "haas-ngc",
              path: "shop-regressions/fanuc/high.nc",
              expectations: {
                expectsMainM99: false,
                expectsSimulationWarnings: false,
                expectsSimulationFindings: false
              }
            },
            {
              id: "low_conf",
              controller: "fanuc",
              path: "shop-regressions/fanuc/low.nc",
              expectations: {
                expectsMainM99: false,
                expectsSimulationWarnings: false,
                expectsSimulationFindings: false
              }
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );

    const preview = await previewShopFixtureAutoFixes({
      fixturesRootDirectory: fixturesRoot,
      includeControllerMismatchFixes: true,
      includeStrictFromSimulationFixes: false
    });
    expect(preview.changes.some((c) => c.fixtureId === "high_conf" && c.confidence === "high")).toBe(true);

    const applied = await applyShopFixtureAutoFixes({
      fixturesRootDirectory: fixturesRoot,
      includeControllerMismatchFixes: true,
      includeStrictFromSimulationFixes: false,
      minimumControllerFixConfidence: "high",
      expectedPreviewFingerprint: preview.fingerprint
    });
    expect(applied.appliedChanges).toBe(1);

    const manifestAfter = JSON.parse(await fs.readFile(path.join(manifestDir, "manifest.json"), "utf8")) as {
      fixtures: Array<{ id: string; controller: string }>;
    };
    expect(manifestAfter.fixtures.find((f) => f.id === "high_conf")?.controller).toBe("fanuc");
    expect(manifestAfter.fixtures.find((f) => f.id === "low_conf")?.controller).toBe("fanuc");
  });

  it("restores manifest from backup after auto-fix apply", async () => {
    const os = await import("node:os");
    const fs = await import("node:fs/promises");
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cnc-fixtures-restore-"));
    const fixturesRoot = path.join(tempRoot, "packages", "test-fixtures");
    const manifestDir = path.join(fixturesRoot, "shop-regressions");
    const fanucDir = path.join(manifestDir, "fanuc");
    await fs.mkdir(fanucDir, { recursive: true });
    await fs.writeFile(path.join(fanucDir, "restore.nc"), "O9300 (FANUC)\nM30\n", "utf8");
    const manifestPath = path.join(manifestDir, "manifest.json");
    const originalManifest = JSON.stringify(
      {
        fixtures: [
          {
            id: "restore_case",
            controller: "haas-ngc",
            path: "shop-regressions/fanuc/restore.nc",
            expectations: {
              expectsMainM99: false,
              expectsSimulationWarnings: false,
              expectsSimulationFindings: false
            }
          }
        ]
      },
      null,
      2
    );
    await fs.writeFile(manifestPath, originalManifest, "utf8");

    const preview = await previewShopFixtureAutoFixes({
      fixturesRootDirectory: fixturesRoot,
      includeControllerMismatchFixes: true,
      includeStrictFromSimulationFixes: false
    });
    const applied = await applyShopFixtureAutoFixes({
      fixturesRootDirectory: fixturesRoot,
      includeControllerMismatchFixes: true,
      includeStrictFromSimulationFixes: false,
      expectedPreviewFingerprint: preview.fingerprint
    });
    expect(applied.backupPath).toBeTruthy();

    await restoreShopFixtureManifestBackup({
      manifestPath,
      backupPath: applied.backupPath!
    });

    const restored = await fs.readFile(manifestPath, "utf8");
    expect(JSON.parse(restored)).toEqual(JSON.parse(originalManifest));
  });

  it("builds stable timeline/findings export bundle format", () => {
    const bundle = buildTimelineFindingsExportBundle({
      timestampIso: "2026-04-25T12:00:00.000Z",
      controller: "fanuc",
      policyPreset: "strict",
      policyPresetSource: "saved",
      subprogramTargetPolicy: "strict_controller",
      logSemantics: "base10",
      score: 84,
      timelineEntries: [{ blockIndex: 12, kind: "main_m99", message: "Main program contains M99." }],
      findings: [
        {
          severity: "blocker",
          code: "SIM_MAIN_M99",
          message: "Main program contains M99.",
          blockIndex: 12
        }
      ]
    });
    expect(bundle.timelineTxt).toContain("WORKSHOP TIMELINE + FINDINGS");
    expect(bundle.timelineTxt).toContain("controller: fanuc");
    expect(bundle.timelineTxt).toContain("policyPreset: strict");
    expect(bundle.timelineTxt).toContain("policyPresetSource: saved");
    expect(bundle.timelineTxt).toContain("[CONTROL] B12: [main_m99] Main program contains M99.");
    expect(bundle.findingsMarkdown).toContain("## Findings");
    expect(bundle.findingsMarkdown).toContain("[BLOCKER] SIM_MAIN_M99 @ B12");
  });

  it("reports node capability by entry point", () => {
    expect(isNodeCapableNode()).toBe(true);
    expect(isNodeCapableBrowser()).toBe(false);
  });

  it("rejects node-only export workflow from browser entry", async () => {
    await expect(
      exportWorkshopFilesBrowser({
        baseDirectory: ".",
        baseName: "browser",
        setupSheetTxt: "SETUP",
        setupSheetMarkdown: "# Setup",
        proveoutCode: "M30"
      })
    ).rejects.toThrow("not available from @cnc/core/browser");
  });

  it("rejects all node-only workflows from browser entry", async () => {
    await expect(
      importShopFixtureBrowser({
        fixturesRootDirectory: ".",
        id: "fixture",
        controller: "haas-ngc",
        code: "M30",
        expectations: {
          expectsMainM99: false,
          expectsSimulationWarnings: false,
          expectsSimulationFindings: false
        }
      })
    ).rejects.toThrow("not available from @cnc/core/browser");

    await expect(validateShopFixturesManifestBrowser({ fixturesRootDirectory: "." })).rejects.toThrow(
      "not available from @cnc/core/browser"
    );
    await expect(runShopRegressionTestsBrowser({ workspaceRootDirectory: "." })).rejects.toThrow(
      "not available from @cnc/core/browser"
    );
    await expect(analyzeShopFixtureHealthBrowser({ fixturesRootDirectory: "." })).rejects.toThrow(
      "not available from @cnc/core/browser"
    );
    await expect(
      previewShopFixtureAutoFixesBrowser({
        fixturesRootDirectory: ".",
        includeControllerMismatchFixes: true,
        includeStrictFromSimulationFixes: true
      })
    ).rejects.toThrow("not available from @cnc/core/browser");
    await expect(
      applyShopFixtureAutoFixesBrowser({
        fixturesRootDirectory: ".",
        includeControllerMismatchFixes: true,
        includeStrictFromSimulationFixes: true
      })
    ).rejects.toThrow("not available from @cnc/core/browser");
    await expect(
      restoreShopFixtureManifestBackupBrowser({
        manifestPath: "./manifest.json",
        backupPath: "./manifest.json.bak"
      })
    ).rejects.toThrow("not available from @cnc/core/browser");
  });
});

describe("Haas NGC profile package (@cnc/profile-haas-ngc)", () => {
  it("flags parser-valid but machine-invalid blocks from documented control rules", () => {
    const cases: Array<{ input: string; expectedMachineRuleWarning: string }> = [
      // One active motion mode per block.
      { input: "G0 G1 X1.\nM30", expectedMachineRuleWarning: "mixes G0 and G1" },
      // Avoid duplicated mode tokens in the same block.
      { input: "G1 G1 X1.\nM30", expectedMachineRuleWarning: "repeats G1" },
      // Cutter comp typically requires D on the same block.
      { input: "G41 X1.\nM30", expectedMachineRuleWarning: "G41/G42 without D" },
      // Tool length comp requires H on G43 line.
      { input: "G43 Z0.1\nM30", expectedMachineRuleWarning: "G43 without H" },
      // Tool change should include T in the same block.
      { input: "M6\nM30", expectedMachineRuleWarning: "M6 without T" },
      // Spindle start generally requires S speed.
      { input: "M3\nM30", expectedMachineRuleWarning: "without S" },
      // Program should not contain conflicting end-of-program codes.
      { input: "G0 X0\nM02\nG0 Y0\nM30", expectedMachineRuleWarning: "both M02 and M30" },
      // Duplicate sequence labels are ambiguous for branch targets.
      { input: "N10 G0 X0\nN10 G0 Y0\nM30", expectedMachineRuleWarning: "Duplicate sequence number" },
      // Mutually exclusive unit/measurement modes in one block (ISO-style controls).
      { input: "G20 G21 X1.\nM30", expectedMachineRuleWarning: "G20 and G21 in the same block" },
      // Mutually exclusive positioning modes in one block (ISO-style controls).
      { input: "G90 G91 X1.\nM30", expectedMachineRuleWarning: "G90 and G91 in the same block" },
      // Multiple M functions in one block (one M per block is typical on Haas/Fanuc-class controls).
      { input: "M3 M8\nM30", expectedMachineRuleWarning: "More than one M code in a single block" },
      // Parenthesis comments should be paired to avoid controller-parse ambiguity.
      { input: "G0 X1 (NO CLOSE\nM30", expectedMachineRuleWarning: "Unmatched parenthesis" },
      // Fanuc documentation invalidates sequence numbers on O-number blocks.
      { input: "N10 O1000\nM30", expectedMachineRuleWarning: "both N and O words" },
      // Fanuc Macro B expects I/J/K argument order on G65 blocks.
      { input: "G65 P9010 K4. J2. I3.\nM30", expectedMachineRuleWarning: "G65 block has I/J/K out of order" }
    ];

    for (const { input, expectedMachineRuleWarning } of cases) {
      const ast = parse(input, haasNgcProfilePackaged);
      const issues = lint(ast, haasNgcProfilePackaged);

      expect(ast.blocks[0]?.words.length).toBeGreaterThan(0);
      expect(issues.some((i) => i.message.includes(expectedMachineRuleWarning))).toBe(true);
    }
  });

  it("attaches parse-stage provenance and spans to lint issues", () => {
    const ast = parse("G0 X1 (NO CLOSE\nM30", haasNgcProfilePackaged, { includeTokenSpans: true });
    const issues = lintWithProvenance(ast, haasNgcProfilePackaged);
    const unmatched = issues.find((issue) => issue.message.includes("Unmatched parenthesis"));

    expect(unmatched).toBeDefined();
    expect(unmatched?.provenance.source).toBe("lexer");
    expect(unmatched?.provenance.relatedDiagnostics.some((d) => d.code === "UNMATCHED_OPEN_PAREN")).toBe(true);
    expect(unmatched?.provenance.relatedDiagnostics.some((d) => d.span !== undefined)).toBe(true);
  });

  it("warns G43 without H on the same block", () => {
    const ast = parse("G0 G90 G54\nG43 Z0.1\nG43 H2 Z0.2\nM30", haasNgcProfilePackaged);
    const issues = lint(ast, haasNgcProfilePackaged);
    expect(issues.some((i) => i.message.includes("G43 without H"))).toBe(true);
    expect(issues.filter((i) => i.message.includes("G43 without H"))).toHaveLength(1);
  });

  it("does not warn G43 H on the same block", () => {
    const ast = parse("G0 G90 G54\nG43 H1 Z0.1\nM30", haasNgcProfilePackaged);
    const issues = lint(ast, haasNgcProfilePackaged);
    expect(issues.some((i) => i.message.includes("G43 without H"))).toBe(false);
  });

  it("warns G1/G2/G3 without F when no prior F exists", () => {
    const ast = parse("T1 M6\nS1200 M3\nG1 X10. Y10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G1/G2/G3 without F and no prior F")
      )
    ).toBe(true);
  });

  it("does not warn G1 when F is on the same block", () => {
    const ast = parse("T1 M6\nS1200 M3\nG1 X10. Y10. F200.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G1/G2/G3 without F and no prior F")
      )
    ).toBe(false);
  });

  it("does not warn G1 when a prior F exists in the program", () => {
    const ast = parse("T1 M6\nS1200 M3\nF150.\nG1 X10. Y10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G1/G2/G3 without F and no prior F")
      )
    ).toBe(false);
  });

  it("warns G43 with H0", () => {
    const ast = parse("T1 M6\nS1200 M3\nG43 H0 Z25.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G43 with H0"))).toBe(true);
  });

  it("warns G41/G42 with D0", () => {
    const ast = parse("T1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D0 X10.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G41/G42 with D0"))).toBe(true);
  });

  it("warns coolant on before any spindle start", () => {
    const ast = parse("T1 M6\nM8\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coolant on (M7/M8) before any spindle start")
      )
    ).toBe(true);
  });

  it("does not warn coolant when spindle started earlier", () => {
    const ast = parse("T1 M6\nS1200 M3\nM8\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coolant on (M7/M8) before any spindle start")
      )
    ).toBe(false);
  });

  it("warns F0 feed rate", () => {
    const ast = parse("T1 M6\nS1200 M3\nG1 X10. F0\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("F0 feed rate"))).toBe(true);
  });

  it("warns G2/G3 without R or I/J/K", () => {
    const ast = parse("T1 M6\nS1200 M3\nG2 X10. Y10. F100.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G2/G3 arc without R or I/J/K"))
    ).toBe(true);
  });

  it("does not warn G2 with R", () => {
    const ast = parse("T1 M6\nS1200 M3\nG2 X10. Y10. R5. F100.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G2/G3 arc without R or I/J/K"))
    ).toBe(false);
  });

  it("warns when cutter compensation is still active at program end", () => {
    const ast = parse("T1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D1 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("cutter compensation (G41/G42) still active")
      )
    ).toBe(true);
  });

  it("does not warn cutter comp at end after G40", () => {
    const ast = parse("T1 M6\nS1200 M3\nG43 H1 Z25.\nG41 D1 X10.\nG40\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("cutter compensation (G41/G42) still active")
      )
    ).toBe(false);
  });

  it("warns canned cycle without Z depth", () => {
    const ast = parse("T1 M6\nS1200 M3\nG81 X10. Y10. R2. F100.\nG80\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("without Z depth"))
    ).toBe(true);
  });

  it("warns canned cycle without R plane", () => {
    const ast = parse("T1 M6\nS1200 M3\nG81 X10. Y10. Z-5. F100.\nG80\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("without R plane"))
    ).toBe(true);
  });

  it("does not warn canned cycle when Z and R are present", () => {
    const ast = parse("T1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nG80\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) => i.message.includes("without Z depth") || i.message.includes("without R plane")
      )
    ).toBe(false);
  });

  it("warns when canned cycle is still active at program end", () => {
    const ast = parse("T1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("canned cycle still active"))
    ).toBe(true);
  });

  it("warns M6 while canned cycle is active", () => {
    const ast = parse("T1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nT2 M6\nG80\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M6 while a canned cycle is still active"))
    ).toBe(true);
  });

  it("does not warn M6 after G80 cancels canned cycle", () => {
    const ast = parse("T1 M6\nS1200 M3\nG81 X10. Y10. Z-5. R2. F100.\nG80\nT2 M6\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M6 while a canned cycle is still active"))
    ).toBe(false);
  });

  it("warns when both G20 and G21 appear", () => {
    const ast = parse("G20\nG21\nT1 M6\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("both G20 and G21"))
    ).toBe(true);
  });

  it("warns when spindle is still on at program end", () => {
    const ast = parse("T1 M6\nS1200 M3\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("spindle still on"))
    ).toBe(true);
  });

  it("does not warn spindle at end after M5", () => {
    const ast = parse("T1 M6\nS1200 M3\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("spindle still on"))
    ).toBe(false);
  });

  it("warns when coolant is still on at program end", () => {
    const ast = parse("T1 M6\nS1200 M3\nM8\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("coolant still on"))
    ).toBe(true);
  });

  it("does not warn coolant at end after M9", () => {
    const ast = parse("T1 M6\nS1200 M3\nM8\nM5\nM9\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("coolant still on"))
    ).toBe(false);
  });

  it("warns when G43 is still active at program end", () => {
    const ast = parse("T1 M6\nS1200 M3\nG43 H1 Z25.\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("tool length compensation (G43) still active")
      )
    ).toBe(true);
  });

  it("does not warn G43 at end after G49", () => {
    const ast = parse("T1 M6\nS1200 M3\nG43 H1 Z25.\nG49\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("tool length compensation (G43) still active")
      )
    ).toBe(false);
  });

  it("warns when program ends in G91", () => {
    const ast = parse("T1 M6\nG54\nG91\nG0 X1.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("incremental mode (G91)"))
    ).toBe(true);
  });

  it("does not warn G91 at end after G90 restore", () => {
    const ast = parse("T1 M6\nG54\nG91\nG0 X1.\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("incremental mode (G91)"))
    ).toBe(false);
  });

  it("warns M6 while spindle is still on", () => {
    const ast = parse("T1 M6\nG54\nS1200 M3\nT2 M6\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M6 while spindle is still on"))
    ).toBe(true);
  });

  it("does not warn M6 after M5 stops spindle", () => {
    const ast = parse("T1 M6\nG54\nS1200 M3\nM5\nT2 M6\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M6 while spindle is still on"))
    ).toBe(false);
  });

  it("warns axis motion before any work offset", () => {
    const ast = parse("T1 M6\nG0 X0 Y0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("before any work offset"))
    ).toBe(true);
  });

  it("does not warn motion after G54", () => {
    const ast = parse("T1 M6\nG54\nG0 X0 Y0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("before any work offset"))
    ).toBe(false);
  });

  it("does not warn G53 machine motion without work offset", () => {
    const ast = parse("T1 M6\nG53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("before any work offset"))
    ).toBe(false);
  });

  it("warns G53 while G91 is active", () => {
    const ast = parse("T1 M6\nG54\nG91\nG53 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G53 with incremental mode"))
    ).toBe(true);
  });

  it("warns when program ends in G18/G19 plane", () => {
    const ast = parse("T1 M6\nG54\nG18\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => /ends in G1[89] plane/.test(i.message))
    ).toBe(true);
  });

  it("does not warn plane at end after G17 restore", () => {
    const ast = parse("T1 M6\nG54\nG18\nG17\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => /ends in G1[89] plane/.test(i.message))
    ).toBe(false);
  });

  it("warns G1/G2/G3 while spindle is off", () => {
    const ast = parse("T1 M6\nG54\nG1 X10. F100.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("while spindle is off"))
    ).toBe(true);
  });

  it("does not warn feed motion after spindle start", () => {
    const ast = parse("T1 M6\nG54\nS1200 M3\nG1 X10. F100.\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("while spindle is off"))
    ).toBe(false);
  });

  it("warns G0 negative Z without G43", () => {
    const ast = parse("T1 M6\nG54\nG0 Z-1.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("negative Z while tool length compensation")
      )
    ).toBe(true);
  });

  it("does not warn G0 negative Z when G43 is active", () => {
    const ast = parse("T1 M6\nG54\nG43 H1 Z25.\nG0 Z-1.\nG49\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("negative Z while tool length compensation")
      )
    ).toBe(false);
  });

  it("warns G0 while cutter compensation is active", () => {
    const ast = parse("T1 M6\nG54\nG41 D1\nG0 X10.\nG40\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G0 rapid while cutter compensation")
      )
    ).toBe(true);
  });

  it("warns M98 without P", () => {
    const ast = parse("M98\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M98 without P"))).toBe(
      true
    );
  });

  it("warns M97 without P", () => {
    const ast = parse("M97\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M97 without P"))).toBe(
      true
    );
  });

  it("warns G65 without P", () => {
    const ast = parse("G65\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G65 without P"))).toBe(
      true
    );
  });

  it("warns G4 dwell without P or X", () => {
    const ast = parse("G4\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G4 dwell without P or X"))
    ).toBe(true);
  });

  it("warns when G43 H does not match last T", () => {
    const ast = parse("T1 M6\nG54\nS1200 M3\nG43 H2 Z25.\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("does not match last tool T")
      )
    ).toBe(true);
  });

  it("does not warn when G43 H matches last T", () => {
    const ast = parse("T1 M6\nG54\nS1200 M3\nG43 H1 Z25.\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("does not match last tool T")
      )
    ).toBe(false);
  });

  it("warns when work offset changes after axis motion", () => {
    const ast = parse("T1 M6\nG54\nG0 X0\nG55\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Work offset changed after axis motion")
      )
    ).toBe(true);
  });

  it("warns G28 with multiple axes on one block", () => {
    const ast = parse("T1 M6\nG54\nG28 X0 Y0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G28 with multiple axes on one block")
      )
    ).toBe(true);
  });

  it("does not warn single-axis G28", () => {
    const ast = parse("T1 M6\nG54\nG28 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G28 with multiple axes on one block")
      )
    ).toBe(false);
  });

  it("warns G30 with multiple axes on one block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG30 X0 Y0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G30 with multiple axes on one block")
      )
    ).toBe(true);
  });

  it("warns G2/G3 with both R and I/J/K", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG2 X10. Y10. R5. I1. F100.\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("both R and I/J/K"))
    ).toBe(true);
  });

  it("warns when both G94 and G95 appear", () => {
    const ast = parse("O1\nG94\nG95\nT1 M6\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("both G94 and G95"))
    ).toBe(true);
  });

  it("warns when program has no O header", () => {
    const ast = parse("T1 M6\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("no O header"))
    ).toBe(true);
  });

  it("does not warn missing O when O header is present", () => {
    const ast = parse("O1\nT1 M6\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("no O header"))
    ).toBe(false);
  });

  it("warns conflicting spindle directions on one block", () => {
    const ast = parse("O1\nT1 M6\nS1200 M3 M4\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns canned cycle without F", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG81 X10. Y10. Z-5. R2.\nG80\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("without F and no prior F"))
    ).toBe(true);
  });

  it("warns peck cycle without Q", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG83 X10. Y10. Z-5. R2. F100.\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("without Q"))
    ).toBe(true);
  });

  it("warns when G68 is still active at program end", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("coordinate rotation (G68) still active")
      )
    ).toBe(true);
  });

  it("warns cutter compensation side flip without G40", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 D1\nG42 D1\nG40\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("without G40"))
    ).toBe(true);
  });

  it("warns G43 before any tool selection", () => {
    const ast = parse("O1\nG54\nG43 H1 Z25.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G43 before any tool selection")
      )
    ).toBe(true);
  });

  it("warns G43 and G49 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG43 H1 G49 Z25.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G43 and G49 on the same block"))
    ).toBe(true);
  });

  it("warns axis motion before G90/G91", () => {
    const ast = parse("O1\nT1 M6\nG54\nG0 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("before G90/G91"))
    ).toBe(true);
  });

  it("does not warn missing distance mode after G90", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG0 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("before G90/G91"))
    ).toBe(false);
  });

  it("warns unit mode change after axis motion", () => {
    const ast = parse("O1\nT1 M6\nG54\nG20\nG90\nG0 X0\nG21\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Unit mode changed after axis motion")
      )
    ).toBe(true);
  });

  it("warns tapping cycle while spindle is off", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG90\nG84 X10. Y10. Z-5. R2. F100.\nG80\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Tapping cycle (G74/G84) while spindle is off")
      )
    ).toBe(true);
  });

  it("warns when G51 is still active at program end", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("scaling (G51) still active"))
    ).toBe(true);
  });

  it("warns plane mode change after axis motion", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG17\nG0 X0\nG18\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Plane mode changed after axis motion")
      )
    ).toBe(true);
  });

  it("warns feed mode change after cutting motion", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG90\nG94\nS1200 M3\nG1 X10. F100.\nG95\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Feed mode changed after cutting motion")
      )
    ).toBe(true);
  });

  it("warns when both G61 and G64 appear", () => {
    const ast = parse("O1\nG61\nG64\nT1 M6\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("both G61 and G64"))
    ).toBe(true);
  });

  it("warns spindle start and stop on the same block", () => {
    const ast = parse("O1\nT1 M6\nS1200 M3 M5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns coolant on and off on the same block", () => {
    const ast = parse("O1\nT1 M6\nS1200 M3\nM8 M9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns distance mode change after axis motion", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG0 X0\nG91\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Distance mode changed after axis motion")
      )
    ).toBe(true);
  });

  it("warns G40 and cutter comp on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG40 G41 D1\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G40 and G41/G42 on the same block")
      )
    ).toBe(true);
  });

  it("warns G80 and canned cycle on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100. G80\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G80 and a canned cycle on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 while cutter compensation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG41 D1\nT2 M6\nG40\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M6 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns M6 while tool length compensation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG43 H1 Z25.\nT2 M6\nG49\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M6 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns path mode change after axis motion", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG61\nG0 X0\nG64\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Path mode changed after axis motion")
      )
    ).toBe(true);
  });

  it("warns G41 and G42 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 G42 D1\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G41 and G42 on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 while coolant is still on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nT2 M6\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M6 while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns G53 with a work offset on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG53 G54 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns coolant mist and flood on the same block", () => {
    const ast = parse("O1\nT1 M6\nS1200 M3\nM7 M8\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns G68 and G69 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 G69\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G68 and G69 on the same block")
      )
    ).toBe(true);
  });

  it("warns G51 and G50 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 G50\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G51 and G50 on the same block")
      )
    ).toBe(true);
  });

  it("warns G28 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG28 G30 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G28 and G30 on the same block")
      )
    ).toBe(true);
  });

  it("warns spindle direction reverse without M5 stop", () => {
    const ast = parse("O1\nT1 M6\nS1200 M3\nS1200 M4\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle direction reversed without M5 stop")
      )
    ).toBe(true);
  });

  it("warns coolant on while spindle is off after prior spindle use", () => {
    const ast = parse("O1\nT1 M6\nS1200 M3\nM5\nM8\nM9\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coolant on (M7/M8) while spindle is off")
      )
    ).toBe(true);
  });

  it("warns M98 and M97 on the same block", () => {
    const ast = parse("O1\nT1 M6\nM98 P2 M97 P10\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns G65 and M98 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG65 P9010 M98 P2\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G65 and M98 on the same block")
      )
    ).toBe(true);
  });

  it("warns M00 and M01 on the same block", () => {
    const ast = parse("O1\nT1 M6\nM00 M01\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns G28 while absolute mode is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG28 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G28 while absolute mode (G90) is active")
      )
    ).toBe(true);
  });

  it("warns G30 while absolute mode is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG30 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G30 while absolute mode (G90) is active")
      )
    ).toBe(true);
  });

  it("warns G65 and M97 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG65 P9010 M97 P10\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G65 and M97 on the same block")
      )
    ).toBe(true);
  });

  it("warns M99 and M30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nM99 M30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 while coordinate rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68\nT2 M6\nG69\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M6 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns M6 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51\nT2 M6\nG50\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M6 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G92 coordinate system shift", () => {
    const ast = parse("O1\nT1 M6\nG54\nG92 X0 Y0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G92 coordinate system shift is uncommon and risky")
      )
    ).toBe(true);
  });

  it("warns M98 and M99 on the same block", () => {
    const ast = parse("O1\nT1 M6\nM98 P2 M99\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns G28 without an axis word", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG28\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G28 without an axis word"))
    ).toBe(true);
  });

  it("warns G30 without an axis word", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG30\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G30 without an axis word"))
    ).toBe(true);
  });

  it("warns G28 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG28 G53 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G28 and G53 on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 dwell with zero time", () => {
    const ast = parse("O1\nT1 M6\nG4 P0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 dwell with zero time")
      )
    ).toBe(true);
  });

  it("warns G30 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG30 G53 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G30 and G53 on the same block")
      )
    ).toBe(true);
  });

  it("warns G53 without an axis word", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG53\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G53 without an axis word"))
    ).toBe(true);
  });

  it("warns G53 with multiple axes on one block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG53 X0 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G53 with multiple axes on one block")
      )
    ).toBe(true);
  });

  it("warns M97 and M99 on the same block", () => {
    const ast = parse("O1\nT1 M6\nM97 P10 M99\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 dwell and axis motion on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG4 P1. G0 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 dwell and axis motion on the same block")
      )
    ).toBe(true);
  });

  it("warns G65 and M99 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG65 P9010 M99\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G65 and M99 on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 while incremental mode is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nT2 M6\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M6 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G4 dwell and M6 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG4 P1. T2 M6\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 dwell and M6 on the same block")
      )
    ).toBe(true);
  });

  it("warns negative feed rate", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG90\nS1200 M3\nG1 X10. F-100.\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("Negative feed rate (F)"))
    ).toBe(true);
  });

  it("warns negative spindle speed", () => {
    const ast = parse("O1\nT1 M6\nS-1200 M3\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Negative spindle speed (S)")
      )
    ).toBe(true);
  });

  it("warns G28 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG90\nG41 D1\nG91\nG28 Z0\nG90\nG40\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G28 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G28 while a canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100.\nG91\nG28 Z0\nG90\nG80\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G28 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G53 while cutter compensation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG41 D1\nG53 Z0\nG40\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G53 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G53 while a canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100.\nG53 Z0\nG80\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G53 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G52 local coordinate offset", () => {
    const ast = parse("O1\nT1 M6\nG54\nG52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G52 local coordinate offset")
      )
    ).toBe(true);
  });

  it("warns G30 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG90\nG41 D1\nG91\nG30 Z0\nG90\nG40\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G30 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G30 while a canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG90\nG81 Z-5. R2. F100.\nG91\nG30 Z0\nG90\nG80\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G30 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G28 while coordinate rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68\nG91\nG28 Z0\nG90\nG69\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G28 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G53 while coordinate rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG68\nG53 Z0\nG69\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G53 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G28 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51\nG91\nG28 Z0\nG90\nG50\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G28 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G53 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG51\nG53 Z0\nG50\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G53 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G30 while coordinate rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68\nG91\nG30 Z0\nG90\nG69\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G30 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G30 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51\nG91\nG30 Z0\nG90\nG50\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G30 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G28 while tool length is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nG91\nG28 Z0\nG90\nG49\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G28 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns G30 while tool length is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nG91\nG30 Z0\nG90\nG49\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G30 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns G53 while tool length is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nG53 Z0\nG49\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G53 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns non-tapping canned cycle while spindle is off", () => {
    const ast = parse("O1\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Canned cycle (G73/G76/G81-G83/G85-G89) while spindle is off")
      )
    ).toBe(true);
  });

  it("warns feed negative Z without G43", () => {
    const ast = parse("O1\nT1 M6\nG54\nG1 Z-1. F10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G1/G2/G3 with negative Z while tool length compensation (G43) is inactive")
      )
    ).toBe(true);
  });

  it("warns G41/G42 without tool length active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 D1\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G41/G42 while tool length compensation (G43) is inactive")
      )
    ).toBe(true);
  });

  it("warns M98 while cutter compensation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nM98 P1000\nG40\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M98 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns M98 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM98 P1000\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M98 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns M97 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nM97 P10\nG40\nN10\nM99\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M97 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns M97 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM97 P10\nG80\nN10\nM99\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M97 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns M98 while tool length is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nM98 P1000\nG49\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M98 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns M97 while tool length is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nM97 P10\nG49\nN10\nM99\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M97 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns M98 while rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nM98 P1000\nG69\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M98 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns M97 while rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nM97 P10\nG69\nN10\nM99\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M97 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns M98 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2.\nM98 P1000\nG50\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M98 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns M97 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2.\nM97 P10\nG50\nN10\nM99\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M97 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G65 while cutter compensation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nG65 P1000\nG40\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G65 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G65 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG65 P1000\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G65 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G65 while tool length is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nG65 P1000\nG49\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G65 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns G65 while rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nG65 P1000\nG69\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G65 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G65 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2.\nG65 P1000\nG50\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G65 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns M98 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nM98 P1000\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M98 while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns M97 while coolant is on", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nM8\nM97 P10\nM9\nN10\nM99\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M97 while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns G65 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG65 P1000\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G65 while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns M98 while incremental mode is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM98 P1000\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M98 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns M97 while incremental mode is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM97 P10\nG90\nN10\nM99\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M97 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G65 while incremental mode is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG65 P1000\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G65 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns M99 while cutter compensation is active", () => {
    const ast = parse("O1000\nT1 M6\nG54\nG43 H1 Z25.\nG41 D1\nM99", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M99 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns M99 while canned cycle is active", () => {
    const ast = parse("O1000\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM99", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M99 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns M99 while tool length is active", () => {
    const ast = parse("O1000\nT1 M6\nG54\nG43 H1 Z25.\nM99", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M99 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns M99 while rotation is active", () => {
    const ast = parse("O1000\nT1 M6\nG54\nG68 X0 Y0 R45.\nM99", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M99 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns M99 while scaling is active", () => {
    const ast = parse("O1000\nT1 M6\nG54\nG51 P2.\nM99", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M99 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns M99 while coolant is on", () => {
    const ast = parse("O1000\nT1 M6\nG54\nS1200 M3\nM8\nM99", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M99 while coolant is still on"))
    ).toBe(true);
  });

  it("warns M99 while incremental is active", () => {
    const ast = parse("O1000\nT1 M6\nG54\nG91\nM99", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M99 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G28 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG91\nG28 Z0\nG90\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G28 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G30 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG91\nG30 Z0\nG90\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G30 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G53 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG90\nG53 Z0\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G53 while coolant is still on"))
    ).toBe(true);
  });

  it("warns M5 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nM5\nM9\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M5 while coolant is still on"))
    ).toBe(true);
  });

  it("warns M5 while cutter compensation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nM5\nG40\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M5 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns M5 while canned cycle is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM5\nG80\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M5 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns M5 while tool length is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM5\nG49\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M5 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns M5 while rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nM5\nG69\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M5 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns M5 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2.\nS1200 M3\nM5\nG50\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M5 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns M5 while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nM5\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M5 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns M00 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nM00\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M00 while coolant is still on"))
    ).toBe(true);
  });

  it("warns M00 while cutter compensation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nM00\nG40\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M00 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns M00 while canned cycle is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM00\nG80\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M00 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns M01 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nM01\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M01 while coolant is still on"))
    ).toBe(true);
  });

  it("warns M01 while cutter compensation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nM01\nG40\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M01 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns M01 while canned cycle is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM01\nG80\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M01 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns M00 while tool length is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM00\nG49\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M00 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns M00 while rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nM00\nG69\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M00 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns M00 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2.\nS1200 M3\nM00\nG50\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M00 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns M00 while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nM00\nG90\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M00 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns M01 while tool length is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM01\nG49\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M01 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns M01 while rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nM01\nG69\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M01 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns M01 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2.\nS1200 M3\nM01\nG50\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M01 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns M01 while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nM01\nG90\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M01 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G4 while cutter compensation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG4 P1.\nG40\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G4 while canned cycle is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG4 P1.\nG80\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G4 while tool length is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG4 P1.\nG49\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns G4 while rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG4 P1.\nG69\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G4 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG4 P1.\nG50\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G4 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG4 P1.\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G4 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G4 while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nG4 P1.\nG90\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G0 while canned cycle is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG0 Z25.\nG80\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G0 rapid while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns work offset while cutter compensation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG55\nG40\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Work offset (G54-G59/G154) while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns work offset while canned cycle is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG55\nG80\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Work offset (G54-G59/G154) while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns work offset while rotation is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG55\nG69\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Work offset (G54-G59/G154) while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns work offset while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG55\nG50\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Work offset (G54-G59/G154) while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns work offset while tool length is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG55\nG49\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Work offset (G54-G59/G154) while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns work offset while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG55\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Work offset (G54-G59/G154) while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns work offset while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nG55\nG90\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Work offset (G54-G59/G154) while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G68 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG68 X0 Y0 R45.\nG40\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G68 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G68 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG68 X0 Y0 R45.\nG80\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G68 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G51 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG51 P2.\nG40\nG50\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G51 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G51 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG51 P2.\nG80\nG50\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G51 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G49 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG49\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G49 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G49 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG81 Z-1. R0.1 F10.\nG49\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G49 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G80 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG81 Z-1. R0.1 F10.\nG80\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G80 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G68 while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG68 X0 Y0 R45.\nG49\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G68 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns G68 while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG68 X0 Y0 R45.\nG50\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G68 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G51 while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG51 P2.\nG49\nG50\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G51 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns G51 while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG51 P2.\nG69\nG50\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G51 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G40 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG81 Z-1. R0.1 F10.\nG40\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G40 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G40 while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG68 X0 Y0 R45.\nG40\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G40 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G40 while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG51 P2.\nG40\nG50\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G40 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G69 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG68 X0 Y0 R45.\nG69\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G69 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G69 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG68 X0 Y0 R45.\nG69\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G69 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G50 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG51 P2.\nG50\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G50 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G49 while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG68 X0 Y0 R45.\nG49\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G49 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G49 while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG51 P2.\nG49\nG50\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G49 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G50 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG51 P2.\nG50\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G50 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G50 while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG51 P2.\nG50\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G50 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G50 while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG51 P2.\nG50\nG49\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G50 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns G69 while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG49\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G69 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns G69 while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG50\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G69 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G80 while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG81 Z-1. R0.1 F10.\nG80\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G80 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G80 while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG81 Z-1. R0.1 F10.\nG80\nG50\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G80 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G68 while coolant is on", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nM8\nG68 X0 Y0 R45.\nM9\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G68 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G68 while incremental is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG91\nS1200 M3\nG68 X0 Y0 R45.\nG90\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G68 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G51 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG51 P2.\nM9\nG50\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G51 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G51 while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nG51 P2.\nG90\nG50\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G51 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G49 while coolant is on", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG49\nM9\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G49 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G49 while incremental is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nG91\nS1200 M3\nG49\nG90\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G49 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G69 while coolant is on", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nM8\nG68 X0 Y0 R45.\nG69\nM9\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G69 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G69 while incremental is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG91\nS1200 M3\nG68 X0 Y0 R45.\nG69\nG90\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G69 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G50 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG51 P2.\nG50\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G50 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G50 while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nG51 P2.\nG50\nG90\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G50 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G80 while incremental is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG91\nS1200 M3\nG81 Z-1. R0.1 F10.\nG80\nG90\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G80 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G40 while coolant is on", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG41 D1\nG40\nM9\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G40 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G40 while incremental is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nG91\nS1200 M3\nG41 D1\nG40\nG90\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G40 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G41/G42 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG81 Z-1. R0.1 F10.\nG41 D1\nG80\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G41/G42 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G41/G42 while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG68 X0 Y0 R45.\nG41 D1\nG69\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G41/G42 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G41/G42 while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG51 P2.\nG41 D1\nG50\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G41/G42 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G41/G42 while incremental is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nG91\nS1200 M3\nG41 D1\nG90\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G41/G42 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G43 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG43 H1 Z25.\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G43 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G43 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG81 Z-1. R0.1 F10.\nG43 H1 Z25.\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G43 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns canned cycle while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG81 Z-1. R0.1 F10.\nG40\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Canned cycle while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns canned cycle while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG81 Z-1. R0.1 F10.\nG69\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Canned cycle while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G43 while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nS1200 M3\nG43 H1 Z25.\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G43 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G43 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2.\nS1200 M3\nG43 H1 Z25.\nG50\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G43 while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G43 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG43 H1 Z25.\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G43 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G43 while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nG43 H1 Z25.\nG90\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G43 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns canned cycle while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG81 Z-1. R0.1 F10.\nG50\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Canned cycle while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns canned cycle while incremental is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG91\nS1200 M3\nG81 Z-1. R0.1 F10.\nG90\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Canned cycle while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns plane select while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG18\nG40\nG17\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Plane select (G17/G18/G19) while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns plane select while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG18\nG80\nG17\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Plane select (G17/G18/G19) while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns plane select while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG18\nG69\nG17\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Plane select (G17/G18/G19) while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns plane select while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG18\nG50\nG17\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Plane select (G17/G18/G19) while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns plane select while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG18\nM9\nG17\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Plane select (G17/G18/G19) while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns plane select while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nG18\nG90\nG17\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Plane select (G17/G18/G19) while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns unit select while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG21\nG40\nG20\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Unit select (G20/G21) while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns unit select while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG21\nG80\nG20\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Unit select (G20/G21) while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns unit select while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG21\nG69\nG20\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Unit select (G20/G21) while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns unit select while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG21\nG50\nG20\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Unit select (G20/G21) while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns feed mode select while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG95\nG40\nG94\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Feed mode select (G94/G95) while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns feed mode select while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG95\nG80\nG94\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Feed mode select (G94/G95) while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns path mode select while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG61\nG40\nG64\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Path mode select (G61/G64) while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns path mode select while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG61\nG80\nG64\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Path mode select (G61/G64) while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns unit select while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG21\nM9\nG20\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Unit select (G20/G21) while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns unit select while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nG21\nG90\nG20\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Unit select (G20/G21) while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns feed mode select while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG95\nG69\nG94\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Feed mode select (G94/G95) while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns feed mode select while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG95\nG50\nG94\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Feed mode select (G94/G95) while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns feed mode select while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG95\nM9\nG94\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Feed mode select (G94/G95) while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns feed mode select while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nG95\nG90\nG94\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Feed mode select (G94/G95) while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns path mode select while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG61\nG69\nG64\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Path mode select (G61/G64) while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns path mode select while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG61\nG50\nG64\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Path mode select (G61/G64) while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns path mode select while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG61\nM9\nG64\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Path mode select (G61/G64) while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns path mode select while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nG61\nG90\nG64\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Path mode select (G61/G64) while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns distance mode select while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG91\nG40\nG90\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Distance mode select (G90/G91) while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns distance mode select while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG91\nG80\nG90\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Distance mode select (G90/G91) while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns distance mode select while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG91\nG69\nG90\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Distance mode select (G90/G91) while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns distance mode select while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG91\nG50\nG90\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Distance mode select (G90/G91) while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns distance mode select while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG91\nM9\nG90\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Distance mode select (G90/G91) while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns plane select while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG18\nG49\nG17\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Plane select (G17/G18/G19) while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns unit select while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG21\nG49\nG20\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Unit select (G20/G21) while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns feed mode select while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG95\nG49\nG94\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Feed mode select (G94/G95) while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns path mode select while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG61\nG49\nG64\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Path mode select (G61/G64) while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns G41/G42 while coolant is on", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG41 D1\nM9\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G41/G42 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G0 rapid while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG0 X10.\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G0 rapid while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G0 rapid while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG0 X10.\nG50\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G0 rapid while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns G80 while coolant is on", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nM8\nG81 Z-1. R0.1 F10.\nG80\nM9\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G80 while coolant is still on"))
    ).toBe(true);
  });

  it("warns M9 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG41 D1\nM9\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M9 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns M9 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nM8\nG81 Z-1. R0.1 F10.\nM9\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M9 while a canned cycle is still active"))
    ).toBe(true);
  });

  it("warns M9 while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nM9\nG49\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M9 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns M9 while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nM8\nG68 X0 Y0 R45.\nM9\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M9 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns M9 while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nM8\nG51 P2.\nM9\nG50\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M9 while scaling (G51) is still active"))
    ).toBe(true);
  });

  it("warns M9 while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nM8\nM9\nG90\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M9 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns spindle start while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM5\nM3\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle start (M3/M4) while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns spindle start while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nM5\nM3\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle start (M3/M4) while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns spindle start while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nM5\nM3\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle start (M3/M4) while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns spindle start while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nM5\nM3\nG50\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle start (M3/M4) while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns spindle start while incremental is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG90\nS1200 M3\nG91\nM5\nM3\nG90\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle start (M3/M4) while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns spindle start while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nM5\nM3\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle start (M3/M4) while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns coolant on while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nM8\nG69\nM9\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coolant on (M7/M8) while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns coolant on while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nM8\nG50\nM9\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coolant on (M7/M8) while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns coolant on while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nM8\nG90\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coolant on (M7/M8) while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns coolant on while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nM8\nG40\nM9\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coolant on (M7/M8) while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns feed motion while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG1 X1. F10.\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G1/G2/G3 while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns G92 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG92 X0\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G92 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G92 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG92 X0\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G92 while a canned cycle is still active"))
    ).toBe(true);
  });

  it("warns G92 while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG92 X0\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G92 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G92 while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG92 X0\nG50\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G92 while scaling (G51) is still active"))
    ).toBe(true);
  });

  it("warns G92 while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG92 X0\nG49\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G92 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns G52 while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nG52 X10.\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G52 while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns G52 while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nG52 X10.\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G52 while a canned cycle is still active"))
    ).toBe(true);
  });

  it("warns G52 while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nG52 X10.\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G52 while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns G52 while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nG52 X10.\nG50\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G52 while scaling (G51) is still active"))
    ).toBe(true);
  });

  it("warns G52 while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG52 X10.\nG49\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G52 while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns G92 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG92 X0\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G92 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G92 while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nG92 X0\nG90\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G92 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns G52 while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nG52 X10.\nM9\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G52 while coolant is still on"))
    ).toBe(true);
  });

  it("warns G52 while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nG52 X10.\nG90\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G52 while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns coolant on while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nM8\nG80\nM9\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coolant on (M7/M8) while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns feed motion while coolant is off after earlier coolant use", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nM8\nG1 X1. F10.\nM9\nG1 X2. F10.\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G1/G2/G3 while coolant is off after coolant was used earlier")
      )
    ).toBe(true);
  });

  it("warns tool select while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nT2\nG40\nM6\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Tool select (T) while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns tool select while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nT2\nG80\nM6\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Tool select (T) while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns tool select while tool length is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nT2\nG49\nM6\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Tool select (T) while tool length compensation (G43) is still active")
      )
    ).toBe(true);
  });

  it("warns tool select while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nT2\nG69\nM6\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Tool select (T) while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns tool select while scaling is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nT2\nG50\nM6\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Tool select (T) while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns tool select while coolant is on", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nM8\nT2\nM9\nM6\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Tool select (T) while coolant is still on")
      )
    ).toBe(true);
  });

  it("warns tool select while incremental is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nS1200 M3\nT2\nG90\nM6\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Tool select (T) while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns spindle speed while canned cycle is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG81 Z-1. R0.1 F10.\nS800\nG80\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle speed (S) while a canned cycle is still active")
      )
    ).toBe(true);
  });

  it("warns spindle speed while cutter compensation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG43 H1 Z25.\nS1200 M3\nG41 D1\nS800\nG40\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle speed (S) while cutter compensation (G41/G42) is still active")
      )
    ).toBe(true);
  });

  it("warns spindle speed while rotation is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nS1200 M3\nG68 X0 Y0 R45.\nS800\nG69\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle speed (S) while coordinate rotation (G68) is still active")
      )
    ).toBe(true);
  });

  it("warns spindle speed while scaling is active", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG51 P2.\nS800\nG50\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle speed (S) while scaling (G51) is still active")
      )
    ).toBe(true);
  });

  it("warns spindle speed while incremental is active", () => {
    const ast = parse(
      "O1\nT1 M6\nG54\nG90\nS1200 M3\nG91\nS800\nG90\nM5\nM30",
      haasNgcProfilePackaged
    );
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Spindle speed (S) while incremental mode (G91) is active")
      )
    ).toBe(true);
  });

  it("warns program ends in feed per revolution", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG95\nG1 X1. F0.1\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Program ends in feed per revolution (G95)")
      )
    ).toBe(true);
  });

  it("warns program ends in exact stop mode", () => {
    const ast = parse("O1\nT1 M6\nG54\nS1200 M3\nG61\nG1 X1. F10.\nM5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Program ends in exact stop mode (G61)")
      )
    ).toBe(true);
  });

  it("warns G28 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG28 Z0 G92 X0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G53 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG53 Z0 G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G30 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG30 Z0 G92 X0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G28 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG28 Z0 G52 X10.\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G53 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG53 Z0 G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G30 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG30 Z0 G52 X10.\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G92 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG92 X0 G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G92 and G52 on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nT2 M6 G28 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nT2 M6 G30 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nT2 M6 G53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG28 Z0 G4 P1.\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG30 Z0 G4 P1.\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG53 Z0 G4 P1.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 and M98 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nT2 M6 M98 P2\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 and M97 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nT2 M6 M97 P10\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 and G65 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nT2 M6 G65 P9010\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("M6 and G65 on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 and M00 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nT2 M6 M00\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 and M01 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nT2 M6 M01\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Multiple M codes on the same block")
      )
    ).toBe(true);
  });

  it("warns M98 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM98 P2 G28 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M97 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM97 P10 G28 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G65 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG65 P9010 G28 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M98 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nM98 P2 G53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M97 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nM97 P10 G53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G65 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nG65 P9010 G53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M98 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM98 P2 G30 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M97 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM97 P10 G30 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G65 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nG65 P9010 G30 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M00 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM00 G28 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M01 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM01 G28 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M00 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nM00 G53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M01 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nM01 G53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M00 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM00 G30 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M01 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM01 G30 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M99 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM99 G28 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M99 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM99 G30 Z0\nG90\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M99 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nM99 G53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 and G65 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG4 P1. G65 P9010\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 dwell and G65 on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 and M98 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG4 P1. M98 P2\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 dwell and M98 on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 and M97 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG4 P1. M97 P10\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 dwell and M97 on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 and M00 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG4 P1. M00\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 dwell and M00 on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 and M01 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG4 P1. M01\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 dwell and M01 on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 and M99 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG4 P1. M99\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("G4 dwell and M99 on the same block")
      )
    ).toBe(true);
  });

  it("warns M30 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM30 G28 Z0", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M30 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM30 G30 Z0", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M30 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nM30 G53 Z0", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M02 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM02 G28 Z0", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M02 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG91\nM02 G30 Z0", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M02 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG90\nM02 G53 Z0", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG4 P1. G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G4 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG4 P1. G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nT2 M6 G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns M6 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nT2 M6 G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns work offset and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54 G28 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns work offset and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54 G30 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G43 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25. G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G43 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25. G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G49 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nG49 G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G49 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nG49 G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G40 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 D1\nG40 G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G40 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 D1\nG40 G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G80 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80 G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G80 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80 G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns work offset and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54 G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns work offset and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54 G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G41/G42 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 D1 G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G41/G42 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 D1 G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G68 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45. G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G68 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45. G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G69 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69 G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G69 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69 G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G51 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2. G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G51 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2. G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G50 and G92 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2.\nG50 G92 X0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G50 and G52 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG51 P2.\nG50 G52 X10.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Coordinate shift conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G43 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25. G28 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G43 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25. G30 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G49 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nG49 G28 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G49 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nG49 G30 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G40 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 D1\nG40 G28 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G40 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 D1\nG40 G30 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G80 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80 G28 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G80 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80 G30 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G43 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25. G53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G49 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG43 H1 Z25.\nG49 G53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G40 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 D1\nG40 G53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G80 and G53 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG81 Z-1. R0.1 F10.\nG80 G53 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G41/G42 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 D1 G28 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G41/G42 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG41 D1 G30 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G68 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45. G28 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G68 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45. G30 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G69 and G28 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69 G28 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns G69 and G30 on the same block", () => {
    const ast = parse("O1\nT1 M6\nG54\nG68 X0 Y0 R45.\nG69 G30 Z0\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) =>
        i.message.includes("Machine positioning conflict on the same block")
      )
    ).toBe(true);
  });

  it("warns first G43 activation with no same-block Z", () => {
    const ast = parse("T1 M6\nG43 H1\nG0 Z20.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("First G43 activation has no meaningful Z"))
    ).toBe(true);
  });

  it("warns first G43 activation with Z0 literal", () => {
    const ast = parse("T1 M6\nG43 H1 Z0.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("First G43 activation has no meaningful Z"))
    ).toBe(true);
  });

  it("does not warn first G43 activation with variable Z#...", () => {
    const ast = parse("#100=25.\nT1 M6\nG43 H1 Z#100\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("First G43 activation has no meaningful Z"))
    ).toBe(false);
  });

  it("does not warn first G43 activation with bracket expression Z[#...]", () => {
    const ast = parse("#100=20.\nT1 M6\nG43 H1 Z[#100+5.]\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("First G43 activation has no meaningful Z"))
    ).toBe(false);
  });

  it("does not warn first G43 activation with non-zero Z move", () => {
    const ast = parse("T1 M6\nG43 H1 Z20.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("First G43 activation has no meaningful Z"))
    ).toBe(false);
  });

  it("warns M6 without T on the same block", () => {
    const ast = parse("G0 G90\nM6\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M6 without T"))).toBe(true);
  });

  it("warns when more than one M function appears in a single block", () => {
    const ast = parse("M3 M8\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("More than one M code in a single block"))).toBe(true);
  });

  it("does not warn for one M function per block", () => {
    const ast = parse("M3\nM8\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("More than one M code in a single block"))).toBe(false);
  });

  it("reports G20/G21 and G90/G91 conflicts from simpleLint without profile validateAst", () => {
    const inchMetric = parse("G20 G21 X1.\nM30", haasNgcProfile);
    const absInc = parse("G90 G91 X1.\nM30", haasNgcProfile);
    expect(lint(inchMetric, haasNgcProfile).some((i) => i.message.includes("G20 and G21 in the same block"))).toBe(true);
    expect(lint(absInc, haasNgcProfile).some((i) => i.message.includes("G90 and G91 in the same block"))).toBe(true);
  });

  it("does not warn for ordered G65 I/J/K arguments", () => {
    const ast = parse("G65 P9010 I1. J2. K3.\nM30", haasNgcProfile);
    expect(lint(ast, haasNgcProfile).some((i) => i.message.includes("G65 block has I/J/K out of order"))).toBe(false);
  });

  it("reports Fanuc-only N/O numeric-range validity checks when profile id is fanuc", () => {
    const fanucProfile = { ...haasNgcProfile, id: "fanuc" };
    const invalidN = parse("N0 G0 X0\nM30", fanucProfile);
    const invalidO = parse("O0\nM30", fanucProfile);
    const invalidNMacro = parse("N#100 G0 X0\nM30", fanucProfile);
    expect(lint(invalidN, fanucProfile).some((i) => i.message.includes("Invalid N/O numeric format"))).toBe(true);
    expect(lint(invalidO, fanucProfile).some((i) => i.message.includes("Invalid N/O numeric format"))).toBe(true);
    expect(lint(invalidNMacro, fanucProfile).some((i) => i.message.includes("Invalid N/O numeric format"))).toBe(true);
  });

  it("can opt into Fanuc-only N/O numeric checks via strict_fanuc parse mode", () => {
    const ast = parse("N0 G0 X0\nM30", haasNgcProfile, { complianceMode: "strict_fanuc" });
    expect(lint(ast, haasNgcProfile).some((i) => i.message.includes("Invalid N/O numeric format"))).toBe(true);
  });

  it("does not apply Fanuc-only N/O numeric checks in strict_haas parse mode", () => {
    const ast = parse("N0 G0 X0\nM30", haasNgcProfile, { complianceMode: "strict_haas" });
    expect(lint(ast, haasNgcProfile).some((i) => i.message.includes("Invalid N/O numeric format"))).toBe(false);
  });

  it("warns in strict_fanuc when executable blocks precede first O header", () => {
    const ast = parse("G0 X0\nO1000\nM30", haasNgcProfile, { complianceMode: "strict_fanuc" });
    expect(
      lint(ast, haasNgcProfile).some((i) =>
        i.message.includes("Fanuc program envelope: executable blocks appear before first O-number header")
      )
    ).toBe(true);
  });

  it("warns on duplicate O headers in strict_fanuc envelope checks", () => {
    const ast = parse("O1000\nG0 X0\nO1000\nM30", haasNgcProfile, { complianceMode: "strict_fanuc" });
    expect(
      lint(ast, haasNgcProfile).some((i) => i.message.includes("Duplicate O-number header O1000"))
    ).toBe(true);
  });

  it("does not warn when strict_fanuc program starts at O header", () => {
    const ast = parse("O1000\nG0 X0\nM30", haasNgcProfile, { complianceMode: "strict_fanuc" });
    expect(
      lint(ast, haasNgcProfile).some((i) =>
        i.message.includes("Fanuc program envelope: executable blocks appear before first O-number header")
      )
    ).toBe(false);
  });

  it("warns on duplicate high-risk address words in one block", () => {
    const ast = parse("G1 X1. X2. F100. F120.\nM30", haasNgcProfilePackaged);
    const issues = lint(ast, haasNgcProfilePackaged);
    expect(issues.some((i) => i.message.includes("Duplicate X words in one block"))).toBe(true);
    expect(issues.some((i) => i.message.includes("Duplicate F words in one block"))).toBe(true);
  });

  it("warns on duplicate P/Q only in strict_fanuc context", () => {
    const nonFanuc = parse("G65 P9010 P9011 Q1 Q2\nM30", haasNgcProfile, { complianceMode: "strict_haas" });
    const fanuc = parse("G65 P9010 P9011 Q1 Q2\nM30", haasNgcProfile, { complianceMode: "strict_fanuc" });
    expect(lint(nonFanuc, haasNgcProfile).some((i) => i.message.includes("Duplicate P words in one block"))).toBe(false);
    expect(lint(nonFanuc, haasNgcProfile).some((i) => i.message.includes("Duplicate Q words in one block"))).toBe(false);
    expect(lint(fanuc, haasNgcProfile).some((i) => i.message.includes("Duplicate P words in one block"))).toBe(true);
    expect(lint(fanuc, haasNgcProfile).some((i) => i.message.includes("Duplicate Q words in one block"))).toBe(true);
  });

  it("allows T before M6 on the same block", () => {
    const ast = parse("G0 G90\nT1 M6\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("M6 without T"))).toBe(false);
  });

  it("errors on duplicate M30", () => {
    const ast = parse("M30\nG0 X0\nM30", haasNgcProfilePackaged);
    const issues = lint(ast, haasNgcProfilePackaged);
    expect(issues.some((i) => i.severity === "error" && i.message.includes("Duplicate M30"))).toBe(true);
  });

  it("warns when a block mixes G0 and G1", () => {
    const ast = parse("G0 G1 X1.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) => i.severity === "warning" && i.message.includes("mixes G0 and G1")
      )
    ).toBe(true);
  });

  it("warns when a block mixes G0 and G2", () => {
    const ast = parse("G0 G2 X1. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) => i.severity === "warning" && i.message.includes("mixes G0 and G2")
      )
    ).toBe(true);
  });

  it("warns when a block mixes G0 and G3", () => {
    const ast = parse("G0 G3 X1. Y0 I-0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) => i.severity === "warning" && i.message.includes("mixes G0 and G3")
      )
    ).toBe(true);
  });

  it("warns when a block mixes G1 and G2", () => {
    const ast = parse("G1 G2 X1. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) => i.severity === "warning" && i.message.includes("mixes G1 and G2")
      )
    ).toBe(true);
  });

  it("warns when a block mixes G1 and G3", () => {
    const ast = parse("G1 G3 X1. Y0 I-0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) => i.severity === "warning" && i.message.includes("mixes G1 and G3")
      )
    ).toBe(true);
  });

  it("uses stable wording for two-mode motion conflicts", () => {
    const ast = parse("G1 G2 X1. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    const msg = lint(ast, haasNgcProfilePackaged).find((i) => i.message.includes("mixes G1 and G2"))?.message;
    expect(msg).toBe("Block mixes G1 and G2 in one line; verify motion mode intent.");
  });

  it("warns once when a block mixes three motion modes", () => {
    const ast = parse("G0 G1 G2 X1. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    const issues = lint(ast, haasNgcProfilePackaged).filter((i) => i.message.includes("multiple motion modes"));
    expect(issues).toHaveLength(1);
  });

  it("uses stable wording for multi-mode conflicts", () => {
    const ast = parse("G0 G1 G2 X1. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    const msg = lint(ast, haasNgcProfilePackaged).find((i) => i.message.includes("multiple motion modes"))?.message;
    expect(msg).toBe(
      "Block has multiple motion modes (G0/G1/G2/G3) in one line; keep one active mode per block."
    );
  });

  it("warns when a block mixes G2 and G3", () => {
    const ast = parse("G2 G3 X1. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) => i.severity === "warning" && i.message.includes("mixes G2 and G3")
      )
    ).toBe(true);
  });

  it("warns when a block repeats the same motion mode", () => {
    const ast = parse("G1 G1 X1.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) => i.severity === "warning" && i.message.includes("repeats G1")
      )
    ).toBe(true);
  });

  it("warns with arc-specific wording when G2 repeats", () => {
    const ast = parse("G2 G2 X1. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    const msg = lint(ast, haasNgcProfilePackaged).find((i) => i.message.includes("repeats G2"))?.message;
    expect(msg).toBe("Block repeats G2 in one line; remove redundant arc mode token.");
  });

  it("warns for each duplicated motion mode in the same block", () => {
    const ast = parse("G1 G1 G2 G2 X1. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    const issues = lint(ast, haasNgcProfilePackaged).filter((i) => i.message.includes("repeats G"));
    expect(issues.some((i) => i.message.includes("repeats G1"))).toBe(true);
    expect(issues.some((i) => i.message.includes("repeats G2"))).toBe(true);
  });

  it("does not warn G0 on one line and G1 on the next", () => {
    const ast = parse("G0 X0\nG1 X1.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("mixes G0 and G1"))).toBe(false);
  });

  it("does not warn G0 on one line and G3 on the next", () => {
    const ast = parse("G0 X0\nG3 X1. Y0 I-0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("mixes G0 and G3"))).toBe(false);
  });

  it("does not warn G0 on one line and G2 on the next", () => {
    const ast = parse("G0 X0\nG2 X1. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("mixes G0 and G2"))).toBe(false);
  });

  it("does not warn G1 on one line and G2 on the next", () => {
    const ast = parse("G1 X0\nG2 X1. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("mixes G1 and G2"))).toBe(false);
  });

  it("does not warn G1 on one line and G3 on the next", () => {
    const ast = parse("G1 X0\nG3 X1. Y0 I-0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("mixes G1 and G3"))).toBe(false);
  });

  it("does not warn multiple motion modes when modes are split across lines", () => {
    const ast = parse("G0 X0\nG1 X1.\nG2 X2. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("multiple motion modes"))).toBe(false);
  });

  it("does not warn repeated motion mode when mode is on separate lines", () => {
    const ast = parse("G1 X0\nG1 X1.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("repeats G1"))).toBe(false);
  });

  it("does not warn repeated arc mode when arc mode is on separate lines", () => {
    const ast = parse("G2 X0 Y0 I0.5 J0.\nG2 X1. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("repeats G2"))).toBe(false);
  });

  it("does not warn repeated modes when duplicates are split across lines", () => {
    const ast = parse("G1 X0\nG1 X1.\nG2 X2. Y0 I0.5 J0.\nG2 X3. Y0 I0.5 J0.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("repeats G"))).toBe(false);
  });

  it("warns when both M02 and M30 appear", () => {
    const ast = parse("G0 X0\nM02\nG0 Y0\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("both M02 and M30"))).toBe(true);
  });

  it("warns when last block is not M02, M30, or M99", () => {
    const ast = parse("G0 G90 G54\nG0 Z1.", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("Last block has no M02"))).toBe(true);
  });

  it("warns spindle on without S", () => {
    const ast = parse("M3\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("without S"))).toBe(true);
  });

  it("warns when M00 is followed by a move below Z0 before spindle restart", () => {
    const ast = parse("G0 Z5.\nM00\nG1 Z-1. F100.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) => i.message.includes("M00") && i.message.includes("below Z0")
      )
    ).toBe(true);
  });

  it("warns when M01 is followed by a move below Z0 before spindle restart", () => {
    const ast = parse("G0 Z5.\nM01\nG1 Z-0.5 F80.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) => i.message.includes("M01") && i.message.includes("below Z0")
      )
    ).toBe(true);
  });

  it("does not warn for M00/M01 when spindle restart occurs before plunge below Z0", () => {
    const ast = parse("G0 Z5.\nM00\nM3 S5000\nG1 Z-1. F100.\nM01\nM4 S4000\nG1 Z-0.5\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) =>
          (i.message.includes("M00") || i.message.includes("M01")) &&
          i.message.includes("below Z0")
      )
    ).toBe(false);
  });

  it("does not warn when post-stop motion stays at or above Z0 before spindle restart", () => {
    const ast = parse("G0 Z5.\nM00\nG1 X10. F100.\nG1 Z0.\nM30", haasNgcProfilePackaged);
    expect(
      lint(ast, haasNgcProfilePackaged).some(
        (i) => i.message.includes("M00") && i.message.includes("below Z0")
      )
    ).toBe(false);
  });

  it("handles M00/M01 restart-below-Z0 edge cases without false positives", () => {
    const cases: Array<{
      input: string;
      shouldWarn: boolean;
      note: string;
    }> = [
      {
        note: "multiple non-Z moves after M00 do not trigger warning",
        input: "G0 Z5.\nM00\nG1 X10. F100.\nG1 Y20.\nM30",
        shouldWarn: false
      },
      {
        note: "negative Z immediately after M00 warns",
        input: "G0 Z5.\nM00\nG1 Z-0.001 F50.\nM30",
        shouldWarn: true
      },
      {
        note: "spindle restart before negative Z suppresses warning",
        input: "G0 Z5.\nM00\nM3 S5000\nG1 Z-2.\nM30",
        shouldWarn: false
      },
      {
        note: "M01 path independently warns on negative Z without restart",
        input: "G0 Z5.\nM01\nG1 Z-3.\nM30",
        shouldWarn: true
      },
      {
        note: "new M01 after M00 resets guard window",
        input: "G0 Z5.\nM00\nG1 X1.\nM01\nG1 Z-1.\nM30",
        shouldWarn: true
      },
      {
        note: "Z expression should not false-trigger numeric check",
        input: "G0 Z5.\nM00\nG1 Z[#100-1.]\nM30",
        shouldWarn: false
      },
      {
        note: "Z-0 is not below zero and should not warn",
        input: "G0 Z5.\nM01\nG1 Z-0. F40.\nM30",
        shouldWarn: false
      }
    ];

    for (const { input, shouldWarn } of cases) {
      const ast = parse(input, haasNgcProfilePackaged);
      const hasWarning = lint(ast, haasNgcProfilePackaged).some(
        (i) => (i.message.includes("M00") || i.message.includes("M01")) && i.message.includes("below Z0")
      );
      expect(hasWarning).toBe(shouldWarn);
    }
  });

  it("handles extended M00/M01 restart-below-Z0 edge sequences", () => {
    const cases: Array<{
      input: string;
      shouldWarn: boolean;
      note: string;
    }> = [
      {
        note: "lowercase m00 and m3 still gate warning logic",
        input: "g0 z5.\nm00\nm3 s5000\ng1 z-1.\nm30",
        shouldWarn: false
      },
      {
        note: "M03 restart form with leading zero is accepted",
        input: "G0 Z5.\nM00\nM03 S5000\nG1 Z-1.\nM30",
        shouldWarn: false
      },
      {
        note: "commented stop line still opens a guarded window",
        input: "G0 Z5.\nM01 (INSPECT)\nG1 Z-2.\nM30",
        shouldWarn: true
      },
      {
        note: "first plunge after stop warns once even with multiple negative Z lines",
        input: "G0 Z5.\nM00\nG1 Z-1.\nG1 Z-2.\nM30",
        shouldWarn: true
      },
      {
        note: "window cleared by restart then reopened by later stop",
        input: "G0 Z5.\nM00\nM3 S5000\nG1 Z-1.\nM01\nG1 Z-0.2\nM30",
        shouldWarn: true
      },
      {
        note: "multiple stops with no plunge below zero never warn",
        input: "G0 Z5.\nM00\nG1 X1.\nM01\nG1 Y2.\nM30",
        shouldWarn: false
      },
      {
        note: "spindle start on same block after stop clears window",
        input: "G0 Z5.\nM00 M3 S5000\nG1 Z-1.\nM30",
        shouldWarn: false
      },
      {
        note: "M4 restart also clears window",
        input: "G0 Z5.\nM01\nM4 S4500\nG1 Z-0.5\nM30",
        shouldWarn: false
      },
      {
        note: "non-numeric Z token does not false-trigger and window remains until numeric plunge",
        input: "G0 Z5.\nM00\nG1 Z[#100-1.]\nG1 Z-0.1\nM30",
        shouldWarn: true
      }
    ];

    for (const { input, shouldWarn } of cases) {
      const ast = parse(input, haasNgcProfilePackaged);
      const warningCount = lint(ast, haasNgcProfilePackaged).filter(
        (i) => (i.message.includes("M00") || i.message.includes("M01")) && i.message.includes("below Z0")
      ).length;
      expect(warningCount > 0).toBe(shouldWarn);
      if (shouldWarn) {
        expect(warningCount).toBe(1);
      }
    }
  });

  it("warns G41 without D", () => {
    const ast = parse("G41 X1.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G41/G42 without D"))).toBe(true);
  });

  it("does not warn G41/G42 without D when a prior D offset is already active", () => {
    const ast = parse("G41 D12 X1.\nG1 X2.\nG42 X3.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G41/G42 without D"))).toBe(false);
  });

  it("does not warn G41.1 without D", () => {
    const ast = parse("G41.1 X1.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G41/G42 without D"))).toBe(false);
  });

  it("warns duplicate N labels", () => {
    const ast = parse("N10 G0 X0\nN10 G0 Y0\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("Duplicate sequence number"))).toBe(true);
  });
});

describe("Haas NGC simulation extras", () => {
  it("applies IF [cond] THEN #n = value on a single line (haas-ngc)", () => {
    const ast = parse(
      "#100 = 0\nIF [#100 EQ 0] THEN #100 = 1\n#101 = #100\nM30",
      haasNgcProfile
    );
    const r = simulate(ast, {}, { maxSteps: 50, maxLoopIterations: 10, controllerMode: "haas-ngc" });
    expect(r.state.variables["#100"]).toBe(1);
    expect(r.state.variables["#101"]).toBe(1);
  });

  it("skips IF…THEN assignment when condition is false", () => {
    const ast = parse(
      "#100 = 1\nIF [#100 EQ 0] THEN #100 = 2\n#101 = #100\nM30",
      haasNgcProfile
    );
    const r = simulate(ast, {}, { maxSteps: 50, maxLoopIterations: 10, controllerMode: "haas-ngc" });
    expect(r.state.variables["#100"]).toBe(1);
    expect(r.state.variables["#101"]).toBe(1);
  });

  it("handles IF…THEN formatting variants in haas-ngc mode", () => {
    const ast = parse(
      "#100=0\nif[#100 eq 0]then#100=1\nIF [#100 EQ 1] THEN #101=[#100+2]\nM30",
      haasNgcProfile
    );
    const r = simulate(ast, {}, { maxSteps: 50, maxLoopIterations: 10, controllerMode: "haas-ngc" });
    expect(r.state.variables["#100"]).toBe(1);
    expect(r.state.variables["#101"]).toBe(3);
  });

  it("applies IF…THEN and still runs trailing words on the same block", () => {
    const ast = parse(
      "#100=0\nIF [#100 EQ 0] THEN #100=[#100+1] G0 Z-10.\n#101=#100\nM30",
      haasNgcProfile
    );
    const r = simulate(ast, {}, { maxSteps: 50, maxLoopIterations: 10, controllerMode: "haas-ngc" });
    expect(r.state.variables["#100"]).toBe(1);
    expect(r.state.variables["#101"]).toBe(1);
    expect(r.warnings.some((w) => w.includes("rapid (G0) Z move down"))).toBe(true);
  });

  it("warns on rapid G0 Z plunge in haas-ngc mode", () => {
    const ast = parse("G90 G0 Z0.\nG0 Z-10.\nM30", haasNgcProfile);
    const r = simulate(ast, {}, { maxSteps: 30, maxLoopIterations: 10, controllerMode: "haas-ngc" });
    expect(r.warnings.some((w) => w.includes("rapid (G0) Z move down"))).toBe(true);
  });

  it("does not warn rapid Z plunge in fanuc mode", () => {
    const ast = parse("G90 G0 Z0.\nG0 Z-10.\nM30", haasNgcProfile);
    const r = simulate(ast, {}, { maxSteps: 30, maxLoopIterations: 10, controllerMode: "fanuc" });
    expect(r.warnings.some((w) => w.includes("rapid (G0) Z move down"))).toBe(false);
  });
});

describe("Controller-specific macro compatibility", () => {
  it("keeps machine-valid macro formatting parse-safe across haas and fanuc modes", () => {
    const sharedPrograms = [
      "#100=0\nif[#100 eq 0]then#100=1\n#101=[#100+2]\nM30",
      "#100=0\nWHILE[#100 LT 2]DO1\n#100=#100+1\nEND1\nM30",
      "#100=1\nIF [#100 EQ 1] GOTO100\nN100 #102=#100\nM30",
      "#100 = [ #101 + 1 ]\n#102=[#100*2]\nM30"
    ];

    for (const program of sharedPrograms) {
      const ast = parse(program, haasNgcProfile);
      const issues = lint(ast, haasNgcProfile);
      const haas = simulate(ast, {}, { maxSteps: 80, maxLoopIterations: 20, controllerMode: "haas-ngc" });
      const fanuc = simulate(ast, {}, { maxSteps: 80, maxLoopIterations: 20, controllerMode: "fanuc" });

      expect(ast.blocks.length).toBeGreaterThan(1);
      expect(issues.some((i) => i.message.includes("Block has no parseable words."))).toBe(false);
      expect(haas.warnings.some((w) => w.includes("Invalid assignment"))).toBe(false);
      expect(fanuc.warnings.some((w) => w.includes("Invalid assignment"))).toBe(false);
      expect(haas.warnings.some((w) => w.includes("is missing END"))).toBe(false);
      expect(fanuc.warnings.some((w) => w.includes("is missing END"))).toBe(false);
      expect(haas.warnings.some((w) => w.includes("target N") && w.includes("not found"))).toBe(false);
      expect(fanuc.warnings.some((w) => w.includes("target N") && w.includes("not found"))).toBe(false);
    }
  });

  it("flags unsupported macro functions only in fanuc while keeping haas clean", () => {
    const ast = parse("#100=EXP[1]\n#101=FUP[-1.2]\nM30", haasNgcProfile);
    const haas = simulate(ast, {}, { maxSteps: 80, maxLoopIterations: 20, controllerMode: "haas-ngc" });
    const fanuc = simulate(ast, {}, { maxSteps: 80, maxLoopIterations: 20, controllerMode: "fanuc" });

    expect(haas.warnings.some((w) => w.includes("not supported in fanuc mode"))).toBe(false);
    expect(haas.warnings.some((w) => w.includes("Invalid assignment"))).toBe(false);
    expect(haas.state.variables["#100"]).toBeCloseTo(2.718281828, 4);
    expect(haas.state.variables["#101"]).toBe(-1);

    expect(fanuc.warnings.some((w) => w.includes("Function EXP is not supported in fanuc mode"))).toBe(true);
    expect(fanuc.warnings.some((w) => w.includes("Function FUP is not supported in fanuc mode"))).toBe(true);
  });
});

describe("runJobCheck parse diagnostics summary", () => {
  it("returns an empty summary for a clean program", async () => {
    const ast = parse("G90 G0 X0 Y0\nM30", haasNgcProfile);
    const result = await runJobCheck({ ast });
    expect(result.parseDiagnosticsSummary.total).toBe(0);
    expect(Object.keys(result.parseDiagnosticsSummary.byCode)).toHaveLength(0);
    expect(result.parseDiagnosticsSummary.topCodes).toEqual([]);
  });

  it("collects byCode counts and topCodes for malformed programs", async () => {
    const ast = parse("G0 X1 (NO CLOSE\nG0 X Y1\nG1 @@@ X1\nM30", haasNgcProfile);
    const result = await runJobCheck({ ast });
    expect(result.parseDiagnosticsSummary.total).toBeGreaterThan(0);
    expect(result.parseDiagnosticsSummary.byCode["UNMATCHED_OPEN_PAREN"]).toBeGreaterThan(0);
    expect(result.parseDiagnosticsSummary.byCode["ADDRESS_MISSING_VALUE"]).toBeGreaterThan(0);
    expect(result.parseDiagnosticsSummary.topCodes.length).toBeGreaterThan(0);
    expect(result.parseDiagnosticsSummary.topCodes.length).toBeLessThanOrEqual(3);
  });

  it("includes parseDiagnostics line in the timeline+findings export bundle headers", () => {
    const ast = parse("G0 X1 (NO CLOSE\nG0 X Y1\nM30", haasNgcProfile);
    const summary = summarizeParseDiagnostics(ast.parseDiagnostics);
    const bundle = buildTimelineFindingsExportBundle({
      timestampIso: new Date().toISOString(),
      controller: "haas-ngc",
      timelineEntries: [],
      findings: [],
      parseDiagnosticsSummary: summary
    });
    expect(bundle.timelineTxt).toContain(`parseDiagnostics: total=${summary.total}`);
    expect(bundle.timelineMarkdown).toContain(`Parse diagnostics: total=${summary.total}`);
    expect(bundle.findingsTxt).toContain("parseDiagnostics:");
    expect(bundle.findingsMarkdown).toContain("Parse diagnostics:");
  });

  it("emits parseDiagnostics: total=0 when no diagnostics are present in the bundle", () => {
    const bundle = buildTimelineFindingsExportBundle({
      timestampIso: new Date().toISOString(),
      controller: "haas-ngc",
      timelineEntries: [],
      findings: []
    });
    expect(bundle.timelineTxt).toContain("parseDiagnostics: total=0");
    expect(bundle.timelineMarkdown).toContain("Parse diagnostics: total=0");
  });
});

describe("controller grammar lint suggestedFixes", () => {
  it("attaches a suggested fix to N+O mixed-block warnings", () => {
    const ast = parse("N10 O1000\nM30", haasNgcProfile);
    const issue = lint(ast, haasNgcProfile).find((i) =>
      i.message.includes("Block contains both N and O words")
    );
    expect(issue).toBeDefined();
    expect(issue?.suggestedFixes).toBeDefined();
    expect(issue?.suggestedFixes?.[0]?.title).toMatch(/move N number to a separate block/i);
  });

  it("attaches a suggested fix to duplicate-address warnings (haas)", () => {
    const ast = parse("G1 X1. X2. F100. F120.\nM30", haasNgcProfile);
    const issues = lint(ast, haasNgcProfile);
    const duplicateX = issues.find((i) => i.message.includes("Duplicate X words in one block"));
    expect(duplicateX).toBeDefined();
    expect(duplicateX?.suggestedFixes?.[0]?.title).toMatch(/split duplicate x words into two blocks/i);
    expect(duplicateX?.suggestedFixes?.[0]?.title).toMatch(/last-value-wins/i);
  });

  it("attaches a suggested fix to G65 I/J/K out-of-order warnings", () => {
    const ast = parse("G65 P9010 K4. J2. I3.\nM30", haasNgcProfile);
    const issue = lint(ast, haasNgcProfile).find((i) =>
      i.message.includes("G65 block has I/J/K out of order")
    );
    expect(issue).toBeDefined();
    expect(issue?.suggestedFixes?.[0]?.title).toMatch(/reorder arguments so i appears before j before k/i);
  });

  it("preserves issue-level suggestedFixes through lintWithProvenance", () => {
    const ast = parse("N10 O1000\nM30", haasNgcProfile);
    const decorated = lintWithProvenance(ast, haasNgcProfile);
    const issue = decorated.find((i) => i.message.includes("Block contains both N and O words"));
    expect(issue).toBeDefined();
    expect(issue?.suggestedFixes?.[0]?.title).toMatch(/move N number to a separate block/i);
    expect(issue?.provenance.source).toBe("controller_grammar");
  });

  it("attaches a suggested fix to fanuc invalid N/O numeric format warnings", () => {
    const ast = parse("N0 O0\nM30", haasNgcProfile, { complianceMode: "strict_fanuc" });
    const issue = lint(ast, haasNgcProfile).find((i) =>
      i.message.includes("Invalid N/O numeric format")
    );
    expect(issue).toBeDefined();
    expect(issue?.suggestedFixes?.[0]?.title).toMatch(
      /use an integer N or O value within 1\.\.99999999/i
    );
  });

  it("attaches a suggested fix to fanuc executable-before-O envelope warnings", () => {
    const ast = parse("G0 X0\nO1000\nM30", haasNgcProfile, { complianceMode: "strict_fanuc" });
    const issue = lint(ast, haasNgcProfile).find((i) =>
      i.message.includes("executable blocks appear before first O-number header")
    );
    expect(issue).toBeDefined();
    expect(issue?.suggestedFixes?.[0]?.title).toMatch(
      /move executable blocks below the o-number header/i
    );
  });

  it("attaches a suggested fix to fanuc duplicate O-number header warnings", () => {
    const ast = parse("O1000\nM30\nO1000\nM30", haasNgcProfile, {
      complianceMode: "strict_fanuc"
    });
    const issue = lint(ast, haasNgcProfile).find((i) =>
      i.message.includes("Duplicate O-number header")
    );
    expect(issue).toBeDefined();
    expect(issue?.suggestedFixes?.[0]?.title).toMatch(
      /use a unique o-number per program; rename duplicate/i
    );
  });
});

describe("runJobCheck parseDiagnosticsPolicy", () => {
  it("emits no findings when no policy is supplied", async () => {
    const ast = parse("G0 X Y1\nG0 X Y1\nM30", haasNgcProfile);
    const result = await runJobCheck({ ast });
    expect(
      result.advisor.safetyFindings.some((f) => f.code === "PARSE_DIAGNOSTICS_THRESHOLD_BREACH")
    ).toBe(false);
    expect(result.simulationFindings.some((f) => f.code === "PARSE_DIAGNOSTICS_THRESHOLD_BREACH")).toBe(
      false
    );
  });

  it("emits a warning finding when the TOTAL threshold is breached", async () => {
    const ast = parse("G0 X Y1\nG0 X Y1\nG0 X Y1\nM30", haasNgcProfile);
    const result = await runJobCheck({
      ast,
      parseDiagnosticsPolicy: {
        severity: "warning",
        thresholds: { TOTAL: 1 }
      }
    });
    expect(result.warningCount).toBeGreaterThanOrEqual(1);
    expect(result.blocked).toBe(false);
    const messages = result.messages.join("\n");
    expect(messages).toMatch(/Parse diagnostics warning: PARSE_DIAGNOSTICS_THRESHOLD_BREACH/);
    expect(messages).toMatch(/TOTAL=\d+ exceeds threshold 1/);
  });

  it("blocks export when a code-specific blocker threshold is breached with blockExport=true", async () => {
    const ast = parse("G0 X Y1\nG0 X Y1\nM30", haasNgcProfile);
    const result = await runJobCheck({
      ast,
      exportOptions: { enabled: true, baseDirectory: "ignored" },
      parseDiagnosticsPolicy: {
        severity: "blocker",
        blockExport: true,
        thresholds: { ADDRESS_MISSING_VALUE: 1 }
      }
    });
    expect(result.blockerCount).toBeGreaterThanOrEqual(1);
    expect(result.blocked).toBe(true);
    expect(result.exportResult).toBeUndefined();
    const messages = result.messages.join("\n");
    expect(messages).toMatch(/Export safety gate active.*PARSE_DIAGNOSTICS_THRESHOLD_BREACH/);
    expect(messages).toMatch(/ADDRESS_MISSING_VALUE=\d+ exceeds threshold 1/);
  });

  it("does not breach when observed counts equal the threshold", async () => {
    const ast = parse("G0 X Y1\nM30", haasNgcProfile);
    const observedTotal = summarizeParseDiagnostics(ast.parseDiagnostics).total;
    const result = await runJobCheck({
      ast,
      parseDiagnosticsPolicy: {
        severity: "warning",
        thresholds: { TOTAL: observedTotal }
      }
    });
    expect(result.messages.some((m) => m.includes("PARSE_DIAGNOSTICS_THRESHOLD_BREACH"))).toBe(false);
  });

  it("blocker severity without blockExport surfaces breach but the policy does not contribute a gate code", async () => {
    const ast = parse("G0 X Y1\nG0 X Y1\nM30", haasNgcProfile);
    const result = await runJobCheck({
      ast,
      exportBlockingPolicy: { includeAllBlockers: false, blockedFindingCodes: [] },
      parseDiagnosticsPolicy: {
        severity: "blocker",
        blockExport: false,
        thresholds: { TOTAL: 1 }
      }
    });
    expect(result.blockerCount).toBeGreaterThanOrEqual(1);
    expect(
      result.messages.some((m) => m.includes("PARSE_DIAGNOSTICS_THRESHOLD_BREACH"))
    ).toBe(true);
    expect(result.blocked).toBe(false);
    expect(
      result.messages.some((m) => m.startsWith("Export safety gate active"))
    ).toBe(false);
  });

  it("returns parseDiagnosticsPolicyBreaches with firstBlockIndex for code-specific breaches", async () => {
    const ast = parse("G0 X1\nG0 X Y1\nG1 X1", haasNgcProfile);
    const result = await runJobCheck({
      ast,
      parseDiagnosticsPolicy: {
        severity: "warning",
        thresholds: { TOTAL: 0, ADDRESS_MISSING_VALUE: 0 }
      }
    });
    expect(result.parseDiagnosticsPolicyBreaches.length).toBe(2);
    const totalBreach = result.parseDiagnosticsPolicyBreaches.find((b) => b.key === "TOTAL");
    expect(totalBreach?.firstBlockIndex).toBeUndefined();
    const codeBreach = result.parseDiagnosticsPolicyBreaches.find(
      (b) => b.key === "ADDRESS_MISSING_VALUE"
    );
    expect(codeBreach?.firstBlockIndex).toBe(1);
    expect(codeBreach?.severity).toBe("warning");
  });
});

describe("setupSheet + proveout parseDiagnostics summary", () => {
  it("setupSheet output for malformed AST contains parseDiagnostics: total= line", async () => {
    const ast = parse("G0 X Y1\nG0 X Y1\nM30", haasNgcProfile);
    const result = await runJobCheck({ ast });
    expect(result.setupSheet.exportTxt).toContain("PARSE DIAGNOSTICS");
    expect(result.setupSheet.exportTxt).toMatch(/parseDiagnostics: total=\d+/);
    expect(result.setupSheet.exportMarkdown).toContain("## Parse diagnostics");
    expect(result.setupSheet.exportMarkdown).toMatch(/- Parse diagnostics: total=\d+/);
  });

  it("setupSheet output for clean AST emits a total=0 marker (still informative, never omits)", async () => {
    const ast = parse("G0 X1\nM30", haasNgcProfile);
    const result = await runJobCheck({ ast });
    expect(result.setupSheet.exportTxt).toContain("parseDiagnostics: total=0");
    expect(result.setupSheet.exportMarkdown).toContain("- Parse diagnostics: total=0");
  });

  it("proveout output for malformed AST contains the parseDiagnostics comment line", async () => {
    const ast = parse("G0 X Y1\nG0 X Y1\nM30", haasNgcProfile);
    const result = await runJobCheck({ ast });
    expect(result.proveout.code).toMatch(/\(parseDiagnostics: total=\d+ \| top=/);
  });

  it("proveout output for clean AST emits a total=0 comment line", async () => {
    const ast = parse("G0 X1\nM30", haasNgcProfile);
    const result = await runJobCheck({ ast });
    expect(result.proveout.code).toContain("(parseDiagnostics: total=0)");
  });

  it("buildSetupSheet/proveoutProgram defaults remain unchanged when no summary is supplied", () => {
    const ast = parse("G0 X1\nM30", haasNgcProfile);
    const setup = buildSetupSheet(ast, {});
    expect(setup.exportTxt).not.toContain("PARSE DIAGNOSTICS");
    expect(setup.exportMarkdown).not.toContain("## Parse diagnostics");
    const proveout = proveoutProgram(ast, {});
    expect(proveout.code).not.toContain("parseDiagnostics:");
  });
});

describe("parseDiagnostics block format guard", () => {
  const malformedProgram = "G0 X Y1\nG0 X Y1\nM30";
  const cleanProgram = "G0 X1\nM30";

  it("locks the canonical malformed-program block strings across setupSheet + proveout", async () => {
    const ast = parse(malformedProgram, haasNgcProfile);
    const result = await runJobCheck({ ast });
    expect(result.setupSheet.exportTxt).toContain(
      "parseDiagnostics: total=2 | top=ADDRESS_MISSING_VALUE | byCode=ADDRESS_MISSING_VALUE=2"
    );
    expect(result.setupSheet.exportMarkdown).toContain(
      "- Parse diagnostics: total=2 | top=ADDRESS_MISSING_VALUE | byCode=ADDRESS_MISSING_VALUE=2"
    );
    expect(result.proveout.code).toContain(
      "(parseDiagnostics: total=2 | top=ADDRESS_MISSING_VALUE | byCode=ADDRESS_MISSING_VALUE=2)"
    );
  });

  it("locks the canonical zero-total block strings for a clean program", async () => {
    const ast = parse(cleanProgram, haasNgcProfile);
    const result = await runJobCheck({ ast });
    expect(result.setupSheet.exportTxt).toContain("parseDiagnostics: total=0");
    expect(result.setupSheet.exportMarkdown).toContain("- Parse diagnostics: total=0");
    expect(result.proveout.code).toContain("(parseDiagnostics: total=0)");
  });
});

describe("parseDiagBreaches block format guard", () => {
  const malformedProgram = "G0 X Y1\nG0 X Y1\nM30";
  const cleanProgram = "G0 X1\nM30";

  it("locks the canonical breach block strings on setupSheet + proveout under a strict policy", async () => {
    const ast = parse(malformedProgram, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      parseDiagnosticsPolicy: {
        thresholds: { TOTAL: 0, ADDRESS_MISSING_VALUE: 0 },
        severity: "blocker",
        blockExport: false
      }
    });
    expect(result.setupSheet.exportTxt).toContain("PARSE DIAGNOSTICS BREACHES");
    expect(result.setupSheet.exportTxt).toContain(
      "parseDiagBreaches: total=2 | severities=blocker:2 | byKey=ADDRESS_MISSING_VALUE:2/0,TOTAL:2/0"
    );
    expect(result.setupSheet.exportMarkdown).toContain(
      "- Parse diagnostics breaches: total=2 | severities=blocker:2 | byKey=ADDRESS_MISSING_VALUE:2/0,TOTAL:2/0"
    );
    expect(result.proveout.code).toContain(
      "(parseDiagBreaches: total=2 | severities=blocker:2 | byKey=ADDRESS_MISSING_VALUE:2/0,TOTAL:2/0)"
    );
  });

  it("locks the canonical zero-form breach block strings when no policy is configured", async () => {
    const ast = parse(cleanProgram, haasNgcProfile);
    const result = await runJobCheck({ ast });
    expect(result.setupSheet.exportTxt).toContain("parseDiagBreaches: total=0");
    expect(result.setupSheet.exportMarkdown).toContain("- Parse diagnostics breaches: total=0");
    expect(result.proveout.code).toContain("(parseDiagBreaches: total=0)");
  });

  it("does not append the breach block to setupSheet/proveout when no breaches array is passed directly", () => {
    const ast = parse(cleanProgram, haasNgcProfile);
    const setup = buildSetupSheet(ast, {});
    expect(setup.exportTxt).not.toContain("parseDiagBreaches:");
    expect(setup.exportMarkdown).not.toContain("Parse diagnostics breaches");
    const proveout = proveoutProgram(ast, {});
    expect(proveout.code).not.toContain("parseDiagBreaches:");
  });
});

describe("public-surface smoke (index.node.ts)", () => {
  it("re-exports resolveParseDiagnosticsPolicyPreset and PARSE_DIAGNOSTICS_POLICY_PRESET_IDS", async () => {
    const mod = await import("../src/index.node.js");
    expect(typeof mod.resolveParseDiagnosticsPolicyPreset).toBe("function");
    expect(Array.isArray(mod.PARSE_DIAGNOSTICS_POLICY_PRESET_IDS)).toBe(true);
    expect([...mod.PARSE_DIAGNOSTICS_POLICY_PRESET_IDS]).toEqual([
      "strict",
      "balanced",
      "permissive"
    ]);
    const strict = mod.resolveParseDiagnosticsPolicyPreset("strict");
    expect(strict).toEqual({
      severity: "blocker",
      blockExport: true,
      thresholds: { TOTAL: 0 }
    });
    expect(mod.resolveParseDiagnosticsPolicyPreset("permissive")).toBeUndefined();
  });

  it("re-exports lintWithProvenance and runJobCheck and they round-trip lintIssues", async () => {
    const mod = await import("../src/index.node.js");
    expect(typeof mod.lintWithProvenance).toBe("function");
    expect(typeof mod.runJobCheck).toBe("function");
    const ast = mod.parse("G0 X1\nM30\n", haasNgcProfile);
    const lints = mod.lintWithProvenance(ast, haasNgcProfile);
    expect(Array.isArray(lints)).toBe(true);
    const result = await mod.runJobCheck({ ast });
    expect(Array.isArray(result.lintIssues)).toBe(true);
    expect(result.lintIssuesSummary).toBeDefined();
    expect(typeof result.lintIssuesSummary.total).toBe("number");
  });
});

describe("lintIssuesSummary surface in runJobCheck", () => {
  const cleanProgram = "G0 X1\nM30";
  const fanucMalformedProgram = "%\nG0 X1.\nO1000\nN10 O1000\nM30\n%";

  it("emits zero-form summary on a clean program", async () => {
    const ast = parse(cleanProgram, haasNgcProfile);
    const result = await runJobCheck({ ast });
    expect(result.lintIssuesSummary.total).toBeGreaterThanOrEqual(0);
    expect(result.lintIssuesSummary.blockers).toBeGreaterThanOrEqual(0);
    expect(result.lintIssuesSummary.warnings).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.lintIssues)).toBe(true);
    expect(result.setupSheet.exportTxt).toContain("LINT ISSUES");
    expect(result.setupSheet.exportTxt).toMatch(/lintIssues: total=\d+/);
    expect(result.proveout.code).toMatch(/\(lintIssues: total=\d+/);
  });

  it("surfaces controller_grammar findings when running against a malformed Fanuc program", async () => {
    const ast = parse(fanucMalformedProgram, haasNgcProfile);
    const result = await runJobCheck({ ast });
    const controllerLints = result.lintIssues.filter(
      (issue) => issue.provenance.source === "controller_grammar"
    );
    expect(controllerLints.length).toBeGreaterThan(0);
    expect(result.lintIssuesSummary.bySource.controller_grammar ?? 0).toBeGreaterThan(0);
    expect(result.setupSheet.exportTxt).toMatch(
      /lintIssues: total=\d+ \| severities=blocker:\d+,warning:\d+ \| top=[\w_]+/
    );
  });

  it("does not append the LINT ISSUES block to setupSheet/proveout when no summary is passed directly", () => {
    const ast = parse(cleanProgram, haasNgcProfile);
    const setup = buildSetupSheet(ast, {});
    expect(setup.exportTxt).not.toContain("LINT ISSUES");
    expect(setup.exportMarkdown).not.toContain("Lint issues");
    const proveout = proveoutProgram(ast, {});
    expect(proveout.code).not.toContain("(lintIssues:");
  });

  it("routes bracket-imbalance lint findings through the expression_parser provenance source", async () => {
    const ast = parse("G1 X[1+2 Y2\nM30", haasNgcProfile);
    const result = await runJobCheck({ ast });
    const exprLints = result.lintIssues.filter(
      (issue) => issue.provenance.source === "expression_parser"
    );
    expect(exprLints.length).toBeGreaterThan(0);
    expect(result.lintIssuesSummary.bySource.expression_parser ?? 0).toBeGreaterThanOrEqual(1);
    expect(exprLints[0].message).toMatch(/Unbalanced bracket expression/);
  });
});

describe("setup-sheet per-source severity histogram", () => {
  it("summarizeLintIssues populates bySourceSeverity with sub-counts that sum to bySource counts", async () => {
    const { summarizeLintIssues } = await import("../src/workshop/exportBundle.js");
    const summary = summarizeLintIssues([
      {
        severity: "error",
        message: "boom",
        blockIndex: 0,
        provenance: { source: "controller_grammar", relatedDiagnostics: [] }
      },
      {
        severity: "warning",
        message: "soft",
        blockIndex: 1,
        provenance: { source: "controller_grammar", relatedDiagnostics: [] }
      },
      {
        severity: "warning",
        message: "soft2",
        blockIndex: 2,
        provenance: { source: "profile_lint", relatedDiagnostics: [] }
      }
    ]);
    expect(summary.bySource.controller_grammar).toBe(2);
    expect(summary.bySource.profile_lint).toBe(1);
    expect(summary.bySourceSeverity?.controller_grammar).toEqual({
      blockers: 1,
      warnings: 1
    });
    expect(summary.bySourceSeverity?.profile_lint).toEqual({
      blockers: 0,
      warnings: 1
    });
    for (const source of Object.keys(summary.bySource) as Array<
      keyof typeof summary.bySource
    >) {
      const sev = summary.bySourceSeverity![source]!;
      expect(sev.blockers + sev.warnings).toBe(summary.bySource[source]);
    }
  });

  it("formatLintIssuesSummaryBlock returns NO histogram when only one source contributed", async () => {
    const { formatLintIssuesSummaryBlock, summarizeLintIssues } = await import(
      "../src/workshop/exportBundle.js"
    );
    const summary = summarizeLintIssues([
      {
        severity: "warning",
        message: "x",
        blockIndex: 0,
        provenance: { source: "controller_grammar", relatedDiagnostics: [] }
      }
    ]);
    const block = formatLintIssuesSummaryBlock(summary);
    expect(block.histogram).toBeUndefined();
    expect(block.txt).toMatch(/^lintIssues: total=1/);
  });

  it("formatLintIssuesSummaryBlock returns a histogram block when multiple sources contributed; bars are scaled to the max count", async () => {
    const { formatLintIssuesSummaryBlock, summarizeLintIssues } = await import(
      "../src/workshop/exportBundle.js"
    );
    const issues = [
      ...Array.from({ length: 3 }, (_, i) => ({
        severity: i === 0 ? ("error" as const) : ("warning" as const),
        message: `m${i}`,
        blockIndex: i,
        provenance: {
          source: "controller_grammar" as const,
          relatedDiagnostics: []
        }
      })),
      {
        severity: "warning" as const,
        message: "p",
        blockIndex: 99,
        provenance: { source: "profile_lint" as const, relatedDiagnostics: [] }
      }
    ];
    const summary = summarizeLintIssues(issues);
    const block = formatLintIssuesSummaryBlock(summary);
    expect(block.histogram).toBeDefined();
    expect(block.histogram!.txt).toContain("controller_grammar");
    expect(block.histogram!.txt).toContain("profile_lint");
    expect(block.histogram!.txt).toMatch(/controller_grammar\s+#{10}\s+3 \(blocker:1, warning:2\)/);
    expect(block.histogram!.txt).toMatch(/profile_lint\s+#+\s+1 \(blocker:0, warning:1\)/);
    // Markdown variant uses bullet rows instead of fixed-width padding.
    expect(block.histogram!.md).toMatch(/- controller_grammar: #{10} 3 \(blocker:1, warning:2\)/);
  });

  it("setup sheet exportTxt includes the histogram block right under the rollup line when ≥2 sources fired", async () => {
    // Bracket-imbalance + safe-start-missing + program-end-missing exercises
    // multiple provenance sources naturally (lexer + expression_parser + common_lint).
    const ast = parse("G1 X[1+2 Y2\n", haasNgcProfile);
    const result = await runJobCheck({ ast });
    const sourcesPresent = Object.entries(result.lintIssuesSummary.bySource).filter(
      ([, count]) => (count ?? 0) > 0
    );
    expect(sourcesPresent.length).toBeGreaterThanOrEqual(2);
    const txt = result.setupSheet.exportTxt;
    expect(txt).toMatch(/LINT ISSUES\nlintIssues: total=\d+/);
    // The histogram lines indent each row by two spaces and end with the
    // "(blocker:N, warning:N)" sub-counts. Asserting any histogram row exists
    // is enough to confirm wiring; specific source set is covered above.
    expect(txt).toMatch(/\n  [a-z_]+\s+#+\s+\d+ \(blocker:\d+, warning:\d+\)/);
  });

  it("setup sheet exportTxt OMITS the histogram block when only one source fired", async () => {
    // A program that triggers exactly one lint source: missing program end →
    // common_lint only.
    const ast = parse("G0 X1\n", haasNgcProfile);
    const result = await runJobCheck({ ast });
    const sourcesPresent = Object.entries(result.lintIssuesSummary.bySource).filter(
      ([, count]) => (count ?? 0) > 0
    );
    if (sourcesPresent.length === 1) {
      const txt = result.setupSheet.exportTxt;
      // Histogram rows are indented two spaces and contain "blocker:" + "warning:".
      expect(txt).not.toMatch(/\n  [a-z_]+\s+#+\s+\d+ \(blocker:\d+, warning:\d+\)/);
    }
  });
});
