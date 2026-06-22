import { describe, expect, it } from "vitest";
import { buildTimelineFindingsExportBundle } from "@cnc/core/browser";
import {
  AUDIT_TRAIL_PERSIST_LIMIT,
  addPolicyPresetContextToSetupSheetBundle,
  buildPolicyUiEventPayload,
  classifyPolicyAuditTrailEntry,
  defaultPolicyPresetForController,
  derivePolicyDriftWarning,
  derivePolicyPresetActionState,
  derivePolicyUiEventEmissionDecision,
  derivePolicyPresetVisualState,
  filterPolicyAuditTrailByCategory,
  formatPolicyAuditTrailFilteredPayload,
  formatPolicyAuditTrailPayload,
  formatPolicyAuditTrailRow,
  hydrateAuditEntriesFromTemplate,
  isParseOrLintAuditEvent,
  resolvePolicyPresetHintState,
  resolvePolicyPresetShortcutAction,
  selectPersistableAuditEntries,
  selectPolicyAuditTrailExportPayload,
  summarizePolicyAuditTrail,
  type PolicyAuditTrailEntry
} from "./policyPresetHint";

describe("resolvePolicyPresetHintState", () => {
  it("marks persisted preset as active when current matches saved", () => {
    const state = resolvePolicyPresetHintState({
      persistedPreset: "strict",
      currentPreset: "strict"
    });
    expect(state.isPersistedActive).toBe(true);
    expect(state.hasUnsavedOverride).toBe(false);
    expect(state.source).toBe("saved");
  });

  it("marks unsaved override when current differs from saved preset", () => {
    const state = resolvePolicyPresetHintState({
      persistedPreset: "balanced",
      currentPreset: "permissive"
    });
    expect(state.isPersistedActive).toBe(false);
    expect(state.hasUnsavedOverride).toBe(true);
    expect(state.source).toBe("saved");
  });

  it("marks source as bootstrap when no persisted default exists", () => {
    const state = resolvePolicyPresetHintState({
      currentPreset: "balanced"
    });
    expect(state.source).toBe("bootstrap");
  });

  it("marks source as manual when user changes preset in-session", () => {
    const state = resolvePolicyPresetHintState({
      persistedPreset: "balanced",
      currentPreset: "strict",
      manuallySet: true
    });
    expect(state.source).toBe("manual");
  });
});

describe("defaultPolicyPresetForController", () => {
  it("defaults fanuc to strict", () => {
    expect(defaultPolicyPresetForController("fanuc")).toBe("strict");
  });

  it("defaults haas-ngc to balanced", () => {
    expect(defaultPolicyPresetForController("haas-ngc")).toBe("balanced");
  });

  it("defaults haas-legacy to balanced", () => {
    expect(defaultPolicyPresetForController("haas-legacy")).toBe("balanced");
  });
});

describe("export metadata uses resolved preset source", () => {
  it("writes saved source to bundle headers", () => {
    const state = resolvePolicyPresetHintState({
      persistedPreset: "strict",
      currentPreset: "strict"
    });
    const bundle = buildTimelineFindingsExportBundle({
      timestampIso: "2026-04-26T00:00:00.000Z",
      controller: "fanuc",
      policyPreset: state.currentPreset,
      policyPresetSource: state.source,
      timelineEntries: [],
      findings: []
    });
    expect(bundle.timelineTxt).toContain("policyPresetSource: saved");
  });

  it("writes bootstrap source to bundle headers", () => {
    const state = resolvePolicyPresetHintState({
      currentPreset: "balanced"
    });
    const bundle = buildTimelineFindingsExportBundle({
      timestampIso: "2026-04-26T00:00:00.000Z",
      controller: "haas-ngc",
      policyPreset: state.currentPreset,
      policyPresetSource: state.source,
      timelineEntries: [],
      findings: []
    });
    expect(bundle.timelineTxt).toContain("policyPresetSource: bootstrap");
  });

  it("writes manual source to bundle headers", () => {
    const state = resolvePolicyPresetHintState({
      persistedPreset: "balanced",
      currentPreset: "permissive",
      manuallySet: true
    });
    const bundle = buildTimelineFindingsExportBundle({
      timestampIso: "2026-04-26T00:00:00.000Z",
      controller: "haas-ngc",
      policyPreset: state.currentPreset,
      policyPresetSource: state.source,
      timelineEntries: [],
      findings: []
    });
    expect(bundle.timelineTxt).toContain("policyPresetSource: manual");
  });
});

