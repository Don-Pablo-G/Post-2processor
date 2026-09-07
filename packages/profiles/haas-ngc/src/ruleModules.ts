import type { LintIssue, ProgramAst } from "@cnc/core";
import {
  attachRuleCodesFromDocs,
  createRuleRegistry,
  ruleModulesFromDocs,
  type RuleModule,
  type RuleRegistry
} from "@cnc/core";
import { lintHaasNgcMill } from "./ngcMillLint.js";
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
 * Remainder of Haas mill lint (modal / while-state / end hygiene). Still one
 * module today; individual haas.* ids are attached via rule docs for policy.
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

/** Full Haas registry: doc modules (for UI listing) + executable modules. */
export function buildHaasNgcRuleRegistry(): RuleRegistry {
  const docModules = ruleModulesFromDocs(haasNgcRuleDocs);
  const registry = createRuleRegistry([
    haasMillStateMachineModule,
    ...docModules.filter(
      (m) =>
        m.id !== "haas.machine-position-conflict-same-block" &&
        m.id !== "haas.coord-shift-conflict-same-block"
    ),
    haasSameBlockConflictsModule
  ]);
  return registry;
}

/** validateAst entry that emits stable codes for every matched rule doc. */
export function lintHaasNgcMillWithCodes(ast: ProgramAst): LintIssue[] {
  return attachRuleCodesFromDocs(lintHaasNgcMill(ast), haasNgcRuleDocs);
}
