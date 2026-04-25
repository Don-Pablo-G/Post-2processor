import type { ProgramAdvisorOptions, ProgramAdvisorReport, ProgramAst } from "../types.js";
export declare function analyzeProgram(ast: ProgramAst, initialState: Record<string, number>, options?: ProgramAdvisorOptions): ProgramAdvisorReport;