describe("derivePolicyPresetActionState", () => {
  it("shows save actions and allows save+run for manual unsaved override", () => {
    const hintState = resolvePolicyPresetHintState({
      persistedPreset: "balanced",
      currentPreset: "strict",
      manuallySet: true
    });
    const actionState = derivePolicyPresetActionState(hintState);
    expect(actionState.showSaveActions).toBe(true);
    expect(actionState.canSaveAndRun).toBe(true);
    expect(actionState.canRevertToControllerDefault).toBe(true);
  });

  it("hides save actions when persisted default is already active", () => {
    const hintState = resolvePolicyPresetHintState({
      persistedPreset: "balanced",
      currentPreset: "balanced"
    });
    const actionState = derivePolicyPresetActionState(hintState);
    expect(actionState.showSaveActions).toBe(false);
    expect(actionState.canSaveAndRun).toBe(false);
    expect(actionState.canRevertToControllerDefault).toBe(true);
  });

  it("disables revert when source is controller bootstrap", () => {
    const hintState = resolvePolicyPresetHintState({
      currentPreset: "balanced"
    });
    const actionState = derivePolicyPresetActionState(hintState);
    expect(actionState.showSaveActions).toBe(false);
    expect(actionState.canSaveAndRun).toBe(false);
    expect(actionState.canRevertToControllerDefault).toBe(false);
  });
});

describe("resolvePolicyPresetShortcutAction", () => {
  it("returns revert action for Ctrl+Shift+R outside typing context", () => {
    expect(
      resolvePolicyPresetShortcutAction({
        key: "R",
        ctrlKey: true,
        shiftKey: true,
        isTypingContext: false
      })
    ).toBe("revert_to_default");
  });

  it("returns save-and-run for Ctrl+Shift+J outside typing context", () => {
    expect(
      resolvePolicyPresetShortcutAction({
        key: "j",
        ctrlKey: true,
        shiftKey: true,
        isTypingContext: false
      })
    ).toBe("save_and_run");
    expect(
      resolvePolicyPresetShortcutAction({
        key: "j",
        ctrlKey: true,
        shiftKey: true,
        isTypingContext: true
      })
    ).toBe("none");
  });

  it("returns none while typing or without modifier combo", () => {
    expect(
      resolvePolicyPresetShortcutAction({
        key: "r",
        ctrlKey: true,
        shiftKey: true,
        isTypingContext: true
      })
    ).toBe("none");
    expect(
      resolvePolicyPresetShortcutAction({
        key: "r",
        ctrlKey: true,
        shiftKey: false,
        isTypingContext: false
      })
    ).toBe("none");
  });
});

describe("derivePolicyDriftWarning", () => {
  it("builds warning when controller changes during manual mode", () => {
    expect(
      derivePolicyDriftWarning({
        previousController: "haas-ngc",
        nextController: "fanuc",
        manuallySet: true,
        warningPrefix: "Warning"
      })
    ).toBe("Warning: haas-ngc -> fanuc");
  });

  it("returns empty when controller unchanged or manual mode off", () => {
    expect(
      derivePolicyDriftWarning({
        previousController: "fanuc",
        nextController: "fanuc",
        manuallySet: true,
        warningPrefix: "Warning"
      })
    ).toBe("");
    expect(
      derivePolicyDriftWarning({
        previousController: "haas-ngc",
        nextController: "fanuc",
        manuallySet: false,
        warningPrefix: "Warning"
      })
    ).toBe("");
  });
});

describe("derivePolicyPresetVisualState", () => {
  it("always keeps tooltip icon visible", () => {
    const saved = resolvePolicyPresetHintState({ persistedPreset: "balanced", currentPreset: "balanced" });
    const bootstrap = resolvePolicyPresetHintState({ currentPreset: "balanced" });
    expect(derivePolicyPresetVisualState(saved).showHelpTooltipIcon).toBe(true);
    expect(derivePolicyPresetVisualState(bootstrap).showHelpTooltipIcon).toBe(true);
  });

  it("highlights source badge only for manual source", () => {
    const manual = resolvePolicyPresetHintState({
      persistedPreset: "balanced",
      currentPreset: "strict",
      manuallySet: true
    });
    const saved = resolvePolicyPresetHintState({
      persistedPreset: "balanced",
      currentPreset: "balanced"
    });
    expect(derivePolicyPresetVisualState(manual).highlightManualSource).toBe(true);
    expect(derivePolicyPresetVisualState(saved).highlightManualSource).toBe(false);
  });
});

