import { describe, expect, it } from "vitest";

import {
  CG_DUPLICATE_ADDRESSES_PREFIX,
  type CliBatchControllerCodeAttribution,
  type CliBatchEnvelope,
  type CliJobCheckEnvelope,
  type LintIssue,
  type LintIssueWithProvenance
} from "@cnc/core";

import {
  deriveQuickFixBindings,
  expandIdeQuickFixTemplate,
  getQuickFixForLintIssue,
  mapBatchAttributionToFileQuickFixes,
  mapJobCheckEnvelopeToQuickFixes,
  type IdeQuickFix
} from "../src/index.js";

const baseLintIssue: LintIssue = {
  severity: "warning",
  message: "placeholder",
  blockIndex: 0
};

const baseProvenance: LintIssueWithProvenance["provenance"] = {
  source: "controller_grammar",
  relatedDiagnostics: []
};

function makeIssue(extra: Partial<LintIssueWithProvenance>): LintIssueWithProvenance {
  return {
    ...baseLintIssue,
    ...extra,
    provenance: { ...baseProvenance, ...(extra.provenance ?? {}) }
  };
}

function makeEnvelope(controllerLints: LintIssueWithProvenance[]): CliJobCheckEnvelope {
  return {
    schemaVersion: 7,
    readyToRunScore: 100,
    blockerCount: 0,
    warningCount: controllerLints.length,
    blocked: false,
    messages: [],
    parseDiagnosticsSummary: { total: 0, byCode: {} },
    parseDiagnosticsPolicyBreaches: [],
    lintIssuesSummary: {
      total: controllerLints.length,
      bySource: { controller_grammar: controllerLints.length } as never,
      topSources: ["controller_grammar"]
    } as never,
    lintIssuesBySource: [],
    parseDiagnosticsByCode: [],
    lintIssuesByParseDiagCode: [],
    lintIssuesByControllerCode: [],
    controllerLints,
    setupSheetExportTxt: "",
    proveoutCode: ""
  };
}

function makeAttribution(
  partial: Partial<CliBatchControllerCodeAttribution> & { input: string; code: string }
): CliBatchControllerCodeAttribution {
  return {
    source: "controller_grammar",
    count: 1,
    blockers: 0,
    warnings: 1,
    ...partial
  };
}

function makeBatchEnvelope(
  rows: CliBatchControllerCodeAttribution[]
): CliBatchEnvelope {
  return {
    schemaVersion: 7,
    results: [],
    summary: {
      files: 0,
      blocked: 0,
      lintIssuesByControllerCodePerInputFile: rows
    }
  };
}

describe("getQuickFixForLintIssue", () => {
  it("resolves an exact catalogue hit (CG_N_AND_O_MIXED) and inlines title + rationale + template", () => {
    const issue = makeIssue({ code: "CG_N_AND_O_MIXED" });
    const fix = getQuickFixForLintIssue(issue);
    expect(fix).toBeDefined();
    expect(fix?.code).toBe("CG_N_AND_O_MIXED");
    expect(fix?.title).toMatch(/separate block/i);
    expect(fix?.rationale).toMatch(/sequence numbers/i);
    expect(fix?.replacementTemplate).toBeDefined();
  });

  it("resolves the duplicate-address family by prefix (CG_DUPLICATE_ADDRESSES_X)", () => {
    const issue = makeIssue({ code: `${CG_DUPLICATE_ADDRESSES_PREFIX}X` });
    const fix = getQuickFixForLintIssue(issue);
    expect(fix).toBeDefined();
    // The IdeQuickFix.code mirrors the PER-LETTER code as actually
    // emitted by the rule, NOT the family wildcard catalogue key.
    expect(fix?.code).toBe(`${CG_DUPLICATE_ADDRESSES_PREFIX}X`);
    expect(fix?.title).toMatch(/duplicate/i);
  });

  it("resolves both _X and _Y to the same family entry (same title + rationale)", () => {
    const fixX = getQuickFixForLintIssue(
      makeIssue({ code: `${CG_DUPLICATE_ADDRESSES_PREFIX}X` })
    );
    const fixY = getQuickFixForLintIssue(
      makeIssue({ code: `${CG_DUPLICATE_ADDRESSES_PREFIX}Y` })
    );
    expect(fixX?.title).toBe(fixY?.title);
    expect(fixX?.rationale).toBe(fixY?.rationale);
    expect(fixX?.replacementTemplate).toBe(fixY?.replacementTemplate);
    expect(fixX?.code).not.toBe(fixY?.code);
  });

  it("returns undefined for a code that is not in the catalogue", () => {
    const issue = makeIssue({ code: "CG_DOES_NOT_EXIST" });
    expect(getQuickFixForLintIssue(issue)).toBeUndefined();
  });

  it("returns undefined for an issue without a code field", () => {
    const issue = makeIssue({});
    expect(getQuickFixForLintIssue(issue)).toBeUndefined();
  });

  it("returns undefined for an issue with an empty-string code", () => {
    const issue = makeIssue({ code: "" });
    expect(getQuickFixForLintIssue(issue)).toBeUndefined();
  });

  it("works with bare LintIssue instances (no provenance required)", () => {
    const bare: LintIssue = { ...baseLintIssue, code: "CG_DUPLICATE_O_HEADER" };
    const fix = getQuickFixForLintIssue(bare);
    expect(fix).toBeDefined();
    expect(fix?.code).toBe("CG_DUPLICATE_O_HEADER");
  });
});

