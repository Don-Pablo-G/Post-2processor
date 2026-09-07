import type { LintIssue, ProgramAst } from "../types.js";

/**
 * Minimal declarative rule schema authorable from UI / JSON packs.
 * Complex modal state-machine checks remain TypeScript rule modules.
 */
export type DeclarativeRuleDef = {
  id: string;
  severity: LintIssue["severity"];
  summary: string;
  message: string;
  /**
   * Same-block constraints:
   * - `requireLetterWith` — if any of `whenLetters`/`whenWords` present, require letter
   * - `forbidSameBlock` — forbid two word tokens on the same block
   * - `letterValue` — warn when letter has a forbidden numeric value
   * - `envelope` — program start/end `%` checks
   */
  kind: "requireLetterWith" | "forbidSameBlock" | "letterValue" | "envelope";
  whenLetters?: string[];
  /** Word matches like "M6", "G43" (letter + integer code). */
  whenWords?: string[];
  requireLetter?: string;
  forbidWords?: [string, string];
  letter?: string;
  forbiddenValues?: number[];
  envelope?: "percentStart" | "percentEnd" | "percentBoth";
};

function blockHasLetter(words: { letter: string; value: string }[], letter: string): boolean {
  const L = letter.toUpperCase();
  return words.some((w) => w.letter.toUpperCase() === L);
}

function blockHasWord(words: { letter: string; value: string }[], token: string): boolean {
  const t = token.trim().toUpperCase();
  const m = /^([A-Z])(-?\d+(?:\.\d+)?)$/.exec(t);
  if (!m) return false;
  const letter = m[1];
  const num = Number.parseFloat(m[2]);
  return words.some(
    (w) => w.letter.toUpperCase() === letter && Number.parseFloat(w.value) === num
  );
}

function letterValue(words: { letter: string; value: string }[], letter: string): number | undefined {
  const L = letter.toUpperCase();
  const w = words.filter((x) => x.letter.toUpperCase() === L).at(-1);
  if (!w) return undefined;
  const n = Number.parseFloat(w.value);
  return Number.isFinite(n) ? n : undefined;
}

export function runDeclarativeRules(
  ast: ProgramAst,
  rules: readonly DeclarativeRuleDef[]
): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const rule of rules) {
    if (rule.kind === "envelope") {
      const mode = rule.envelope ?? "percentBoth";
      const first = ast.blocks[0]?.raw.trim();
      const last = ast.blocks[ast.blocks.length - 1]?.raw.trim();
      if ((mode === "percentStart" || mode === "percentBoth") && first !== "%") {
        issues.push({
          code: rule.id,
          severity: rule.severity,
          message: rule.message,
          blockIndex: 0
        });
      }
      if ((mode === "percentEnd" || mode === "percentBoth") && last !== "%") {
        issues.push({
          code: rule.id,
          severity: rule.severity,
          message: rule.message,
          blockIndex: Math.max(0, ast.blocks.length - 1)
        });
      }
      continue;
    }

    ast.blocks.forEach((block, blockIndex) => {
      const words = block.words;
      if (rule.kind === "requireLetterWith") {
        const whenHit =
          (rule.whenWords?.some((w) => blockHasWord(words, w)) ?? false) ||
          (rule.whenLetters?.some((l) => blockHasLetter(words, l)) ?? false);
        if (!whenHit) return;
        if (rule.requireLetter && !blockHasLetter(words, rule.requireLetter)) {
          issues.push({
            code: rule.id,
            severity: rule.severity,
            message: rule.message,
            blockIndex
          });
        }
        return;
      }

      if (rule.kind === "forbidSameBlock" && rule.forbidWords) {
        const [a, b] = rule.forbidWords;
        if (blockHasWord(words, a) && blockHasWord(words, b)) {
          issues.push({
            code: rule.id,
            severity: rule.severity,
            message: rule.message,
            blockIndex
          });
        }
        return;
      }

      if (rule.kind === "letterValue" && rule.letter && rule.forbiddenValues) {
        const v = letterValue(words, rule.letter);
        if (v !== undefined && rule.forbiddenValues.includes(v)) {
          issues.push({
            code: rule.id,
            severity: rule.severity,
            message: rule.message,
            blockIndex
          });
        }
      }
    });
  }
  return issues;
}

/** Parse UI/JSON custom rules; throws on invalid entries. */
export function parseDeclarativeRulesJson(raw: string): DeclarativeRuleDef[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid declarative rules JSON: ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Declarative rules JSON must be an array.");
  }
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Declarative rule at index ${index} must be an object.`);
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string" || !e.id.trim()) {
      throw new Error(`Declarative rule at index ${index} needs a string id.`);
    }
    if (e.severity !== "warning" && e.severity !== "error") {
      throw new Error(`Declarative rule "${e.id}" needs severity warning|error.`);
    }
    if (typeof e.message !== "string" || typeof e.summary !== "string") {
      throw new Error(`Declarative rule "${e.id}" needs message and summary.`);
    }
    if (
      e.kind !== "requireLetterWith" &&
      e.kind !== "forbidSameBlock" &&
      e.kind !== "letterValue" &&
      e.kind !== "envelope"
    ) {
      throw new Error(`Declarative rule "${e.id}" has unsupported kind.`);
    }
    return entry as DeclarativeRuleDef;
  });
}
