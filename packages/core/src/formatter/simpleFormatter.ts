import type { FormatStyle, ProgramAst } from "../types.js";

export function simpleFormat(ast: ProgramAst, style: FormatStyle): string {
  return ast.blocks
    .filter((block) => {
      // Drop structural lines like "%" that produce no parseable words/comments.
      if (block.words.length === 0 && !block.comment) return false;
      return true;
    })
    .filter((block) => {
      if (!style.removeStandaloneOptionalStops) return true;
      if (block.comment) return true;
      if (block.words.length !== 1) return true;
      const word = block.words[0];
      if (word.letter !== "M") return true;
      const value = Number(word.value);
      return !(Number.isFinite(value) && value === 1);
    })
    .map((block) => {
      const raw = block.raw.trim();
      if (isMacroControlFlowLine(raw)) {
        // Keep macro/control-flow structure, but normalize casing when uppercase style is requested.
        return style.upperCaseWords ? raw.toUpperCase() : raw;
      }
      const words = block.words.map(({ letter, value }) => {
        const normalizedLetter = style.upperCaseWords ? letter.toUpperCase() : letter.toLowerCase();
        return `${normalizedLetter}${value}`;
      });
      const base = style.normalizeSpacing ? words.join(" ") : words.join("");
      return block.comment ? `${base} (${block.comment})` : base;
    })
    .join("\n");
}

function isMacroControlFlowLine(raw: string): boolean {
  const codeOnly = raw.replace(/\([^)]*\)/g, "").replace(/;.*$/g, "").trim().toUpperCase();
  if (codeOnly.length === 0) return false;
  return (
    /^#\d+\s*=/.test(codeOnly) ||
    /\bIF\b/.test(codeOnly) ||
    /\bWHILE\b/.test(codeOnly) ||
    /\bGOTO\b/.test(codeOnly) ||
    /\bDO\d+\b/.test(codeOnly) ||
    /\bEND\d+\b/.test(codeOnly)
  );
}