describe("mapJobCheckEnvelopeToQuickFixes", () => {
  it("returns an IdeQuickFix for every controllerLint with a catalogue entry, in envelope order", () => {
    const envelope = makeEnvelope([
      makeIssue({ code: "CG_N_AND_O_MIXED" }),
      makeIssue({ code: "CG_DOES_NOT_EXIST" }),
      makeIssue({ code: `${CG_DUPLICATE_ADDRESSES_PREFIX}Z` }),
      makeIssue({}) // codeless: skipped
    ]);
    const fixes = mapJobCheckEnvelopeToQuickFixes(envelope);
    expect(fixes.map((f) => f.code)).toEqual([
      "CG_N_AND_O_MIXED",
      `${CG_DUPLICATE_ADDRESSES_PREFIX}Z`
    ]);
    expect(fixes.every((f: IdeQuickFix) => f.title.length > 0 && f.rationale.length > 0)).toBe(
      true
    );
  });

  it("returns an empty array when no controllerLint has a catalogue-resolvable code", () => {
    const envelope = makeEnvelope([
      makeIssue({ code: "CG_DOES_NOT_EXIST" }),
      makeIssue({})
    ]);
    expect(mapJobCheckEnvelopeToQuickFixes(envelope)).toEqual([]);
  });

  it("returns an empty array for an envelope with zero controllerLints", () => {
    expect(mapJobCheckEnvelopeToQuickFixes(makeEnvelope([]))).toEqual([]);
  });
});

