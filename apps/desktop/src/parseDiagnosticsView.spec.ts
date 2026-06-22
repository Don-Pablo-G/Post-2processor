import { describe, expect, it } from "vitest";
import {
  DIAGNOSTICS_DEMO_PROGRAM,
  LINT_DEMO_PROGRAM,
  LINT_DEMO_PROGRAM_FANUC,
  LINT_DEMO_PROGRAM_HAAS_LEGACY,
  PARSE_DIAGNOSTICS_POLICY_PRESETS,
  applyDiagnosticsCap,
  applyParseDiagnosticsPolicyPreset,
  selectMatchingParseDiagnosticsPolicyPreset,
  buildAllFixesPayload,
  buildAllLintFixesPayload,
  buildDiagnosticsSummaryChip,
  buildFixLine,
  buildLintFixLine,
  buildLintIssuesSummaryChip,
  buildParseDiagBreachSeveritiesBriefField,
  buildParseDiagBreachesBriefField,
  buildParseDiagnosticsBreachContext,
  buildParseDiagnosticsPolicyBriefField,
  buildParseFixLine,
  formatLintIssuesSummaryChip,
  summarizeLintIssuesBySource,
  summarizeParseDiagBreachSeverities,
  compareDiagnostics,
  compareLintIssues,
  groupAndSortDiagnostics,
  groupLintIssuesBySource,
  parseParseDiagnosticsPolicyThresholds,
  resolveParseDiagnosticsPolicy,
  selectFirstBlockIndexByCode,
  selectLintDemoProgram,
  serializeParseDiagnosticsPolicy,
  severityRank,
  type LintIssueLike,
  type ParseDiagnosticLike,
  type ParseDiagnosticsPolicyBreachLike,
  type ParseDiagnosticsPolicyUiState
} from "./parseDiagnosticsView";

const baseDiag: ParseDiagnosticLike = {
  code: "UNMATCHED_BRACKET",
  severity: "warning",
  message: "Unmatched bracket in expression syntax.",
  blockIndex: 0
};

describe("severityRank", () => {
  it("ranks errors before warnings", () => {
    expect(severityRank("error")).toBeLessThan(severityRank("warning"));
  });
});

describe("compareDiagnostics", () => {
  it("orders by blockIndex first", () => {
    const a: ParseDiagnosticLike = { ...baseDiag, blockIndex: 5 };
    const b: ParseDiagnosticLike = { ...baseDiag, blockIndex: 2 };
    expect(compareDiagnostics(a, b)).toBeGreaterThan(0);
  });

  it("breaks ties with severity (errors first)", () => {
    const err: ParseDiagnosticLike = { ...baseDiag, severity: "error" };
    const warn: ParseDiagnosticLike = { ...baseDiag, severity: "warning" };
    expect(compareDiagnostics(err, warn)).toBeLessThan(0);
  });

  it("falls back to message for full determinism", () => {
    const earlier: ParseDiagnosticLike = { ...baseDiag, message: "alpha" };
    const later: ParseDiagnosticLike = { ...baseDiag, message: "beta" };
    expect(compareDiagnostics(earlier, later)).toBeLessThan(0);
  });
});

