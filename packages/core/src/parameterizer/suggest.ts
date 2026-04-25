import type { ParameterSuggestion, ParameterizeOptions, ParameterizeResult, ProgramAst } from "../types.js";

export function simpleParameterize(ast: ProgramAst, options?: ParameterizeOptions): ParameterizeResult {
  const literalCount = new Map<string, number>();
  const occupiedParameters = collectOccupiedParameters(ast, options);
  const startAt = options?.startAt ?? 100;

  for (const block of ast.blocks) {
    for (const word of block.words) {
      if (/^\d+(\.\d*)?$/.test(word.value)) {
        literalCount.set(word.value, (literalCount.get(word.value) ?? 0) + 1);
      }
    }
  }

  const repeated = Array.from(literalCount.entries()).filter(([, count]) => count >= 2);
  const freeParameters = allocateFreeParameters(occupiedParameters, repeated.length, startAt);
  const suggestions: ParameterSuggestion[] = repeated.map(([literal, count], index) => ({
    literal,
    replacement: `#${freeParameters[index]}`,
    count
  }));

  return { ast, suggestions };
}

function collectOccupiedParameters(ast: ProgramAst, options?: ParameterizeOptions): Set<number> {
  const occupied = new Set<number>();
  for (const p of options?.blacklistedParameters ?? []) {
    occupied.add(p);
  }
  for (const block of ast.blocks) {
    for (const match of block.raw.matchAll(/#(\d+)/g)) {
      occupied.add(Number(match[1]));
    }
  }
  return occupied;
}

function allocateFreeParameters(occupied: Set<number>, count: number, startAt: number): number[] {
  const result: number[] = [];
  let cursor = startAt;
  while (result.length < count) {
    if (!occupied.has(cursor)) result.push(cursor);
    cursor += 1;
  }
  return result;
}
