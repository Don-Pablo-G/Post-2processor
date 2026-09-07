import { describe, expect, it } from "vitest";
import {
  enabledRuleIdsFromManifest,
  grammarIdsFromManifest,
  parseOptionsFromManifest,
  rulePolicyFromManifest,
  type ControllerPackManifest
} from "../src/cli/controllerManifest.js";
import type { ProfileRuleDoc } from "../src/types.js";

const docs: ProfileRuleDoc[] = [
  {
    id: "pack.a",
    severity: "warning",
    messageMatcher: /a/,
    summary: "A",
    positiveSnippet: "O1\n",
    negativeSnippet: "O1\n"
  },
  {
    id: "pack.b",
    severity: "warning",
    messageMatcher: /b/,
    summary: "B",
    positiveSnippet: "O1\n",
    negativeSnippet: "O1\n"
  }
];

describe("controllerPackManifest helpers", () => {
  it("extracts grammar ids and parse options", () => {
    const manifest: ControllerPackManifest = {
      controllerKey: "demo",
      name: "Demo",
      grammar: ["haas-strict", "fanuc-strict"],
      parseCompliance: "strict_fanuc"
    };
    expect(grammarIdsFromManifest(manifest)).toEqual(["haas-strict", "fanuc-strict"]);
    expect(parseOptionsFromManifest(manifest)).toEqual({
      complianceMode: "strict_fanuc",
      grammarPackIds: ["haas-strict", "fanuc-strict"]
    });
  });

  it("builds allowlist rule policy when enabled ids are listed", () => {
    const manifest: ControllerPackManifest = {
      controllerKey: "demo",
      name: "Demo",
      rules: ["pack.a", { id: "pack.b", enabled: false }]
    };
    expect(enabledRuleIdsFromManifest(manifest)).toEqual({
      enabled: ["pack.a"],
      disabled: ["pack.b"]
    });
    expect(rulePolicyFromManifest(manifest, docs)).toEqual({
      rules: {
        "pack.a": { enabled: true },
        "pack.b": { enabled: false }
      }
    });
  });

  it("returns undefined policy when rules field is omitted", () => {
    const manifest: ControllerPackManifest = {
      controllerKey: "demo",
      name: "Demo",
      grammar: "haas-strict"
    };
    expect(rulePolicyFromManifest(manifest, docs)).toBeUndefined();
  });
});