describe("derivePolicyUiEventEmissionDecision", () => {
  it("emits when toggle is enabled", () => {
    expect(derivePolicyUiEventEmissionDecision(true).emit).toBe(true);
  });

  it("does not emit when toggle is disabled", () => {
    expect(derivePolicyUiEventEmissionDecision(false).emit).toBe(false);
  });
});

describe("buildPolicyUiEventPayload", () => {
  const detail = {
    controller: "haas-ngc" as const,
    preset: "strict" as const,
    source: "manual" as const
  };
  const ts = "2026-05-01T18:00:00.000Z";

  it("emits schemaVersion 1 when no extras are supplied", () => {
    const payload = buildPolicyUiEventPayload({
      event: "manual_selection_changed",
      detail,
      timestampIso: ts
    });
    expect(payload.schemaVersion).toBe(1);
    expect(payload).toEqual({
      schemaVersion: 1,
      event: "manual_selection_changed",
      controller: "haas-ngc",
      preset: "strict",
      source: "manual",
      timestampIso: ts
    });
    expect("extras" in payload).toBe(false);
  });

  it("emits schemaVersion 1 when extras object is empty", () => {
    const payload = buildPolicyUiEventPayload({
      event: "saved_to_template",
      detail,
      timestampIso: ts,
      extras: {}
    });
    expect(payload.schemaVersion).toBe(1);
    expect("extras" in payload).toBe(false);
  });

  it("emits schemaVersion 2 when parse-fix extras are present", () => {
    const payload = buildPolicyUiEventPayload({
      event: "parse_fix_copied",
      detail,
      timestampIso: ts,
      extras: { code: "ADDRESS_MISSING_VALUE", blockIndex: 0, fixCount: 1 }
    });
    expect(payload.schemaVersion).toBe(2);
    if (payload.schemaVersion === 2) {
      expect(payload.extras).toEqual({
        code: "ADDRESS_MISSING_VALUE",
        blockIndex: 0,
        fixCount: 1
      });
      expect(payload.event).toBe("parse_fix_copied");
      expect(payload.timestampIso).toBe(ts);
    }
  });

  it("emits schemaVersion 2 with only the extras that are defined", () => {
    const payload = buildPolicyUiEventPayload({
      event: "parse_fix_group_copied",
      detail,
      timestampIso: ts,
      extras: { code: "UNKNOWN_TOKEN", fixCount: 4 }
    });
    expect(payload.schemaVersion).toBe(2);
    if (payload.schemaVersion === 2) {
      expect(payload.extras).toEqual({ code: "UNKNOWN_TOKEN", fixCount: 4 });
      expect("blockIndex" in payload.extras).toBe(false);
    }
  });

  it("emits schemaVersion 2 when only blockIndex is supplied", () => {
    const payload = buildPolicyUiEventPayload({
      event: "parse_fix_group_expanded",
      detail,
      timestampIso: ts,
      extras: { blockIndex: 2 }
    });
    expect(payload.schemaVersion).toBe(2);
    if (payload.schemaVersion === 2) {
      expect(payload.extras).toEqual({ blockIndex: 2 });
    }
  });

  it("rides the v2 envelope for lint_fix_copied with provenance source as code", () => {
    const payload = buildPolicyUiEventPayload({
      event: "lint_fix_copied",
      detail,
      timestampIso: ts,
      extras: { code: "controller_grammar", blockIndex: 0, fixCount: 1 }
    });
    expect(payload.schemaVersion).toBe(2);
    if (payload.schemaVersion === 2) {
      expect(payload.event).toBe("lint_fix_copied");
      expect(payload.extras).toEqual({
        code: "controller_grammar",
        blockIndex: 0,
        fixCount: 1
      });
    }
  });

  it("rides the v2 envelope for lint_fix_group_copied with aggregate fixCount", () => {
    const payload = buildPolicyUiEventPayload({
      event: "lint_fix_group_copied",
      detail,
      timestampIso: ts,
      extras: { code: "controller_grammar", fixCount: 3 }
    });
    expect(payload.schemaVersion).toBe(2);
    if (payload.schemaVersion === 2) {
      expect(payload.event).toBe("lint_fix_group_copied");
      expect(payload.extras).toEqual({ code: "controller_grammar", fixCount: 3 });
      expect("blockIndex" in payload.extras).toBe(false);
    }
  });

  it("rides the v2 envelope for parse_breach_copied with count + severities", () => {
    const payload = buildPolicyUiEventPayload({
      event: "parse_breach_copied",
      detail,
      timestampIso: ts,
      extras: { count: 2, severities: "blocker:1,warning:1" }
    });
    expect(payload.schemaVersion).toBe(2);
    if (payload.schemaVersion === 2) {
      expect(payload.event).toBe("parse_breach_copied");
      expect(payload.extras).toEqual({ count: 2, severities: "blocker:1,warning:1" });
    }
  });
});

