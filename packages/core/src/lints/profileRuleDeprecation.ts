import type { LintIssue, ProfileRuleDoc } from "../types.js";

/**
 * Soft-suppress lint issues whose message matches a `ProfileRuleDoc` entry
 * marked with `deprecatedSince`. Used by the CLI `--no-deprecated-rules`
 * flag to let shops tighten CI without forking the profile pack.
 *
 * The match is intentionally lenient: a `ProfileRuleDoc` is considered to
 * "own" an issue when its `messageMatcher` (a substring or RegExp) matches
 * `issue.message`. Issues that match no doc are passed through unchanged
 * (i.e. unknown issues are NEVER suppressed — opt-in deprecation only
 * affects rules that explicitly declared themselves deprecated).
 *
 * Pure / deterministic — order-preserving. No I/O, no globals.
 */
export function filterDeprecatedProfileLintIssues(
  issues: readonly LintIssue[],
  ruleDocs: readonly ProfileRuleDoc[]
): LintIssue[] {
  const deprecatedDocs = ruleDocs.filter((doc) => doc.deprecatedSince !== undefined);
  if (deprecatedDocs.length === 0) {
    return issues.slice();
  }
  return issues.filter((issue) => !isDeprecatedIssue(issue, deprecatedDocs));
}

function isDeprecatedIssue(
  issue: LintIssue,
  deprecatedDocs: readonly ProfileRuleDoc[]
): boolean {
  for (const doc of deprecatedDocs) {
    // Reset lastIndex so a /g or /y flag from third-party docs can't leak
    // state across issues — semantics must stay "does this regex match
    // anywhere in the message?" not "next match after the previous call".
    doc.messageMatcher.lastIndex = 0;
    if (doc.messageMatcher.test(issue.message)) {
      return true;
    }
  }
  return false;
}
