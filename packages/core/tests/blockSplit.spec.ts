import { describe, expect, it } from "vitest";

import {
  blockSpanToRange,
  splitProgramIntoBlockSpans,
  splitProgramIntoBlocks
} from "../src/parser/blockSplit.js";

describe("blockSplit", () => {
  it("splits newline-separated programs into trimmed non-empty blocks", () => {
    expect(splitProgramIntoBlocks("O1234\n\nG0 X1\n")).toEqual(["O1234", "G0 X1"]);
  });

  it("splits semicolon-EOB programs into blocks", () => {
    const source = "O1; G0 X1; G1 X2;";
    expect(splitProgramIntoBlocks(source, { semicolonEob: true })).toEqual([
      "O1",
      "G0 X1",
      "G1 X2"
    ]);
  });

  it("resolves multi-line semicolon block ranges", () => {
    const source = "O1;\nG0 X1\nY1;\nM30";
    const spans = splitProgramIntoBlockSpans(source, { semicolonEob: true });
    expect(spans.map((s) => s.text)).toEqual(["O1", "G0 X1", "Y1", "M30"]);
    const range = blockSpanToRange(source, spans[1]);
    expect(range.startLine).toBe(2);
    expect(range.endLine).toBe(2);
  });
});