describe("formatPolicyAuditTrailRow", () => {
  it("formats a row without extras using the v1-shape line", () => {
    expect(
      formatPolicyAuditTrailRow({
        timestampIso: "2026-05-01T18:00:00.000Z",
        event: "manual_selection_changed",
        preset: "strict",
        source: "manual",
        controller: "haas-ngc"
      })
    ).toBe(
      "AUDIT | 2026-05-01T18:00:00.000Z | event=manual_selection_changed preset=strict source=manual controller=haas-ngc"
    );
  });

  it("appends extras in stable order (code, block, fix)", () => {
    expect(
      formatPolicyAuditTrailRow({
        timestampIso: "2026-05-01T18:00:00.000Z",
        event: "parse_fix_copied",
        preset: "balanced",
        source: "saved",
        controller: "fanuc",
        code: "ADDRESS_MISSING_VALUE",
        blockIndex: 2,
        fixCount: 1
      })
    ).toBe(
      "AUDIT | 2026-05-01T18:00:00.000Z | event=parse_fix_copied preset=balanced source=saved controller=fanuc | code=ADDRESS_MISSING_VALUE | block=2 | fix=1"
    );
  });

  it("only emits the extras that are defined", () => {
    expect(
      formatPolicyAuditTrailRow({
        timestampIso: "2026-05-01T18:00:00.000Z",
        event: "parse_fix_group_copied",
        preset: "balanced",
        source: "manual",
        controller: "haas-ngc",
        code: "UNKNOWN_TOKEN",
        fixCount: 4
      })
    ).toBe(
      "AUDIT | 2026-05-01T18:00:00.000Z | event=parse_fix_group_copied preset=balanced source=manual controller=haas-ngc | code=UNKNOWN_TOKEN | fix=4"
    );
  });

  it("appends count and severities for parse_breach_copied entries", () => {
    expect(
      formatPolicyAuditTrailRow({
        timestampIso: "2026-05-01T18:00:00.000Z",
        event: "parse_breach_copied",
        preset: "strict",
        source: "manual",
        controller: "haas-ngc",
        count: 2,
        severities: "blocker:1,warning:1"
      })
    ).toBe(
      "AUDIT | 2026-05-01T18:00:00.000Z | event=parse_breach_copied preset=strict source=manual controller=haas-ngc | count=2 | severities=blocker:1,warning:1"
    );
  });
});

describe("formatPolicyAuditTrailPayload", () => {
  it("returns empty payload and rowCount=0 for empty input", () => {
    expect(formatPolicyAuditTrailPayload([])).toEqual({ payload: "", rowCount: 0 });
  });

  it("joins rows with newlines and respects limit", () => {
    const entries = Array.from({ length: 5 }, (_, idx) => ({
      timestampIso: `2026-05-01T18:00:0${idx}.000Z`,
      event: `evt_${idx}`,
      preset: "balanced" as const,
      source: "manual" as const,
      controller: "haas-ngc" as const
    }));
    const result = formatPolicyAuditTrailPayload(entries, { limit: 3 });
    expect(result.rowCount).toBe(3);
    expect(result.payload.split("\n")).toHaveLength(3);
    expect(result.payload).toContain("event=evt_0");
    expect(result.payload).toContain("event=evt_2");
    expect(result.payload).not.toContain("event=evt_3");
  });
});

