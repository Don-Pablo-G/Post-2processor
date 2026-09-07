import type { ControllerPackManifest } from "@cnc/core";

/** Haas NGC controller pack manifest (rules apply via validateAst + rule docs). */
export const haasNgcControllerManifest: ControllerPackManifest = {
  controllerKey: "haas-ngc",
  name: "Haas NGC",
  grammar: "haas-strict",
  parseCompliance: "strict_haas"
};
