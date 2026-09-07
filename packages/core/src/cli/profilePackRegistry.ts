import type { CliControllerKey, CliProfileLintLoader } from "../cli.js";
import type { LintIssue, ProfileRuleDoc, ProgramAst } from "../types.js";
import {
  parseControllerPackManifest,
  type ControllerPackManifest
} from "./controllerManifest.js";

/**
 * Metadata that a profile-pack `package.json` can declare under the
 * `cnc-workbench.profilePack` namespace to opt into auto-discovery by
 * `cnc-job-check`. The discovery walker is strict-but-quiet: missing or
 * malformed metadata silently disqualifies the package (mirrors the existing
 * per-loader try/catch contract — a broken third-party pack must never block
 * a CI run that doesn't even use it).
 *
 * Example (in `node_modules/@cnc/profile-third-party/package.json`):
 *
 * ```json
 * {
 *   "cnc-workbench": {
 *     "profilePack": {
 *       "controllerKey": "haas-ngc",
 *       "validateAstExport": "myThirdPartyProfile"
 *     }
 *   }
 * }
 * ```
 */
export type ProfilePackMetadata = {
  controllerKey: string;
  validateAstExport: string;
  /**
   * Optional. When set, names a top-level export from the same package whose
   * value is a `ProfileRuleDoc[]` array. The CLI uses this to read each
   * pack's deprecation metadata for the `--no-deprecated-rules` filter and
   * for the `PROFILE_PACKS.md` doc generator. Packs that don't ship rule
   * docs simply omit this field — discovery still picks them up for linting.
   */
  ruleDocsExport?: string;
  /**
   * Optional embedded controller manifest (rules list, grammar, compliance).
   * When present, CLI/desktop treat it as the pack's rule/controller config.
   */
  manifest?: ControllerPackManifest;
};

export type DiscoverProfilePackOptions = {
  /**
   * Override the directory the walker scans. Defaults to
   * `<process.cwd()>/node_modules/@cnc`. Tests inject a synthetic root.
   *
   * When `scopeRoots` is also provided, the union of `[scopeRoot, ...scopeRoots]`
   * is walked in declaration order with first-wins precedence.
   */
  scopeRoot?: string;
  /**
   * Optional additional scope roots walked AFTER `scopeRoot` (or after the
   * default cwd-derived root when neither `scopeRoot` nor this list is set).
   * Each root is a directory containing `profile-*` subdirectories. The
   * walker visits the merged list in order; the FIRST pack to claim a
   * given `controllerKey` wins. When `scopeRoots` is missing AND `scopeRoot`
   * is missing, the walker also consults the env var
   * `CNC_PROFILE_PACK_SCOPE_ROOTS` (split on `;` on Windows, `:` elsewhere).
   */
  scopeRoots?: string[];
  /**
   * Inject the `readdir` implementation. Receives an absolute path; returns
   * directory entry names. Errors propagate (caller is expected to wrap in a
   * try/catch — discovery already does that internally).
   */
  readDirEntriesFn?: (path: string) => Promise<string[]>;
  /** Inject the file reader; receives an absolute path; returns UTF-8 text. */
  readFileFn?: (path: string) => Promise<string>;
  /**
   * Inject the dynamic-import implementation. Receives a package specifier
   * (e.g. `@cnc/profile-third-party`); returns the imported module record.
   */
  importPackageFn?: (specifier: string) => Promise<unknown>;
  /**
   * Override the platform-default env-var separator. Defaults to `;` on
   * Windows and `:` elsewhere. Tests inject this directly so the env-var
   * parser can be exercised cross-platform without mutating `process.platform`.
   */
  envSeparator?: ";" | ":";
  /**
   * Inject the env-var lookup. Defaults to `process.env`. Tests provide a
   * frozen snapshot to avoid leaking state.
   */
  envFn?: (name: string) => string | undefined;
};

const CONTROLLER_KEY_RE = /^(?:haas-ngc|haas-legacy|fanuc|[a-z][a-z0-9._-]*)$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadata(json: string): {
  packageName: string;
  metadata: ProfilePackMetadata;
} | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!isPlainObject(parsed)) return undefined;
  const packageName = typeof parsed.name === "string" ? parsed.name : undefined;
  if (!packageName) return undefined;
  const wb = parsed["cnc-workbench"];
  if (!isPlainObject(wb)) return undefined;
  const profilePack = wb.profilePack;
  if (!isPlainObject(profilePack)) return undefined;
  const { controllerKey, validateAstExport } = profilePack;
  if (typeof controllerKey !== "string" || typeof validateAstExport !== "string") {
    return undefined;
  }
  if (!CONTROLLER_KEY_RE.test(controllerKey)) {
    return undefined;
  }
  if (validateAstExport.length === 0) return undefined;
  const rawRuleDocsExport = profilePack.ruleDocsExport;
  const ruleDocsExport =
    typeof rawRuleDocsExport === "string" && rawRuleDocsExport.length > 0
      ? rawRuleDocsExport
      : undefined;
  let manifest: ProfilePackMetadata["manifest"];
  if (isPlainObject(profilePack.manifest)) {
    try {
      manifest = parseControllerPackManifest(profilePack.manifest);
    } catch {
      manifest = undefined;
    }
  }
  return {
    packageName,
    metadata: {
      controllerKey,
      validateAstExport,
      ...(ruleDocsExport !== undefined ? { ruleDocsExport } : {}),
      ...(manifest !== undefined ? { manifest } : {})
    }
  };
}

