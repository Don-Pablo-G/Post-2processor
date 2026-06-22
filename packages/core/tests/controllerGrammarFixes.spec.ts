import { describe, expect, it } from "vitest";
import {
  CG_DUPLICATE_ADDRESSES_PREFIX,
  CONTROLLER_GRAMMAR_FIXES,
  getControllerGrammarFix
} from "../src/lints/controllerGrammarFixes.js";
import {
  collectControllerGrammarIssues,
  collectControllerProgramEnvelopeIssues
} from "../src/lints/controllerGrammar.js";
import { simpleParse } from "../src/parser/simpleParser.js";

function lintCodes(source: string, profileId: string): Set<string> {
  const ast = simpleParse(source, profileId);
  const codes = new Set<string>();
  ast.blocks.forEach((block, blockIndex) => {
    for (const issue of collectControllerGrammarIssues(ast, block, blockIndex)) {
      if (issue.code) codes.add(issue.code);
    }
  });
  for (const issue of collectControllerProgramEnvelopeIssues(ast)) {
    if (issue.code) codes.add(issue.code);
  }
  return codes;
}

const FANUC_TRIGGERS = [
  "G0 X0",
  "O1234 N5",
  "O999999999",
  "G65 P9000 K1 J2 I3",
  "O1234",
  "O1234",
  "G1 X1 X2 Y3 Y4 F100"
].join("\n");

const HAAS_TRIGGERS = [
  "O1234 N5",
  "G65 P9000 K1 J2 I3",
  "G1 X1 X2 Y3 Y4 F100"
].join("\n");

describe("controllerGrammarFixes catalogue", () => {
  it("covers every CG_* code emitted by today's controllerGrammar rules", () => {
    const fanucCodes = lintCodes(FANUC_TRIGGERS, "fanuc-iso");
    const haasCodes = lintCodes(HAAS_TRIGGERS, "haas-ngc");
    const emitted = new Set<string>([...fanucCodes, ...haasCodes]);

    expect(emitted.size).toBeGreaterThan(0);

    const exactCatalogueKeys = Object.keys(CONTROLLER_GRAMMAR_FIXES).filter(
      (k) => !k.endsWith("*")
    );

    for (const code of emitted) {
      const isExact = exactCatalogueKeys.includes(code);
      const isDuplicateAddressFamily = code.startsWith(
        CG_DUPLICATE_ADDRESSES_PREFIX
      );
      expect(
        isExact || isDuplicateAddressFamily,
        `controllerGrammar emitted code ${code} but no catalogue entry covers it`
      ).toBe(true);
    }
  });

  it("triggers the expected anchor codes for both Fanuc and Haas profiles", () => {
    const fanucCodes = lintCodes(FANUC_TRIGGERS, "fanuc-iso");
    expect(fanucCodes.has("CG_N_AND_O_MIXED")).toBe(true);
    expect(fanucCodes.has("CG_FANUC_INVALID_N_O_FORMAT")).toBe(true);
    expect(fanucCodes.has("CG_FANUC_MACRO_IJK_ORDER")).toBe(true);
    expect(fanucCodes.has("CG_DUPLICATE_O_HEADER")).toBe(true);
    expect(fanucCodes.has("CG_FANUC_PROGRAM_ENVELOPE")).toBe(true);
    expect([...fanucCodes].some((c) => c.startsWith(CG_DUPLICATE_ADDRESSES_PREFIX))).toBe(true);

    const haasCodes = lintCodes(HAAS_TRIGGERS, "haas-ngc");
    expect(haasCodes.has("CG_N_AND_O_MIXED")).toBe(true);
    expect(haasCodes.has("CG_FANUC_MACRO_IJK_ORDER")).toBe(true);
    expect([...haasCodes].some((c) => c.startsWith(CG_DUPLICATE_ADDRESSES_PREFIX))).toBe(true);
  });

  it("every catalogue entry has a non-empty title and rationale", () => {
    for (const [key, entry] of Object.entries(CONTROLLER_GRAMMAR_FIXES)) {
      expect(entry.code, `entry key ${key} mismatched code`).toBe(key);
      expect(entry.title.trim().length, `${key} title empty`).toBeGreaterThan(0);
      expect(entry.rationale.trim().length, `${key} rationale empty`).toBeGreaterThan(0);
    }
  });

  it("getControllerGrammarFix resolves exact codes and the duplicate-address family by prefix", () => {
    expect(getControllerGrammarFix("CG_N_AND_O_MIXED")?.title).toMatch(/separate block/i);
    expect(getControllerGrammarFix("CG_FANUC_PROGRAM_ENVELOPE")?.title).toMatch(/O-number header/);

    const familyEntry = getControllerGrammarFix("CG_DUPLICATE_ADDRESSES_X");
    expect(familyEntry).toBeDefined();
    expect(familyEntry!.code).toBe(`${CG_DUPLICATE_ADDRESSES_PREFIX}*`);

    const familyEntryY = getControllerGrammarFix("CG_DUPLICATE_ADDRESSES_Y");
    expect(familyEntryY).toBeDefined();
    expect(familyEntryY!.code).toBe(`${CG_DUPLICATE_ADDRESSES_PREFIX}*`);

    expect(getControllerGrammarFix("CG_NOT_A_REAL_CODE")).toBeUndefined();
    expect(getControllerGrammarFix("")).toBeUndefined();
  });
});
