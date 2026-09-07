import type { LintIssue, ProgramAst, RulePolicy } from "@cnc/core";
import {
  applyRulePolicy,
  attachRuleCodesFromDocs,
  createRuleRegistry,
  ruleModulesFromDocs,
  type RuleModule,
  type RuleRegistry
} from "@cnc/core";
import { lintHaasNgcMill } from "./ngcMillLint.js";
import { lintHaasEndHygiene } from "./rules/endHygiene.js";
import { lintHaasOrphanWordWhile } from "./rules/orphanWordWhile.js";
import { haasNgcRuleDocs } from "./rules.meta.js";
import { collectSameBlockMatrixIssues } from "./sameBlockConflicts.js";

/**
 * Same-block conflict matrix as its own registered module (extracted from the
 * mill state-machine for registry-based enable/disable).
 */
export const haasSameBlockConflictsModule: RuleModule = {
  id: "haas.machine-position-conflict-same-block",
  summary: "Same-block machine-position / coord-shift conflict matrix.",
  defaultEnabled: true,
  run: (ast: ProgramAst): LintIssue[] => {
    const issues: LintIssue[] = [];
    ast.blocks.forEach((block, blockIndex) => {
      issues.push(
        ...collectSameBlockMatrixIssues(block, blockIndex).map((issue) => ({
          ...issue,
          code: issue.message.includes("Coordinate shift")
            ? "haas.coord-shift-conflict-same-block"
            : issue.message.includes("Machine positioning")
              ? "haas.machine-position-conflict-same-block"
              : issue.code
        }))
      );
    });
    return issues;
  }
};

/**
 * Orphan Q/R/P/IJK words while modal state is active.
 */
export const haasOrphanWordWhileModule: RuleModule = {
  id: "haas.orphan-word-while",
  summary: "Orphan Q/R/P/IJK words while cutter/canned/rotation/scaling/etc. still active.",
  defaultEnabled: true,
  run: (ast: ProgramAst): LintIssue[] => lintHaasOrphanWordWhile(ast)
};

/**
 * Program-end modal hygiene (cutter, G43, spindle, coolant, plane, …).
 */
export const haasEndHygieneModule: RuleModule = {
  id: "haas.end-hygiene",
  summary: "Program-end modal hygiene checks for Haas NGC mill programs.",
  defaultEnabled: true,
  run: (ast: ProgramAst): LintIssue[] => lintHaasEndHygiene(ast)
};

/**
 * Remainder of Haas mill lint (modal / while-state suite minus extracted
 * orphan-word and end-hygiene clusters). Individual haas.* ids are attached
 * via rule docs for policy.
 */
export const haasMillStateMachineModule: RuleModule = {
  id: "haas.mill-state-machine",
  summary: "Haas NGC mill modal/state-machine lint suite.",
  defaultEnabled: true,
  run: (ast: ProgramAst): LintIssue[] => {
    // Same-block matrix still runs inside lintHaasNgcMill for backward
    // compatibility; policy filters individual codes after attach.
    return attachRuleCodesFromDocs(lintHaasNgcMill(ast), haasNgcRuleDocs);
  }
};

const ORPHAN_AND_END_MODULE_IDS = new Set([
  "haas.orphan-word-while",
  "haas.end-hygiene",
  "haas.machine-position-conflict-same-block",
  "haas.coord-shift-conflict-same-block"
]);

/** Full Haas registry: doc modules (for UI listing) + executable modules. */
export function buildHaasNgcRuleRegistry(): RuleRegistry {
  const docModules = ruleModulesFromDocs(haasNgcRuleDocs);
  const registry = createRuleRegistry([
    haasMillStateMachineModule,
    haasOrphanWordWhileModule,
    haasEndHygieneModule,
    ...docModules.filter((m) => !ORPHAN_AND_END_MODULE_IDS.has(m.id)),
    haasSameBlockConflictsModule
  ]);
  return registry;
}

function disabledRuleIdsFromPolicy(rulePolicy: RulePolicy | undefined): Set<string> {
  const disabled = new Set<string>();
  if (!rulePolicy) return disabled;
  for (const [id, entry] of Object.entries(rulePolicy.rules)) {
    if (entry.enabled === false) disabled.add(id);
  }
  return disabled;
}

/** validateAst entry that emits stable codes for every matched rule doc. */
export function lintHaasNgcMillWithCodes(
  ast: ProgramAst,
  options?: { rulePolicy?: RulePolicy }
): LintIssue[] {
  const disabledRuleIds = disabledRuleIdsFromPolicy(options?.rulePolicy);
  const issues: LintIssue[] = [
    ...lintHaasNgcMill(ast),
    ...lintHaasOrphanWordWhile(ast, { disabledRuleIds }),
    ...lintHaasEndHygiene(ast, { disabledRuleIds })
  ];
  const coded = attachRuleCodesFromDocs(issues, haasNgcRuleDocs);
  return applyRulePolicy(coded, options?.rulePolicy);
}
