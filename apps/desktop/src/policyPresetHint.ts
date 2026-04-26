export type JobCheckPolicyPreset = "strict" | "balanced" | "permissive";
export type ControllerProfileKey = "haas-ngc" | "haas-legacy" | "fanuc";

export type PolicyPresetHintState = {
  persistedPreset?: JobCheckPolicyPreset;
  currentPreset: JobCheckPolicyPreset;
  isPersistedActive: boolean;
  hasUnsavedOverride: boolean;
  source: "saved" | "bootstrap" | "manual";
};

export type PolicyPresetActionState = {
  showSaveActions: boolean;
  canSaveAndRun: boolean;
  canRevertToControllerDefault: boolean;
};

export function resolvePolicyPresetHintState(input: {
  persistedPreset?: JobCheckPolicyPreset;
  currentPreset: JobCheckPolicyPreset;
  manuallySet?: boolean;
}): PolicyPresetHintState {
  const isPersistedActive = input.persistedPreset !== undefined && input.persistedPreset === input.currentPreset;
  const hasUnsavedOverride = input.persistedPreset !== undefined && input.persistedPreset !== input.currentPreset;
  const source: PolicyPresetHintState["source"] =
    input.manuallySet ? "manual" : input.persistedPreset !== undefined ? "saved" : "bootstrap";
  return {
    persistedPreset: input.persistedPreset,
    currentPreset: input.currentPreset,
    isPersistedActive,
    hasUnsavedOverride,
    source
  };
}

export function defaultPolicyPresetForController(profile: ControllerProfileKey): JobCheckPolicyPreset {
  // Fanuc defaults to strict on first use; Haas modes stay balanced.
  return profile === "fanuc" ? "strict" : "balanced";
}

export function derivePolicyPresetActionState(state: PolicyPresetHintState): PolicyPresetActionState {
  return {
    showSaveActions: state.hasUnsavedOverride,
    canSaveAndRun: state.hasUnsavedOverride,
    canRevertToControllerDefault: state.source !== "bootstrap"
  };
}
