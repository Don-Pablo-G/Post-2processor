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
    expect(result.simulationFindings.some((f) => f.code === "SIM_MAIN_M99")).toBe(true);
    expect(result.blockerCount).toBeGreaterThan(0);
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

  it("adds simulation finding for loop max-iteration limit warning", async () => {
    const input = "WHILE [1 EQ 1] DO1\n#100=#100+1\nEND1\nM30";
    const ast = parse(input, haasNgcProfile);
    const result = await runJobCheck({
      ast,
      simulationLimits: { controllerMode: "haas-ngc", maxLoopIterations: 2 },
      exportOptions: { enabled: false, baseDirectory: ".", baseName: "control_flow_loop_limit_job" }
    });
    expect(result.simulation.warnings.some((w) => w.includes("exceeded maxLoopIterations"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_CONTROL_FLOW_LOOP_LIMIT")).toBe(true);
  });

  it("adds one loop-limit finding per loop-limit warning", async () => {
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
  });

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
    expect(result.simulation.warnings.some((w) => w.includes("maxSteps limit before program end"))).toBe(true);
    expect(result.simulationFindings.some((f) => f.code === "SIM_MAX_STEPS_LIMIT")).toBe(true);
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

  it("warns G41 without D", () => {
    const ast = parse("G41 X1.\nM30", haasNgcProfilePackaged);
    expect(lint(ast, haasNgcProfilePackaged).some((i) => i.message.includes("G41/G42 without D"))).toBe(true);
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
