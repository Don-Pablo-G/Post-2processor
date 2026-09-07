import type { LintIssue, ProgramAst } from "../types.js";
import {
  GRAMMAR_PACK_TABLES,
  resolveGrammarPackIds,
  type ControllerGrammarPackTable,
  type GrammarPackId
} from "./grammarTables.js";

type BlockLike = { raw: string; words: Array<{ letter: string; value: string }> };

export type { GrammarPackId, ControllerGrammarPackTable };
export { GRAMMAR_PACK_TABLES, resolveGrammarPackIds };

/** @deprecated Prefer GrammarPackId / grammarTables — kept for existing imports. */
export type ControllerGrammarRulePack = {
  id: "haasStrictRules" | "fanucStrictRules";
  blockRules: Array<(ast: ProgramAst, block: BlockLike, blockIndex: number) => LintIssue[]>;
  envelopeRules: Array<(ast: ProgramAst) => LintIssue[]>;
};

function stripLintComments(raw: string): string {
  return raw.replace(/\([^)]*\)/g, "").replace(/;.*$/gim, "").trim();
}

export function isLikelyMacroControlFlowLine(raw: string): boolean {
  const code = stripLintComments(raw).toUpperCase();
  if (code.length === 0) return false;
  if (/^\s*END\d*\s*$/.test(code)) return true;
  if (/^\s*DO\d*\s*$/.test(code)) return true;
  if (/^\s*ELSE\s*$/.test(code)) return true;
  if (/^\s*ENDIF\s*$/.test(code)) return true;
  if (/^\s*IF\b/.test(code)) return true;
  if (/^\s*WHILE\b/.test(code)) return true;
  if (/^\s*GOTO(?:\d+)?\b/.test(code)) return true;
  if (/^\s*THEN\b/.test(code)) return true;
  return false;
}

function hasBothNAndOWords(block: BlockLike): boolean {
  const letters = new Set(block.words.map((w) => w.letter));
  return letters.has("N") && letters.has("O");
}

function hasInvalidSequenceOrProgramNumberWord(block: BlockLike): boolean {
  const inRange = (n: number): boolean => n >= 1 && n <= 99999999;
  for (const w of block.words) {
    if (w.letter !== "N" && w.letter !== "O") continue;
    if (!/^\d+$/.test(w.value)) return true;
    const numeric = Number.parseInt(w.value, 10);
    if (!Number.isFinite(numeric) || !inRange(numeric)) return true;
  }
  return false;
}

function isPercentDelimiter(raw: string): boolean {
  return raw.trim() === "%";
}

function firstCodeBlockIndex(ast: ProgramAst): number | null {
  for (let i = 0; i < ast.blocks.length; i += 1) {
    if (!isPercentDelimiter(ast.blocks[i]!.raw)) return i;
  }
  return null;
}

function blockOWords(block: BlockLike): Array<{ letter: string; value: string }> {
  return block.words.filter((w) => w.letter === "O");
}

function hasFanucMacroIjkOrderingViolation(block: BlockLike): boolean {
  const hasG65 = block.words.some((w) => w.letter === "G" && Math.trunc(Number.parseFloat(w.value)) === 65);
  if (!hasG65) return false;
  const order = block.words
    .map((w) => w.letter)
    .filter((letter): letter is "I" | "J" | "K" => letter === "I" || letter === "J" || letter === "K");

  const rank = (letter: "I" | "J" | "K"): number => (letter === "I" ? 1 : letter === "J" ? 2 : 3);
  let prev = 0;
  for (const letter of order) {
    const next = rank(letter);
    if (next < prev && next !== 1) return true;
    if (next < prev && next === 1) {
      prev = 1;
      continue;
    }
    prev = next;
  }
  return false;
}