describe("mapBatchAttributionToFileQuickFixes", () => {
  it("groups resolved fixes into a Map keyed by input path, preserving row order", () => {
    const envelope = makeBatchEnvelope([
      makeAttribution({ input: "a/prog1.nc", code: "CG_N_AND_O_MIXED" }),
      makeAttribution({ input: "a/prog1.nc", code: "CG_DUPLICATE_O_HEADER" }),
      makeAttribution({ input: "b/prog2.nc", code: `${CG_DUPLICATE_ADDRESSES_PREFIX}X` })
    ]);
    const grouped = mapBatchAttributionToFileQuickFixes(envelope);
    expect([...grouped.keys()]).toEqual(["a/prog1.nc", "b/prog2.nc"]);
    expect(grouped.get("a/prog1.nc")?.map((f: IdeQuickFix) => f.code)).toEqual([
      "CG_N_AND_O_MIXED",
      "CG_DUPLICATE_O_HEADER"
    ]);
    expect(grouped.get("b/prog2.nc")?.map((f: IdeQuickFix) => f.code)).toEqual([
      `${CG_DUPLICATE_ADDRESSES_PREFIX}X`
    ]);
  });

  it("inlines title + rationale on every emitted IdeQuickFix", () => {
    const grouped = mapBatchAttributionToFileQuickFixes(
      makeBatchEnvelope([
        makeAttribution({ input: "a.nc", code: "CG_N_AND_O_MIXED", count: 3, blockers: 1, warnings: 2 })
      ])
    );
    const fix = grouped.get("a.nc")?.[0];
    expect(fix).toBeDefined();
    expect(fix?.code).toBe("CG_N_AND_O_MIXED");
    expect(fix?.title).toMatch(/separate block/i);
    expect(fix?.rationale.length).toBeGreaterThan(0);
  });

  it("dedupes the same code reported under multiple sources for the same input (first wins)", () => {
    const envelope = makeBatchEnvelope([
      makeAttribution({
        input: "a.nc",
        code: "CG_N_AND_O_MIXED",
        source: "controller_grammar"
      }),
      makeAttribution({
        input: "a.nc",
        code: "CG_N_AND_O_MIXED",
        source: "profile_lint"
      })
    ]);
    const grouped = mapBatchAttributionToFileQuickFixes(envelope);
    expect(grouped.get("a.nc")?.length).toBe(1);
    expect(grouped.get("a.nc")?.[0].code).toBe("CG_N_AND_O_MIXED");
  });

  it("skips rows whose code is not in the catalogue without inserting empty arrays", () => {
    const envelope = makeBatchEnvelope([
      makeAttribution({ input: "a/prog1.nc", code: "CG_DOES_NOT_EXIST" }),
      makeAttribution({ input: "b/prog2.nc", code: "CG_N_AND_O_MIXED" })
    ]);
    const grouped = mapBatchAttributionToFileQuickFixes(envelope);
    expect([...grouped.keys()]).toEqual(["b/prog2.nc"]);
    expect(grouped.has("a/prog1.nc")).toBe(false);
  });

  it("returns an empty Map when there are no attribution rows at all", () => {
    expect(mapBatchAttributionToFileQuickFixes(makeBatchEnvelope([]))).toBeInstanceOf(Map);
    expect(mapBatchAttributionToFileQuickFixes(makeBatchEnvelope([])).size).toBe(0);
  });

  it("returns an empty Map when no attribution row has a catalogue-resolvable code", () => {
    const envelope = makeBatchEnvelope([
      makeAttribution({ input: "x.nc", code: "CG_DOES_NOT_EXIST" })
    ]);
    expect(mapBatchAttributionToFileQuickFixes(envelope).size).toBe(0);
  });
});

describe("expandIdeQuickFixTemplate", () => {
  it("substitutes a single {{NAME}} token from the binding map", () => {
    const fix: IdeQuickFix = {
      code: "CG_TEST",
      title: "t",
      rationale: "r",
      replacementTemplate: "G65 P{{PROG}}"
    };
    expect(expandIdeQuickFixTemplate(fix, { PROG: "9100" })).toBe("G65 P9100");
  });

  it("preserves an unbound {{NAME}} verbatim when only some bindings are supplied", () => {
    const fix: IdeQuickFix = {
      code: "CG_TEST",
      title: "t",
      rationale: "r",
      replacementTemplate: "G65 P{{PROG}} I{{I}} J{{J}}"
    };
    expect(expandIdeQuickFixTemplate(fix, { PROG: "9100", I: "1.0" })).toBe(
      "G65 P9100 I1.0 J{{J}}"
    );
  });

  it("replaces every occurrence when the same {{NAME}} appears multiple times", () => {
    const fix: IdeQuickFix = {
      code: "CG_TEST",
      title: "t",
      rationale: "r",
      replacementTemplate: "{{LETTER}}1 {{LETTER}}2 {{LETTER}}3"
    };
    expect(expandIdeQuickFixTemplate(fix, { LETTER: "X" })).toBe("X1 X2 X3");
  });

  it("returns undefined when the quick-fix has no replacementTemplate", () => {
    const fix: IdeQuickFix = { code: "CG_TEST", title: "t", rationale: "r" };
    expect(expandIdeQuickFixTemplate(fix, { LETTER: "X" })).toBeUndefined();
  });

  it("ignores unknown {{name}} tokens that don't match the [A-Z0-9_]+ grammar", () => {
    // lowercase is intentionally NOT a placeholder per the catalogue contract;
    // anything outside [A-Z0-9_] passes through unchanged so consumers can
    // safely include literal {{lowercase}} in arbitrary text.
    const fix: IdeQuickFix = {
      code: "CG_TEST",
      title: "t",
      rationale: "r",
      replacementTemplate: "{{LETTER}} kept-as-{{lowercase}}-literal"
    };
    expect(expandIdeQuickFixTemplate(fix, { LETTER: "X", lowercase: "should-be-ignored" })).toBe(
      "X kept-as-{{lowercase}}-literal"
    );
  });

  it("does not mutate the input fix object", () => {
    const fix: IdeQuickFix = {
      code: "CG_TEST",
      title: "t",
      rationale: "r",
      replacementTemplate: "{{LETTER}}"
    };
    const before = fix.replacementTemplate;
    expandIdeQuickFixTemplate(fix, { LETTER: "Z" });
    expect(fix.replacementTemplate).toBe(before);
  });
});

