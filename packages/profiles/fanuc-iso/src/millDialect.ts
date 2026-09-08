export const FANUC_MILL_DIALECT = {
  ruleIdPrefix: "fanuc",
  // Work offsets: G54-G59 only for v1 (NO Haas G154). Optional later: G54.1 Pn.
  workOffsetGCodes: [54, 55, 56, 57, 58, 59],
  spindleOnMCodes: [3, 4], // no M13/M14 for v1
  // Explicitly disabled Haas idioms:
  enableM97LocalSubs: false,
  enableThroughSpindleCoolantM88: false,
  enableG154ExtendedOffsets: false,
  enableM13M14: false,
  // Fanuc overlay:
  warnOnM97: true
} as const;
