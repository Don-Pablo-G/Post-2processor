import type { ControllerProfile } from "@cnc/core";
import { lintFanucIsoMill } from "./fanucIsoMill.js";

export const fanucIsoProfile: ControllerProfile = {
  id: "fanuc",
  name: "Fanuc ISO",
  defaultFormatStyle: {
    upperCaseWords: true,
    normalizeSpacing: true,
    removeStandaloneOptionalStops: false
  },
  validateAst: lintFanucIsoMill
};