describe("formatPolicyAuditTrailFilteredPayload + isParseOrLintAuditEvent", () => {
  const mixedEntries = [
    {
      timestampIso: "2026-05-01T18:00:00.000Z",
      event: "manual_selection_changed",
      preset: "strict" as const,
      source: "manual" as const,
      controller: "haas-ngc" as const
    },
    {
      timestampIso: "2026-05-01T18:00:01.000Z",
      event: "parse_fix_copied",
      preset: "strict" as const,
      source: "manual" as const,
      controller: "haas-ngc" as const,
      code: "ADDRESS_MISSING_VALUE",
      blockIndex: 1,
      fixCount: 1
    },
    {
      timestampIso: "2026-05-01T18:00:02.000Z",
      event: "lint_fix_copied",
      preset: "strict" as const,
      source: "manual" as const,
      controller: "haas-ngc" as const,
      code: "controller_grammar",
      fixCount: 1
    },
    {
      timestampIso: "2026-05-01T18:00:03.000Z",
      event: "policy_audit_trail_copied",
      preset: "strict" as const,
      source: "manual" as const,
      controller: "haas-ngc" as const,
      fixCount: 4
    }
  ];

  it("returns empty payload + rowCount=0 when nothing matches the predicate", () => {
    expect(
      formatPolicyAuditTrailFilteredPayload(mixedEntries, () => false)
    ).toEqual({ payload: "", rowCount: 0 });
  });

  it("keeps only parse_*/lint_* rows via isParseOrLintAuditEvent", () => {
    const result = formatPolicyAuditTrailFilteredPayload(
      mixedEntries,
      isParseOrLintAuditEvent
    );
    expect(result.rowCount).toBe(2);
    const lines = result.payload.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("event=parse_fix_copied");
    expect(lines[1]).toContain("event=lint_fix_copied");
    expect(result.payload).not.toContain("event=manual_selection_changed");
    expect(result.payload).not.toContain("event=policy_audit_trail_copied");
  });

  it("respects limit after filtering", () => {
    const trio = [
      ...mixedEntries,
      {
        timestampIso: "2026-05-01T18:00:04.000Z",
        event: "parse_breach_copied",
        preset: "strict" as const,
        source: "manual" as const,
        controller: "haas-ngc" as const,
        count: 2,
        severities: "blocker:2"
      }
    ];
    const result = formatPolicyAuditTrailFilteredPayload(
      trio,
      isParseOrLintAuditEvent,
      { limit: 2 }
    );
    expect(result.rowCount).toBe(2);
  });
});

describe("addPolicyPresetContextToSetupSheetBundle", () => {
  it("adds policy context header block to txt/printable outputs", () => {
    const result = addPolicyPresetContextToSetupSheetBundle(
      { printable80mm: "BASE_PRINT", exportTxt: "BASE_TXT", exportMarkdown: "BASE_MD" },
      "strict",
      "manual",
      "fanuc"
    );
    expect(result.printable80mm).toContain("=== POLICY CONTEXT ===");
    expect(result.printable80mm).toContain("policyPreset: strict");
    expect(result.printable80mm).toContain("policyPresetSource: manual");
    expect(result.printable80mm).toContain("controller: fanuc");
    expect(result.exportTxt).toContain("=== POLICY CONTEXT ===");
    expect(result.exportTxt).toContain("policyPreset: strict");
  });

  it("adds markdown policy context section with expected fields", () => {
    const result = addPolicyPresetContextToSetupSheetBundle(
      { printable80mm: "P", exportTxt: "T", exportMarkdown: "BASE_MD" },
      "balanced",
      "bootstrap",
      "haas-ngc"
    );
    expect(result.exportMarkdown).toContain("### Policy Context");
    expect(result.exportMarkdown).toContain("- Policy preset: `balanced`");
    expect(result.exportMarkdown).toContain("- Policy preset source: `bootstrap`");
    expect(result.exportMarkdown).toContain("- Controller: `haas-ngc`");
  });
});

