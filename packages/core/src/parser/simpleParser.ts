import type { Block, ParseComplianceMode, ParseDiagnostic, ParseOptions, ProgramAst } from "../types.js";

const LENIENT_WORD_RE = /([A-Z#])\s*([+\-]?(?:(?:\d|\s)+(?:\.(?:\d|\s)*)?|\.(?:\d|\s)+)|#\d+|\[[^\]]+\])/gi;

function suggestInsertPairedParentheses(): NonNullable<ParseDiagnostic["suggestedFixes"]> {
  return [{ title: "Close the comment with ')'", replacement: ")" }];
}

function suggestRemoveStrayCloseParen(): NonNullable<ParseDiagnostic["suggestedFixes"]> {
  return [{ title: "Remove unmatched ')'" }];
}

function suggestAddressValue(address: string): NonNullable<ParseDiagnostic["suggestedFixes"]> {
  return [
    { title: `Add numeric value after ${address}`, replacement: `${address}0` },
    { title: `If ${address} is intentional text, move it into a comment` }
  ];
}

function suggestUnknownTokenCleanup(token: string): NonNullable<ParseDiagnostic["suggestedFixes"]> {
  const compact = token.replace(/\s+/g, "");
  return [
    { title: `Remove unknown token '${compact}'` },
    { title: "Replace it with a valid address word (for example X1 or G1)" }
  ];
}

function suggestInvalidCharacter(ch: string): NonNullable<ParseDiagnostic["suggestedFixes"]> {
  return [
    { title: `Remove unsupported character '${ch}'` },
    { title: "Replace with a valid operator/symbol for this compliance mode" }
  ];
}

function suggestBracketBalance(opens: number, closes: number): NonNullable<ParseDiagnostic["suggestedFixes"]> {
  if (opens > closes) return [{ title: "Add missing ']'", replacement: "]" }];
  return [{ title: "Remove extra ']'" }];
}

function suggestBracketExpressionFix(): NonNullable<ParseDiagnostic["suggestedFixes"]> {
  return [
    { title: "Fix bracket expression syntax so it parses as a single expression" },
    { title: "Use balanced operators/operands (for example [#100+1])" }
  ];
}

function normalizeWordValue(value: string): string {
  if (value.startsWith("[") || value.startsWith("#")) {
    return value;
  }
  // Controller docs allow arbitrary spaces/tabs between numeric characters.
  return value.replace(/\s+/g, "");
}

function isAsciiLetter(ch: string): boolean {
  return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z");
}

function parseBracketValue(source: string, start: number): { value: string; end: number } | null {
  if (source[start] !== "[") return null;
  const end = source.indexOf("]", start + 1);
  if (end < 0) return null;
  return { value: source.slice(start, end + 1), end: end + 1 };
}

function parseSharpValue(
  source: string,
  start: number,
  includeLeadingHashForValue = false
): { value: string; end: number } | null {
  if (source[start] !== "#") return null;
  const next = source[start + 1];
  if (!next) return null;
  if (next === "[") {
    const bracket = parseBracketValue(source, start + 1);
    if (!bracket) return null;
    const raw = source.slice(start, bracket.end);
    return { value: includeLeadingHashForValue ? raw : bracket.value, end: bracket.end };
  }
  if (next === "#") {
    let j = start + 2;
    while (j < source.length && /[0-9]/.test(source[j])) j += 1;
    if (j === start + 2) return null;
    const raw = source.slice(start, j);
    return { value: includeLeadingHashForValue ? raw : source.slice(start + 1, j), end: j };
  }
  if (!/[0-9]/.test(next)) return null;
  let j = start + 1;
  while (j < source.length && /[0-9]/.test(source[j])) j += 1;
  const raw = source.slice(start, j);
  return { value: includeLeadingHashForValue ? raw : source.slice(start + 1, j), end: j };
}

function parseNumericValue(source: string, start: number): { value: string; end: number } | null {
  let j = start;
  if (source[j] === "+" || source[j] === "-") j += 1;

  let seenDigit = false;
  let seenDot = false;
  while (j < source.length) {
    const ch = source[j];
    if (/[0-9]/.test(ch)) {
      seenDigit = true;
      j += 1;
      continue;
    }
    if (/\s/.test(ch)) {
      j += 1;
      continue;
    }
    if (ch === "." && !seenDot) {
      seenDot = true;
      j += 1;
      continue;
    }
    break;
  }
  if (!seenDigit) return null;
  return { value: source.slice(start, j), end: j };
}

function strictLexWords(
  codeOnly: string,
  blockIndex: number,
  includeTokenSpans: boolean,
  rawOffset: number
): { words: Block["words"]; diagnostics: ParseDiagnostic[] } {
  const words: Block["words"] = [];
  const diagnostics: ParseDiagnostic[] = [];
  let i = 0;
  while (i < codeOnly.length) {
    const ch = codeOnly[i];

    if (ch === "#") {
      const parsed = parseSharpValue(codeOnly, i);
      if (parsed) {
        words.push({
          letter: "#",
          value: normalizeWordValue(parsed.value),
          ...(includeTokenSpans ? { span: { start: rawOffset + i, end: rawOffset + parsed.end } } : {})
        });
        i = parsed.end;
        continue;
      }
      i += 1;
      continue;
    }

    if (isAsciiLetter(ch)) {
      const prev = i > 0 ? codeOnly[i - 1] : "";
      if (isAsciiLetter(prev)) {
        i += 1;
        continue;
      }
      let j = i + 1;
      while (j < codeOnly.length && /\s/.test(codeOnly[j])) j += 1;
      const valueStart = j;

      const sharp = parseSharpValue(codeOnly, valueStart, true);
      if (sharp) {
        words.push({
          letter: ch.toUpperCase(),
          value: normalizeWordValue(sharp.value),
          ...(includeTokenSpans ? { span: { start: rawOffset + i, end: rawOffset + sharp.end } } : {})
        });
        i = sharp.end;
        continue;
      }
      const bracket = parseBracketValue(codeOnly, valueStart);
      if (bracket) {
        words.push({
          letter: ch.toUpperCase(),
          value: normalizeWordValue(bracket.value),
          ...(includeTokenSpans ? { span: { start: rawOffset + i, end: rawOffset + bracket.end } } : {})
        });
        i = bracket.end;
        continue;
      }
      const numeric = parseNumericValue(codeOnly, valueStart);
      if (numeric) {
        words.push({
          letter: ch.toUpperCase(),
          value: normalizeWordValue(numeric.value),
          ...(includeTokenSpans ? { span: { start: rawOffset + i, end: rawOffset + numeric.end } } : {})
        });
        i = numeric.end;
        continue;
      }
      diagnostics.push({
        code: "ADDRESS_MISSING_VALUE",
        severity: "warning",
        message: `Address '${ch.toUpperCase()}' has no parseable value in strict mode.`,
        blockIndex,
        suggestedFixes: suggestAddressValue(ch.toUpperCase()),
        ...(includeTokenSpans ? { span: { start: rawOffset + i, end: rawOffset + i + 1 } } : {})
      });
      i += 1;
      continue;
    }

    // Deterministic recovery: consume an unknown token chunk and continue.
    if (!/\s/.test(ch)) {
      let j = i + 1;
      while (j < codeOnly.length) {
        const look = codeOnly[j];
        if (/\s/.test(look)) break;
        if (isAsciiLetter(look) || look === "#" || look === "[" || look === "]" || look === "(" || look === ")" || look === ";" || look === "/") break;
        j += 1;
      }
      diagnostics.push({
        code: "UNKNOWN_TOKEN",
        severity: "warning",
        message: `Unknown token '${codeOnly.slice(i, j)}' skipped in strict mode recovery.`,
        blockIndex,
        suggestedFixes: suggestUnknownTokenCleanup(codeOnly.slice(i, j)),
        ...(includeTokenSpans ? { span: { start: rawOffset + i, end: rawOffset + j } } : {})
      });
      i = j;
      continue;
    }

    i += 1;
  }
  return { words, diagnostics };
}

type ExprParseResult = { node?: NonNullable<Block["words"][number]["expressionAst"]>; error?: string };

class ExprCursor {
  private readonly source: string;

  private idx = 0;

  constructor(source: string) {
    this.source = source;
  }

  private skipWs(): void {
    while (this.idx < this.source.length && /\s/.test(this.source[this.idx])) this.idx += 1;
  }

  private peek(): string {
    this.skipWs();
    return this.source[this.idx] ?? "";
  }

  private consume(ch: string): boolean {
    this.skipWs();
    if (this.source[this.idx] === ch) {
      this.idx += 1;
      return true;
    }
    return false;
  }

  private consumeKeyword(keyword: string): boolean {
    this.skipWs();
    const upper = this.source.slice(this.idx, this.idx + keyword.length).toUpperCase();
    if (upper !== keyword) return false;
    const next = this.source[this.idx + keyword.length] ?? "";
    if (/[A-Z0-9_]/i.test(next)) return false;
    this.idx += keyword.length;
    return true;
  }

  private parseNumber(): NonNullable<Block["words"][number]["expressionAst"]> | null {
    this.skipWs();
    const m = this.source.slice(this.idx).match(/^[+\-]?(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!m) return null;
    const raw = m[0];
    this.idx += raw.length;
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return null;
    return { kind: "number", value, raw };
  }

  private parseIdentifier(): string | null {
    this.skipWs();
    const m = this.source.slice(this.idx).match(/^[A-Z_][A-Z0-9_]*/i);
    if (!m) return null;
    this.idx += m[0].length;
    return m[0].toUpperCase();
  }

  private parseVariable(): NonNullable<Block["words"][number]["expressionAst"]> | null {
    this.skipWs();
    if (!this.consume("#")) return null;
    this.skipWs();
    if (this.consume("[")) {
      const indexExpr = this.parseExpression();
      if (!indexExpr || !this.consume("]")) return null;
      return { kind: "variable", name: "#[]", indexExpression: indexExpr };
    }
    const id = this.parseIdentifier();
    if (id) return { kind: "variable", name: `#${id}` };
    const number = this.source.slice(this.idx).match(/^\d+/)?.[0];
    if (!number) return null;
    this.idx += number.length;
    return { kind: "variable", name: `#${number}` };
  }

  private parseFunctionCall(name: string): NonNullable<Block["words"][number]["expressionAst"]> | null {
    this.skipWs();
    if (!this.consume("[")) return null;
    const first = this.parseExpression();
    if (!first || !this.consume("]")) return null;
    if (name === "ATAN") {
      const save = this.idx;
      if (this.consume("/") && this.consume("[")) {
        const second = this.parseExpression();
        if (!second || !this.consume("]")) return null;
        return { kind: "function", name, args: [first, second] };
      }
      this.idx = save;
    }
    return { kind: "function", name, args: [first] };
  }

  private parsePrimary(): NonNullable<Block["words"][number]["expressionAst"]> | null {
    const variable = this.parseVariable();
    if (variable) return variable;

    const number = this.parseNumber();
    if (number) return number;

    if (this.consume("[")) {
      const expr = this.parseExpression();
      if (!expr || !this.consume("]")) return null;
      return expr;
    }
    if (this.consume("(")) {
      const expr = this.parseExpression();
      if (!expr || !this.consume(")")) return null;
      return expr;
    }

    const idStart = this.idx;
    const id = this.parseIdentifier();
    if (id) {
      const fn = this.parseFunctionCall(id);
      if (fn) return fn;
      this.idx = idStart;
    }
    return null;
  }

  private parseUnary(): NonNullable<Block["words"][number]["expressionAst"]> | null {
    if (this.consume("+")) {
      const operand = this.parseUnary();
      if (!operand) return null;
      return { kind: "unary", operator: "+", operand };
    }
    if (this.consume("-")) {
      const operand = this.parseUnary();
      if (!operand) return null;
      return { kind: "unary", operator: "-", operand };
    }
    return this.parsePrimary();
  }

  private parseMulDiv(): NonNullable<Block["words"][number]["expressionAst"]> | null {
    let left = this.parseUnary();
    if (!left) return null;
    while (true) {
      const op = this.consume("*") ? "*" : this.consume("/") ? "/" : this.consumeKeyword("MOD") ? "MOD" : null;
      if (!op) break;
      const right = this.parseUnary();
      if (!right) return null;
      left = { kind: "binary", operator: op, left, right };
    }
    return left;
  }

  private parseAddSub(): NonNullable<Block["words"][number]["expressionAst"]> | null {
    let left = this.parseMulDiv();
    if (!left) return null;
    while (true) {
      const op = this.consume("+") ? "+" : this.consume("-") ? "-" : null;
      if (!op) break;
      const right = this.parseMulDiv();
      if (!right) return null;
      left = { kind: "binary", operator: op, left, right };
    }
    return left;
  }

  private parseRelation(): NonNullable<Block["words"][number]["expressionAst"]> | null {
    let left = this.parseAddSub();
    if (!left) return null;
    while (true) {
      const operators = ["EQ", "NE", "GT", "GE", "LT", "LE"] as const;
      const op = operators.find((candidate) => this.consumeKeyword(candidate)) ?? null;
      if (!op) break;
      const right = this.parseAddSub();
      if (!right) return null;
      left = { kind: "binary", operator: op, left, right };
    }
    return left;
  }

  private parseAnd(): NonNullable<Block["words"][number]["expressionAst"]> | null {
    let left = this.parseRelation();
    if (!left) return null;
    while (this.consumeKeyword("AND")) {
      const right = this.parseRelation();
      if (!right) return null;
      left = { kind: "binary", operator: "AND", left, right };
    }
    return left;
  }

  private parseOrXor(): NonNullable<Block["words"][number]["expressionAst"]> | null {
    let left = this.parseAnd();
    if (!left) return null;
    while (true) {
      const op = this.consumeKeyword("OR") ? "OR" : this.consumeKeyword("XOR") ? "XOR" : null;
      if (!op) break;
      const right = this.parseAnd();
      if (!right) return null;
      left = { kind: "binary", operator: op, left, right };
    }
    return left;
  }

  parseExpression(): NonNullable<Block["words"][number]["expressionAst"]> | null {
    return this.parseOrXor();
  }

  parseAll(): ExprParseResult {
    const node = this.parseExpression();
    if (!node) return { error: "Invalid or incomplete expression." };
    this.skipWs();
    if (this.idx !== this.source.length) return { error: "Trailing tokens after expression." };
    return { node };
  }
}

function parseBracketExpressionAst(value: string): ExprParseResult {
  if (!value.startsWith("[") || !value.endsWith("]")) {
    return { error: "Expression value is not bracket-delimited." };
  }
  const inner = value.slice(1, -1);
  const cursor = new ExprCursor(inner);
  return cursor.parseAll();
}

function splitIntoRawBlocks(code: string, options?: ParseOptions): string[] {
  if (!options?.semicolonEob) {
    return code
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  const blocks: string[] = [];
  let current = "";
  let parenDepth = 0;
  let bracketDepth = 0;

  const pushCurrent = (): void => {
    const trimmed = current.trim();
    if (trimmed.length > 0) {
      blocks.push(trimmed);
    }
    current = "";
  };

  for (let i = 0; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === "(") {
      parenDepth += 1;
      current += ch;
      continue;
    }
    if (ch === ")") {
      if (parenDepth > 0) parenDepth -= 1;
      current += ch;
      continue;
    }
    if (ch === "[" && parenDepth === 0) {
      bracketDepth += 1;
      current += ch;
      continue;
    }
    if (ch === "]" && parenDepth === 0) {
      if (bracketDepth > 0) bracketDepth -= 1;
      current += ch;
      continue;
    }
    if (ch === ";" && parenDepth === 0 && bracketDepth === 0) {
      pushCurrent();
      continue;
    }
    if ((ch === "\n" || ch === "\r") && parenDepth === 0 && bracketDepth === 0) {
      pushCurrent();
      continue;
    }
    current += ch;
  }

  pushCurrent();
  return blocks;
}

function allowedExtraSymbolsForMode(mode: ParseComplianceMode): Set<string> {
  // Baseline symbols accepted in code words/operators across controllers.
  const base = new Set(["+", "-", "*", "/", ".", "[", "]", "(", ")", "#", "=", " ", "\t"]);
  if (mode === "strict_haas") {
    // Haas keyboard/docs expose additional special characters used in some shop files.
    ["_", "^", "~", "{", "}", "\\", "<", ">"].forEach((ch) => base.add(ch));
  }
  if (mode === "strict" || mode === "strict_fanuc") {
    // Fanuc/ISO-focused strict mode keeps a tighter symbol surface.
    ["<", ">"].forEach((ch) => base.add(ch));
  }
  return base;
}

function collectInvalidCharacterDiagnostics(
  codeOnly: string,
  blockIndex: number,
  rawOffset: number,
  includeTokenSpans: boolean,
  complianceMode: ParseComplianceMode
): ParseDiagnostic[] {
  const issues: ParseDiagnostic[] = [];
  const allowedExtras = allowedExtraSymbolsForMode(complianceMode);
  for (let i = 0; i < codeOnly.length; i += 1) {
    const ch = codeOnly[i];
    if (/[A-Za-z0-9]/.test(ch)) continue;
    if (allowedExtras.has(ch)) continue;
    issues.push({
      code: "INVALID_CHARACTER",
      severity: "warning",
      message: `Character '${ch}' is not permitted in ${complianceMode} code tokens.`,
      blockIndex,
      suggestedFixes: suggestInvalidCharacter(ch),
      ...(includeTokenSpans ? { span: { start: rawOffset + i, end: rawOffset + i + 1 } } : {})
    });
  }
  return issues;
}

export function simpleParse(code: string, profileId: string, options?: ParseOptions): ProgramAst {
  const complianceMode: ParseComplianceMode = options?.complianceMode ?? "strict";
  const strictMode =
    complianceMode === "strict" || complianceMode === "strict_haas" || complianceMode === "strict_fanuc";
  const includeTokenSpans = options?.includeTokenSpans ?? false;
  const includeExpressionAst = options?.includeExpressionAst ?? false;
  const lines = splitIntoRawBlocks(code, options);
  const parseDiagnostics: ParseDiagnostic[] = [];

  const blocks: Block[] = lines.map((raw, blockIndex) => {
    const parenComments = Array.from(raw.matchAll(/\(([^)]*)\)/g)).map((m) => m[1].trim());
    const semicolonComment = raw.match(/;(.+)$/)?.[1]?.trim();
    const combinedComments = [...parenComments, ...(semicolonComment ? [semicolonComment] : [])].filter(Boolean);
    const comment = combinedComments.length > 0 ? combinedComments.join(" | ") : undefined;
    const codeWithoutParens = raw.replace(/\([^)]*\)/g, "");
    // In strict mode, if a "(" remains, treat the rest as comment tail so partial
    // comment fragments are not tokenized as address words.
    const unmatchedParenIndex = codeWithoutParens.indexOf("(");
    if (strictMode && unmatchedParenIndex >= 0) {
      parseDiagnostics.push({
        code: "UNMATCHED_OPEN_PAREN",
        severity: "warning",
        message: "Unmatched '(' found; strict parser ignores trailing text after it.",
        blockIndex,
        suggestedFixes: suggestInsertPairedParentheses(),
        ...(includeTokenSpans ? { span: { start: unmatchedParenIndex, end: unmatchedParenIndex + 1 } } : {})
      });
    }
    const unmatchedCloseIndex = raw.indexOf(")");
    if (strictMode && unmatchedCloseIndex >= 0 && raw.indexOf("(") < 0) {
      parseDiagnostics.push({
        code: "UNMATCHED_CLOSE_PAREN",
        severity: "warning",
        message: "Unmatched ')' found in block comment syntax.",
        blockIndex,
        suggestedFixes: suggestRemoveStrayCloseParen(),
        ...(includeTokenSpans ? { span: { start: unmatchedCloseIndex, end: unmatchedCloseIndex + 1 } } : {})
      });
    }
    const truncatedForUnmatchedParen =
      strictMode && unmatchedParenIndex >= 0
        ? codeWithoutParens.slice(0, unmatchedParenIndex)
        : codeWithoutParens;
    const codeOnly = options?.semicolonEob ? truncatedForUnmatchedParen.trim() : truncatedForUnmatchedParen.replace(/;.*$/g, "").trim();
    const codeOnlyStart = raw.indexOf(codeOnly);
    const rawOffset = codeOnlyStart >= 0 ? codeOnlyStart : 0;
    if (strictMode) {
      parseDiagnostics.push(
        ...collectInvalidCharacterDiagnostics(codeOnly, blockIndex, rawOffset, includeTokenSpans, complianceMode)
      );
    }
    if (strictMode) {
      const opens = (codeOnly.match(/\[/g) ?? []).length;
      const closes = (codeOnly.match(/\]/g) ?? []).length;
      if (opens !== closes) {
        const idx = codeOnly.indexOf(opens > closes ? "[" : "]");
        parseDiagnostics.push({
          code: "UNMATCHED_BRACKET",
          severity: "warning",
          message: "Unmatched bracket in expression syntax.",
          blockIndex,
          suggestedFixes: suggestBracketBalance(opens, closes),
          ...(includeTokenSpans && idx >= 0 ? { span: { start: rawOffset + idx, end: rawOffset + idx + 1 } } : {})
        });
      }
    }
    const words = strictMode
      ? (() => {
          const result = strictLexWords(codeOnly, blockIndex, includeTokenSpans, rawOffset);
          parseDiagnostics.push(...result.diagnostics);
          return result.words;
        })()
      : Array.from(codeOnly.matchAll(LENIENT_WORD_RE)).map((match) => {
          const start = match.index ?? 0;
          const end = start + match[0].length;
          return {
            letter: match[1].toUpperCase(),
            value: normalizeWordValue(match[2]),
            ...(includeTokenSpans ? { span: { start: rawOffset + start, end: rawOffset + end } } : {})
          };
        });

    const wordsWithExpressionAst = includeExpressionAst
      ? words.map((word) => {
          if (!word.value.startsWith("[") || !word.value.endsWith("]")) return word;
          const result = parseBracketExpressionAst(word.value);
          if (!result.node) {
            parseDiagnostics.push({
              code: "BRACKET_EXPRESSION_INVALID",
              severity: "warning",
              message: `Bracket expression parse failed: ${result.error ?? "unknown error"}`,
              blockIndex,
              suggestedFixes: suggestBracketExpressionFix(),
              ...(word.span ? { span: word.span } : {})
            });
            return word;
          }
          return { ...word, expressionAst: result.node };
        })
      : words;

    return {
      raw,
      words: wordsWithExpressionAst,
      comment
    };
  });
  const blockSummaryMap = new Map<number, { errorCount: number; warningCount: number; hasRecovery: boolean }>();
  for (const d of parseDiagnostics) {
    const current = blockSummaryMap.get(d.blockIndex) ?? { errorCount: 0, warningCount: 0, hasRecovery: false };
    if (d.severity === "error") current.errorCount += 1;
    else current.warningCount += 1;
    if (d.code === "UNKNOWN_TOKEN" || d.code === "ADDRESS_MISSING_VALUE") current.hasRecovery = true;
    blockSummaryMap.set(d.blockIndex, current);
  }
  const parseSummary = {
    errorCount: parseDiagnostics.filter((d) => d.severity === "error").length,
    warningCount: parseDiagnostics.filter((d) => d.severity === "warning").length,
    hasRecovery: parseDiagnostics.some((d) => d.code === "UNKNOWN_TOKEN" || d.code === "ADDRESS_MISSING_VALUE"),
    blocks: blocks.map((_, blockIndex) => {
      const entry = blockSummaryMap.get(blockIndex) ?? { errorCount: 0, warningCount: 0, hasRecovery: false };
      return { blockIndex, ...entry };
    })
  };

  return { profileId, blocks, parseComplianceMode: complianceMode, parseDiagnostics, parseSummary };
}
