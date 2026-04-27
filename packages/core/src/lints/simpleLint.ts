import type { LintIssue, ProgramAst } from "../types.js";

function stripLintComments(raw: string): string {
  return raw.replace(/\([^)]*\)/g, "").replace(/;.*$/gim, "").trim();
}

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
    const code = stripLintComments(block.raw).toUpperCase();
    if (/\bG\s*0\b/.test(code) && /\bG\s*1\b/.test(code)) {
      issues.push({
        severity: "warning",
        message: "Block mixes G0 and G1 in one line; verify motion mode intent.",
        blockIndex: index
      });
    }
  });

  return issues;
}
