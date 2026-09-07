import { describe, expect, it } from "vitest";

import {
  discoverProfilePackLoaders,
  discoverProfilePackRuleDocs,
  resolveScopeRoots
} from "../src/cli/profilePackRegistry.js";
import type { LintIssue, ProfileRuleDoc, ProgramAst } from "../src/types.js";

type ParsedDirectoryRoot = {
  files: Record<string, string>;
  dirs: Record<string, string[]>;
};

function buildFakeIo(root: ParsedDirectoryRoot, modules: Record<string, unknown>) {
  return {
    scopeRoot: "/fake/node_modules/@cnc",
    readDirEntriesFn: async (path: string) => {
      const entries = root.dirs[path];
      if (!entries) throw new Error(`ENOENT (fake): ${path}`);
      return entries;
    },
    readFileFn: async (path: string) => {
      const value = root.files[path];
      if (value === undefined) throw new Error(`ENOENT (fake): ${path}`);
      return value;
    },
    importPackageFn: async (specifier: string) => {
      const mod = modules[specifier];
      if (mod === undefined) throw new Error(`Cannot import (fake): ${specifier}`);
      return mod;
    }
  };
}

const STUB_AST = { profileId: "haas-ngc", blocks: [] } as unknown as ProgramAst;

describe("discoverProfilePackLoaders", () => {
  it("returns an empty map when the scope root does not exist", async () => {
    const result = await discoverProfilePackLoaders({
      scopeRoot: "/missing",
      readDirEntriesFn: async () => {
        throw new Error("ENOENT");
      },
      readFileFn: async () => "",
      importPackageFn: async () => ({})
    });
    expect(result).toEqual({});
  });

  it("ignores directories that do not start with profile-", async () => {
    const root: ParsedDirectoryRoot = {
      dirs: { "/fake/node_modules/@cnc": ["core", "desktop", "policy-helpers"] },
      files: {}
    };
    const result = await discoverProfilePackLoaders(buildFakeIo(root, {}));
    expect(result).toEqual({});
  });

  it("ignores profile packs whose package.json is missing", async () => {
    const root: ParsedDirectoryRoot = {
      dirs: { "/fake/node_modules/@cnc": ["profile-broken"] },
      files: {}
    };
    const result = await discoverProfilePackLoaders(buildFakeIo(root, {}));
    expect(result).toEqual({});
  });

  it("ignores profile packs without cnc-workbench.profilePack metadata", async () => {
    const root: ParsedDirectoryRoot = {
      dirs: { "/fake/node_modules/@cnc": ["profile-plain"] },
      files: {
        "/fake/node_modules/@cnc/profile-plain/package.json": JSON.stringify({
          name: "@cnc/profile-plain"
        })
      }
    };
    const result = await discoverProfilePackLoaders(buildFakeIo(root, {}));
    expect(result).toEqual({});
  });

  it("ignores profile packs with malformed JSON metadata (no throw)", async () => {
    const root: ParsedDirectoryRoot = {
      dirs: { "/fake/node_modules/@cnc": ["profile-malformed", "profile-good"] },
      files: {
        "/fake/node_modules/@cnc/profile-malformed/package.json": "{ not valid json",
        "/fake/node_modules/@cnc/profile-good/package.json": JSON.stringify({
          name: "@cnc/profile-good",
          "cnc-workbench": {
            profilePack: {
              controllerKey: "haas-ngc",
              validateAstExport: "goodProfile"
            }
          }
        })
      }
    };
    const goodProfile = {
      validateAst: (_ast: ProgramAst): LintIssue[] => [
        { severity: "warning", message: "good", blockIndex: 0 }
      ]
    };
    const result = await discoverProfilePackLoaders(
      buildFakeIo(root, { "@cnc/profile-good": { goodProfile } })
    );
    expect(Object.keys(result)).toEqual(["haas-ngc"]);
    const issues = await result["haas-ngc"]!(STUB_AST);
    expect(issues).toEqual([
      { severity: "warning", message: "good", blockIndex: 0 }
    ]);
  });

  it("accepts open controller keys such as siemens-840d from discovered packs", async () => {
    const root: ParsedDirectoryRoot = {
      dirs: { "/fake/node_modules/@cnc": ["profile-future"] },
      files: {
        "/fake/node_modules/@cnc/profile-future/package.json": JSON.stringify({
          name: "@cnc/profile-future",
          "cnc-workbench": {
            profilePack: {
              controllerKey: "siemens-840d",
              validateAstExport: "futureProfile"
            }
          }
        })
      }
    };
    const futureProfile = {
      validateAst: () => [{ severity: "warning", message: "siemens", blockIndex: 0 }]
    };
    const result = await discoverProfilePackLoaders(
      buildFakeIo(root, { "@cnc/profile-future": { futureProfile } })
    );
    expect(Object.keys(result)).toEqual(["siemens-840d"]);
    const issues = await result["siemens-840d"]!(STUB_AST);
    expect(issues).toEqual([{ severity: "warning", message: "siemens", blockIndex: 0 }]);
  });

  it("registers a synthetic third-party pack with valid metadata", async () => {
    const root: ParsedDirectoryRoot = {
      dirs: { "/fake/node_modules/@cnc": ["profile-third-party"] },
      files: {
        "/fake/node_modules/@cnc/profile-third-party/package.json": JSON.stringify({
          name: "@cnc/profile-third-party",
          "cnc-workbench": {
            profilePack: {
              controllerKey: "fanuc",
              validateAstExport: "thirdPartyFanucProfile"
            }
          }
        })
      }
    };
    let validateInvoked = false;
    const thirdPartyFanucProfile = {
      validateAst: (_ast: ProgramAst): LintIssue[] => {
        validateInvoked = true;
        return [{ severity: "error", message: "third-party blocker", blockIndex: 1 }];
      }
    };
    const result = await discoverProfilePackLoaders(
      buildFakeIo(root, {
        "@cnc/profile-third-party": { thirdPartyFanucProfile }
      })
    );
    expect(Object.keys(result)).toEqual(["fanuc"]);
    const loader = result["fanuc"]!;
    const issues = await loader(STUB_AST);
    expect(validateInvoked).toBe(true);
    expect(issues).toEqual([
      { severity: "error", message: "third-party blocker", blockIndex: 1 }
    ]);
  });

  it("first-wins (alphabetical) when two packs claim the same controllerKey", async () => {
    const root: ParsedDirectoryRoot = {
      dirs: {
        "/fake/node_modules/@cnc": ["profile-zzz-late", "profile-aaa-early"]
      },
      files: {
        "/fake/node_modules/@cnc/profile-aaa-early/package.json": JSON.stringify({
          name: "@cnc/profile-aaa-early",
          "cnc-workbench": {
            profilePack: {
              controllerKey: "haas-ngc",
              validateAstExport: "earlyProfile"
            }
          }
        }),
        "/fake/node_modules/@cnc/profile-zzz-late/package.json": JSON.stringify({
          name: "@cnc/profile-zzz-late",
          "cnc-workbench": {
            profilePack: {
              controllerKey: "haas-ngc",
              validateAstExport: "lateProfile"
            }
          }
        })
      }
    };
    const earlyProfile = {
      validateAst: () => [
        { severity: "warning", message: "EARLY", blockIndex: 0 } as LintIssue
      ]
    };
    const lateProfile = {
      validateAst: () => [
        { severity: "warning", message: "LATE", blockIndex: 0 } as LintIssue
      ]
    };
    const result = await discoverProfilePackLoaders(
      buildFakeIo(root, {
        "@cnc/profile-aaa-early": { earlyProfile },
        "@cnc/profile-zzz-late": { lateProfile }
      })
    );
    const issues = await result["haas-ngc"]!(STUB_AST);
    expect(issues?.[0]?.message).toBe("EARLY");
  });

  it("scopeRoots[] walks every root and unions the results", async () => {
    const rootA = "/fake/A/node_modules/@cnc";
    const rootB = "/fake/B/node_modules/@cnc";
    const dirs: Record<string, string[]> = {
      [rootA]: ["profile-haas"],
      [rootB]: ["profile-fanuc"]
    };
    const files: Record<string, string> = {
      [`${rootA}/profile-haas/package.json`]: JSON.stringify({
        name: "@cnc/profile-haas-multi-root-a",
        "cnc-workbench": {
          profilePack: { controllerKey: "haas-ngc", validateAstExport: "haasA" }
        }
      }),
      [`${rootB}/profile-fanuc/package.json`]: JSON.stringify({
        name: "@cnc/profile-fanuc-multi-root-b",
        "cnc-workbench": {
          profilePack: { controllerKey: "fanuc", validateAstExport: "fanucB" }
        }
      })
    };
    const result = await discoverProfilePackLoaders({
      scopeRoots: [rootA, rootB],
      readDirEntriesFn: async (p) => {
        const entries = dirs[p];
        if (!entries) throw new Error("ENOENT");
        return entries;
      },
      readFileFn: async (p) => {
        const v = files[p];
        if (v === undefined) throw new Error("ENOENT");
        return v;
      },
      importPackageFn: async (specifier) => ({
        haasA: { validateAst: () => [] },
        fanucB: { validateAst: () => [] }
      }[specifier === "@cnc/profile-haas-multi-root-a" ? "haasA" : "fanucB"]
        ? { haasA: { validateAst: () => [] }, fanucB: { validateAst: () => [] } }
        : {})
    });
    expect(Object.keys(result).sort()).toEqual(["fanuc", "haas-ngc"]);
  });

  it("first-wins precedence across roots: root[0] beats root[1] for the same controllerKey", async () => {
    const rootA = "/fake/A/node_modules/@cnc";
    const rootB = "/fake/B/node_modules/@cnc";
    const dirs: Record<string, string[]> = {
      [rootA]: ["profile-haas"],
      [rootB]: ["profile-haas"]
    };
    const files: Record<string, string> = {
      [`${rootA}/profile-haas/package.json`]: JSON.stringify({
        name: "@cnc/profile-haas-rootA",
        "cnc-workbench": {
          profilePack: { controllerKey: "haas-ngc", validateAstExport: "rootAProfile" }
        }
      }),
      [`${rootB}/profile-haas/package.json`]: JSON.stringify({
        name: "@cnc/profile-haas-rootB",
        "cnc-workbench": {
          profilePack: { controllerKey: "haas-ngc", validateAstExport: "rootBProfile" }
        }
      })
    };
    const modules: Record<string, unknown> = {
      "@cnc/profile-haas-rootA": {
        rootAProfile: {
          validateAst: () => [
            { severity: "warning", message: "ROOT_A", blockIndex: 0 } as LintIssue
          ]
        }
      },
      "@cnc/profile-haas-rootB": {
        rootBProfile: {
          validateAst: () => [
            { severity: "warning", message: "ROOT_B", blockIndex: 0 } as LintIssue
          ]
        }
      }
    };
    const result = await discoverProfilePackLoaders({
      scopeRoots: [rootA, rootB],
      readDirEntriesFn: async (p) => dirs[p] ?? [],
      readFileFn: async (p) => {
        const v = files[p];
        if (v === undefined) throw new Error("ENOENT");
        return v;
      },
      importPackageFn: async (specifier) => modules[specifier] ?? {}
    });
    const issues = await result["haas-ngc"]!(STUB_AST);
    expect(issues?.[0]?.message).toBe("ROOT_A");
  });

  it("loader swallows import errors and returns undefined", async () => {
    const root: ParsedDirectoryRoot = {
      dirs: { "/fake/node_modules/@cnc": ["profile-broken-import"] },
      files: {
        "/fake/node_modules/@cnc/profile-broken-import/package.json": JSON.stringify({
          name: "@cnc/profile-broken-import",
          "cnc-workbench": {
            profilePack: {
              controllerKey: "fanuc",
              validateAstExport: "missingExport"
            }
          }
        })
      }
    };
    const result = await discoverProfilePackLoaders(
      buildFakeIo(root, {
        "@cnc/profile-broken-import": {
          /* missingExport intentionally absent */
        }
      })
    );
    const loader = result["fanuc"]!;
    expect(loader).toBeDefined();
    const issues = await loader(STUB_AST);
    expect(issues).toBeUndefined();
  });
});

