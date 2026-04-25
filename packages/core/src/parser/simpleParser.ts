import type { Block, ProgramAst } from "../types.js";

const WORD_RE = /([A-Z#])\s*([+\-]?(?:\d+(?:\.\d*)?|\.\d+)|#\d+|\[[^\]]+\])/gi;

export function simpleParse(code: string, profileId: string): ProgramAst {
  const lines = code
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const blocks: Block[] = lines.map((raw) => {
    const parenComments = Array.from(raw.matchAll(/\(([^)]*)\)/g)).map((m) => m[1].trim());
    const semicolonComment = raw.match(/;(.+)$/)?.[1]?.trim();
    const combinedComments = [...parenComments, ...(semicolonComment ? [semicolonComment] : [])].filter(Boolean);
    const comment = combinedComments.length > 0 ? combinedComments.join(" | ") : undefined;
    const codeWithoutParens = raw.replace(/\([^)]*\)/g, "");
    const codeOnly = codeWithoutParens.replace(/;.*$/g, "").trim();

    const words = Array.from(codeOnly.matchAll(WORD_RE)).map((match) => ({
      letter: match[1].toUpperCase(),
      value: match[2]
    }));

    return {
      raw,
      words,
      comment
    };
  });

  return { profileId, blocks };
}
