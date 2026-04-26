export type JobCheckPolicyPreset = "strict" | "balanced" | "permissive";
export type ControllerProfileKey = "haas-ngc" | "haas-legacy" | "fanuc";

export type PolicyPresetHintState = {
  persistedPreset?: JobCheckPolicyPreset;
  currentPreset: JobCheckPolicyPreset;
  isPersistedActive: boolean;
  hasUnsavedOverride: boolean;
};

export function resolvePolicyPresetHintState(input: {
  persistedPreset?: JobCheckPolicyPreset;
  currentPreset: JobCheckPolicyPreset;
}): PolicyPresetHintState {
  const isPersistedActive = input.persistedPreset !== undefined && input.persistedPreset === input.currentPreset;
  const hasUnsavedOverride = input.persistedPreset !== undefined && input.persistedPreset !== input.currentPreset;
  return {
    persistedPreset: input.persistedPreset,
    currentPreset: input.currentPreset,
    isPersistedActive,
    hasUnsavedOverride
  };
}

export function defaultPolicyPresetForController(profile: ControllerProfileKey): JobCheckPolicyPreset {
  // Fanuc defaults to strict on first use; Haas modes stay balanced.
  return profile === "fanuc" ? "strict" : "balanced";
}
