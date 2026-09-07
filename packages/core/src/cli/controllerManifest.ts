import type { DeclarativeRuleDef } from "../lints/declarativeRules.js";
import type { RulePolicy } from "../lints/rulePolicy.js";
import type { ParseComplianceMode, ParseOptions, ProfileRuleDoc } from "../types.js";

/**
 * Controller pack manifest — source of truth for which rules / grammar /
 * parse compliance apply to a controller key. Stored as JSON beside packs
 * or embedded under `cnc-workbench.profilePack.manifest` in package.json.
 */
export type ControllerPackManifest = {
  controllerKey: string;
  name: string;
  /** Optional packs whose rules are inherited (first-wins on conflict). */
  extends?: string[];
  /**
   * Rule ids enabled for this controller. Entries may be bare ids or
   * `{ id, enabled }` objects. When omitted, the pack's validateAst /
   * rule-docs export defines the full set.
   *
   * When non-empty and at least one id is enabled, combined with `ruleDocs`
   * this becomes an allowlist: doc ids not listed as enabled are disabled.
   */
  rules?: Array<string | { id: string; enabled?: boolean }>;
  /** Grammar pack table ids (e.g. "haas-strict", "fanuc-strict"). */
  grammar?: string | string[];
  /** Default parse compliance mode for this controller. */
  parseCompliance?: "strict" | "lenient" | "strict_haas" | "strict_fanuc";
  /** Optional UI/JSON declarative rules owned by this pack. */
  declarativeRules?: DeclarativeRuleDef[];
};

export function parseControllerPackManifest(raw: unknown): ControllerPackManifest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Controller pack manifest must be an object.");
  }
  const m = raw as Record<string, unknown>;
  if (typeof m.controllerKey !== "string" || !m.controllerKey.trim()) {
    throw new Error("Controller pack manifest requires controllerKey.");
  }
  if (typeof m.name !== "string" || !m.name.trim()) {
    throw new Error("Controller pack manifest requires name.");
  }
  return raw as ControllerPackManifest;
}

export function grammarIdsFromManifest(manifest: ControllerPackManifest): string[] {
  if (!manifest.grammar) return [];
  return Array.isArray(manifest.grammar) ? [...manifest.grammar] : [manifest.grammar];
}

export function enabledRuleIdsFromManifest(manifest: ControllerPackManifest): {
  enabled: string[];
  disabled: string[];
} {
  const enabled: string[] = [];
  const disabled: string[] = [];
  for (const entry of manifest.rules ?? []) {
    if (typeof entry === "string") {
      enabled.push(entry);
      continue;
    }
    if (entry.enabled === false) disabled.push(entry.id);
    else enabled.push(entry.id);
  }
  return { enabled, disabled };
}

/**
 * Build parse options driven by a pack manifest (compliance + grammar packs).
 * Returns undefined when the manifest contributes nothing.
 */
export function parseOptionsFromManifest(
  manifest: ControllerPackManifest | undefined
): Pick<ParseOptions, "complianceMode" | "grammarPackIds"> | undefined {
  if (!manifest) return undefined;
  const grammarPackIds = grammarIdsFromManifest(manifest);
  const complianceMode = manifest.parseCompliance as ParseComplianceMode | undefined;
  if (!complianceMode && grammarPackIds.length === 0) return undefined;
  return {
    ...(complianceMode ? { complianceMode } : {}),
    ...(grammarPackIds.length > 0 ? { grammarPackIds } : {})
  };
}

/**
 * Convert manifest `rules` into a RulePolicy overlay.
 * When `rules` lists enabled ids and `ruleDocs` is provided, unlisted doc ids
 * are disabled (allowlist). Explicit `{ enabled: false }` always wins.
 */
export function rulePolicyFromManifest(
  manifest: ControllerPackManifest | undefined,
  ruleDocs?: readonly ProfileRuleDoc[]
): RulePolicy | undefined {
  if (!manifest) return undefined;
  const hasRulesField = Array.isArray(manifest.rules) && manifest.rules.length > 0;
  if (!hasRulesField) return undefined;

  const { enabled, disabled } = enabledRuleIdsFromManifest(manifest);
  const rules: RulePolicy["rules"] = {};

  if (enabled.length > 0 && ruleDocs && ruleDocs.length > 0) {
    const enabledSet = new Set(enabled);
    for (const doc of ruleDocs) {
      if (!enabledSet.has(doc.id)) {
        rules[doc.id] = { enabled: false };
      }
    }
  }
  for (const id of enabled) {
    rules[id] = { ...rules[id], enabled: true };
  }
  for (const id of disabled) {
    rules[id] = { ...rules[id], enabled: false };
  }
  return Object.keys(rules).length > 0 ? { rules } : undefined;
}