async function defaultReadDirEntriesFn(p: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises");
  return readdir(p);
}

async function defaultReadFileFn(p: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  return readFile(p, "utf8");
}

const dynamicImport = new Function(
  "specifier",
  "return import(specifier);"
) as (specifier: string) => Promise<unknown>;

async function defaultImportPackageFn(specifier: string): Promise<unknown> {
  return dynamicImport(specifier);
}

function defaultScopeRoot(): string {
  return `${process.cwd()}/node_modules/@cnc`;
}

function defaultEnvSeparator(): ";" | ":" {
  return process.platform === "win32" ? ";" : ":";
}

function parseScopeRootsEnvVar(
  raw: string | undefined,
  separator: ";" | ":"
): string[] {
  if (!raw) return [];
  return raw
    .split(separator)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Resolve the ordered list of scope roots from `opts`. Visible for testing
 * and for the CLI hot-reload flag — production code goes through
 * `discoverProfilePackLoaders`.
 */
export function resolveScopeRoots(opts: DiscoverProfilePackOptions = {}): string[] {
  const explicitProvided =
    opts.scopeRoot !== undefined || (opts.scopeRoots && opts.scopeRoots.length > 0);
  const roots: string[] = [];
  if (opts.scopeRoot !== undefined) roots.push(opts.scopeRoot);
  if (opts.scopeRoots && opts.scopeRoots.length > 0) {
    for (const r of opts.scopeRoots) {
      if (!roots.includes(r)) roots.push(r);
    }
  }
  if (explicitProvided) return roots;

  const env = opts.envFn ?? ((name: string) => process.env[name]);
  const separator = opts.envSeparator ?? defaultEnvSeparator();
  const envRoots = parseScopeRootsEnvVar(env("CNC_PROFILE_PACK_SCOPE_ROOTS"), separator);

  const result = [defaultScopeRoot()];
  for (const r of envRoots) {
    if (!result.includes(r)) result.push(r);
  }
  return result;
}

function buildLoaderForPack(
  packageName: string,
  metadata: ProfilePackMetadata,
  importPackageFn: (specifier: string) => Promise<unknown>
): CliProfileLintLoader {
  return async (ast: ProgramAst): Promise<LintIssue[] | undefined> => {
    try {
      const mod = (await importPackageFn(packageName)) as Record<string, unknown>;
      const exported = mod[metadata.validateAstExport];
      if (!isPlainObject(exported)) return undefined;
      const validateAst = exported.validateAst;
      if (typeof validateAst !== "function") return undefined;
      const issues = (validateAst as (ast: ProgramAst) => LintIssue[])(ast);
      return Array.isArray(issues) ? issues : undefined;
    } catch {
      return undefined;
    }
  };
}

/**
 * Walk the configured scope root (default: `<cwd>/node_modules/@cnc`) for
 * directories named `profile-*` and try to read each one's `package.json`
 * for `cnc-workbench.profilePack` metadata. Returns a partial map keyed by
 * `controllerKey`. When two packs declare the same `controllerKey`, the
 * first one encountered wins (alphabetical order — keeps the result stable
 * across runs); the CLI's hand-wired `PROFILE_LINT_LOADERS` is consulted
 * BEFORE this map and trumps any auto-discovered loader for the same key.
 *
 * Discovery is intentionally non-throwing — errors at every layer (root
 * doesn't exist, package.json missing/malformed, metadata typing wrong)
 * silently exclude that pack from the result.
 */
export async function discoverProfilePackLoaders(
  opts: DiscoverProfilePackOptions = {}
): Promise<Partial<Record<CliControllerKey, CliProfileLintLoader>>> {
  const readDirEntriesFn = opts.readDirEntriesFn ?? defaultReadDirEntriesFn;
  const readFileFn = opts.readFileFn ?? defaultReadFileFn;
  const importPackageFn = opts.importPackageFn ?? defaultImportPackageFn;

  const scopeRoots = resolveScopeRoots(opts);
  const result: Partial<Record<CliControllerKey, CliProfileLintLoader>> = {};

  for (const scopeRoot of scopeRoots) {
    let directoryEntries: string[];
    try {
      directoryEntries = await readDirEntriesFn(scopeRoot);
    } catch {
      continue;
    }
    const profileDirs = directoryEntries
      .filter((name) => name.startsWith("profile-"))
      .sort();

    for (const dirName of profileDirs) {
      const packageJsonPath = `${scopeRoot}/${dirName}/package.json`;
      let json: string;
      try {
        json = await readFileFn(packageJsonPath);
      } catch {
        continue;
      }
      const parsed = parseMetadata(json);
      if (!parsed) continue;
      if (result[parsed.metadata.controllerKey] !== undefined) {
        // First-wins across the merged root list (root[0] beats root[1]); the
        // alphabetical sort above keeps single-root order deterministic too.
        continue;
      }
      result[parsed.metadata.controllerKey] = buildLoaderForPack(
        parsed.packageName,
        parsed.metadata,
        importPackageFn
      );
    }
  }
  return result;
}

/**
 * Sibling of {@link discoverProfilePackLoaders}: walks the same scope roots
 * but extracts each pack's `ProfileRuleDoc[]` registry (named via the
 * optional `cnc-workbench.profilePack.ruleDocsExport` metadata field). Used
 * by the CLI to drive the `--no-deprecated-rules` filter for auto-discovered
 * packs. Built-in packs go through `cli.ts`'s hand-wired
 * `PROFILE_RULE_DOCS_LOADERS` map.
 *
 * Same first-wins precedence and silent-failure contract as the loader
 * walker — a pack that lacks `ruleDocsExport` (or whose import fails)
 * silently drops out of the result.
 */
export async function discoverProfilePackRuleDocs(
  opts: DiscoverProfilePackOptions = {}
): Promise<Partial<Record<CliControllerKey, ProfileRuleDoc[]>>> {
  const readDirEntriesFn = opts.readDirEntriesFn ?? defaultReadDirEntriesFn;
  const readFileFn = opts.readFileFn ?? defaultReadFileFn;
  const importPackageFn = opts.importPackageFn ?? defaultImportPackageFn;

  const scopeRoots = resolveScopeRoots(opts);
  const result: Partial<Record<CliControllerKey, ProfileRuleDoc[]>> = {};

  for (const scopeRoot of scopeRoots) {
    let directoryEntries: string[];
    try {
      directoryEntries = await readDirEntriesFn(scopeRoot);
    } catch {
      continue;
    }
    const profileDirs = directoryEntries
      .filter((name) => name.startsWith("profile-"))
      .sort();

    for (const dirName of profileDirs) {
      const packageJsonPath = `${scopeRoot}/${dirName}/package.json`;
      let json: string;
      try {
        json = await readFileFn(packageJsonPath);
      } catch {
        continue;
      }
      const parsed = parseMetadata(json);
      if (!parsed) continue;
      if (parsed.metadata.ruleDocsExport === undefined) continue;
      if (result[parsed.metadata.controllerKey] !== undefined) continue;
      try {
        const mod = (await importPackageFn(parsed.packageName)) as Record<string, unknown>;
        const docs = mod[parsed.metadata.ruleDocsExport];
        if (Array.isArray(docs)) {
          result[parsed.metadata.controllerKey] = docs as ProfileRuleDoc[];
        }
      } catch {
        // Silent — broken third-party rule-docs export must not block linting.
      }
    }
  }
  return result;
}

/**
 * Discover pack manifests embedded under `cnc-workbench.profilePack.manifest`.
 * Same first-wins / silent-failure contract as the loader and rule-docs walkers.
 */
export async function discoverProfilePackManifests(
  opts: DiscoverProfilePackOptions = {}
): Promise<Partial<Record<CliControllerKey, ControllerPackManifest>>> {
  const readDirEntriesFn = opts.readDirEntriesFn ?? defaultReadDirEntriesFn;
  const readFileFn = opts.readFileFn ?? defaultReadFileFn;

  const scopeRoots = resolveScopeRoots(opts);
  const result: Partial<Record<CliControllerKey, ControllerPackManifest>> = {};

  for (const scopeRoot of scopeRoots) {
    let directoryEntries: string[];
    try {
      directoryEntries = await readDirEntriesFn(scopeRoot);
    } catch {
      continue;
    }
    const profileDirs = directoryEntries
      .filter((name) => name.startsWith("profile-"))
      .sort();

    for (const dirName of profileDirs) {
      const packageJsonPath = `${scopeRoot}/${dirName}/package.json`;
      let json: string;
      try {
        json = await readFileFn(packageJsonPath);
      } catch {
        continue;
      }
      const parsed = parseMetadata(json);
      if (!parsed?.metadata.manifest) continue;
      if (result[parsed.metadata.controllerKey] !== undefined) continue;
      result[parsed.metadata.controllerKey] = parsed.metadata.manifest;
    }
  }
  return result;
}
