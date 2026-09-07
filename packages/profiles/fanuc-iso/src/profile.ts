import type { ControllerProfile } from "@cnc/core";
import { lintFanucIsoMillWithCodes } from "./ruleModules.js";

export const fanucIsoProfile: ControllerProfile = {
  id: "fanuc",
  name: "Fanuc ISO",
  defaultFormatStyle: {
    upperCaseWords: true,
    normalizeSpacing: true,
    removeStandaloneOptionalStops: false
  },
  validateAst: lintFanucIsoMillWithCodes
};
