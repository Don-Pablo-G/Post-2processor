import { describe, expect, it } from "vitest";
import { buildTimelineFindingsExportBundle } from "@cnc/core/browser";
import {
  addPolicyPresetContextToSetupSheetBundle,
  defaultPolicyPresetForController,
  derivePolicyDriftWarning,
  derivePolicyPresetActionState,
  derivePolicyUiEventEmissionDecision,
  derivePolicyPresetVisualState,
  resolvePolicyPresetHintState,
  resolvePolicyPresetShortcutAction
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
