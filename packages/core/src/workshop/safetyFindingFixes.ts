/**
 * Catalogue mapping advisor + simulation safety finding codes to stable
 * fix titles and rationales. Parallel to controller-grammar and
 * parse-diagnostic catalogues for IDE / batch tooling.
 */

export type SafetyFindingFix = {
  code: string;
  title: string;
  rationale: string;
  replacementTemplate?: string;
};

export const SAFETY_FINDING_FIXES: Readonly<Record<string, SafetyFindingFix>> = {
  MISSING_G43_BEFORE_NEGATIVE_Z: {
    code: "MISSING_G43_BEFORE_NEGATIVE_Z",
    title: "Apply G43 length compensation before negative Z moves",
    rationale: "Negative Z without G43 risks uncontrolled Z depth at the controller.",
    replacementTemplate: "G43 H{{H}} Z{{Z}}"
  },
  SAFE_START_NOT_DETECTED: {
    code: "SAFE_START_NOT_DETECTED",
    title: "Add a safe-start block (G90 G17) near program start",
    rationale: "Absolute XY plane mode should be established before cutting moves.",
    replacementTemplate: "G90 G17"
  },
  MISSING_PROGRAM_END: {
    code: "MISSING_PROGRAM_END",
    title: "Add program end (M30 or M02)",
    rationale: "Programs without M30/M02 leave the controller in an unfinished state.",
    replacementTemplate: "M30"
  },
  TOOL_WITHOUT_G43: {
    code: "TOOL_WITHOUT_G43",
    title: "Add G43 after the tool change",
    rationale: "Tool changes should be followed by length compensation before Z work.",
    replacementTemplate: "G43 H{{H}}"
  },
  G43_WITHOUT_H: {
    code: "G43_WITHOUT_H",
    title: "Specify an H offset with G43",
    rationale: "G43 without H leaves length compensation unbound.",
    replacementTemplate: "G43 H{{H}}"
  },
  TOOL_H_MISMATCH: {
    code: "TOOL_H_MISMATCH",
    title: "Align H offset with the active tool number",
    rationale: "Mismatched T/H pairs apply the wrong length offset.",
    replacementTemplate: "T{{TOOL}}\nG43 H{{TOOL}}"
  },
  CANNED_CYCLE_NO_R: {
    code: "CANNED_CYCLE_NO_R",
    title: "Add an R plane to the canned cycle",
    rationale: "Canned cycles require an R retract plane for safe Z approach.",
    replacementTemplate: "R{{R}}"
  },
  CLAMP_ZONE_COLLISION_RISK: {
    code: "CLAMP_ZONE_COLLISION_RISK",
    title: "Review toolpath against clamp/fixture zones",
    rationale: "Motion intersects a declared clamp zone — adjust stock setup or path."
  },
  X_OUTSIDE_STOCK: {
    code: "X_OUTSIDE_STOCK",
    title: "Keep X motion inside the declared stock envelope",
    rationale: "Simulated X travel exceeds the configured stock bounds."
  },
  Y_OUTSIDE_STOCK: {
    code: "Y_OUTSIDE_STOCK",
    title: "Keep Y motion inside the declared stock envelope",
    rationale: "Simulated Y travel exceeds the configured stock bounds."
  },
  Z_OUTSIDE_EXPECTED_ENVELOPE: {
    code: "Z_OUTSIDE_EXPECTED_ENVELOPE",
    title: "Keep Z motion inside the expected envelope",
    rationale: "Simulated Z travel exceeds the configured top/bottom stock envelope."
  },
  MIXED_FEED_MODES: {
    code: "MIXED_FEED_MODES",
    title: "Use a consistent feed mode (G94 or G95) for the program",
    rationale: "Mixing per-minute and per-revolution feed modes is easy to misread on the machine."
  },
  MIXED_UNITS: {
    code: "MIXED_UNITS",
    title: "Use a single unit mode (G20 or G21) for the program",
    rationale: "Mixing inch and metric modes causes scale errors at the controller."
  },
  SIM_RAPID_Z_PLUNGE: {
    code: "SIM_RAPID_Z_PLUNGE",
    title: "Use feed (G1) for Z plunges instead of rapid (G0)",
    rationale: "Rapid Z into material is a common crash pattern in simulation."
  },
  SIM_MAIN_M99: {
    code: "SIM_MAIN_M99",
    title: "Use M30/M02 for main program end, not M99",
    rationale: "M99 on the main program loops or returns unexpectedly."
  },
  SIM_CALL_DEPTH_LIMIT: {
    code: "SIM_CALL_DEPTH_LIMIT",
    title: "Reduce nested subprogram call depth",
    rationale: "Call stack exceeded the configured simulation depth limit."
  },
  SIM_UNSUPPORTED_M97: {
    code: "SIM_UNSUPPORTED_M97",
    title: "Replace M97 with a supported local-subprogram call style",
    rationale: "M97 local subprogram calls are unsupported in this simulation profile."
  },
  SIM_GOTO_TARGET_MISS: {
    code: "SIM_GOTO_TARGET_MISS",
    title: "Fix GOTO / jump target labels",
    rationale: "A control-flow jump references a missing target block."
  },
  SIM_SUBPROGRAM_TARGET_MISS: {
    code: "SIM_SUBPROGRAM_TARGET_MISS",
    title: "Provide the missing subprogram target",
    rationale: "A subprogram call references a program number that was not found."
  },
  SIM_MAX_STEPS_LIMIT: {
    code: "SIM_MAX_STEPS_LIMIT",
    title: "Reduce program length or raise the step limit carefully",
    rationale: "Simulation stopped after hitting the configured max-steps ceiling."
  },
  SIM_MACRO_ALARM: {
    code: "SIM_MACRO_ALARM",
    title: "Resolve the macro alarm condition before running",
    rationale: "Simulation raised a macro alarm (#3000-style) during execution."
  },
  SIM_UNFINISHED_RETURN_PATH: {
    code: "SIM_UNFINISHED_RETURN_PATH",
    title: "Complete or remove unfinished return-path logic",
    rationale: "A subprogram return path did not finish cleanly in simulation."
  },
  SIM_INVALID_ASSIGNMENT: {
    code: "SIM_INVALID_ASSIGNMENT",
    title: "Fix the invalid variable assignment",
    rationale: "A macro assignment could not be evaluated during simulation."
  },
  SIM_IF_THEN_RHS_INVALID: {
    code: "SIM_IF_THEN_RHS_INVALID",
    title: "Fix the IF/THEN right-hand side expression",
    rationale: "An IF/THEN branch has an invalid RHS in simulation."
  },
  SIM_FUNCTION_DOMAIN_ERROR: {
    code: "SIM_FUNCTION_DOMAIN_ERROR",
    title: "Fix the math function domain error",
    rationale: "A macro math function received an out-of-domain argument."
  },
  SIM_CONTROL_FLOW_MISSING_END: {
    code: "SIM_CONTROL_FLOW_MISSING_END",
    title: "Add the missing END for the open control-flow block",
    rationale: "A WHILE/IF control structure is missing its END terminator."
  },
  SIM_CONTROL_FLOW_LOOP_LIMIT: {
    code: "SIM_CONTROL_FLOW_LOOP_LIMIT",
    title: "Reduce loop iterations or raise the loop limit carefully",
    rationale: "A control-flow loop hit the configured max-iteration ceiling."
  },
  SIM_CONTROL_FLOW_ORPHAN_END: {
    code: "SIM_CONTROL_FLOW_ORPHAN_END",
    title: "Remove or pair the orphan END",
    rationale: "An END was found without a matching open control-flow block."
  },
  SIM_CYCLE_PARAMETER_ISSUE: {
    code: "SIM_CYCLE_PARAMETER_ISSUE",
    title: "Correct canned-cycle parameters",
    rationale: "A canned cycle has missing or inconsistent parameters in simulation."
  },
  SIM_UNSUPPORTED_FUNCTION: {
    code: "SIM_UNSUPPORTED_FUNCTION",
    title: "Replace the unsupported macro function",
    rationale: "Simulation does not implement this macro function for the active profile."
  }
};

export function getSafetyFindingFix(code: string): SafetyFindingFix | undefined {
  return SAFETY_FINDING_FIXES[code];
}
