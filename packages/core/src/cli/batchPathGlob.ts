/**
 * Browser-safe glob helpers for batch input-dir / folder walks.
 * No `node:` imports — shared by CLI and desktop.
 */

export const BATCH_INPUT_EXTENSIONS = /\.(nc|tap|gcode)$/i;

export function compileGlobToRegExp(pattern: string): RegExp {
  let body = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === "*") {
      if (pattern[i + 1] === "*") {
        // "**/" matches zero or more directory segments; bare "**" matches anything
        if (pattern[i + 2] === "/") {
          body += "(?:.*/)?";
          i += 2;
        } else {
          body += ".*";
          i += 1;
        }
      } else {
        body += "[^/]*";
      }
      continue;
    }
    if (ch === "?") {
      body += "[^/]";
      continue;
    }
    if (ch === "[") {
      const close = pattern.indexOf("]", i + 1);
      if (close > i) {
        body += pattern.slice(i, close + 1);
        i = close;
        continue;
      }
    }
    if (/[\\^$+(){}|.]/.test(ch)) {
      body += "\\" + ch;
      continue;
    }
    body += ch;
  }
  return new RegExp(`^${body}$`);
}

export function matchesAnyGlob(relativePath: string, patterns: ReadonlyArray<string>): boolean {
  for (const pattern of patterns) {
    if (compileGlobToRegExp(pattern).test(relativePath)) return true;
  }
  return false;
}

export type BatchPathClassify = "matched" | "skipped" | "ignored";

/**
 * Classify a forward-slash relative path under a batch root for the
 * extension/glob floor used by `summary.batchWalk`.
 *
 * - `matched` — will be processed
 * - `skipped` — looked like a batch candidate (extension or include hit)
 *   but failed exclude / include / non-recursive depth
 * - `ignored` — not a batch candidate (e.g. `.txt`)
 */
export function classifyBatchRelativePath(
  relativePath: string,
  options: {
    recursive: boolean;
    include?: ReadonlyArray<string>;
    exclude?: ReadonlyArray<string>;
  }
): BatchPathClassify {
  const normalized = relativePath.split(/\\/).join("/");
  const base = normalized.split("/").pop() ?? normalized;
  const nested = normalized.includes("/");

  if (!options.recursive && nested) {
    const hasInclude = options.include && options.include.length > 0;
    const looksLikeCandidate =
      BATCH_INPUT_EXTENSIONS.test(base) ||
      (hasInclude && matchesAnyGlob(normalized, options.include!));
    return looksLikeCandidate ? "skipped" : "ignored";
  }

  const hasInclude = options.include && options.include.length > 0;
  const hasExclude = options.exclude && options.exclude.length > 0;

  if (hasExclude && matchesAnyGlob(normalized, options.exclude!)) {
    const looksLikeCandidate =
      BATCH_INPUT_EXTENSIONS.test(base) ||
      (hasInclude && matchesAnyGlob(normalized, options.include!));
    return looksLikeCandidate ? "skipped" : "ignored";
  }

  if (hasInclude) {
    if (matchesAnyGlob(normalized, options.include!)) return "matched";
    return BATCH_INPUT_EXTENSIONS.test(base) ? "skipped" : "ignored";
  }

  if (BATCH_INPUT_EXTENSIONS.test(base)) return "matched";
  return "ignored";
}
