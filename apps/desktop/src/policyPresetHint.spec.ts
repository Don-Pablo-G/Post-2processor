import { describe, expect, it } from "vitest";
import { defaultPolicyPresetForController, resolvePolicyPresetHintState } from "./policyPresetHint";

describe("resolvePolicyPresetHintState", () => {
  it("marks persisted preset as active when current matches saved", () => {
    const state = resolvePolicyPresetHintState({
      persistedPreset: "strict",
      currentPreset: "strict"
    });
    expect(state.isPersistedActive).toBe(true);
    expect(state.hasUnsavedOverride).toBe(false);
  });

  it("marks unsaved override when current differs from saved preset", () => {
    const state = resolvePolicyPresetHintState({
      persistedPreset: "balanced",
      currentPreset: "permissive"
    });
    expect(state.isPersistedActive).toBe(false);
    expect(state.hasUnsavedOverride).toBe(true);
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
