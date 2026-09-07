import type { DeclarativeRuleDef } from "../lints/declarativeRules.js";

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
