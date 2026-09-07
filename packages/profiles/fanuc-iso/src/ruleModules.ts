import type { ControllerPackManifest, LintIssue, ProgramAst } from "@cnc/core";
import { attachRuleCodesFromDocs } from "@cnc/core";
import { lintFanucIsoMill } from "./fanucIsoMill.js";
import { fanucIsoRuleDocs } from "./rules.meta.js";

export const fanucIsoControllerManifest: ControllerPackManifest = {
  controllerKey: "fanuc",
  name: "Fanuc ISO",
  grammar: ["haas-strict", "fanuc-strict"],
  parseCompliance: "strict_fanuc"
};

export function lintFanucIsoMillWithCodes(ast: ProgramAst): LintIssue[] {
  return attachRuleCodesFromDocs(lintFanucIsoMill(ast), fanucIsoRuleDocs);
}