describe("groupAndSortDiagnostics", () => {
  it("groups by code, sorts groups by code, sorts items by block/severity", () => {
    const groups = groupAndSortDiagnostics([
      { ...baseDiag, code: "UNKNOWN_TOKEN", blockIndex: 3 },
      { ...baseDiag, code: "UNMATCHED_BRACKET", blockIndex: 1 },
      { ...baseDiag, code: "UNMATCHED_BRACKET", blockIndex: 0, severity: "error" },
      { ...baseDiag, code: "UNMATCHED_BRACKET", blockIndex: 0, severity: "warning" }
    ]);
    expect(groups.map(([code]) => code)).toEqual(["UNKNOWN_TOKEN", "UNMATCHED_BRACKET"]);
    const bracketItems = groups.find(([code]) => code === "UNMATCHED_BRACKET")![1];
    expect(bracketItems.map((d) => `${d.blockIndex}:${d.severity}`)).toEqual([
      "0:error",
      "0:warning",
      "1:warning"
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(groupAndSortDiagnostics([])).toEqual([]);
  });
});

describe("applyDiagnosticsCap", () => {
  const items = Array.from({ length: 30 }, (_, idx): ParseDiagnosticLike => ({
    ...baseDiag,
    blockIndex: idx
  }));

  it("returns full list when expanded", () => {
    const view = applyDiagnosticsCap(items, { cap: 10, expanded: true });
    expect(view.visible).toHaveLength(items.length);
    expect(view.truncated).toBe(false);
    expect(view.hiddenCount).toBe(0);
  });

  it("trims to cap when not expanded and reports hiddenCount", () => {
    const view = applyDiagnosticsCap(items, { cap: 10, expanded: false });
    expect(view.visible).toHaveLength(10);
    expect(view.truncated).toBe(true);
    expect(view.hiddenCount).toBe(20);
  });

  it("does not truncate when items <= cap", () => {
    const small = items.slice(0, 5);
    const view = applyDiagnosticsCap(small, { cap: 10, expanded: false });
    expect(view.visible).toHaveLength(5);
    expect(view.truncated).toBe(false);
  });
});

describe("buildParseFixLine", () => {
  it("includes replacement when provided", () => {
    expect(
      buildParseFixLine({
        code: "UNMATCHED_OPEN_PAREN",
        blockIndex: 4,
        fix: { title: "Close the comment with ')'", replacement: ")" }
      })
    ).toBe("PARSE FIX | code=UNMATCHED_OPEN_PAREN block=4 | Close the comment with ')' -> )");
  });

  it("omits replacement suffix when not provided", () => {
    expect(
      buildParseFixLine({
        code: "UNMATCHED_CLOSE_PAREN",
        blockIndex: 1,
        fix: { title: "Remove unmatched ')'" }
      })
    ).toBe("PARSE FIX | code=UNMATCHED_CLOSE_PAREN block=1 | Remove unmatched ')'");
  });
});

describe("buildAllFixesPayload", () => {
  it("collects fix lines across diagnostics in stable order", () => {
    const items: ParseDiagnosticLike[] = [
      {
        ...baseDiag,
        code: "UNMATCHED_BRACKET",
        blockIndex: 0,
        suggestedFixes: [{ title: "Add missing ']'", replacement: "]" }]
      },
      {
        ...baseDiag,
        code: "UNMATCHED_BRACKET",
        blockIndex: 1,
        suggestedFixes: [
          { title: "Remove extra ']'" },
          { title: "Manually balance brackets" }
        ]
      }
    ];
    const result = buildAllFixesPayload("UNMATCHED_BRACKET", items);
    expect(result.fixCount).toBe(3);
    expect(result.payload.split("\n")).toEqual([
      "PARSE FIX | code=UNMATCHED_BRACKET block=0 | Add missing ']' -> ]",
      "PARSE FIX | code=UNMATCHED_BRACKET block=1 | Remove extra ']'",
      "PARSE FIX | code=UNMATCHED_BRACKET block=1 | Manually balance brackets"
    ]);
  });

  it("returns zero count and empty payload when no fixes exist", () => {
    const items: ParseDiagnosticLike[] = [{ ...baseDiag, suggestedFixes: [] }];
    const result = buildAllFixesPayload("UNMATCHED_BRACKET", items);
    expect(result.fixCount).toBe(0);
    expect(result.payload).toBe("");
  });
});

describe("buildDiagnosticsSummaryChip", () => {
  it("emits an empty marker when there are no diagnostics", () => {
    const chip = buildDiagnosticsSummaryChip([]);
    expect(chip.total).toBe(0);
    expect(chip.topCodes).toEqual([]);
    expect(chip.text).toBe("parseDiagnostics: total=0");
    expect(chip.briefField).toBe("parseDiag=total=0");
  });

  it("uses the configured emptyText when provided", () => {
    const chip = buildDiagnosticsSummaryChip([], { emptyText: "diag: total=0" });
    expect(chip.text).toBe("diag: total=0");
  });

  it("ranks codes by count and tie-breaks alphabetically", () => {
    const groups = groupAndSortDiagnostics([
      { ...baseDiag, code: "ADDRESS_MISSING_VALUE", blockIndex: 0 },
      { ...baseDiag, code: "ADDRESS_MISSING_VALUE", blockIndex: 1 },
      { ...baseDiag, code: "UNKNOWN_TOKEN", blockIndex: 2 },
      { ...baseDiag, code: "UNMATCHED_OPEN_PAREN", blockIndex: 3 }
    ]);
    const chip = buildDiagnosticsSummaryChip(groups, { topLimit: 2 });
    expect(chip.total).toBe(4);
    expect(chip.topCodes).toEqual(["ADDRESS_MISSING_VALUE", "UNKNOWN_TOKEN"]);
    expect(chip.text).toBe("parseDiagnostics: total=4 | top=ADDRESS_MISSING_VALUE,UNKNOWN_TOKEN");
    expect(chip.briefField).toBe("parseDiag=total=4,top=ADDRESS_MISSING_VALUE,UNKNOWN_TOKEN");
  });

  it("respects a custom label prefix", () => {
    const groups = groupAndSortDiagnostics([
      { ...baseDiag, code: "UNKNOWN_TOKEN", blockIndex: 0 }
    ]);
    const chip = buildDiagnosticsSummaryChip(groups, { label: "diagnostyka parsera" });
    expect(chip.text).toBe("diagnostyka parsera: total=1 | top=UNKNOWN_TOKEN");
  });
});

describe("DIAGNOSTICS_DEMO_PROGRAM", () => {
  it("contains tokens that exercise the targeted diagnostic codes", () => {
    expect(DIAGNOSTICS_DEMO_PROGRAM).toContain("(DEMO");
    expect(DIAGNOSTICS_DEMO_PROGRAM).toMatch(/X Y1/);
    expect(DIAGNOSTICS_DEMO_PROGRAM).toContain("@@@");
    expect(DIAGNOSTICS_DEMO_PROGRAM).toContain("[#100+]");
  });
});

describe("buildFixLine generic shape", () => {
  it("formats PARSE FIX with code identifier", () => {
    expect(
      buildFixLine({
        kind: "PARSE FIX",
        identifierKey: "code",
        identifierValue: "ADDRESS_MISSING_VALUE",
        blockIndex: 0,
        fix: { title: "Add numeric value after X", replacement: "X0" }
      })
    ).toBe("PARSE FIX | code=ADDRESS_MISSING_VALUE block=0 | Add numeric value after X -> X0");
  });

  it("formats LINT FIX with source identifier", () => {
    expect(
      buildFixLine({
        kind: "LINT FIX",
        identifierKey: "source",
        identifierValue: "controller_grammar",
        blockIndex: 1,
        fix: { title: "Move N number to a separate block from the O header" }
      })
    ).toBe(
      "LINT FIX | source=controller_grammar block=1 | Move N number to a separate block from the O header"
    );
  });

  it("buildParseFixLine and buildLintFixLine remain consistent with buildFixLine", () => {
    const parseLine = buildParseFixLine({
      code: "UNKNOWN_TOKEN",
      blockIndex: 2,
      fix: { title: "Remove unknown token '@@@'" }
    });
    const lintLine = buildLintFixLine({
      source: "controller_grammar",
      blockIndex: 2,
      fix: { title: "Reorder arguments so I appears before J before K" }
    });
    expect(parseLine.startsWith("PARSE FIX | code=")).toBe(true);
    expect(lintLine.startsWith("LINT FIX | source=")).toBe(true);
  });
});

const baseLintIssue: LintIssueLike = {
  severity: "warning",
  message: "Block contains both N and O words.",
  blockIndex: 0,
  provenance: { source: "controller_grammar" }
};

describe("compareLintIssues", () => {
  it("orders by blockIndex first", () => {
    const a: LintIssueLike = { ...baseLintIssue, blockIndex: 4 };
    const b: LintIssueLike = { ...baseLintIssue, blockIndex: 1 };
    expect(compareLintIssues(a, b)).toBeGreaterThan(0);
  });

  it("breaks ties with severity (errors first) and then message", () => {
    const errA: LintIssueLike = { ...baseLintIssue, severity: "error", message: "alpha" };
    const errB: LintIssueLike = { ...baseLintIssue, severity: "error", message: "beta" };
    const warn: LintIssueLike = { ...baseLintIssue, severity: "warning", message: "alpha" };
    expect(compareLintIssues(errA, warn)).toBeLessThan(0);
    expect(compareLintIssues(errA, errB)).toBeLessThan(0);
  });
});

describe("groupLintIssuesBySource", () => {
  it("groups by provenance.source, sorts groups alphabetically and items deterministically", () => {
    const groups = groupLintIssuesBySource([
      {
        ...baseLintIssue,
        provenance: { source: "lexer" },
        blockIndex: 5,
        message: "Unmatched parenthesis."
      },
      {
        ...baseLintIssue,
        provenance: { source: "controller_grammar" },
        blockIndex: 2,
        message: "Duplicate X words in one block."
      },
      {
        ...baseLintIssue,
        provenance: { source: "controller_grammar" },
        blockIndex: 0,
        severity: "error",
        message: "Block contains both N and O words."
      }
    ]);
    expect(groups.map(([source]) => source)).toEqual(["controller_grammar", "lexer"]);
    const cg = groups.find(([s]) => s === "controller_grammar")![1];
    expect(cg.map((i) => `${i.blockIndex}:${i.severity}`)).toEqual(["0:error", "2:warning"]);
  });

  it("returns empty array for empty input", () => {
    expect(groupLintIssuesBySource([])).toEqual([]);
  });
});

describe("buildAllLintFixesPayload", () => {
  it("collects lint fixes across issues in stable order", () => {
    const items: LintIssueLike[] = [
      {
        ...baseLintIssue,
        blockIndex: 0,
        suggestedFixes: [
          { title: "Move N number to a separate block from the O header" }
        ]
      },
      {
        ...baseLintIssue,
        blockIndex: 1,
        suggestedFixes: [
          { title: "Split duplicate X words into two blocks; controller is last-value-wins" }
        ]
      }
    ];
    const result = buildAllLintFixesPayload("controller_grammar", items);
    expect(result.fixCount).toBe(2);
    expect(result.payload.split("\n")).toEqual([
      "LINT FIX | source=controller_grammar block=0 | Move N number to a separate block from the O header",
      "LINT FIX | source=controller_grammar block=1 | Split duplicate X words into two blocks; controller is last-value-wins"
    ]);
  });

  it("returns zero count and empty payload when no fixes exist", () => {
    const result = buildAllLintFixesPayload("controller_grammar", [
      { ...baseLintIssue, suggestedFixes: [] }
    ]);
    expect(result.fixCount).toBe(0);
    expect(result.payload).toBe("");
  });
});

const policyState = (overrides: Partial<ParseDiagnosticsPolicyUiState> = {}): ParseDiagnosticsPolicyUiState => ({
  enabled: true,
  severity: "warning",
  blockExport: false,
  thresholdsText: "",
  ...overrides
});

describe("parseParseDiagnosticsPolicyThresholds", () => {
  it("parses comma- and newline-separated entries case-insensitively", () => {
    const result = parseParseDiagnosticsPolicyThresholds(" total = 12, address_missing_value=3\nUNKNOWN_TOKEN=2");
    expect(result.thresholds).toEqual({
      TOTAL: 12,
      ADDRESS_MISSING_VALUE: 3,
      UNKNOWN_TOKEN: 2
    });
    expect(result.invalidEntries).toEqual([]);
  });

  it("collects invalid entries instead of throwing", () => {
    const result = parseParseDiagnosticsPolicyThresholds("BOGUS=4, TOTAL=-1, ADDRESS_MISSING_VALUE=2.5, OK=1");
    expect(result.thresholds).toEqual({});
    expect(result.invalidEntries.sort()).toEqual([
      "ADDRESS_MISSING_VALUE=2.5",
      "BOGUS=4",
      "OK=1",
      "TOTAL=-1"
    ]);
  });

  it("treats empty input as zero thresholds with no errors", () => {
    expect(parseParseDiagnosticsPolicyThresholds("")).toEqual({ thresholds: {}, invalidEntries: [] });
    expect(parseParseDiagnosticsPolicyThresholds("   \n  ")).toEqual({ thresholds: {}, invalidEntries: [] });
  });
});

describe("resolveParseDiagnosticsPolicy", () => {
  it("returns undefined policy when disabled regardless of thresholds", () => {
    const result = resolveParseDiagnosticsPolicy(policyState({ enabled: false, thresholdsText: "TOTAL=10" }));
    expect(result.policy).toBeUndefined();
    expect(result.invalidEntries).toEqual([]);
  });

  it("returns undefined policy when enabled but no valid thresholds parsed", () => {
    const result = resolveParseDiagnosticsPolicy(policyState({ thresholdsText: "BOGUS=4" }));
    expect(result.policy).toBeUndefined();
    expect(result.invalidEntries).toEqual(["BOGUS=4"]);
  });

  it("constructs the runJobCheck-shaped policy when valid thresholds exist", () => {
    const result = resolveParseDiagnosticsPolicy(
      policyState({ severity: "blocker", blockExport: true, thresholdsText: "TOTAL=10, ADDRESS_MISSING_VALUE=3" })
    );
    expect(result.policy).toEqual({
      severity: "blocker",
      blockExport: true,
      thresholds: { TOTAL: 10, ADDRESS_MISSING_VALUE: 3 }
    });
    expect(result.invalidEntries).toEqual([]);
  });
});

describe("serializeParseDiagnosticsPolicy", () => {
  it("returns disabled token when state is off", () => {
    expect(serializeParseDiagnosticsPolicy(policyState({ enabled: false }))).toBe("parseDiagPolicy=disabled");
  });

  it("emits stable canonical line with sorted thresholds when enabled", () => {
    expect(
      serializeParseDiagnosticsPolicy(
        policyState({ severity: "blocker", blockExport: true, thresholdsText: "ADDRESS_MISSING_VALUE=3, TOTAL=10" })
      )
    ).toBe(
      "parseDiagPolicy=enabled,severity=blocker,blockExport=true,thresholds=ADDRESS_MISSING_VALUE=3,TOTAL=10"
    );
  });

  it("emits thresholds=n/a when enabled but empty/invalid", () => {
    expect(
      serializeParseDiagnosticsPolicy(policyState({ thresholdsText: "BOGUS=4" }))
    ).toBe("parseDiagPolicy=enabled,severity=warning,blockExport=false,thresholds=n/a");
  });

  it("round-trips canonical thresholds back through parseParseDiagnosticsPolicyThresholds", () => {
    const state = policyState({
      severity: "blocker",
      blockExport: true,
      thresholdsText: "TOTAL=10, ADDRESS_MISSING_VALUE=3"
    });
    const serialized = serializeParseDiagnosticsPolicy(state);
    expect(serialized).toBe(
      "parseDiagPolicy=enabled,severity=blocker,blockExport=true,thresholds=ADDRESS_MISSING_VALUE=3,TOTAL=10"
    );
    const thresholdsPart = serialized.replace(/^.*thresholds=/, "");
    const reparsed = parseParseDiagnosticsPolicyThresholds(thresholdsPart);
    expect(reparsed.invalidEntries).toEqual([]);
    expect(reparsed.thresholds).toEqual({ ADDRESS_MISSING_VALUE: 3, TOTAL: 10 });
    expect(Object.keys(reparsed.thresholds).sort()).toEqual(["ADDRESS_MISSING_VALUE", "TOTAL"]);
  });
});

describe("buildLintIssuesSummaryChip", () => {
  it("emits an empty marker when no lint issues exist", () => {
    const chip = buildLintIssuesSummaryChip([]);
    expect(chip.total).toBe(0);
    expect(chip.topSources).toEqual([]);
    expect(chip.text).toBe("lintIssues: total=0");
    expect(chip.briefField).toBe("lintIssues=total=0");
  });

  it("ranks sources by count then alphabetically when populated", () => {
    const groups = groupLintIssuesBySource([
      { ...baseLintIssue, provenance: { source: "controller_grammar" } },
      { ...baseLintIssue, provenance: { source: "controller_grammar" }, blockIndex: 1 },
      { ...baseLintIssue, provenance: { source: "profile_lint" } },
      { ...baseLintIssue, provenance: { source: "lexer" } }
    ]);
    const chip = buildLintIssuesSummaryChip(groups, { topLimit: 2 });
    expect(chip.total).toBe(4);
    expect(chip.topSources).toEqual(["controller_grammar", "lexer"]);
    expect(chip.text).toBe("lintIssues: total=4 | top=controller_grammar,lexer");
    expect(chip.briefField).toBe("lintIssues=total=4,top=controller_grammar,lexer");
  });

  it("supports custom emptyText override", () => {
    const chip = buildLintIssuesSummaryChip([], { emptyText: "lint: brak" });
    expect(chip.text).toBe("lint: brak");
    expect(chip.briefField).toBe("lintIssues=total=0");
  });
});

describe("LINT_DEMO_PROGRAM", () => {
  it("contains tokens that exercise the targeted controller-grammar lint rules", () => {
    expect(LINT_DEMO_PROGRAM).toContain("(DEMO");
    expect(LINT_DEMO_PROGRAM).toMatch(/N10 O1000/);
    expect(LINT_DEMO_PROGRAM).toMatch(/X1\. X2\./);
    expect(LINT_DEMO_PROGRAM).toMatch(/G65 P9010 K4\. J2\. I3\./);
  });
});

describe("buildParseDiagnosticsPolicyBriefField", () => {
  it("returns inactive when policy is disabled or empty", () => {
    expect(buildParseDiagnosticsPolicyBriefField({ state: policyState({ enabled: false }) })).toBe(
      "parseDiagPolicy=inactive"
    );
    expect(buildParseDiagnosticsPolicyBriefField({ state: policyState({ thresholdsText: "" }) })).toBe(
      "parseDiagPolicy=inactive"
    );
  });

  it("returns active state when policy is enabled with thresholds", () => {
    expect(
      buildParseDiagnosticsPolicyBriefField({
        state: policyState({ severity: "blocker", blockExport: true, thresholdsText: "TOTAL=10" })
      })
    ).toBe("parseDiagPolicy=active,severity=blocker,blockExport=true,breached=none");
  });

  it("includes sorted breached codes when supplied", () => {
    expect(
      buildParseDiagnosticsPolicyBriefField({
        state: policyState({ thresholdsText: "TOTAL=10, ADDRESS_MISSING_VALUE=3" }),
        breaches: [
          { key: "TOTAL", observed: 12, threshold: 10 },
          { key: "ADDRESS_MISSING_VALUE", observed: 4, threshold: 3 }
        ]
      })
    ).toBe(
      "parseDiagPolicy=active,severity=warning,blockExport=false,breached=ADDRESS_MISSING_VALUE,TOTAL"
    );
  });
});

describe("selectFirstBlockIndexByCode", () => {
  it("returns empty record for undefined or empty input", () => {
    expect(selectFirstBlockIndexByCode(undefined)).toEqual({});
    expect(selectFirstBlockIndexByCode([])).toEqual({});
  });

  it("returns the smallest blockIndex per code", () => {
    const diagnostics: ParseDiagnosticLike[] = [
      { ...baseDiag, code: "ADDRESS_MISSING_VALUE", blockIndex: 3 },
      { ...baseDiag, code: "ADDRESS_MISSING_VALUE", blockIndex: 1 },
      { ...baseDiag, code: "ADDRESS_MISSING_VALUE", blockIndex: 5 },
      { ...baseDiag, code: "UNKNOWN_TOKEN", blockIndex: 2 },
      { ...baseDiag, code: "UNKNOWN_TOKEN", blockIndex: 0 }
    ];
    expect(selectFirstBlockIndexByCode(diagnostics)).toEqual({
      ADDRESS_MISSING_VALUE: 1,
      UNKNOWN_TOKEN: 0
    });
  });
});

describe("buildParseDiagnosticsBreachContext", () => {
  it("returns header-only payload when no breaches are supplied", () => {
    const result = buildParseDiagnosticsBreachContext([], "haas-ngc");
    expect(result.payload).toBe("controller=haas-ngc");
    expect(result.count).toBe(0);
    expect(result.severities).toBe("none");
  });

  it("emits a single TOTAL line without firstBlock for an aggregate breach", () => {
    const breaches: ParseDiagnosticsPolicyBreachLike[] = [
      { key: "TOTAL", observed: 12, threshold: 10, severity: "blocker" }
    ];
    const result = buildParseDiagnosticsBreachContext(breaches, "fanuc");
    expect(result.payload.split("\n")).toEqual([
      "parseDiagBreach: TOTAL=12>10 (blocker)",
      "controller=fanuc"
    ]);
    expect(result.count).toBe(1);
    expect(result.severities).toBe("blocker:1");
  });

  it("includes firstBlock for code-specific breaches and counts severities", () => {
    const breaches: ParseDiagnosticsPolicyBreachLike[] = [
      {
        key: "ADDRESS_MISSING_VALUE",
        observed: 4,
        threshold: 3,
        severity: "blocker",
        firstBlockIndex: 1
      },
      { key: "TOTAL", observed: 12, threshold: 10, severity: "warning" }
    ];
    const result = buildParseDiagnosticsBreachContext(breaches, "haas-ngc");
    expect(result.payload.split("\n")).toEqual([
      "parseDiagBreach: ADDRESS_MISSING_VALUE=4>3 (blocker) firstBlock=1",
      "parseDiagBreach: TOTAL=12>10 (warning)",
      "controller=haas-ngc"
    ]);
    expect(result.count).toBe(2);
    expect(result.severities).toBe("blocker:1,warning:1");
  });
});

describe("buildParseDiagBreachesBriefField", () => {
  it("returns parseDiagBreaches=none when no breaches occurred", () => {
    expect(buildParseDiagBreachesBriefField(undefined)).toBe("parseDiagBreaches=none");
    expect(buildParseDiagBreachesBriefField([])).toBe("parseDiagBreaches=none");
  });

  it("emits sorted observed/threshold pairs joined by commas", () => {
    const breaches: ParseDiagnosticsPolicyBreachLike[] = [
      { key: "TOTAL", observed: 12, threshold: 10, severity: "blocker" },
      {
        key: "ADDRESS_MISSING_VALUE",
        observed: 4,
        threshold: 3,
        severity: "blocker",
        firstBlockIndex: 1
      }
    ];
    expect(buildParseDiagBreachesBriefField(breaches)).toBe(
      "parseDiagBreaches=ADDRESS_MISSING_VALUE:4/3,TOTAL:12/10"
    );
  });
});

describe("summarizeParseDiagBreachSeverities", () => {
  it("returns zeros and a chip with total=0 for empty input", () => {
    const summary = summarizeParseDiagBreachSeverities(undefined);
    expect(summary).toEqual({
      total: 0,
      blockers: 0,
      warnings: 0,
      chip: "breaches: total=0 | blockers=0 | warnings=0"
    });
    expect(summarizeParseDiagBreachSeverities([])).toEqual(summary);
  });

  it("aggregates blockers-only breaches", () => {
    const breaches: ParseDiagnosticsPolicyBreachLike[] = [
      { key: "TOTAL", observed: 12, threshold: 10, severity: "blocker" },
      { key: "ADDRESS_MISSING_VALUE", observed: 4, threshold: 3, severity: "blocker" }
    ];
    expect(summarizeParseDiagBreachSeverities(breaches)).toEqual({
      total: 2,
      blockers: 2,
      warnings: 0,
      chip: "breaches: total=2 | blockers=2 | warnings=0"
    });
  });

  it("counts mixed severities", () => {
    const breaches: ParseDiagnosticsPolicyBreachLike[] = [
      { key: "TOTAL", observed: 12, threshold: 10, severity: "blocker" },
      { key: "ADDRESS_MISSING_VALUE", observed: 4, threshold: 3, severity: "warning" },
      { key: "UNKNOWN_TOKEN", observed: 5, threshold: 1, severity: "warning" }
    ];
    expect(summarizeParseDiagBreachSeverities(breaches)).toEqual({
      total: 3,
      blockers: 1,
      warnings: 2,
      chip: "breaches: total=3 | blockers=1 | warnings=2"
    });
  });
});

describe("summarizeLintIssuesBySource", () => {
  it("returns [] for empty / undefined summaries", () => {
    expect(summarizeLintIssuesBySource(undefined)).toEqual([]);
    expect(
      summarizeLintIssuesBySource({
        total: 0,
        blockers: 0,
        warnings: 0,
        bySource: {},
        topSources: []
      })
    ).toEqual([]);
  });

  it("orders by topSources first, then count desc, then canonical source order", () => {
    const ordered = summarizeLintIssuesBySource({
      total: 7,
      blockers: 0,
      warnings: 7,
      bySource: {
        controller_grammar: 3,
        common_lint: 1,
        profile_lint: 2,
        expression_parser: 1
      },
      topSources: ["controller_grammar", "profile_lint"]
    });
    expect(ordered).toEqual([
      ["controller_grammar", 3],
      ["profile_lint", 2],
      ["expression_parser", 1],
      ["common_lint", 1]
    ]);
  });

  it("filters out zero-count sources", () => {
    const ordered = summarizeLintIssuesBySource({
      total: 1,
      blockers: 0,
      warnings: 1,
      bySource: { controller_grammar: 0, common_lint: 1 },
      topSources: ["common_lint"]
    });
    expect(ordered).toEqual([["common_lint", 1]]);
  });
});

describe("formatLintIssuesSummaryChip", () => {
  it("returns the canonical zero-form line for undefined or empty summary", () => {
    expect(formatLintIssuesSummaryChip(undefined)).toBe(
      "lintIssues: total=0 | severities=blocker:0,warning:0 | top=n/a"
    );
    expect(
      formatLintIssuesSummaryChip({
        total: 0,
        blockers: 0,
        warnings: 0,
        bySource: {},
        topSources: []
      })
    ).toBe("lintIssues: total=0 | severities=blocker:0,warning:0 | top=n/a");
  });

  it("renders the canonical line with severities and top sources", () => {
    expect(
      formatLintIssuesSummaryChip({
        total: 4,
        blockers: 1,
        warnings: 3,
        bySource: { controller_grammar: 3, common_lint: 1 },
        topSources: ["controller_grammar", "common_lint"]
      })
    ).toBe(
      "lintIssues: total=4 | severities=blocker:1,warning:3 | top=controller_grammar,common_lint"
    );
  });

  it("uses n/a when bySource is non-empty but topSources is empty", () => {
    expect(
      formatLintIssuesSummaryChip({
        total: 0,
        blockers: 0,
        warnings: 0,
        bySource: {},
        topSources: []
      })
    ).toContain("top=n/a");
  });
});

describe("buildParseDiagBreachSeveritiesBriefField", () => {
  it("returns parseDiagBreachSeverities=none when there are no breaches", () => {
    expect(buildParseDiagBreachSeveritiesBriefField(undefined)).toBe(
      "parseDiagBreachSeverities=none"
    );
    expect(buildParseDiagBreachSeveritiesBriefField([])).toBe(
      "parseDiagBreachSeverities=none"
    );
  });

  it("emits stable blockers/warnings counts when breaches are present", () => {
    const breaches: ParseDiagnosticsPolicyBreachLike[] = [
      { key: "TOTAL", observed: 12, threshold: 10, severity: "blocker" },
      { key: "ADDRESS_MISSING_VALUE", observed: 4, threshold: 3, severity: "warning" }
    ];
    expect(buildParseDiagBreachSeveritiesBriefField(breaches)).toBe(
      "parseDiagBreachSeverities=blockers=1,warnings=1"
    );
  });
});

describe("selectLintDemoProgram", () => {
  it("returns the Fanuc demo for fanuc controllers", () => {
    expect(selectLintDemoProgram("fanuc")).toBe(LINT_DEMO_PROGRAM_FANUC);
  });

  it("returns the Haas legacy demo for haas-legacy controllers", () => {
    expect(selectLintDemoProgram("haas-legacy")).toBe(LINT_DEMO_PROGRAM_HAAS_LEGACY);
  });

  it("returns the shared lint demo for haas-ngc controllers", () => {
    expect(selectLintDemoProgram("haas-ngc")).toBe(LINT_DEMO_PROGRAM);
  });
});

describe("LINT_DEMO_PROGRAM_FANUC", () => {
  it("contains Fanuc-specific tokens that exercise duplicate-O envelope and N+O strict format rules", () => {
    expect(LINT_DEMO_PROGRAM_FANUC.startsWith("%")).toBe(true);
    expect(LINT_DEMO_PROGRAM_FANUC.endsWith("%")).toBe(true);
    expect(LINT_DEMO_PROGRAM_FANUC).toMatch(/N10 O1000/);
    expect(LINT_DEMO_PROGRAM_FANUC.match(/^O1000$/gm)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(LINT_DEMO_PROGRAM_FANUC).toMatch(/G0 X1\./);
  });
});

describe("LINT_DEMO_PROGRAM_HAAS_LEGACY", () => {
  it("contains legacy idioms that exercise Haas-classic lint paths", () => {
    expect(LINT_DEMO_PROGRAM_HAAS_LEGACY.startsWith("%")).toBe(true);
    expect(LINT_DEMO_PROGRAM_HAAS_LEGACY.endsWith("%")).toBe(true);
    expect(LINT_DEMO_PROGRAM_HAAS_LEGACY).toMatch(/M97 P10/);
    expect(LINT_DEMO_PROGRAM_HAAS_LEGACY).toMatch(/M88/);
    expect(LINT_DEMO_PROGRAM_HAAS_LEGACY).toMatch(/M89/);
    expect(LINT_DEMO_PROGRAM_HAAS_LEGACY).toMatch(/G187 P3 E0\.0005/);
    expect(LINT_DEMO_PROGRAM_HAAS_LEGACY).toMatch(/X1\.\s/);
  });

  it("differs from the shared and Fanuc demo programs", () => {
    expect(LINT_DEMO_PROGRAM_HAAS_LEGACY).not.toBe(LINT_DEMO_PROGRAM);
    expect(LINT_DEMO_PROGRAM_HAAS_LEGACY).not.toBe(LINT_DEMO_PROGRAM_FANUC);
  });
});

describe("applyParseDiagnosticsPolicyPreset", () => {
  it("exposes the canonical preset list", () => {
    expect([...PARSE_DIAGNOSTICS_POLICY_PRESETS]).toEqual(["strict", "balanced", "permissive"]);
  });

  it("returns strict shape for the strict preset", () => {
    expect(applyParseDiagnosticsPolicyPreset("strict")).toEqual({
      enabled: true,
      severity: "blocker",
      blockExport: true,
      thresholdsText: "TOTAL=0"
    });
  });

  it("returns balanced shape for the balanced preset", () => {
    expect(applyParseDiagnosticsPolicyPreset("balanced")).toEqual({
      enabled: true,
      severity: "warning",
      blockExport: false,
      thresholdsText: "TOTAL=10"
    });
  });

  it("returns permissive shape for the permissive preset", () => {
    expect(applyParseDiagnosticsPolicyPreset("permissive")).toEqual({
      enabled: false,
      severity: "warning",
      blockExport: false,
      thresholdsText: ""
    });
  });
});

describe("selectMatchingParseDiagnosticsPolicyPreset", () => {
  it("returns 'strict' for the canonical strict shape", () => {
    expect(
      selectMatchingParseDiagnosticsPolicyPreset(applyParseDiagnosticsPolicyPreset("strict"))
    ).toBe("strict");
  });

  it("returns 'balanced' for the canonical balanced shape", () => {
    expect(
      selectMatchingParseDiagnosticsPolicyPreset(applyParseDiagnosticsPolicyPreset("balanced"))
    ).toBe("balanced");
  });

  it("returns 'permissive' whenever the policy is disabled", () => {
    expect(
      selectMatchingParseDiagnosticsPolicyPreset(applyParseDiagnosticsPolicyPreset("permissive"))
    ).toBe("permissive");
    expect(
      selectMatchingParseDiagnosticsPolicyPreset({
        enabled: false,
        severity: "blocker",
        blockExport: true,
        thresholdsText: "TOTAL=0"
      })
    ).toBe("permissive");
  });

  it("tolerates whitespace and trailing commas in thresholdsText for canonical matches", () => {
    expect(
      selectMatchingParseDiagnosticsPolicyPreset({
        enabled: true,
        severity: "blocker",
        blockExport: true,
        thresholdsText: "  TOTAL = 0 ,"
      })
    ).toBe("strict");
  });

  it("returns 'custom' when severity matches strict but blockExport differs", () => {
    expect(
      selectMatchingParseDiagnosticsPolicyPreset({
        enabled: true,
        severity: "blocker",
        blockExport: false,
        thresholdsText: "TOTAL=0"
      })
    ).toBe("custom");
  });

  it("returns 'custom' when extra threshold keys are added", () => {
    expect(
      selectMatchingParseDiagnosticsPolicyPreset({
        enabled: true,
        severity: "blocker",
        blockExport: true,
        thresholdsText: "TOTAL=0,UNMATCHED_BRACKET=0"
      })
    ).toBe("custom");
  });

  it("returns 'custom' when the threshold value differs", () => {
    expect(
      selectMatchingParseDiagnosticsPolicyPreset({
        enabled: true,
        severity: "warning",
        blockExport: false,
        thresholdsText: "TOTAL=5"
      })
    ).toBe("custom");
  });

  it("returns 'custom' when invalid threshold entries are present", () => {
    expect(
      selectMatchingParseDiagnosticsPolicyPreset({
        enabled: true,
        severity: "blocker",
        blockExport: true,
        thresholdsText: "TOTAL=0,bogus"
      })
    ).toBe("custom");
  });
});
