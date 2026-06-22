import type { LintIssue, LintIssueWithProvenance, ParseDiagnostic, ProgramAst } from "../types.js";

function sourceForIssue(issue: LintIssue): LintIssueWithProvenance["provenance"]["source"] {
  if (issue.message.includes("G65 block has I/J/K out of order")) return "controller_grammar";
  if (issue.message.includes("Invalid N/O numeric format")) return "controller_grammar";
  if (issue.message.includes("both N and O words")) return "controller_grammar";
  if (issue.message.includes("Duplicate O-number header")) return "controller_grammar";
  if (issue.message.includes("Fanuc program envelope")) return "controller_grammar";
  if (issue.message.includes("Duplicate ") && issue.message.includes("words in one block")) return "controller_grammar";
  if (
    issue.message.includes("bracket expression") ||
    issue.message.includes("Bracket expression") ||
    issue.message.includes("Unbalanced bracket")
  ) {
    return "expression_parser";
  }
  if (issue.message.includes("Unmatched parenthesis")) return "lexer";
  if (issue.message.includes("Block has no parseable words")) return "lexer";
  if (issue.message.includes("More than one M code")) return "common_lint";
  if (issue.message.includes("G20 and G21") || issue.message.includes("G90 and G91")) return "common_lint";
  if (issue.message.includes("mixes G") || issue.message.includes("repeats G")) return "common_lint";
  return "profile_lint";
}

function diagnosticsForIssue(issue: LintIssue, parseDiagnostics: ParseDiagnostic[]): ParseDiagnostic[] {
  const sameBlock = parseDiagnostics.filter((d) => d.blockIndex === issue.blockIndex);
  if (issue.message.includes("Unmatched parenthesis")) {
    return sameBlock.filter((d) => d.code === "UNMATCHED_OPEN_PAREN" || d.code === "UNMATCHED_CLOSE_PAREN");
  }
  if (issue.message.includes("Block has no parseable words")) {
    return sameBlock.filter((d) =>
      d.code === "ADDRESS_MISSING_VALUE" || d.code === "UNKNOWN_TOKEN" || d.code === "INVALID_CHARACTER"
    );
  }
  return [];
}

export function withLintProvenance(ast: ProgramAst, issues: LintIssue[]): LintIssueWithProvenance[] {
  const parseDiagnostics = ast.parseDiagnostics ?? [];
  return issues.map((issue) => {
    const related = diagnosticsForIssue(issue, parseDiagnostics);
    return {
      ...issue,
      provenance: {
        source: sourceForIssue(issue),
        relatedDiagnostics: related.map((d) => ({ code: d.code, span: d.span, suggestedFixes: d.suggestedFixes }))
      }
    };
  });
}