describe("selectPersistableAuditEntries + hydrateAuditEntriesFromTemplate", () => {
  const baseEntry = (overrides: Partial<PolicyAuditTrailEntry> = {}): PolicyAuditTrailEntry => ({
    timestampIso: "2026-05-01T18:00:00.000Z",
    event: "saved_to_template",
    preset: "balanced",
    source: "saved",
    controller: "haas-ngc",
    ...overrides
  });

  it("exposes a 10-entry persistence cap by default", () => {
    expect(AUDIT_TRAIL_PERSIST_LIMIT).toBe(10);
  });

  it("caps persistable entries at the configured limit", () => {
    const entries = Array.from({ length: 15 }, (_, idx) =>
      baseEntry({
        timestampIso: `2026-05-01T18:00:${idx.toString().padStart(2, "0")}.000Z`,
        event: `event_${idx}`
      })
    );
    expect(selectPersistableAuditEntries(entries)).toHaveLength(10);
    expect(selectPersistableAuditEntries(entries, 3)).toHaveLength(3);
  });

  it("preserves newest-first ordering and copies extras", () => {
    const entries = [
      baseEntry({ event: "parse_breach_copied", count: 2, severities: "blocker:2" }),
      baseEntry({ event: "lint_demo_loaded", code: "override=fanuc" })
    ];
    const persisted = selectPersistableAuditEntries(entries);
    expect(persisted[0].event).toBe("parse_breach_copied");
    expect(persisted[0].count).toBe(2);
    expect(persisted[0].severities).toBe("blocker:2");
    expect(persisted[1].code).toBe("override=fanuc");
  });

  it("treats negative or zero limits as empty", () => {
    expect(selectPersistableAuditEntries([baseEntry()], 0)).toEqual([]);
    expect(selectPersistableAuditEntries([baseEntry()], -1)).toEqual([]);
  });

  it("hydrates valid auditTrailRecent arrays from parsed templates", () => {
    const parsed = {
      settings: {
        auditTrailRecent: [
          baseEntry({ event: "parse_diag_policy_preset_applied", code: "preset:strict" }),
          baseEntry({ event: "fixture_prefs_reset_aborted", code: "haas-ngc" })
        ]
      }
    };
    const hydrated = hydrateAuditEntriesFromTemplate(parsed);
    expect(hydrated).toHaveLength(2);
    expect(hydrated[0].event).toBe("parse_diag_policy_preset_applied");
    expect(hydrated[0].code).toBe("preset:strict");
  });

  it("returns an empty array when auditTrailRecent is missing or non-array", () => {
    expect(hydrateAuditEntriesFromTemplate({})).toEqual([]);
    expect(hydrateAuditEntriesFromTemplate({ settings: {} })).toEqual([]);
    expect(
      hydrateAuditEntriesFromTemplate({ settings: { auditTrailRecent: "not-an-array" } })
    ).toEqual([]);
    expect(hydrateAuditEntriesFromTemplate(null)).toEqual([]);
  });

  it("filters out invalid audit entries during hydration", () => {
    const parsed = {
      settings: {
        auditTrailRecent: [
          baseEntry(),
          { timestampIso: "x" },
          baseEntry({ preset: "invalid" as unknown as PolicyAuditTrailEntry["preset"] }),
          baseEntry({ event: "lint_demo_loaded" })
        ]
      }
    };
    const hydrated = hydrateAuditEntriesFromTemplate(parsed);
    expect(hydrated).toHaveLength(2);
    expect(hydrated.map((e) => e.event)).toEqual(["saved_to_template", "lint_demo_loaded"]);
  });

  it("respects the limit parameter when hydrating", () => {
    const entries = Array.from({ length: 12 }, (_, idx) =>
      baseEntry({ event: `event_${idx}` })
    );
    expect(
      hydrateAuditEntriesFromTemplate({ settings: { auditTrailRecent: entries } }, 5)
    ).toHaveLength(5);
  });
});

