import type { LintIssue, ProfileRuleDoc, ProgramAst, RulePolicy } from "../types.js";
import { applyRulePolicy, attachRuleCodesFromDocs } from "./rulePolicy.js";
import { runDeclarativeRules, type DeclarativeRuleDef } from "./declarativeRules.js";

/**
 * A registered lint rule module. Engines look up modules by id; packs register
 * them. Complex stateful checks stay as TypeScript modules; simple checks can
 * also be expressed as DeclarativeRuleDef entries in the registry.
 */
export type RuleModule = {
  id: string;
  /** Default when RulePolicy omits this id. */
  defaultEnabled?: boolean;
  severity?: LintIssue["severity"];
  summary?: string;
  /** Imperative checker. Prefer emitting `code: id` on each issue. */
  run?: (ast: ProgramAst) => LintIssue[];
  /** Optional docs contract (snippets / messageMatcher). */
  doc?: ProfileRuleDoc;
  /** Optional declarative definition (interpreted when `run` is absent). */
  declarative?: DeclarativeRuleDef;
};

export type RuleRegistry = {
  modules: Map<string, RuleModule>;
};

export function createRuleRegistry(modules: readonly RuleModule[] = []): RuleRegistry {
  const map = new Map<string, RuleModule>();
  for (const mod of modules) {
    map.set(mod.id, mod);
  }
  return { modules: map };
}

export function registerRuleModule(registry: RuleRegistry, mod: RuleModule): void {
  registry.modules.set(mod.id, mod);
}

export function listRuleModules(registry: RuleRegistry): RuleModule[] {
  return [...registry.modules.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Run all enabled modules in the registry. Applies RulePolicy after collection.
 */
export function runRuleRegistry(
  ast: ProgramAst,
  registry: RuleRegistry,
  options?: {
    rulePolicy?: RulePolicy;
    /** Extra declarative rules (e.g. UI-authored) not yet in the registry. */
    extraDeclarative?: readonly DeclarativeRuleDef[];
  }
): LintIssue[] {
  const issues: LintIssue[] = [];
  const docs: ProfileRuleDoc[] = [];

  for (const mod of registry.modules.values()) {
    const enabledByDefault = mod.defaultEnabled !== false;
    const policyEntry = options?.rulePolicy?.rules[mod.id];
    const enabled = policyEntry ? policyEntry.enabled : enabledByDefault;
    if (!enabled) continue;

    if (mod.doc) docs.push(mod.doc);

    if (mod.run) {
      for (const issue of mod.run(ast)) {
        issues.push({
          ...issue,
          code: issue.code ?? mod.id,
          severity: policyEntry?.severity ?? issue.severity
        });
      }
      continue;
    }

    if (mod.declarative) {
      issues.push(
        ...runDeclarativeRules(ast, [mod.declarative]).map((issue) => ({
          ...issue,
          severity: policyEntry?.severity ?? issue.severity
        }))
      );
    }
  }

  if (options?.extraDeclarative && options.extraDeclarative.length > 0) {
    issues.push(...runDeclarativeRules(ast, options.extraDeclarative));
  }

  const coded = docs.length > 0 ? attachRuleCodesFromDocs(issues, docs) : issues;
  return applyRulePolicy(coded, options?.rulePolicy);
}

/**
 * Build registry modules from ProfileRuleDoc entries that only have docs
 * (no run). Useful for UI listing; execution still goes through validateAst
 * until Slice F fully migrates each rule.
 */
export function ruleModulesFromDocs(docs: readonly ProfileRuleDoc[]): RuleModule[] {
  return docs.map((doc) => ({
    id: doc.id,
    severity: doc.severity,
    summary: doc.summary,
    doc,
    defaultEnabled: doc.deprecatedSince === undefined
  }));
}
