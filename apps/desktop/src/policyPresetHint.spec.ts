import { describe, expect, it } from "vitest";
import { resolvePolicyPresetHintState } from "./policyPresetHint";

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
