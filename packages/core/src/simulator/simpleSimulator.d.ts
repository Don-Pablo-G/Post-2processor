import type { ProgramAst, SimulationResult, SimulatorLimits } from "../types.js";
export declare function simpleSimulate(ast: ProgramAst, initialState: Record<string, number>, limits: SimulatorLimits): SimulationResult;
