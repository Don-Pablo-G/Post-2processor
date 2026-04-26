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

export type PolicyPresetShortcutAction = "none" | "revert_to_default" | "save_and_run";
export type PolicyPresetVisualState = {
  showHelpTooltipIcon: boolean;
  highlightManualSource: boolean;
};
export type PolicyUiEventEmissionDecision = {
  emit: boolean;
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

export function resolvePolicyPresetShortcutAction(input: {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  isTypingContext: boolean;
  hasUnsavedOverride: boolean;
}): PolicyPresetShortcutAction {
  if (!(input.ctrlKey && input.shiftKey) || input.isTypingContext) return "none";
  const key = input.key.toLowerCase();
  if (key === "r") return "revert_to_default";
  if (key === "j" && input.hasUnsavedOverride) return "save_and_run";
  return "none";
}

export function derivePolicyDriftWarning(input: {
  previousController?: ControllerProfileKey;
  nextController: ControllerProfileKey;
  manuallySet: boolean;
  warningPrefix: string;
}): string {
  if (!input.previousController || input.previousController === input.nextController || !input.manuallySet) return "";
  return `${input.warningPrefix}: ${input.previousController} -> ${input.nextController}`;
}

export function derivePolicyPresetVisualState(state: PolicyPresetHintState): PolicyPresetVisualState {
  return {
    showHelpTooltipIcon: true,
    highlightManualSource: state.source === "manual"
  };
}

export function derivePolicyUiEventEmissionDecision(enabled: boolean): PolicyUiEventEmissionDecision {
  return { emit: enabled };
}