describe("summarizePolicyAuditTrail + classifyPolicyAuditTrailEntry + filterPolicyAuditTrailByCategory", () => {
  function entry(
    overrides: Partial<PolicyAuditTrailEntry & { hydratedFromTemplate?: boolean }> = {}
  ): PolicyAuditTrailEntry & { hydratedFromTemplate?: boolean } {
    return {
      timestampIso: "2026-05-01T00:00:00.000Z",
      event: "saved_to_template",
      preset: "strict",
      source: "saved",
      controller: "haas-ngc",
      ...overrides
    };
  }

  it("counts total/hydrated/parseLint/resetEvents accurately", () => {
    const entries = [
      entry({ hydratedFromTemplate: true, event: "policy_saved" }),
      entry({ event: "parse_breach_copied" }),
      entry({ event: "lint_demo_loaded" }),
      entry({ event: "ui_defaults_reset_confirmed" }),
      entry({ event: "fixture_prefs_reset_aborted" }),
      entry({ event: "saved_to_template" })
    ];
    const summary = summarizePolicyAuditTrail(entries);
    expect(summary.total).toBe(6);
    expect(summary.hydrated).toBe(1);
    expect(summary.parseLint).toBe(2);
    expect(summary.resetEvents).toBe(2);
  });

  it("classifies parse_/lint_ entries as parse_lint", () => {
    expect(classifyPolicyAuditTrailEntry(entry({ event: "parse_fix_copied" }))).toBe("parse_lint");
    expect(classifyPolicyAuditTrailEntry(entry({ event: "lint_demo_loaded" }))).toBe("parse_lint");
  });

  it("classifies any 'reset' event as reset", () => {
    expect(
      classifyPolicyAuditTrailEntry(entry({ event: "ui_defaults_reset_confirmed" }))
    ).toBe("reset");
    expect(
      classifyPolicyAuditTrailEntry(entry({ event: "fixture_prefs_reset_aborted" }))
    ).toBe("reset");
  });

  it("falls back to 'policy' for unknown event names", () => {
    expect(classifyPolicyAuditTrailEntry(entry({ event: "saved_to_template" }))).toBe("policy");
    expect(
      classifyPolicyAuditTrailEntry(entry({ event: "policy_audit_trail_persisted" }))
    ).toBe("policy");
    expect(
      classifyPolicyAuditTrailEntry(entry({ event: "policy_audit_trail_cleared" }))
    ).toBe("policy");
    expect(classifyPolicyAuditTrailEntry(entry({ event: "totally_unknown_event" }))).toBe(
      "policy"
    );
  });

  it("filters by category and returns a copy for 'all'", () => {
    const entries = [
      entry({ event: "parse_fix_copied" }),
      entry({ event: "ui_defaults_reset_confirmed" }),
      entry({ event: "saved_to_template" })
    ];
    expect(filterPolicyAuditTrailByCategory(entries, "all")).toEqual(entries);
    expect(filterPolicyAuditTrailByCategory(entries, "parse_lint")).toHaveLength(1);
    expect(filterPolicyAuditTrailByCategory(entries, "reset")).toHaveLength(1);
    expect(filterPolicyAuditTrailByCategory(entries, "policy")).toHaveLength(1);
    expect(filterPolicyAuditTrailByCategory(entries, "policy")[0].event).toBe(
      "saved_to_template"
    );
  });
});