describe("resolveScopeRoots (CNC_PROFILE_PACK_SCOPE_ROOTS env-var parsing)", () => {
  it("returns ONLY the explicit scopeRoot when provided (no env merge)", () => {
    expect(
      resolveScopeRoots({
        scopeRoot: "/explicit/root",
        envFn: () => "/should/not/appear",
        envSeparator: ":"
      })
    ).toEqual(["/explicit/root"]);
  });

  it("returns ONLY the explicit scopeRoots[] when provided (no env merge)", () => {
    expect(
      resolveScopeRoots({
        scopeRoots: ["/r1", "/r2"],
        envFn: () => "/should/not/appear",
        envSeparator: ":"
      })
    ).toEqual(["/r1", "/r2"]);
  });

  it("merges scopeRoot + scopeRoots[] preserving order, deduplicating", () => {
    expect(
      resolveScopeRoots({
        scopeRoot: "/r0",
        scopeRoots: ["/r1", "/r0", "/r2"]
      })
    ).toEqual(["/r0", "/r1", "/r2"]);
  });

  it("falls back to default cwd root + env-var roots when nothing explicit is set (POSIX `:` separator)", () => {
    const cwd = `${process.cwd()}/node_modules/@cnc`;
    expect(
      resolveScopeRoots({
        envFn: (name) =>
          name === "CNC_PROFILE_PACK_SCOPE_ROOTS" ? "/extra/a:/extra/b" : undefined,
        envSeparator: ":"
      })
    ).toEqual([cwd, "/extra/a", "/extra/b"]);
  });

  it("parses Windows-style `;` separator when envSeparator is overridden", () => {
    const cwd = `${process.cwd()}/node_modules/@cnc`;
    expect(
      resolveScopeRoots({
        envFn: (name) =>
          name === "CNC_PROFILE_PACK_SCOPE_ROOTS"
            ? "C:\\extra\\a;D:\\extra\\b"
            : undefined,
        envSeparator: ";"
      })
    ).toEqual([cwd, "C:\\extra\\a", "D:\\extra\\b"]);
  });

  it("ignores blank entries inside the env var", () => {
    const cwd = `${process.cwd()}/node_modules/@cnc`;
    expect(
      resolveScopeRoots({
        envFn: () => "::/foo::",
        envSeparator: ":"
      })
    ).toEqual([cwd, "/foo"]);
  });

  it("returns ONLY the default cwd root when env var is unset", () => {
    const cwd = `${process.cwd()}/node_modules/@cnc`;
    expect(
      resolveScopeRoots({
        envFn: () => undefined,
        envSeparator: ":"
      })
    ).toEqual([cwd]);
  });
});

