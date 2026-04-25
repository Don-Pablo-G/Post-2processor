import type { ControllerProfile } from "@cnc/core";
import { lintHaasNgcMill } from "./ngcMillLint.js";

export const haasNgcProfile: ControllerProfile = {
  id: "haas-ngc",
  name: "Haas NGC",
  defaultFormatStyle: {
    upperCaseWords: true,
    normalizeSpacing: true,
    removeStandaloneOptionalStops: false
  },
  validateAst: lintHaasNgcMill
};
