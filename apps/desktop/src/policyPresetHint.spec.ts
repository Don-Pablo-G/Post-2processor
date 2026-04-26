import { describe, expect, it } from "vitest";
import { buildTimelineFindingsExportBundle } from "@cnc/core/browser";
import { defaultPolicyPresetForController, resolvePolicyPresetHintState } from "./policyPresetHint";

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
