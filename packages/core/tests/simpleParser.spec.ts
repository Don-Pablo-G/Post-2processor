import { describe, expect, it } from "vitest";
import { simpleParse } from "../src/parser/simpleParser.js";

describe("simpleParse edge cases", () => {
  const id = "haas-ngc";

  it("returns no blocks for empty or whitespace-only programs", () => {
    expect(simpleParse("", id)).toEqual({
      profileId: id,
      blocks: [],
      parseComplianceMode: "strict",
      parseDiagnostics: [],
      parseSummary: { errorCount: 0, warningCount: 0, hasRecovery: false, blocks: [] }
    });
    expect(simpleParse("   \n\t\r\n  ", id).blocks).toEqual([]);
  });

  it("splits CRLF, trims each line, and omits blank lines", () => {
    const ast = simpleParse("G0 X0\r\n\r\n  \r\nY1", id);
    expect(ast.blocks.map((b) => b.raw)).toEqual(["G0 X0", "Y1"]);
  });

  it("parses parenthesis-only and semicolon-only lines as zero words with comments", () => {
    const paren = simpleParse("(only paren)", id);
    expect(paren.blocks[0]!.words).toEqual([]);
    expect(paren.blocks[0]!.comment).toBe("only paren");

    const semi = simpleParse("; only semi", id);
    expect(semi.blocks[0]!.words).toEqual([]);
    expect(semi.blocks[0]!.comment).toBe("only semi");
  });

  it("joins multiple parenthesis comments and merges semicolon comment", () => {
    const ast = simpleParse("(a) (b) ; tail", id);
    expect(ast.blocks[0]!.words).toEqual([]);
    expect(ast.blocks[0]!.comment).toBe("a | b | tail");
  });

  it("strips all balanced parenthesis spans before word extraction", () => {
    const ast = simpleParse("G0 (note) X1 (more)", id);
    expect(ast.blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
    expect(ast.blocks[0]!.comment).toBe("note | more");
  });

  it("treats an unmatched '(' as the start of trailing comment text", () => {
    const ast = simpleParse("G0 X1 (no close", id);
    expect(ast.blocks[0]!.words.map((w) => [w.letter, w.value])).toContainEqual(["G", "0"]);
    expect(ast.blocks[0]!.words.map((w) => [w.letter, w.value])).toContainEqual(["X", "1"]);
    expect(ast.blocks[0]!.words.some((w) => w.letter === "O" && w.value === "")).toBe(false);
  });

  it("parses bare address letters as lines with zero words", () => {
    expect(simpleParse("G", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("N", id).blocks[0]!.words).toEqual([]);
  });

  it("collapses whitespace inside numeric values", () => {
    const ast = simpleParse("X +0. 12 34", id);
    expect(ast.blocks[0]!.words).toEqual([{ letter: "X", value: "+0.1234" }]);
  });

  it("does not treat scientific notation as a single numeric token", () => {
    const ast = simpleParse("X1e2", id);
    expect(ast.blocks[0]!.words).toEqual([
      { letter: "X", value: "1" },
      { letter: "E", value: "2" }
    ]);
  });

  it("parses leading block-delete slash when the first address follows immediately", () => {
    expect(simpleParse("/G0X1", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
  });

  it("parses slash with spaces before the first word", () => {
    expect(simpleParse("/ G0 X1", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
  });

  it("parses sharp-number, double-sharp, and sharp-bracket forms", () => {
    expect(simpleParse("#100", id).blocks[0]!.words).toEqual([{ letter: "#", value: "100" }]);
    expect(simpleParse("##1", id).blocks[0]!.words).toEqual([{ letter: "#", value: "#1" }]);
    expect(simpleParse("#[100]", id).blocks[0]!.words).toEqual([{ letter: "#", value: "[100]" }]);
  });

  it("parses only the leading #number on assignment-looking lines (tokenizer boundary)", () => {
    expect(simpleParse("#100=0", id).blocks[0]!.words).toEqual([{ letter: "#", value: "100" }]);
  });

  it("uppercases letters and still parses packed addresses", () => {
    expect(simpleParse("g0x1y-2", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" },
      { letter: "Y", value: "-2" }
    ]);
  });

  it("does not match empty brackets as a bracket expression word", () => {
    expect(simpleParse("[]", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("[ ]", id).blocks[0]!.words).toEqual([]);
  });

  it("does not emit incidental address tokens from macro keyword text", () => {
    const ast = simpleParse("WHILE [1] DO1", id);
    expect(ast.blocks[0]!.words).toEqual([]);
  });

  it("strips semicolon comment and everything after first semicolon in the code segment", () => {
    const ast = simpleParse("G0 X1;; second", id);
    expect(ast.blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
    expect(ast.blocks[0]!.comment).toBe("; second");
  });
});

describe("simpleParse more edge cases", () => {
  const id = "haas-ngc";

  it("treats a lone percent or slash line as zero words", () => {
    expect(simpleParse("%", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("/", id).blocks[0]!.words).toEqual([]);
  });

  it("drops a second leading slash so motion still tokenizes", () => {
    expect(simpleParse("//G0X1", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
  });

  it("does not split on carriage return without line feed", () => {
    const line = `G0X1${String.fromCharCode(13)}Y2`;
    const ast = simpleParse(line, id);
    expect(ast.blocks).toHaveLength(1);
    expect(ast.blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" },
      { letter: "Y", value: "2" }
    ]);
  });

  it("parses leading-dot decimals and rejects a lone dot without a letter", () => {
    expect(simpleParse("X.5", id).blocks[0]!.words).toEqual([{ letter: "X", value: ".5" }]);
    expect(simpleParse(".5", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("X.", id).blocks[0]!.words).toEqual([]);
  });

  it("allows spaces between a letter and its numeric value", () => {
    expect(simpleParse("G . 5", id).blocks[0]!.words).toEqual([{ letter: "G", value: ".5" }]);
  });

  it("parses packed arc vector words", () => {
    expect(simpleParse("I-0J.5", id).blocks[0]!.words).toEqual([
      { letter: "I", value: "-0" },
      { letter: "J", value: ".5" }
    ]);
  });

  it("does not create an address word with an empty numeric value", () => {
    expect(simpleParse("M99 P Q1", id).blocks[0]!.words).toEqual([
      { letter: "M", value: "99" },
      { letter: "Q", value: "1" }
    ]);
  });

  it("preserves leading zeros in N and O numbers", () => {
    expect(simpleParse("N001", id).blocks[0]!.words).toEqual([{ letter: "N", value: "001" }]);
    expect(simpleParse("O0001", id).blocks[0]!.words).toEqual([{ letter: "O", value: "0001" }]);
  });

  it("does not parse GOTO text as an O address word", () => {
    expect(simpleParse("GOTO1", id).blocks[0]!.words).toEqual([]);
  });

  it("keeps true macro variable tokens in IF…GOTO text", () => {
    expect(simpleParse("IF[#1EQ1]GOTO1", id).blocks[0]!.words).toEqual([
      { letter: "#", value: "1" }
    ]);
  });

  it("parses macro-style values after rotary axes", () => {
    expect(simpleParse("A#100", id).blocks[0]!.words).toEqual([{ letter: "A", value: "#100" }]);
  });

  it("parses bracket expressions as a single address value", () => {
    expect(simpleParse("X[1+2]", id).blocks[0]!.words).toEqual([{ letter: "X", value: "[1+2]" }]);
    expect(simpleParse("X[1+2]Y3", id).blocks[0]!.words).toEqual([
      { letter: "X", value: "[1+2]" },
      { letter: "Y", value: "3" }
    ]);
  });

  it("strips only the first balanced parenthesis span when comments are nested", () => {
    const ast = simpleParse("(outer (inner)) G0 X1", id);
    expect(ast.blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
    expect(ast.blocks[0]!.comment).toBe("outer (inner");
  });

  it("merges semicolon tail comments oddly when a semicolon appears inside parentheses", () => {
    const ast = simpleParse("G0 (a;b)", id);
    expect(ast.blocks[0]!.words).toEqual([{ letter: "G", value: "0" }]);
    expect(ast.blocks[0]!.comment).toBe("a;b | b)");
  });

  it("treats a lone sharp as zero words", () => {
    expect(simpleParse("#", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("##", id).blocks[0]!.words).toEqual([]);
  });

  it("strips a NUL control character between tokens without breaking words", () => {
    const line = `G0X1${String.fromCharCode(0)}Y2`;
    expect(simpleParse(line, id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" },
      { letter: "Y", value: "2" }
    ]);
  });
});

describe("simpleParse further edge cases", () => {
  const id = "haas-ngc";

  it("accepts tab whitespace between packed words", () => {
    expect(simpleParse("G0\tX0", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "0" }
    ]);
  });

  it("trims leading and trailing spaces on each line before tokenizing", () => {
    expect(simpleParse("  G0 X1  ", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
  });

  it("parses double-sharp macro indices with digits", () => {
    expect(simpleParse("##100", id).blocks[0]!.words).toEqual([{ letter: "#", value: "#100" }]);
  });

  it("parses consecutive macro references as separate sharp words", () => {
    expect(simpleParse("#100.#101", id).blocks[0]!.words).toEqual([
      { letter: "#", value: "100" },
      { letter: "#", value: "101" }
    ]);
  });

  it("yields no words for double-sign or sign-run prefixes on a numeric value", () => {
    expect(simpleParse("X--1", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("X+-1", id).blocks[0]!.words).toEqual([]);
  });

  it("parses packed M98 and G65 macro-call style lines", () => {
    expect(simpleParse("M98P1000", id).blocks[0]!.words).toEqual([
      { letter: "M", value: "98" },
      { letter: "P", value: "1000" }
    ]);
    expect(simpleParse("G65P9010A1", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "65" },
      { letter: "P", value: "9010" },
      { letter: "A", value: "1" }
    ]);
  });

  it("does not parse END and DO keywords as address words", () => {
    expect(simpleParse("END1", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("DO1", id).blocks[0]!.words).toEqual([]);
  });

  it("keeps macro variable token from THEN-style assignment-looking text", () => {
    expect(simpleParse("THEN#100=1", id).blocks[0]!.words).toEqual([{ letter: "#", value: "100" }]);
  });

  it("strips a leading close-paren before tokenizing words", () => {
    expect(simpleParse(")G0X1", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
  });

  it("handles a UTF-8 BOM at the start of the first line", () => {
    const line = `${String.fromCharCode(0xfeff)}G0X1`;
    expect(simpleParse(line, id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
  });

  it("stops a numeric token at the second decimal point", () => {
    expect(simpleParse("X1.2.3", id).blocks[0]!.words).toEqual([{ letter: "X", value: "1.2" }]);
  });

  it("parses secondary-plane and arc helper addresses", () => {
    expect(simpleParse("D01", id).blocks[0]!.words).toEqual([{ letter: "D", value: "01" }]);
    expect(simpleParse("L10 P2", id).blocks[0]!.words).toEqual([
      { letter: "L", value: "10" },
      { letter: "P", value: "2" }
    ]);
    expect(simpleParse("R-0.25", id).blocks[0]!.words).toEqual([{ letter: "R", value: "-0.25" }]);
    expect(simpleParse("K1.5", id).blocks[0]!.words).toEqual([{ letter: "K", value: "1.5" }]);
    expect(simpleParse("U0.1V0.2", id).blocks[0]!.words).toEqual([
      { letter: "U", value: "0.1" },
      { letter: "V", value: "0.2" }
    ]);
    expect(simpleParse("W-1", id).blocks[0]!.words).toEqual([{ letter: "W", value: "-1" }]);
  });

  it("splits Z plus macro plus bracket into separate words (bracket is not merged into Z)", () => {
    expect(simpleParse("Z#101[#102]", id).blocks[0]!.words).toEqual([
      { letter: "Z", value: "#101" },
      { letter: "#", value: "102" }
    ]);
  });

  it("captures only the innermost text for doubled empty parentheses", () => {
    const ast = simpleParse("(()) G0", id);
    expect(ast.blocks[0]!.words).toEqual([{ letter: "G", value: "0" }]);
    expect(ast.blocks[0]!.comment).toBe("(");
  });

  it("treats a whitespace-only parenthesis comment as no comment field", () => {
    const ast = simpleParse("G0 ( )", id);
    expect(ast.blocks[0]!.words).toEqual([{ letter: "G", value: "0" }]);
    expect(ast.blocks[0]!.comment).toBeUndefined();
  });

  it("parses O and N lines with trailing program comments", () => {
    expect(simpleParse("O1000 (prog)", id).blocks[0]!.words).toEqual([{ letter: "O", value: "1000" }]);
    expect(simpleParse("O1000 (prog)", id).blocks[0]!.comment).toBe("prog");
    expect(simpleParse("N10 (n line)", id).blocks[0]!.words).toEqual([{ letter: "N", value: "10" }]);
    expect(simpleParse("N10 (n line)", id).blocks[0]!.comment).toBe("n line");
  });

  it("ignores a trailing backslash after the last word on a line", () => {
    expect(simpleParse("G0X1\\", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
  });
});

describe("simpleParse even more edge cases", () => {
  const id = "haas-ngc";

  it("parses a slash between two modal words without dropping the second mode", () => {
    expect(simpleParse("G0 / G1X1", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "G", value: "1" },
      { letter: "X", value: "1" }
    ]);
  });

  it("allows a unary sign on the G-code number itself", () => {
    expect(simpleParse("G-0.5", id).blocks[0]!.words).toEqual([{ letter: "G", value: "-0.5" }]);
    expect(simpleParse("G+0", id).blocks[0]!.words).toEqual([{ letter: "G", value: "+0" }]);
  });

  it("produces a block with no words for digit-only lines", () => {
    expect(simpleParse("0", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("123", id).blocks[0]!.words).toEqual([]);
  });

  it("preserves two-digit G values in the word value", () => {
    expect(simpleParse("G00X0", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "00" },
      { letter: "X", value: "0" }
    ]);
  });

  it("does not attach a semicolon comment when nothing follows the semicolon", () => {
    const ast = simpleParse("G0 ;", id).blocks[0]!;
    expect(ast.words).toEqual([{ letter: "G", value: "0" }]);
    expect(ast.comment).toBeUndefined();
  });

  it("captures a semicolon tail that is only further semicolons", () => {
    expect(simpleParse("G0X1; ;", id).blocks[0]!.comment).toBe(";");
  });

  it("parses a colon immediately after an N number", () => {
    expect(simpleParse("N10:G0X0", id).blocks[0]!.words).toEqual([
      { letter: "N", value: "10" },
      { letter: "G", value: "0" },
      { letter: "X", value: "0" }
    ]);
  });

  it("truncates nested bracket expressions to the first closing bracket", () => {
    expect(simpleParse("X[[1]]", id).blocks[0]!.words).toEqual([{ letter: "X", value: "[[1]" }]);
  });

  it("does not tokenize PRINT/EQ keyword text as address words", () => {
    expect(simpleParse("PRINT[1]", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("EQ[1]", id).blocks[0]!.words).toEqual([]);
  });

  it("keeps macro variable token from WHILE bracket conditions", () => {
    expect(simpleParse("WHILE[#1LT1]DO1", id).blocks[0]!.words).toEqual([
      { letter: "#", value: "1" }
    ]);
  });

  it("yields no words for alphabetic text that never starts an address pattern", () => {
    expect(simpleParse("SUBPROGRAM", id).blocks[0]!.words).toEqual([]);
  });

  it("ignores CALL letters that have no numeric or macro value", () => {
    expect(simpleParse("CALL O1000", id).blocks[0]!.words).toEqual([
      { letter: "O", value: "1000" }
    ]);
  });

  it("parses extended three-digit G codes with P arguments", () => {
    expect(simpleParse("G103 P1", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "103" },
      { letter: "P", value: "1" }
    ]);
    expect(simpleParse("G154 P12", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "154" },
      { letter: "P", value: "12" }
    ]);
  });

  it("parses B and C rotary words on one line", () => {
    expect(simpleParse("B90. C180.", id).blocks[0]!.words).toEqual([
      { letter: "B", value: "90." },
      { letter: "C", value: "180." }
    ]);
  });

  it("parses small decimal magnitudes on Q and Z", () => {
    expect(simpleParse("Q-0.001", id).blocks[0]!.words).toEqual([{ letter: "Q", value: "-0.001" }]);
    expect(simpleParse("Z0.0001", id).blocks[0]!.words).toEqual([{ letter: "Z", value: "0.0001" }]);
  });

  it("splits signed scientific-like tails into separate E words", () => {
    expect(simpleParse("X1E-3", id).blocks[0]!.words).toEqual([
      { letter: "X", value: "1" },
      { letter: "E", value: "-3" }
    ]);
  });

  it("joins three parenthesis comments on one motion line", () => {
    const ast = simpleParse("G0 (a) (b) (c)", id).blocks[0]!;
    expect(ast.words).toEqual([{ letter: "G", value: "0" }]);
    expect(ast.comment).toBe("a | b | c");
  });

  it("treats bare S, F, and M letters as zero-word lines", () => {
    expect(simpleParse("S", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("F", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("M", id).blocks[0]!.words).toEqual([]);
  });

  it("ignores two trailing backslashes after the last word", () => {
    expect(simpleParse("G0X1\\\\", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
  });

  it("merges semicolon-first and parenthesis comments into one comment field", () => {
    const ast = simpleParse(";(no code)", id).blocks[0]!;
    expect(ast.words).toEqual([]);
    expect(ast.comment).toBe("no code | (no code)");
  });

  it("merges a parenthesis comment and a semicolon tail on a code-free line", () => {
    const ast = simpleParse("(a);b", id).blocks[0]!;
    expect(ast.words).toEqual([]);
    expect(ast.comment).toBe("a | b");
  });
});

describe("simpleParse yet more edge cases", () => {
  const id = "haas-ngc";

  it("parses decimal G codes such as G90.1 and G43.4", () => {
    expect(simpleParse("G90.1X1", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "90.1" },
      { letter: "X", value: "1" }
    ]);
    expect(simpleParse("G43.4", id).blocks[0]!.words).toEqual([{ letter: "G", value: "43.4" }]);
  });

  it("parses M98 with both P and L on one line", () => {
    expect(simpleParse("M98 P1000 L2", id).blocks[0]!.words).toEqual([
      { letter: "M", value: "98" },
      { letter: "P", value: "1000" },
      { letter: "L", value: "2" }
    ]);
  });

  it("parses local coordinate system and dwell/probe style lines", () => {
    expect(simpleParse("G52 X0 Y0", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "52" },
      { letter: "X", value: "0" },
      { letter: "Y", value: "0" }
    ]);
    expect(simpleParse("G04 P1.", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "04" },
      { letter: "P", value: "1." }
    ]);
    expect(simpleParse("G31 Z-1. F10.", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "31" },
      { letter: "Z", value: "-1." },
      { letter: "F", value: "10." }
    ]);
  });

  it("parses N and T lines whose values are macro references", () => {
    expect(simpleParse("N#100", id).blocks[0]!.words).toEqual([{ letter: "N", value: "#100" }]);
    expect(simpleParse("T#100", id).blocks[0]!.words).toEqual([{ letter: "T", value: "#100" }]);
  });

  it("parses X with a macro value then a separate sharp word after a dot", () => {
    expect(simpleParse("X#100.#101", id).blocks[0]!.words).toEqual([
      { letter: "X", value: "#100" },
      { letter: "#", value: "101" }
    ]);
  });

  it("parses motion words when several backslashes precede the first letter", () => {
    expect(simpleParse("\\\\G0X1", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
  });

  it("merges an empty paren comment with a semicolon tail on the same line", () => {
    const ast = simpleParse("G0X1 ( ) ; tail", id).blocks[0]!;
    expect(ast.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
    expect(ast.comment).toBe("tail");
  });

  it("duplicates semicolon and parenthesis text when the tail looks like a paren comment", () => {
    const ast = simpleParse("G0 ; (not paren)", id).blocks[0]!;
    expect(ast.words).toEqual([{ letter: "G", value: "0" }]);
    expect(ast.comment).toBe("not paren | (not paren)");
  });

  it("captures odd comment merging when semicolons appear inside parentheses", () => {
    const ast = simpleParse("G0 ( ; )", id).blocks[0]!;
    expect(ast.words).toEqual([{ letter: "G", value: "0" }]);
    expect(ast.comment).toBe("; | )");
  });

  it("strips only the first balanced span for nested parentheses in a comment", () => {
    const ast = simpleParse("M0 (a (b) c)", id).blocks[0]!;
    expect(ast.words).toEqual([{ letter: "M", value: "0" }]);
    expect(ast.comment).toBe("a (b");
  });

  it("keeps macro variable token from SELECT…GOTO text", () => {
    expect(simpleParse("SELECT[#100EQ1]GOTO1", id).blocks[0]!.words).toEqual([
      { letter: "#", value: "100" }
    ]);
  });

  it("yields no words for ELSE and ENDIF keyword-only lines", () => {
    expect(simpleParse("ELSE", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("ENDIF", id).blocks[0]!.words).toEqual([]);
  });

  it("parses negative P values on M99", () => {
    expect(simpleParse("M99 P-1", id).blocks[0]!.words).toEqual([
      { letter: "M", value: "99" },
      { letter: "P", value: "-1" }
    ]);
  });

  it("parses G65 with P, Q, and R packed on one line", () => {
    expect(simpleParse("G65 P9010 Q1 R2", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "65" },
      { letter: "P", value: "9010" },
      { letter: "Q", value: "1" },
      { letter: "R", value: "2" }
    ]);
  });

  it("parses a positive exponent tail as a separate E word", () => {
    expect(simpleParse("G0 X1E+2", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" },
      { letter: "E", value: "+2" }
    ]);
  });

  it("parses very small leading-dot values", () => {
    expect(simpleParse("X.0000001", id).blocks[0]!.words).toEqual([{ letter: "X", value: ".0000001" }]);
  });

  it("yields no words when a sign is not followed by a numeric tail", () => {
    expect(simpleParse("Z-", id).blocks[0]!.words).toEqual([]);
    expect(simpleParse("X+", id).blocks[0]!.words).toEqual([]);
  });

  it("ignores punctuation that does not start an address letter", () => {
    expect(simpleParse("G0 ,1", id).blocks[0]!.words).toEqual([{ letter: "G", value: "0" }]);
    expect(simpleParse("G0 :1", id).blocks[0]!.words).toEqual([{ letter: "G", value: "0" }]);
    expect(simpleParse("G0 =1", id).blocks[0]!.words).toEqual([{ letter: "G", value: "0" }]);
    expect(simpleParse("G0 _1", id).blocks[0]!.words).toEqual([{ letter: "G", value: "0" }]);
  });

  it("treats Unicode line separators between packed words as whitespace", () => {
    const ls = String.fromCharCode(0x2028);
    const ps = String.fromCharCode(0x2029);
    expect(simpleParse(`G0X1${ls}Y2`, id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" },
      { letter: "Y", value: "2" }
    ]);
    expect(simpleParse(`G0X1${ps}Y2`, id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" },
      { letter: "Y", value: "2" }
    ]);
  });

  it("treats NBSP and em space between words as whitespace", () => {
    expect(simpleParse("G0X1\u00a0Y2", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" },
      { letter: "Y", value: "2" }
    ]);
    expect(simpleParse("G0X1\u2003Y2", id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" },
      { letter: "Y", value: "2" }
    ]);
  });

  it("parses words when a non-trimmable control character precedes the first letter", () => {
    const line = `${String.fromCharCode(0x85)}G0X1`;
    expect(simpleParse(line, id).blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "1" }
    ]);
  });
});

describe("simpleParse compliance modes", () => {
  const id = "haas-ngc";

  it("uses strict mode by default", () => {
    expect(simpleParse("M99 P Q1", id).blocks[0]!.words).toEqual([
      { letter: "M", value: "99" },
      { letter: "Q", value: "1" }
    ]);
  });

  it("treats strict_haas and strict_fanuc as strict lexer modes", () => {
    const strictHaas = simpleParse("M99 P Q1", id, { complianceMode: "strict_haas" });
    const strictFanuc = simpleParse("M99 P Q1", id, { complianceMode: "strict_fanuc" });
    expect(strictHaas.blocks[0]!.words).toEqual([
      { letter: "M", value: "99" },
      { letter: "Q", value: "1" }
    ]);
    expect(strictFanuc.blocks[0]!.words).toEqual([
      { letter: "M", value: "99" },
      { letter: "Q", value: "1" }
    ]);
  });

  it("restores legacy empty-value tokenization in lenient mode", () => {
    expect(simpleParse("M99 P Q1", id, { complianceMode: "lenient" }).blocks[0]!.words).toEqual([
      { letter: "M", value: "99" },
      { letter: "P", value: "" },
      { letter: "Q", value: "1" }
    ]);
  });

  it("restores legacy unmatched-parenthesis tokenization in lenient mode", () => {
    const strict = simpleParse("G0 X1 (no close", id);
    const lenient = simpleParse("G0 X1 (no close", id, { complianceMode: "lenient" });
    expect(strict.blocks[0]!.words.some((w) => w.letter === "O" && w.value === "")).toBe(false);
    expect(lenient.blocks[0]!.words.some((w) => w.letter === "O" && w.value === "")).toBe(true);
  });
});

describe("simpleParse semicolon EOB mode", () => {
  const id = "haas-ngc";

  it("keeps legacy semicolon-tail behavior by default", () => {
    const ast = simpleParse("G0 X0; G1 X1; M30;", id);
    expect(ast.blocks).toHaveLength(1);
    expect(ast.blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "0" }
    ]);
  });

  it("splits multiple semicolon-terminated blocks when semicolonEob is enabled", () => {
    const ast = simpleParse("G0 X0; G1 X1; M30;", id, { semicolonEob: true });
    expect(ast.blocks).toHaveLength(3);
    expect(ast.blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "0" }
    ]);
    expect(ast.blocks[1]!.words).toEqual([
      { letter: "G", value: "1" },
      { letter: "X", value: "1" }
    ]);
    expect(ast.blocks[2]!.words).toEqual([{ letter: "M", value: "30" }]);
  });

  it("does not split semicolons inside parentheses or bracket expressions", () => {
    const ast = simpleParse("(A;B) G0 X[1;2]; M30;", id, { semicolonEob: true });
    expect(ast.blocks).toHaveLength(2);
    expect(ast.blocks[0]!.words).toEqual([
      { letter: "G", value: "0" },
      { letter: "X", value: "[1;2]" }
    ]);
    expect(ast.blocks[1]!.words).toEqual([{ letter: "M", value: "30" }]);
  });
});

describe("simpleParse spans and diagnostics", () => {
  const id = "haas-ngc";

  it("adds token spans when includeTokenSpans is enabled", () => {
    const ast = simpleParse("G1 X10. Y5.", id, { includeTokenSpans: true });
    const words = ast.blocks[0]!.words;
    expect(words.every((w) => w.span && w.span.end > w.span.start)).toBe(true);
    expect(words[0]!.span!.start).toBe(0);
    expect(words[1]!.span!.start).toBeGreaterThanOrEqual(words[0]!.span!.end);
    expect(words[2]!.span!.start).toBeGreaterThanOrEqual(words[1]!.span!.end);
  });

  it("emits unmatched parenthesis diagnostics in strict mode", () => {
    const ast = simpleParse("G0 X1 (no close", id, { includeTokenSpans: true });
    expect(ast.parseDiagnostics?.some((d) => d.code === "UNMATCHED_OPEN_PAREN")).toBe(true);
  });

  it("emits missing-value diagnostics in strict mode", () => {
    const ast = simpleParse("G0 X Y1", id, { includeTokenSpans: true });
    expect(ast.parseDiagnostics?.some((d) => d.code === "ADDRESS_MISSING_VALUE")).toBe(true);
  });

  it("attaches expression AST for bracket-valued words when enabled", () => {
    const ast = simpleParse("X[#100+1.]", id, { includeExpressionAst: true });
    const expression = ast.blocks[0]!.words[0]!.expressionAst;
    expect(expression?.kind).toBe("binary");
  });

  it("emits bracket diagnostics for unmatched or invalid bracket expressions", () => {
    const unmatched = simpleParse("X[#100+1", id, { includeExpressionAst: true, includeTokenSpans: true });
    expect(unmatched.parseDiagnostics?.some((d) => d.code === "UNMATCHED_BRACKET")).toBe(true);

    const invalid = simpleParse("X[#100+]", id, { includeExpressionAst: true });
    expect(invalid.parseDiagnostics?.some((d) => d.code === "BRACKET_EXPRESSION_INVALID")).toBe(true);
  });

  it("emits unknown-token diagnostics and recovers to parse following words", () => {
    const ast = simpleParse("G1 @@@ X1", id, { includeTokenSpans: true });
    expect(ast.parseDiagnostics?.some((d) => d.code === "UNKNOWN_TOKEN")).toBe(true);
    expect(ast.blocks[0]!.words.some((w) => w.letter === "X" && w.value === "1")).toBe(true);
  });

  it("applies controller-specific strict invalid-character policy", () => {
    const strictFanuc = simpleParse("G1 X1 {", id, { complianceMode: "strict_fanuc", includeTokenSpans: true });
    const strictHaas = simpleParse("G1 X1 {", id, { complianceMode: "strict_haas", includeTokenSpans: true });
    expect(strictFanuc.parseDiagnostics?.some((d) => d.code === "INVALID_CHARACTER")).toBe(true);
    expect(strictHaas.parseDiagnostics?.some((d) => d.code === "INVALID_CHARACTER")).toBe(false);
  });

  it("computes parse summary totals and per-block counts", () => {
    const ast = simpleParse("G1 @@@ X1\nG0 X", id);
    expect(ast.parseSummary?.warningCount).toBeGreaterThanOrEqual(2);
    expect(ast.parseSummary?.errorCount).toBe(0);
    expect(ast.parseSummary?.hasRecovery).toBe(true);
    expect(ast.parseSummary?.blocks).toHaveLength(2);
    expect(ast.parseSummary?.blocks[0]?.warningCount).toBeGreaterThanOrEqual(1);
    expect(ast.parseSummary?.blocks[1]?.warningCount).toBeGreaterThanOrEqual(1);
  });

  it("emits non-mutating fix suggestions on common parse diagnostics", () => {
    const unmatchedParen = simpleParse("G0 X1 (NO CLOSE", id, { includeTokenSpans: true });
    const unmatchedDiag = unmatchedParen.parseDiagnostics?.find((d) => d.code === "UNMATCHED_OPEN_PAREN");
    expect(unmatchedDiag?.suggestedFixes?.some((f) => f.title.includes("Close the comment"))).toBe(true);

    const missingValue = simpleParse("G0 X Y1", id, { includeTokenSpans: true });
    const missingDiag = missingValue.parseDiagnostics?.find((d) => d.code === "ADDRESS_MISSING_VALUE");
    expect(missingDiag?.suggestedFixes?.some((f) => f.replacement === "X0")).toBe(true);

    const unknownToken = simpleParse("G1 @@@ X1", id, { includeTokenSpans: true });
    const unknownDiag = unknownToken.parseDiagnostics?.find((d) => d.code === "UNKNOWN_TOKEN");
    expect(unknownDiag?.suggestedFixes?.length).toBeGreaterThan(0);

    const invalidChar = simpleParse("G1 X1 {", id, { complianceMode: "strict_fanuc", includeTokenSpans: true });
    const invalidDiag = invalidChar.parseDiagnostics?.find((d) => d.code === "INVALID_CHARACTER");
    expect(invalidDiag?.suggestedFixes?.some((f) => f.title.includes("Remove unsupported character"))).toBe(true);

    const invalidExpr = simpleParse("X[#100+]", id, { includeExpressionAst: true });
    const exprDiag = invalidExpr.parseDiagnostics?.find((d) => d.code === "BRACKET_EXPRESSION_INVALID");
    expect(exprDiag?.suggestedFixes?.some((f) => f.title.includes("Fix bracket expression syntax"))).toBe(true);
  });
});

describe("simpleParse suggestion payload edge cases", () => {
  const id = "haas-ngc";

  it("UNMATCHED_OPEN_PAREN suggestion has explicit ')' replacement", () => {
    const ast = simpleParse("G0 X1 (NO CLOSE", id, { includeTokenSpans: true });
    const diag = ast.parseDiagnostics?.find((d) => d.code === "UNMATCHED_OPEN_PAREN");
    expect(diag?.suggestedFixes).toEqual([
      { title: "Close the comment with ')'", replacement: ")" }
    ]);
  });

  it("UNMATCHED_CLOSE_PAREN suggestion proposes removal without replacement", () => {
    const ast = simpleParse("G0 X1)", id, { includeTokenSpans: true });
    const diag = ast.parseDiagnostics?.find((d) => d.code === "UNMATCHED_CLOSE_PAREN");
    expect(diag?.suggestedFixes).toEqual([{ title: "Remove unmatched ')'" }]);
    expect(diag?.suggestedFixes?.[0]?.replacement).toBeUndefined();
  });

  it("ADDRESS_MISSING_VALUE suggests both replacement and comment fallback", () => {
    const ast = simpleParse("G0 X Y1", id, { includeTokenSpans: true });
    const diag = ast.parseDiagnostics?.find((d) => d.code === "ADDRESS_MISSING_VALUE");
    expect(diag?.suggestedFixes).toEqual([
      { title: "Add numeric value after X", replacement: "X0" },
      { title: "If X is intentional text, move it into a comment" }
    ]);
  });

  it("UNKNOWN_TOKEN suggestion echoes the compact token text", () => {
    const ast = simpleParse("G1 @@@ X1", id, { includeTokenSpans: true });
    const diag = ast.parseDiagnostics?.find((d) => d.code === "UNKNOWN_TOKEN");
    expect(diag?.suggestedFixes?.[0]?.title).toBe("Remove unknown token '@@@'");
    expect(diag?.suggestedFixes?.[1]?.title).toContain("Replace it with a valid address word");
  });

  it("INVALID_CHARACTER suggestion mentions the offending character", () => {
    const ast = simpleParse("G1 X1 {", id, { complianceMode: "strict_fanuc", includeTokenSpans: true });
    const diag = ast.parseDiagnostics?.find((d) => d.code === "INVALID_CHARACTER");
    expect(diag?.suggestedFixes).toEqual([
      { title: "Remove unsupported character '{'" },
      { title: "Replace with a valid operator/symbol for this compliance mode" }
    ]);
  });

  it("UNMATCHED_BRACKET direction differs by open/close imbalance", () => {
    const tooManyOpens = simpleParse("X[#100+1", id, { includeTokenSpans: true });
    const openDiag = tooManyOpens.parseDiagnostics?.find((d) => d.code === "UNMATCHED_BRACKET");
    expect(openDiag?.suggestedFixes).toEqual([
      { title: "Add missing ']'", replacement: "]" }
    ]);

    const tooManyCloses = simpleParse("X#100+1]]", id, { includeTokenSpans: true });
    const closeDiag = tooManyCloses.parseDiagnostics?.find((d) => d.code === "UNMATCHED_BRACKET");
    expect(closeDiag?.suggestedFixes).toEqual([{ title: "Remove extra ']'" }]);
    expect(closeDiag?.suggestedFixes?.[0]?.replacement).toBeUndefined();
  });

  it("BRACKET_EXPRESSION_INVALID exposes both syntax-fix and balance-helpers", () => {
    const ast = simpleParse("X[#100+]", id, { includeExpressionAst: true });
    const diag = ast.parseDiagnostics?.find((d) => d.code === "BRACKET_EXPRESSION_INVALID");
    expect(diag?.suggestedFixes).toEqual([
      { title: "Fix bracket expression syntax so it parses as a single expression" },
      { title: "Use balanced operators/operands (for example [#100+1])" }
    ]);
  });

  it("does not mutate AST blocks despite emitting suggestions", () => {
    const program = "G0 X1 (NO CLOSE\nG0 X Y1\nG1 @@@ X1\nX[#100+]";
    const ast = simpleParse(program, id, { includeTokenSpans: true, includeExpressionAst: true });
    const blockRaws = ast.blocks.map((b) => b.raw);
    expect(blockRaws).toEqual([
      "G0 X1 (NO CLOSE",
      "G0 X Y1",
      "G1 @@@ X1",
      "X[#100+]"
    ]);
  });
});

describe("simpleParse fuzz properties", () => {
  const id = "haas-ngc";

  function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  function randomProgram(rng: () => number): string {
    const alphabet = "GXYZFIJKRMPNOTHDSQ#[]()+-*/=;:,. \t\r\n_%{}<>@!?\\";
    const lines = 1 + Math.floor(rng() * 6);
    let out = "";
    for (let l = 0; l < lines; l += 1) {
      const len = 5 + Math.floor(rng() * 40);
      let line = "";
      for (let i = 0; i < len; i += 1) {
        line += alphabet[Math.floor(rng() * alphabet.length)];
      }
      out += line;
      if (l < lines - 1) out += "\n";
    }
    return out;
  }

  it("is deterministic and resilient under randomized malformed input", () => {
    const rng = makeRng(0xC0FFEE);
    for (let i = 0; i < 200; i += 1) {
      const program = randomProgram(rng);
      const options = {
        complianceMode: (i % 4 === 0
          ? "strict_fanuc"
          : i % 4 === 1
            ? "strict_haas"
            : i % 4 === 2
              ? "strict"
              : "lenient") as "strict_fanuc" | "strict_haas" | "strict" | "lenient",
        semicolonEob: i % 2 === 0,
        includeTokenSpans: i % 3 === 0,
        includeExpressionAst: i % 5 === 0
      };

      const a = simpleParse(program, id, options);
      const b = simpleParse(program, id, options);

      // Deterministic parser output for identical input/options.
      expect(a).toEqual(b);

      // Parser must always return a summary aligned with diagnostics.
      const diagCount = a.parseDiagnostics?.length ?? 0;
      const summaryWarn = a.parseSummary?.warningCount ?? 0;
      const summaryErr = a.parseSummary?.errorCount ?? 0;
      expect(summaryWarn + summaryErr).toBe(diagCount);

      // Diagnostics remain bounded relative to input size.
      expect(diagCount).toBeLessThanOrEqual(program.length * 2 + 10);
    }
  });
});
