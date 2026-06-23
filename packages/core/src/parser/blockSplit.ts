export type BlockSplitOptions = {
  semicolonEob?: boolean;
};

export type ProgramBlockSpan = {
  text: string;
  startOffset: number;
  endOffset: number;
};

/**
 * Split G-code source into trimmed non-empty blocks using the same semantics
 * as `simpleParser.splitIntoRawBlocks`.
 */
export function splitProgramIntoBlocks(
  code: string,
  options?: BlockSplitOptions
): string[] {
  return splitProgramIntoBlockSpans(code, options).map((span) => span.text);
}

/**
 * Like {@link splitProgramIntoBlocks} but retains each block's source offsets
 * for editor range resolution (IDE quick-fix bridge, desktop jump-to-block).
 */
export function splitProgramIntoBlockSpans(
  code: string,
  options?: BlockSplitOptions
): ProgramBlockSpan[] {
  if (!options?.semicolonEob) {
    const spans: ProgramBlockSpan[] = [];
    let offset = 0;
    while (offset <= code.length) {
      let lineEnd = code.indexOf("\n", offset);
      if (lineEnd < 0) lineEnd = code.length;
      const rawLine = code.slice(offset, lineEnd).replace(/\r$/, "");
      const trimmed = rawLine.trim();
      if (trimmed.length > 0) {
        const startInLine = rawLine.indexOf(trimmed);
        spans.push({
          text: trimmed,
          startOffset: offset + startInLine,
          endOffset: offset + startInLine + trimmed.length
        });
      }
      if (lineEnd >= code.length) break;
      offset = lineEnd + 1;
    }
    return spans;
  }

  const spans: ProgramBlockSpan[] = [];
  let current = "";
  let blockStart = 0;
  let parenDepth = 0;
  let bracketDepth = 0;

  const pushCurrent = (endOffset: number): void => {
    const trimmed = current.trim();
    if (trimmed.length > 0) {
      const leading = current.length - current.trimStart().length;
      const startOffset = blockStart + leading;
      spans.push({
        text: trimmed,
        startOffset,
        endOffset: startOffset + trimmed.length
      });
    }
    current = "";
    blockStart = endOffset;
  };

  for (let i = 0; i < code.length; i += 1) {
    const ch = code[i];
    if (current.length === 0) blockStart = i;
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
      pushCurrent(i + 1);
      continue;
    }
    if ((ch === "\n" || ch === "\r") && parenDepth === 0 && bracketDepth === 0) {
      pushCurrent(ch === "\r" && code[i + 1] === "\n" ? i + 2 : i + 1);
      if (ch === "\r" && code[i + 1] === "\n") i += 1;
      continue;
    }
    current += ch;
  }

  pushCurrent(code.length);
  return spans;
}

export function offsetToLineColumn(
  source: string,
  offset: number
): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let line = 1;
  let column = 1;
  for (let i = 0; i < clamped; i += 1) {
    const ch = source[i];
    if (ch === "\n") {
      line += 1;
      column = 1;
    } else if (ch !== "\r") {
      column += 1;
    }
  }
  return { line, column };
}

export function blockSpanToRange(
  source: string,
  span: ProgramBlockSpan
): {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
} {
  const start = offsetToLineColumn(source, span.startOffset);
  const end = offsetToLineColumn(source, Math.max(span.startOffset, span.endOffset - 1));
  return {
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column
  };
}
