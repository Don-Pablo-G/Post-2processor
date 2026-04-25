import type { LintIssue, ProgramAst } from "../types.js";

export function simpleLint(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];

  ast.blocks.forEach((block, index) => {
    if (block.words.length === 0) {
      issues.push({
        severity: "warning",
        message: "Block has no parseable words.",
        blockIndex: index
      });
    }
  });

  return issues;
}
