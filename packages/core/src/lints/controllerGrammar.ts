import type { LintIssue, ProgramAst } from "../types.js";

type BlockLike = { raw: string; words: Array<{ letter: string; value: string }> };
type ControllerGrammarRule = (ast: ProgramAst, block: BlockLike, blockIndex: number) => LintIssue[];
type ProgramEnvelopeRule = (ast: ProgramAst) => LintIssue[];

export type ControllerGrammarRulePack = {
  id: "haasStrictRules" | "fanucStrictRules";
  blockRules: ControllerGrammarRule[];
  envelopeRules: ProgramEnvelopeRule[];
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

function isFanucProfile(profileId: string): boolean {
  const normalized = profileId.toLowerCase();
  return normalized.includes("fanuc");
}

function isFanucStrictContext(ast: ProgramAst): boolean {
  return isFanucProfile(ast.profileId) || ast.parseComplianceMode === "strict_fanuc";
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

function collectProgramEnvelopeIssues(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];
  if (!isFanucStrictContext(ast)) return issues;

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
      suggestedFixes: [
        { title: "Move executable blocks below the O-number header" }
      ]
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
          {
            title: `Use a unique O-number per program; rename duplicate O${entry.value}`
          }
        ]
      });
    } else {
      seen.set(entry.value, entry.blockIndex);
    }
  }

  return issues;
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

function duplicateAddressLetters(block: BlockLike, targets: Set<string>): string[] {
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

function duplicateAddressTargetsForAst(ast: ProgramAst): Set<string> {
  // Shared high-risk addresses where duplicated values in one block are commonly
  // interpreted as last-wins and may hide programmer intent.
  const base = new Set(["X", "Y", "Z", "F", "S", "T", "H", "D", "R"]);
  // Fanuc adds common macro/cycle scalar addresses frequently reused in calls.
  if (isFanucStrictContext(ast)) {
    base.add("P");
    base.add("Q");
  }
  return base;
}

function ruleNAndOMixed(_ast: ProgramAst, block: BlockLike, blockIndex: number): LintIssue[] {
  const issues: LintIssue[] = [];
  if (hasBothNAndOWords(block)) {
    issues.push({
      severity: "warning",
      message: "Block contains both N and O words — Fanuc manuals state sequence numbers are invalid on O-number blocks.",
      blockIndex,
      code: "CG_N_AND_O_MIXED",
      suggestedFixes: [
        { title: "Move N number to a separate block from the O header" }
      ]
    });
  }
  return issues;
}

function ruleFanucStrictNAndOFormat(ast: ProgramAst, block: BlockLike, blockIndex: number): LintIssue[] {
  if (!isFanucStrictContext(ast) || !hasInvalidSequenceOrProgramNumberWord(block)) return [];
  return [
    {
      severity: "warning",
      message: "Invalid N/O numeric format — Fanuc sequence and O-program numbers must be integer values in range 1..99999999.",
      blockIndex,
      code: "CG_FANUC_INVALID_N_O_FORMAT",
      suggestedFixes: [
        { title: "Use an integer N or O value within 1..99999999" }
      ]
    }
  ];
}

function ruleG65IjkOrder(_ast: ProgramAst, block: BlockLike, blockIndex: number): LintIssue[] {
  if (!hasFanucMacroIjkOrderingViolation(block)) return [];
  return [
    {
      severity: "warning",
      message: "G65 block has I/J/K out of order — Fanuc Macro documentation expects I, J, K arguments in alphabetical order.",
      blockIndex,
      code: "CG_FANUC_MACRO_IJK_ORDER",
      suggestedFixes: [
        { title: "Reorder arguments so I appears before J before K" }
      ]
    }
  ];
}

function ruleDuplicateAddresses(ast: ProgramAst, block: BlockLike, blockIndex: number): LintIssue[] {
  const duplicateTargets = duplicateAddressTargetsForAst(ast);
  const duplicates = duplicateAddressLetters(block, duplicateTargets);
  return duplicates.map((letter) => ({
    severity: "warning" as const,
    message: `Duplicate ${letter} words in one block — controller behavior is typically last-value-wins; split into explicit blocks for safety.`,
    blockIndex,
    code: `CG_DUPLICATE_ADDRESSES_${letter}`,
    suggestedFixes: [
      { title: `Split duplicate ${letter} words into two blocks; controller is last-value-wins` }
    ]
  }));
}

function ruleFanucProgramEnvelope(ast: ProgramAst): LintIssue[] {
  return collectProgramEnvelopeIssues(ast);
}

export const haasStrictRules: ControllerGrammarRulePack = {
  id: "haasStrictRules",
  blockRules: [ruleNAndOMixed, ruleG65IjkOrder, ruleDuplicateAddresses],
  envelopeRules: []
};

export const fanucStrictRules: ControllerGrammarRulePack = {
  id: "fanucStrictRules",
  blockRules: [ruleNAndOMixed, ruleFanucStrictNAndOFormat, ruleG65IjkOrder, ruleDuplicateAddresses],
  envelopeRules: [ruleFanucProgramEnvelope]
};

function activeRulePacksForAst(ast: ProgramAst): ControllerGrammarRulePack[] {
  return isFanucStrictContext(ast) ? [haasStrictRules, fanucStrictRules] : [haasStrictRules];
}

export function collectControllerGrammarIssues(ast: ProgramAst, block: BlockLike, blockIndex: number): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const pack of activeRulePacksForAst(ast)) {
    for (const rule of pack.blockRules) {
      issues.push(...rule(ast, block, blockIndex));
    }
  }
  return issues;
}

export function collectControllerProgramEnvelopeIssues(ast: ProgramAst): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const pack of activeRulePacksForAst(ast)) {
    for (const rule of pack.envelopeRules) {
      issues.push(...rule(ast));
    }
  }
  return issues;
}