describe("selectPolicyAuditTrailExportPayload", () => {
  const entries: PolicyAuditTrailEntry[] = [
    {
      timestampIso: "2026-05-01T22:00:00.000Z",
      event: "parse_diag_policy_preset_applied",
      preset: "strict",
      source: "manual",
      controller: "haas-ngc",
      code: "TOTAL"
    },
    {
      timestampIso: "2026-05-01T22:01:00.000Z",
      event: "parse_breach_copied",
      preset: "strict",
      source: "manual",
      controller: "haas-ngc",
      count: 2,
      severities: "blocker:2"
    }
  ];

  it("text format matches the legacy formatPolicyAuditTrailPayload byte-for-byte", () => {
    const legacy = formatPolicyAuditTrailPayload(entries, { limit: 30 });
    const next = selectPolicyAuditTrailExportPayload(entries, { format: "text" });
    expect(next.payload).toBe(legacy.payload);
    expect(next.rowCount).toBe(legacy.rowCount);
  });

  it("markdown format renders a header row + body rows in canonical shape", () => {
    const result = selectPolicyAuditTrailExportPayload(entries, { format: "markdown" });
    const lines = result.payload.split("\n");
    expect(lines[0]).toBe("| Time | Event | Preset | Source | Controller | Extras |");
    expect(lines[1]).toBe("| --- | --- | --- | --- | --- | --- |");
    expect(lines[2]).toBe(
      "| 2026-05-01T22:00:00.000Z | parse_diag_policy_preset_applied | strict | manual | haas-ngc | code=TOTAL |"
    );
    expect(lines[3]).toBe(
      "| 2026-05-01T22:01:00.000Z | parse_breach_copied | strict | manual | haas-ngc | count=2 \\| severities=blocker:2 |"
    );
    expect(result.rowCount).toBe(2);
  });

  it("csv format renders header + escaped rows", () => {
    const result = selectPolicyAuditTrailExportPayload(entries, { format: "csv" });
    const lines = result.payload.split("\n");
    expect(lines[0]).toBe(
      "time,event,preset,source,controller,code,blockIndex,fixCount,count,severities"
    );
    expect(lines[1]).toBe(
      "2026-05-01T22:00:00.000Z,parse_diag_policy_preset_applied,strict,manual,haas-ngc,TOTAL,,,,"
    );
    expect(lines[2]).toBe(
      "2026-05-01T22:01:00.000Z,parse_breach_copied,strict,manual,haas-ngc,,,,2,blocker:2"
    );
    expect(result.rowCount).toBe(2);
  });

  it("escapes csv fields that contain commas, quotes, or newlines", () => {
    const tricky: PolicyAuditTrailEntry[] = [
      {
        timestampIso: "2026-05-01T22:00:00.000Z",
        event: "parse_breach_copied",
        preset: "strict",
        source: "manual",
        controller: "haas-ngc",
        severities: 'blocker:1, "warn":2'
      }
    ];
    const result = selectPolicyAuditTrailExportPayload(tricky, { format: "csv" });
    const rowLine = result.payload.split("\n")[1];
    expect(rowLine).toContain('"blocker:1, ""warn"":2"');
  });

  it("respects categoryFilter and applies it before slicing", () => {
    const result = selectPolicyAuditTrailExportPayload(entries, {
      format: "text",
      categoryFilter: "parse_lint"
    });
    expect(result.rowCount).toBe(2);
  });

  it("returns headers only for empty entries in markdown/csv formats", () => {
    const md = selectPolicyAuditTrailExportPayload([], { format: "markdown" });
    expect(md.payload).toBe(
      "| Time | Event | Preset | Source | Controller | Extras |\n| --- | --- | --- | --- | --- | --- |"
    );
    expect(md.rowCount).toBe(0);
    const csv = selectPolicyAuditTrailExportPayload([], { format: "csv" });
    expect(csv.payload).toBe(
      "time,event,preset,source,controller,code,blockIndex,fixCount,count,severities"
    );
    expect(csv.rowCount).toBe(0);
    const text = selectPolicyAuditTrailExportPayload([], { format: "text" });
    expect(text.payload).toBe("");
    expect(text.rowCount).toBe(0);
  });

  it("ndjson format emits one JSON-parseable line per entry with optional fields omitted when undefined", () => {
    const result = selectPolicyAuditTrailExportPayload(entries, { format: "ndjson" });
    const lines = result.payload.split("\n");
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    expect(first).toEqual({
      timestampIso: "2026-05-01T22:00:00.000Z",
      event: "parse_diag_policy_preset_applied",
      preset: "strict",
      source: "manual",
      controller: "haas-ngc",
      code: "TOTAL"
    });
    expect("blockIndex" in first).toBe(false);
    expect("fixCount" in first).toBe(false);
    expect("count" in first).toBe(false);
    expect("severities" in first).toBe(false);
    const second = JSON.parse(lines[1]);
    expect(second).toEqual({
      timestampIso: "2026-05-01T22:01:00.000Z",
      event: "parse_breach_copied",
      preset: "strict",
      source: "manual",
      controller: "haas-ngc",
      count: 2,
      severities: "blocker:2"
    });
    expect(result.rowCount).toBe(2);
  });

  it("ndjson format produces empty payload (no header) for empty input", () => {
    const result = selectPolicyAuditTrailExportPayload([], { format: "ndjson" });
    expect(result.payload).toBe("");
    expect(result.rowCount).toBe(0);
  });

  it("ndjson format round-trips special characters in severities", () => {
    const tricky: PolicyAuditTrailEntry[] = [
      {
        timestampIso: "2026-05-01T22:00:00.000Z",
        event: "parse_breach_copied",
        preset: "strict",
        source: "manual",
        controller: "haas-ngc",
        severities: 'blocker:1, "warn":2\nnewline'
      }
    ];
    const result = selectPolicyAuditTrailExportPayload(tricky, { format: "ndjson" });
    const lines = result.payload.split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.severities).toBe('blocker:1, "warn":2\nnewline');
  });
});