function duplicateAddressLetters(block: BlockLike, targets: ReadonlySet<string>): string[] {
  const counts = new Map<string, number>();
  for (const word of block.words) {
    if (!targets.has(word.letter)) continue;
    counts.set(word.letter, (counts.get(word.letter) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([letter]) => letter)
    .sort();
}

function collectProgramEnvelopeIssues(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];
  const oEntries: Array<{ blockIndex: number; value: string }> = [];
  ast.blocks.forEach((block, blockIndex) => {
    for (const oWord of blockOWords(block)) {
      oEntries.push({ blockIndex, value: oWord.value });
    }
  });
  if (oEntries.length === 0) return issues;

  const firstCode = firstCodeBlockIndex(ast);
  const firstO = oEntries[0];
  if (firstCode !== null && firstO && firstO.blockIndex !== firstCode) {
    issues.push({
      severity: "warning",
      message: "Fanuc program envelope: executable blocks appear before first O-number header.",
      blockIndex: firstCode,
      code: "CG_FANUC_PROGRAM_ENVELOPE",
      suggestedFixes: [{ title: "Move executable blocks below the O-number header" }]
    });
  }

  const seen = new Map<string, number>();
  for (const entry of oEntries) {
    const prev = seen.get(entry.value);
    if (prev !== undefined) {
      issues.push({
        severity: "warning",
        message: `Duplicate O-number header O${entry.value} appears multiple times in one file.`,
        blockIndex: entry.blockIndex,
        code: "CG_DUPLICATE_O_HEADER",
        suggestedFixes: [
          { title: `Use a unique O-number per program; rename duplicate O${entry.value}` }
        ]
      });
    } else {
      seen.set(entry.value, entry.blockIndex);
    }
  }
  return issues;
}

function evaluateBlockAgainstTable(
  table: ControllerGrammarPackTable,
  block: BlockLike,
  blockIndex: number
): LintIssue[] {
  const issues: LintIssue[] = [];
  if (table.nAndOMixed && hasBothNAndOWords(block)) {
    issues.push({
      severity: "warning",
      message:
        "Block contains both N and O words — Fanuc manuals state sequence numbers are invalid on O-number blocks.",
      blockIndex,
      code: "CG_N_AND_O_MIXED",
      suggestedFixes: [{ title: "Move N number to a separate block from the O header" }]
    });
  }
  if (table.strictNoFormat && hasInvalidSequenceOrProgramNumberWord(block)) {
    issues.push({
      severity: "warning",
      message:
        "Invalid N/O numeric format — Fanuc sequence and O-program numbers must be integer values in range 1..99999999.",
      blockIndex,
      code: "CG_FANUC_INVALID_N_O_FORMAT",
      suggestedFixes: [{ title: "Use an integer N or O value within 1..99999999" }]
    });
  }
  if (table.g65IjkOrder && hasFanucMacroIjkOrderingViolation(block)) {
    issues.push({
      severity: "warning",
      message:
        "G65 block has I/J/K out of order — Fanuc Macro documentation expects I, J, K arguments in alphabetical order.",
      blockIndex,
      code: "CG_FANUC_MACRO_IJK_ORDER",
      suggestedFixes: [{ title: "Reorder arguments so I appears before J before K" }]
    });
  }
  const duplicates = duplicateAddressLetters(block, new Set(table.duplicateAddressLetters));
  for (const letter of duplicates) {
    issues.push({
      severity: "warning",
      message: `Duplicate ${letter} words in one block — controller behavior is typically last-value-wins; split into explicit blocks for safety.`,
      blockIndex,
      code: `CG_DUPLICATE_ADDRESSES_${letter}`,
      suggestedFixes: [
        { title: `Split duplicate ${letter} words into two blocks; controller is last-value-wins` }
      ]
    });
  }
  return issues;
}

function grammarPackIdsForAst(ast: ProgramAst): GrammarPackId[] {
  const extended = ast as ProgramAst & { grammarPackIds?: readonly string[] };
  return resolveGrammarPackIds({
    profileId: ast.profileId,
    parseComplianceMode: ast.parseComplianceMode,
    grammarPackIds: extended.grammarPackIds
  });
}

/** Legacy exports kept for tests that import pack objects. */
export const haasStrictRules: ControllerGrammarRulePack = {
  id: "haasStrictRules",
  blockRules: [
    (_ast, block, blockIndex) =>
      evaluateBlockAgainstTable(GRAMMAR_PACK_TABLES["haas-strict"], block, blockIndex)
  ],
  envelopeRules: []
};

export const fanucStrictRules: ControllerGrammarRulePack = {
  id: "fanucStrictRules",
  blockRules: [
    (_ast, block, blockIndex) =>
      evaluateBlockAgainstTable(GRAMMAR_PACK_TABLES["fanuc-strict"], block, blockIndex)
  ],
  envelopeRules: [(ast) => collectProgramEnvelopeIssues(ast)]
};

export function collectControllerGrammarIssues(
  ast: ProgramAst,
  block: BlockLike,
  blockIndex: number
): LintIssue[] {
  const issues: LintIssue[] = [];
  const seenCodes = new Set<string>();
  for (const packId of grammarPackIdsForAst(ast)) {
    const table = GRAMMAR_PACK_TABLES[packId];
    for (const issue of evaluateBlockAgainstTable(table, block, blockIndex)) {
      const key = `${issue.code}:${issue.blockIndex}:${issue.message}`;
      if (seenCodes.has(key)) continue;
      seenCodes.add(key);
      issues.push(issue);
    }
  }
  return issues;
}

export function collectControllerProgramEnvelopeIssues(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const packId of grammarPackIdsForAst(ast)) {
    const table = GRAMMAR_PACK_TABLES[packId];
    if (table.programEnvelope) {
      issues.push(...collectProgramEnvelopeIssues(ast));
    }
  }
  return issues;
}