describe("deriveQuickFixBindings", () => {
  it("derives { LETTER: 'X' } from CG_DUPLICATE_ADDRESSES_X", () => {
    const issue = makeIssue({ code: `${CG_DUPLICATE_ADDRESSES_PREFIX}X` });
    expect(deriveQuickFixBindings(issue)).toEqual({ LETTER: "X" });
  });

  it("derives { LETTER: 'Y' } from CG_DUPLICATE_ADDRESSES_Y", () => {
    const issue = makeIssue({ code: `${CG_DUPLICATE_ADDRESSES_PREFIX}Y` });
    expect(deriveQuickFixBindings(issue)).toEqual({ LETTER: "Y" });
  });

  it("returns an empty object for a code outside the catalogue heuristic set", () => {
    const issue = makeIssue({ code: "CG_N_AND_O_MIXED" });
    expect(deriveQuickFixBindings(issue)).toEqual({});
  });

  it("returns an empty object for a codeless issue", () => {
    const issue = makeIssue({});
    expect(deriveQuickFixBindings(issue)).toEqual({});
  });

  it("returns an empty object for an empty-string code", () => {
    const issue = makeIssue({ code: "" });
    expect(deriveQuickFixBindings(issue)).toEqual({});
  });

  it("returns an empty object for the bare CG_DUPLICATE_ADDRESSES_ prefix without a letter suffix", () => {
    // The discovered code must carry exactly one letter — bare prefix is
    // never emitted today and would not yield a usable binding either.
    const issue = makeIssue({ code: CG_DUPLICATE_ADDRESSES_PREFIX });
    expect(deriveQuickFixBindings(issue)).toEqual({});
  });

  it("returns a frozen object so consumers can spread without mutating the heuristic", () => {
    const derived = deriveQuickFixBindings(
      makeIssue({ code: `${CG_DUPLICATE_ADDRESSES_PREFIX}X` })
    );
    expect(Object.isFrozen(derived)).toBe(true);
    const merged = { ...derived, EXTRA: "value" };
    expect(merged).toEqual({ LETTER: "X", EXTRA: "value" });
    expect(derived).toEqual({ LETTER: "X" }); // original untouched
  });

  it("end-to-end: CG_DUPLICATE_ADDRESSES_X expands the catalogue family template with LETTER=X", () => {
    const issue = makeIssue({ code: `${CG_DUPLICATE_ADDRESSES_PREFIX}X` });
    const fix = getQuickFixForLintIssue(issue);
    expect(fix).toBeDefined();
    const expanded = expandIdeQuickFixTemplate(fix!, deriveQuickFixBindings(issue));
    expect(expanded).toBeDefined();
    // Catalogue family template is "{{FIRST_BLOCK_WITH_LETTER}}\n{{SECOND_BLOCK_WITH_LETTER}}";
    // neither token is in the heuristic set, so both stay verbatim. The
    // {{LETTER}} binding is wired for templates that DO include it (the
    // catalogue's family template intentionally references the LETTER via
    // its block tokens — IDE hosts derive the per-letter snippet locally).
    expect(expanded).toContain("{{FIRST_BLOCK_WITH_LETTER}}");
    expect(expanded).toContain("{{SECOND_BLOCK_WITH_LETTER}}");
  });
});
