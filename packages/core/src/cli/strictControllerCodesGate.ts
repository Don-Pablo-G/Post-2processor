/**
 * Shared strict-controller-codes pattern matching for CLI and desktop.
 */

export function matchesAnyStrictControllerCodePattern(
  code: string,
  patterns: readonly string[]
): boolean {
  for (const pat of patterns) {
    if (pat.endsWith("*")) {
      const prefix = pat.slice(0, -1);
      if (code.startsWith(prefix)) return true;
    } else if (code === pat) {
      return true;
    }
  }
  return false;
}

/**
 * Return every `code` that matches at least one gate pattern (sorted asc, deduped).
 */
export function resolveStrictControllerCodesGate(
  codes: readonly string[],
  patterns: readonly string[]
): string[] {
  if (patterns.length === 0) return [];
  const matched = new Set<string>();
  for (const code of codes) {
    if (matchesAnyStrictControllerCodePattern(code, patterns)) {
      matched.add(code);
    }
  }
  return [...matched].sort((a, b) => a.localeCompare(b));
}

export const STRICT_CONTROLLER_GATE_WATCH_PATTERNS = [
  "CG_N_AND_O_MIXED",
  "CG_DUPLICATE_O_HEADER",
  "CG_DUPLICATE_ADDRESSES_*"
] as const;

export type StrictControllerGateWatchPattern =
  (typeof STRICT_CONTROLLER_GATE_WATCH_PATTERNS)[number];
