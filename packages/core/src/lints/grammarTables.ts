/**
 * Data-driven controller grammar pack tables. The grammar evaluator in
 * `controllerGrammar.ts` reads these tables instead of hardcoding Fanuc vs
 * Haas selection logic in multiple places.
 */

export type GrammarPackId = "haas-strict" | "fanuc-strict";

export type ControllerGrammarPackTable = {
  id: GrammarPackId;
  /** Letters that trigger duplicate-address warnings on one block. */
  duplicateAddressLetters: readonly string[];
  /** Emit CG_N_AND_O_MIXED when N and O share a block. */
  nAndOMixed: boolean;
  /** Emit CG_FANUC_MACRO_IJK_ORDER on G65 I/J/K disorder. */
  g65IjkOrder: boolean;
  /** Emit CG_FANUC_INVALID_N_O_FORMAT for out-of-range N/O. */
  strictNoFormat: boolean;
  /** Emit Fanuc program envelope / duplicate O checks. */
  programEnvelope: boolean;
};

export const GRAMMAR_PACK_TABLES: Readonly<Record<GrammarPackId, ControllerGrammarPackTable>> = {
  "haas-strict": {
    id: "haas-strict",
    duplicateAddressLetters: ["X", "Y", "Z", "F", "S", "T", "H", "D", "R"],
    nAndOMixed: true,
    g65IjkOrder: true,
    strictNoFormat: false,
    programEnvelope: false
  },
  "fanuc-strict": {
    id: "fanuc-strict",
    duplicateAddressLetters: ["X", "Y", "Z", "F", "S", "T", "H", "D", "R", "P", "Q"],
    nAndOMixed: true,
    g65IjkOrder: true,
    strictNoFormat: true,
    programEnvelope: true
  }
};

/** Map legacy pack ids used by older APIs onto table ids. */
export function normalizeGrammarPackId(id: string): GrammarPackId | undefined {
  if (id === "haas-strict" || id === "haasStrictRules") return "haas-strict";
  if (id === "fanuc-strict" || id === "fanucStrictRules") return "fanuc-strict";
  return undefined;
}

/**
 * Resolve which grammar pack tables apply for an AST / controller.
 * Controllers may set `grammarPackIds` explicitly; otherwise Fanuc contexts
 * get both packs and everyone else gets Haas-strict.
 */
export function resolveGrammarPackIds(options: {
  profileId: string;
  parseComplianceMode?: string;
  grammarPackIds?: readonly string[];
}): GrammarPackId[] {
  if (options.grammarPackIds && options.grammarPackIds.length > 0) {
    const resolved: GrammarPackId[] = [];
    for (const raw of options.grammarPackIds) {
      const id = normalizeGrammarPackId(raw);
      if (id && !resolved.includes(id)) resolved.push(id);
    }
    if (resolved.length > 0) return resolved;
  }
  const normalized = options.profileId.toLowerCase();
  const fanuc =
    normalized.includes("fanuc") || options.parseComplianceMode === "strict_fanuc";
  return fanuc ? ["haas-strict", "fanuc-strict"] : ["haas-strict"];
}