describe("discoverProfilePackRuleDocs", () => {
  it("returns an empty map when no pack declares ruleDocsExport", async () => {
    const root: ParsedDirectoryRoot = {
      dirs: { "/fake/node_modules/@cnc": ["profile-no-docs"] },
      files: {
        "/fake/node_modules/@cnc/profile-no-docs/package.json": JSON.stringify({
          name: "@cnc/profile-no-docs",
          "cnc-workbench": {
            profilePack: {
              controllerKey: "haas-ngc",
              validateAstExport: "noDocsProfile"
            }
          }
        })
      }
    };
    const result = await discoverProfilePackRuleDocs(
      buildFakeIo(root, { "@cnc/profile-no-docs": { noDocsProfile: { validateAst: () => [] } } })
    );
    expect(result).toEqual({});
  });

  it("captures ruleDocs[] from a pack that declares ruleDocsExport", async () => {
    const docs: ProfileRuleDoc[] = [
      {
        id: "thirdparty.alive",
        severity: "warning",
        messageMatcher: /alive matcher/,
        positiveSnippet: "",
        negativeSnippet: "",
        summary: "alive rule"
      },
      {
        id: "thirdparty.dead",
        severity: "warning",
        messageMatcher: /dead matcher/,
        positiveSnippet: "",
        negativeSnippet: "",
        summary: "dead rule",
        deprecatedSince: "2026-05"
      }
    ];
    const root: ParsedDirectoryRoot = {
      dirs: { "/fake/node_modules/@cnc": ["profile-with-docs"] },
      files: {
        "/fake/node_modules/@cnc/profile-with-docs/package.json": JSON.stringify({
          name: "@cnc/profile-with-docs",
          "cnc-workbench": {
            profilePack: {
              controllerKey: "fanuc",
              validateAstExport: "withDocsProfile",
              ruleDocsExport: "withDocsRuleDocs"
            }
          }
        })
      }
    };
    const result = await discoverProfilePackRuleDocs(
      buildFakeIo(root, {
        "@cnc/profile-with-docs": {
          withDocsProfile: { validateAst: () => [] },
          withDocsRuleDocs: docs
        }
      })
    );
    expect(Object.keys(result)).toEqual(["fanuc"]);
    expect(result["fanuc"]).toEqual(docs);
  });

  it("first-wins precedence across roots for ruleDocs (root[0] beats root[1])", async () => {
    const docsA: ProfileRuleDoc[] = [
      {
        id: "rootA.rule",
        severity: "warning",
        messageMatcher: /A/,
        positiveSnippet: "",
        negativeSnippet: "",
        summary: "A"
      }
    ];
    const docsB: ProfileRuleDoc[] = [
      {
        id: "rootB.rule",
        severity: "warning",
        messageMatcher: /B/,
        positiveSnippet: "",
        negativeSnippet: "",
        summary: "B"
      }
    ];
    const rootA = "/fake/A/node_modules/@cnc";
    const rootB = "/fake/B/node_modules/@cnc";
    const dirs: Record<string, string[]> = {
      [rootA]: ["profile-haas"],
      [rootB]: ["profile-haas"]
    };
    const files: Record<string, string> = {
      [`${rootA}/profile-haas/package.json`]: JSON.stringify({
        name: "@cnc/profile-haas-rootA",
        "cnc-workbench": {
          profilePack: {
            controllerKey: "haas-ngc",
            validateAstExport: "haasA",
            ruleDocsExport: "haasARuleDocs"
          }
        }
      }),
      [`${rootB}/profile-haas/package.json`]: JSON.stringify({
        name: "@cnc/profile-haas-rootB",
        "cnc-workbench": {
          profilePack: {
            controllerKey: "haas-ngc",
            validateAstExport: "haasB",
            ruleDocsExport: "haasBRuleDocs"
          }
        }
      })
    };
    const modules: Record<string, unknown> = {
      "@cnc/profile-haas-rootA": {
        haasA: { validateAst: () => [] },
        haasARuleDocs: docsA
      },
      "@cnc/profile-haas-rootB": {
        haasB: { validateAst: () => [] },
        haasBRuleDocs: docsB
      }
    };
    const result = await discoverProfilePackRuleDocs({
      scopeRoots: [rootA, rootB],
      readDirEntriesFn: async (p) => dirs[p] ?? [],
      readFileFn: async (p) => {
        const v = files[p];
        if (v === undefined) throw new Error("ENOENT");
        return v;
      },
      importPackageFn: async (specifier) => modules[specifier] ?? {}
    });
    expect(result["haas-ngc"]).toEqual(docsA);
  });

  it("silently skips packs whose ruleDocsExport import errors", async () => {
    const root: ParsedDirectoryRoot = {
      dirs: { "/fake/node_modules/@cnc": ["profile-broken-docs"] },
      files: {
        "/fake/node_modules/@cnc/profile-broken-docs/package.json": JSON.stringify({
          name: "@cnc/profile-broken-docs",
          "cnc-workbench": {
            profilePack: {
              controllerKey: "haas-ngc",
              validateAstExport: "brokenProfile",
              ruleDocsExport: "missingDocs"
            }
          }
        })
      }
    };
    const result = await discoverProfilePackRuleDocs(
      buildFakeIo(root, {
        "@cnc/profile-broken-docs": {
          brokenProfile: { validateAst: () => [] }
          // missingDocs intentionally absent
        }
      })
    );
    expect(result).toEqual({});
  });
});
