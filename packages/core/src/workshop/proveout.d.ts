import type { ProgramAst, ProveoutPatchResult, ProveoutResult } from "../types.js";
export declare function buildProveoutProgram(ast: ProgramAst, initialState: Record<string, number>): ProveoutResult;
export declare function applyProveoutMarkers(code: string, markerLines: string[]): ProveoutPatchResult;
export declare function removeProveoutMarkers(code: string): ProveoutPatchResult;
