#!/usr/bin/env node
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse, runJobCheck } from "./api.node.js";
import type { ControllerProfile } from "./api.node.js";
import type {
  LintIssue,
  ParseDiagnosticsThresholdPolicy,
  ProfileRuleDoc,
  ProgramAst,
  RunJobCheckResult
} from "./types.js";
import {
  PARSE_DIAGNOSTICS_POLICY_PRESET_IDS,
  resolveParseDiagnosticsPolicyPreset,
  type ParseDiagnosticsPolicyPresetId
} from "./workshop/parseDiagnosticsPresets.js";
import { buildSetupSheetPdf } from "./workshop/setupSheetPdf.js";
import { createZip } from "./workshop/storeZip.js";
import {
  computeHmacSha256,
  computeSha256,
  computeSha256Bytes,
  decryptAesGcm,
  parseSidecarBodyDigest
} from "./audit/auditTrailIntegrity.js";
import { filterDeprecatedProfileLintIssues } from "./lints/profileRuleDeprecation.js";
import {
  AuditTrailRotationStrandedTempError,
  rotateAuditTrailKey
} from "./audit/auditTrailRotation.js";
import {
  isAuditDeprecatedRulesPolicyPresetId,
  resolveAuditDeprecatedRulesPreset,
  type AuditDeprecatedRulesPolicyPresetId
} from "./cli/auditDeprecatedRulesPresets.js";
import {
  buildDeprecatedRuleAudit,
  parseOlderThanThreshold,
  type DeprecatedRuleAuditRow
} from "./cli/auditDeprecatedRules.js";
import {
  formatDeprecatedRuleAuditAsJson,
  formatDeprecatedRuleAuditAsText
} from "./cli/deprecatedRuleAuditFormat.js";
import {
  CLI_SCHEMA_VERSION,
  applyStrictControllerCodesGate,
  buildBatchEnvelope,
  buildJobCheckEnvelope,
  formatBatchJson,
  formatBatchNdjson,
  formatBatchAggregationsAsCsv,
  formatBatchFixCandidatesAsSarifLite,
  buildBatchFixTemplateCandidates,
  buildBatchExportManifest,
  formatBatchExportManifest,
  formatBatchExportZipSha256Sidecar,
  formatJobCheckJson,
  formatJobCheckNdjsonLine,
  type CliBatchEntry,
  type CliBatchWalk
} from "./cli/jobCheckEnvelope.js";
import {
  classifyBatchRelativePath
} from "./cli/batchPathGlob.js";

export type CliControllerKey = "haas-ngc" | "haas-legacy" | "fanuc";

export {
  CLI_SCHEMA_VERSION,
  applyStrictControllerCodesGate,
  buildBatchBlockReasonAggregation,
  buildBatchEnvelope,
  buildBatchLintIssuesByControllerCodeAggregation,
  buildBatchLintIssuesByParseDiagCodeAggregation,
  buildBatchLintIssuesBySourceAggregation,
  buildBatchParseDiagnosticsAttribution,
  buildBatchParseDiagnosticsByCodeAggregation,
  buildBatchParseDiagnosticsPolicyBreachesAggregation,
  buildBatchSafetyBlockerCodesAggregation,
  buildBatchSafetyFindingsAttribution,
  buildBatchSafetyFindingsByCodeAggregation,
  buildBatchStrictControllerCodesGatedAggregation,
  buildJobCheckEnvelope,
  buildSafetyFindingsByCode,
  formatBatchJson,
  formatBatchNdjson,
  formatBatchAggregationsAsCsv,
  formatBatchFixCandidatesAsSarifLite,
  buildBatchFixTemplateCandidates,
  buildBatchExportManifest,
  classifyBatchExportPath,
  formatBatchExportManifest,
  formatBatchExportZipSha256Sidecar,
  formatJobCheckJson,
  formatJobCheckNdjsonLine
} from "./cli/jobCheckEnvelope.js";

export type {
  CliBatchBlockReasonAggregation,
  CliBatchControllerCodeAttribution,
  CliBatchEnvelope,
  CliBatchEntry,
  CliBatchLintIssuesByControllerCodeAggregation,
  CliBatchLintIssuesByParseDiagCodeAggregation,
  CliBatchLintIssuesBySourceAggregation,
  CliBatchParseDiagnosticsAttribution,
  CliBatchParseDiagnosticsByCodeAggregation,
  CliBatchParseDiagnosticsPolicyBreachesAggregation,
  CliBatchSafetyFindingsAttribution,
  CliBatchSafetyFindingsByCodeAggregation,
  CliBatchStrictControllerCodesGatedAggregation,
  CliBatchWalk,
  CliBatchWalkExport,
  CliBlockReason,
  CliJobCheckEnvelope,
  CliLintIssuesByControllerCodeEntry,
  CliLintIssuesByParseDiagCodeEntry,
  CliLintIssuesBySourceEntry,
  CliNdjsonBatchEntry,
  CliParseDiagnosticsByCodeEntry,
  CliSafetyFindingSource,
  CliSafetyFindingsByCodeEntry,
  BatchExportManifest,
  BatchExportManifestEntry,
  BatchExportManifestPathInput
} from "./cli/jobCheckEnvelope.js";

export {
  BATCH_INPUT_EXTENSIONS,
  classifyBatchRelativePath,
  compileGlobToRegExp,
  matchesAnyGlob
} from "./cli/batchPathGlob.js";

export {
  matchesAnyStrictControllerCodePattern,
  resolveStrictControllerCodesGate
} from "./cli/strictControllerCodesGate.js";

const CONTROLLER_NAMES: Record<CliControllerKey, string> = {
  "haas-ngc": "Haas NGC",
  "haas-legacy": "Haas Legacy",
  fanuc: "Fanuc"
};

export const CLI_USAGE = [
  "Usage: cnc-job-check (--input <path>|--input -|--input-dir <path>) [options]",
  "       cnc-job-check verify-audit-trail --main <file> [...] (run with --help for sub-args)",
  "       cnc-job-check verify-batch-export --zip <file> --sha256 <file> (run with --help for sub-args)",
  "       cnc-job-check rotate-audit-trail-key --encrypted <file> --old-secret <key> --new-secret <key> (run with --help for sub-args)",
  "       cnc-job-check audit-deprecated-rules [--older-than <N>{mo|d}] [--format json|text] [--strict] (run with --help for sub-args)",
  "",
  "Options:",
  "  --input <path>             G-code source file (use '-' for stdin)",
  "  --input-dir <path>         Run for every .nc/.tap/.gcode file in the directory (use --recursive to walk subtrees)",
  "  --recursive                Walk --input-dir subtrees (default: single-level)",
  "  --include <glob>           Repeatable glob matched against forward-slash relative paths (replaces extension floor)",
  "  --exclude <glob>           Repeatable glob; takes precedence over --include and the extension floor",
  "  --controller <id>          haas-ngc | haas-legacy | fanuc (default: haas-ngc)",
  "  --policy <path>            JSON file with ParseDiagnosticsThresholdPolicy",
  "  --policy-preset <id>       strict | balanced | permissive (mirrors desktop chips)",
  "  --format <json|text|ndjson>  Output format (default: json; ndjson emits one envelope per line)",
  "  --out <path>               Write output to file instead of stdout",
  "  --export-setup-sheet-pdf <path>  Single --input only: write the setup sheet (with optional histogram bars) as a single-page PDF1.4",
  "  --export-setup-sheet-pdf-batch <dir>  Batch only: write one <basename>.pdf per --input-dir input under <dir> (mirrors relative tree; mutually exclusive with --export-setup-sheet-pdf)",
  "  --out-dir <path>           Batch only: write one rendered file per input under <path> (mirrors relative tree; mutually exclusive with --out)",
  "  --out-dir-format <f>:<ext> Repeatable: override per-format extension under --out-dir (e.g. json:.envelope.json). Requires --out-dir. f one of json|text|ndjson, ext must start with '.'",
  "  --strict                   Exit with code 1 when any result.blocked is true",
  "  --quiet                    Suppress non-fatal stderr (strict-block hint, empty-dir notice)",
  "  --schema-version           Print 'cnc-job-check schema=<n>' and exit (no input required)",
  "  --rediscover-profile-packs Flush the in-memory profile-pack auto-discovery cache before running (use after installing a new pack mid-session)",
  "  --no-deprecated-rules      Suppress profile-lint issues whose ProfileRuleDoc.deprecatedSince is set (per-pack opt-in soft-deprecation)",
  "  --strict-controller-codes <c,...>  Comma-separated list of CG_* codes (or families with trailing *) that, when emitted by any lint issue, flip blocked=true and add the codes to envelope.strictControllerCodesGated",
  "  --help, -h                 Show this message",
  "",
  "Subcommands:",
  "  verify-audit-trail         Verify a previously-downloaded audit trail and any of its sidecars.",
  "                              Run `cnc-job-check verify-audit-trail --help` for sub-args.",
  "  verify-batch-export        Verify a sealed batch-export.zip against its .sha256 sidecar.",
  "                              Run `cnc-job-check verify-batch-export --help` for sub-args.",
  "  rotate-audit-trail-key     Re-encrypt an AES-GCM audit-trail blob under a new secret.",
  "                              Run `cnc-job-check rotate-audit-trail-key --help` for sub-args.",
  "  audit-deprecated-rules     List every profile-pack rule that has a deprecatedSince value.",
  "                              Run `cnc-job-check audit-deprecated-rules --help` for sub-args."
].join("\n");

export const CLI_USAGE_VERIFY_AUDIT_TRAIL = [
  "Usage: cnc-job-check verify-audit-trail --main <file> [--sha256 <file>] [--hmac <file> --secret <key>] [--encrypted <file> --encryption-secret <key>]",
  "",
  "Verifies that any combination of audit-trail sidecars (SHA-256, HMAC-SHA-256,",
  "AES-256-GCM at-rest encryption) match the canonical `--main` payload. At least",
  "one sidecar must be supplied. Exit codes:",
  "  0   every supplied sidecar matched (or decrypted to bytes-identical plaintext)",
  "  1   any sidecar mismatched / failed to decrypt",
  "  2   argument or IO error (missing flag, unreadable file, etc.)",
  "",
  "Options:",
  "  --main <file>                Required. Path to the canonical audit-trail payload (the file that was downloaded from the desktop UI).",
  "  --sha256 <file>              Optional. Path to a `.sha256` BSD shasum-style sidecar (`<hex>  <name>\\n`). Filename component is ignored — only the digest is compared.",
  "  --hmac <file>                Optional. Path to a `.hmac-sha256` sidecar (same shape as `--sha256`). Requires `--secret`.",
  "  --secret <key>               Required when `--hmac` is given. Shared secret used to recompute the HMAC.",
  "  --encrypted <file>           Optional. Path to a `.aes-gcm` ciphertext blob (raw bytes, [salt(16)|iv(12)|ciphertext+tag]). Requires `--encryption-secret`.",
  "  --encryption-secret <key>    Required when `--encrypted` is given. PBKDF2 password used to derive the AES-256 key.",
  "  --quiet                      Suppress per-check `OK` lines (failures still emit on stderr).",
  "  --help, -h                   Show this message"
].join("\n");

export type VerifyAuditTrailArgs = {
  main?: string;
  sha256?: string;
  hmac?: string;
  hmacSecret?: string;
  encrypted?: string;
  encryptionSecret?: string;
  quiet: boolean;
  help: boolean;
};

export function parseVerifyAuditTrailArgs(argv: readonly string[]): VerifyAuditTrailArgs {
  const result: VerifyAuditTrailArgs = { quiet: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--main":
        result.main = requireValue("--main", argv[++i]);
        break;
      case "--sha256":
        result.sha256 = requireValue("--sha256", argv[++i]);
        break;
      case "--hmac":
        result.hmac = requireValue("--hmac", argv[++i]);
        break;
      case "--secret":
        result.hmacSecret = requireValue("--secret", argv[++i]);
        break;
      case "--encrypted":
        result.encrypted = requireValue("--encrypted", argv[++i]);
        break;
      case "--encryption-secret":
        result.encryptionSecret = requireValue("--encryption-secret", argv[++i]);
        break;
      case "--quiet":
        result.quiet = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      default:
        throw new CliArgumentError(`Unknown verify-audit-trail flag: ${arg}`);
    }
  }
  if (result.help) return result;
  if (result.main === undefined) {
    throw new CliArgumentError("verify-audit-trail requires --main <file>");
  }
  if (result.hmac !== undefined && (result.hmacSecret === undefined || result.hmacSecret.length === 0)) {
    throw new CliArgumentError("verify-audit-trail --hmac requires --secret <key>");
  }
  if (result.encrypted !== undefined && (result.encryptionSecret === undefined || result.encryptionSecret.length === 0)) {
    throw new CliArgumentError(
      "verify-audit-trail --encrypted requires --encryption-secret <key>"
    );
  }
  if (
    result.sha256 === undefined &&
    result.hmac === undefined &&
    result.encrypted === undefined
  ) {
    throw new CliArgumentError(
      "verify-audit-trail requires at least one of --sha256, --hmac, or --encrypted"
    );
  }
  return result;
}

export const CLI_USAGE_VERIFY_BATCH_EXPORT = [
  "Usage: cnc-job-check verify-batch-export --zip <file> --sha256 <file>",
  "",
  "Verifies a sealed `batch-export.zip` against its BSD-style",
  "`batch-export.zip.sha256` sidecar (`<hex>  batch-export.zip`).",
  "",
  "Exit codes:",
  "  0   digest matches",
  "  1   digest mismatch",
  "  2   argument or IO error",
  "",
  "Options:",
  "  --zip <file>               Required. Path to batch-export.zip (binary).",
  "  --sha256 <file>            Required. Path to the .sha256 sidecar (text).",
  "  --quiet                    Suppress the per-success `OK` line on stdout.",
  "  --help, -h                 Show this message"
].join("\n");

export type VerifyBatchExportArgs = {
  zip?: string;
  sha256?: string;
  quiet: boolean;
  help: boolean;
};

export function parseVerifyBatchExportArgs(argv: readonly string[]): VerifyBatchExportArgs {
  const result: VerifyBatchExportArgs = { quiet: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--zip":
        result.zip = requireValue("--zip", argv[++i]);
        break;
      case "--sha256":
        result.sha256 = requireValue("--sha256", argv[++i]);
        break;
      case "--quiet":
        result.quiet = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      default:
        throw new CliArgumentError(`Unknown verify-batch-export flag: ${arg}`);
    }
  }
  if (result.help) return result;
  if (result.zip === undefined) {
    throw new CliArgumentError("verify-batch-export requires --zip <file>");
  }
  if (result.sha256 === undefined) {
    throw new CliArgumentError("verify-batch-export requires --sha256 <file>");
  }
  return result;
}

export type VerifyBatchExportIo = {
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
  readFileFn?: (filePath: string) => Promise<string>;
  readFileBytesFn?: (filePath: string) => Promise<Uint8Array>;
};

export async function runVerifyBatchExport(
  parsed: VerifyBatchExportArgs,
  io: VerifyBatchExportIo = {}
): Promise<number> {
  const writeOut = io.stdout ?? ((chunk: string) => void process.stdout.write(chunk));
  const writeErr = io.stderr ?? ((chunk: string) => void process.stderr.write(chunk));
  const readText = io.readFileFn ?? ((p: string) => readFile(p, "utf8"));
  const readBytes =
    io.readFileBytesFn ??
    (async (p: string) => {
      const buf = await readFile(p);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    });

  let zipBytes: Uint8Array;
  try {
    zipBytes = await readBytes(parsed.zip!);
  } catch (err) {
    writeErr(
      `cnc-job-check verify-batch-export: failed to read --zip ${parsed.zip}: ${(err as Error).message}\n`
    );
    return 2;
  }

  let sidecarBody: string;
  try {
    sidecarBody = await readText(parsed.sha256!);
  } catch (err) {
    writeErr(
      `cnc-job-check verify-batch-export: failed to read --sha256 ${parsed.sha256}: ${(err as Error).message}\n`
    );
    return 2;
  }

  const expected = parseSidecarBodyDigest(sidecarBody);
  if (!expected) {
    writeErr(
      `cnc-job-check verify-batch-export: --sha256 ${parsed.sha256} does not contain a hex digest\n`
    );
    return 2;
  }

  let actual: string;
  try {
    actual = await computeSha256Bytes(zipBytes);
  } catch (err) {
    writeErr(
      `cnc-job-check verify-batch-export: sha256 compute failed: ${(err as Error).message}\n`
    );
    return 2;
  }

  if (actual !== expected) {
    writeErr(
      `cnc-job-check verify-batch-export: sha256 mismatch (expected ${expected}, got ${actual})\n`
    );
    return 1;
  }
  if (!parsed.quiet) {
    writeOut(`cnc-job-check verify-batch-export: sha256 OK (${actual})\n`);
  }
  return 0;
}

export const CLI_USAGE_ROTATE_AUDIT_TRAIL_KEY = [
  "Usage: cnc-job-check rotate-audit-trail-key --encrypted <file> --old-secret <key> --new-secret <key> (--out <file>|--in-place)",
  "       cnc-job-check rotate-audit-trail-key --recover-temp --temp <stranded.tmp> --target <input.aes-gcm> --new-secret <key>",
  "",
  "Decrypts an AES-256-GCM audit-trail blob produced by the desktop UI",
  "(`[salt(16) | iv(12) | ciphertext+tag]` layout) under `--old-secret`,",
  "then re-encrypts the recovered plaintext under `--new-secret`. Fresh",
  "salt + IV are generated for the rotated output. Useful for periodic",
  "shop-wide secret rotation without losing existing audit trails.",
  "",
  "When `--in-place` writes its `.rotating` temp file but then fails to",
  "atomically rename it onto the original path (e.g. another process",
  "holds the target open), the temp stays on disk encrypted under the",
  "NEW secret and the CLI exits 3 with a canonical message pointing at",
  "the temp path. The `--recover-temp` arm picks up where the failure",
  "left off: it re-validates the temp's decryption under `--new-secret`,",
  "then atomically renames it onto `--target`.",
  "",
  "Exit codes:",
  "  0   rotation succeeded; new ciphertext written to --out (or --in-place target)",
  "      OR --recover-temp validated + renamed an existing temp",
  "  1   decryption with --old-secret failed (canonical error string on stderr)",
  "      OR --recover-temp temp does not decrypt under --new-secret",
  "  2   argument or IO error (missing flag, unreadable file, etc.)",
  "  3   --in-place wrote the temp but rename failed (`stranded temp file at <path>`)",
  "",
  "Options:",
  "  --encrypted <file>          Required (rotation arm). Input AES-GCM blob to rotate.",
  "  --old-secret <key>          Required (rotation arm). PBKDF2 password the blob was originally encrypted with.",
  "  --new-secret <key>          Required (BOTH arms). PBKDF2 password to re-encrypt under (rotation arm) /",
  "                              expected secret the temp file was encrypted under (--recover-temp arm).",
  "  --out <file>                Rotation arm. Write the rotated blob to this path. Mutually exclusive with --in-place / --recover-temp.",
  "  --in-place                  Rotation arm. Atomically replace --encrypted (write to <file>.rotating then rename).",
  "                              Mutually exclusive with --out / --recover-temp.",
  "  --recover-temp              Recovery arm. Validate an existing temp file under --new-secret then rename it onto --target.",
  "                              Mutually exclusive with --encrypted / --old-secret / --out / --in-place.",
  "  --temp <stranded.tmp>       Required (--recover-temp arm). Path to the stranded temp file left by a failed --in-place run.",
  "  --target <input.aes-gcm>    Required (--recover-temp arm). Path to atomically rename the temp onto.",
  "  --quiet                     Suppress the per-success `OK` line on stdout (failures still emit on stderr).",
  "  --help, -h                  Show this message"
].join("\n");

export type RotateAuditTrailKeyArgs = {
  encrypted?: string;
  oldSecret?: string;
  newSecret?: string;
  out?: string;
  inPlace: boolean;
  /**
   * Schema v8: when `true`, the CLI takes the recovery branch instead
   * of the rotation branch. Mutually exclusive with `encrypted` /
   * `oldSecret` / `out` / `inPlace` (parser rejects the combo with
   * exit 2). Requires `temp`, `target`, and `newSecret`.
   */
  recoverTemp: boolean;
  /** Recovery arm only: path to the stranded temp file. */
  temp?: string;
  /** Recovery arm only: path to atomically rename the temp onto. */
  target?: string;
  quiet: boolean;
  help: boolean;
};

export function parseRotateAuditTrailKeyArgs(
  argv: readonly string[]
): RotateAuditTrailKeyArgs {
  const result: RotateAuditTrailKeyArgs = {
    inPlace: false,
    recoverTemp: false,
    quiet: false,
    help: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--encrypted":
        result.encrypted = requireValue("--encrypted", argv[++i]);
        break;
      case "--old-secret":
        result.oldSecret = requireValue("--old-secret", argv[++i]);
        break;
      case "--new-secret":
        result.newSecret = requireValue("--new-secret", argv[++i]);
        break;
      case "--out":
        result.out = requireValue("--out", argv[++i]);
        break;
      case "--in-place":
        result.inPlace = true;
        break;
      case "--recover-temp":
        result.recoverTemp = true;
        break;
      case "--temp":
        result.temp = requireValue("--temp", argv[++i]);
        break;
      case "--target":
        result.target = requireValue("--target", argv[++i]);
        break;
      case "--quiet":
        result.quiet = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      default:
        throw new CliArgumentError(`Unknown rotate-audit-trail-key flag: ${arg}`);
    }
  }
  if (result.help) return result;

  if (result.recoverTemp) {
    // Recovery arm: --temp + --target + --new-secret are required;
    // --encrypted / --old-secret / --out / --in-place are forbidden
    // (the recovery flow has nothing to decrypt under an old key — the
    // temp is already encrypted under the new secret from the failed
    // in-place run).
    if (result.encrypted !== undefined) {
      throw new CliArgumentError(
        "rotate-audit-trail-key --recover-temp is mutually exclusive with --encrypted"
      );
    }
    if (result.oldSecret !== undefined) {
      throw new CliArgumentError(
        "rotate-audit-trail-key --recover-temp is mutually exclusive with --old-secret"
      );
    }
    if (result.out !== undefined) {
      throw new CliArgumentError(
        "rotate-audit-trail-key --recover-temp is mutually exclusive with --out"
      );
    }
    if (result.inPlace) {
      throw new CliArgumentError(
        "rotate-audit-trail-key --recover-temp is mutually exclusive with --in-place"
      );
    }
    if (result.temp === undefined) {
      throw new CliArgumentError(
        "rotate-audit-trail-key --recover-temp requires --temp <stranded.tmp>"
      );
    }
    if (result.target === undefined) {
      throw new CliArgumentError(
        "rotate-audit-trail-key --recover-temp requires --target <input.aes-gcm>"
      );
    }
    if (result.newSecret === undefined || result.newSecret.length === 0) {
      throw new CliArgumentError(
        "rotate-audit-trail-key --recover-temp requires --new-secret <key>"
      );
    }
    return result;
  }

  // Rotation arm: --temp / --target are recovery-only and forbidden here.
  if (result.temp !== undefined) {
    throw new CliArgumentError(
      "rotate-audit-trail-key --temp is only valid with --recover-temp"
    );
  }
  if (result.target !== undefined) {
    throw new CliArgumentError(
      "rotate-audit-trail-key --target is only valid with --recover-temp"
    );
  }
  if (result.encrypted === undefined) {
    throw new CliArgumentError("rotate-audit-trail-key requires --encrypted <file>");
  }
  if (result.oldSecret === undefined || result.oldSecret.length === 0) {
    throw new CliArgumentError("rotate-audit-trail-key requires --old-secret <key>");
  }
  if (result.newSecret === undefined || result.newSecret.length === 0) {
    throw new CliArgumentError("rotate-audit-trail-key requires --new-secret <key>");
  }
  if (!result.inPlace && result.out === undefined) {
    throw new CliArgumentError(
      "rotate-audit-trail-key requires --out <file> or --in-place"
    );
  }
  if (result.inPlace && result.out !== undefined) {
    throw new CliArgumentError(
      "rotate-audit-trail-key --out and --in-place are mutually exclusive"
    );
  }
  return result;
}

export const CLI_USAGE_AUDIT_DEPRECATED_RULES = [
  "Usage: cnc-job-check audit-deprecated-rules [--policy <preset>] [--older-than <N>{mo|d}] [--format json|text] [--strict] [--scope-roots <p>;<p>;...]",
  "",
  "Walks every loaded profile pack (built-in + auto-discovered) and lists",
  "every rule whose `ProfileRuleDoc.deprecatedSince` is set. Informational",
  "by default; combine with `--older-than` + `--strict` (or `--policy`) to",
  "fail CI when a deprecation has aged past the configured cadence (see",
  "DEPRECATION_POLICY.md).",
  "Exit codes:",
  "  0   audit completed (no over-threshold rows, OR --strict not supplied)",
  "  1   --strict was supplied AND at least one row is over the threshold",
  "  2   argument or IO error (malformed --older-than, unknown flag, etc.)",
  "",
  "Options:",
  "  --policy <preset>          Named preset: informational | six-month-strict |",
  "                             yearly-strict. Mutually exclusive with --older-than",
  "                             and --strict (the preset supplies both).",
  "  --older-than <N>{mo|d}     Threshold for the `overThreshold` flag. `mo` = whole months;",
  "                             `d` = days, converted via Math.ceil(days/30) (a non-zero",
  "                             day count never collapses to 0 months). Without this flag,",
  "                             every deprecated rule is listed with `overThreshold: false`.",
  "  --format <json|text>       Output format (default: text).",
  "  --strict                   Exit 1 when any row is over the threshold.",
  "  --scope-roots <list>       Semicolon-separated list of additional discovery roots passed",
  "                             to `discoverProfilePackRuleDocs`. Mirrors the",
  "                             CNC_PROFILE_PACK_SCOPE_ROOTS env-var contract.",
  "  --quiet                    Suppress the `(no deprecated rules found)` line on empty audits.",
  "  --help, -h                 Show this message"
].join("\n");

export type AuditDeprecatedRulesArgs = {
  policy?: AuditDeprecatedRulesPolicyPresetId;
  olderThan?: string; // raw token, e.g. "6mo" — translated by parseOlderThanThreshold
  format: "json" | "text";
  strict: boolean;
  scopeRoots?: string[];
  quiet: boolean;
  help: boolean;
};

export function parseAuditDeprecatedRulesArgs(
  argv: readonly string[]
): AuditDeprecatedRulesArgs {
  const result: AuditDeprecatedRulesArgs = {
    format: "text",
    strict: false,
    quiet: false,
    help: false
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--policy": {
        const value = requireValue("--policy", argv[++i]);
        if (!isAuditDeprecatedRulesPolicyPresetId(value)) {
          throw new CliArgumentError(
            `audit-deprecated-rules: invalid --policy value: ${value} (expected informational | six-month-strict | yearly-strict)`
          );
        }
        result.policy = value;
        break;
      }
      case "--older-than":
        result.olderThan = requireValue("--older-than", argv[++i]);
        break;
      case "--format": {
        const value = requireValue("--format", argv[++i]);
        if (value !== "json" && value !== "text") {
          throw new CliArgumentError(
            `audit-deprecated-rules: invalid --format value: ${value} (expected json | text)`
          );
        }
        result.format = value;
        break;
      }
      case "--strict":
        result.strict = true;
        break;
      case "--scope-roots": {
        const value = requireValue("--scope-roots", argv[++i]);
        result.scopeRoots = value
          .split(";")
          .map((part) => part.trim())
          .filter((part) => part.length > 0);
        if (result.scopeRoots.length === 0) {
          throw new CliArgumentError(
            "audit-deprecated-rules: --scope-roots requires at least one non-empty path"
          );
        }
        break;
      }
      case "--quiet":
        result.quiet = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
      default:
        throw new CliArgumentError(`Unknown audit-deprecated-rules flag: ${arg}`);
    }
  }
  if (result.help) return result;
  if (result.policy !== undefined) {
    if (result.olderThan !== undefined) {
      throw new CliArgumentError(
        "audit-deprecated-rules: --policy is mutually exclusive with --older-than"
      );
    }
    if (result.strict) {
      throw new CliArgumentError(
        "audit-deprecated-rules: --policy is mutually exclusive with --strict"
      );
    }
    const resolved = resolveAuditDeprecatedRulesPreset(result.policy);
    result.olderThan = resolved.olderThan;
    result.strict = resolved.strict;
  }
  if (result.olderThan !== undefined) {
    const parsed = parseOlderThanThreshold(result.olderThan);
    if (parsed === undefined) {
      throw new CliArgumentError(
        `audit-deprecated-rules: invalid --older-than value: ${result.olderThan} (expected <N>mo or <N>d)`
      );
    }
  }
  if (result.strict && result.olderThan === undefined) {
    throw new CliArgumentError(
      "audit-deprecated-rules: --strict requires --older-than <N>{mo|d}"
    );
  }
  return result;
}

export const CLI_TEXT_SEPARATOR = "===== PROVEOUT =====";
export const CLI_BATCH_FILE_SEPARATOR_PREFIX = "===== FILE: ";
export const CLI_BATCH_FILE_SEPARATOR_SUFFIX = " =====";

export type CliArgs = {
  input?: string;
  inputDir?: string;
  recursive: boolean;
  include?: string[];
  exclude?: string[];
  controller: CliControllerKey;
  policy?: string;
  policyPreset?: ParseDiagnosticsPolicyPresetId;
  format: "json" | "text" | "ndjson";
  out?: string;
  outDir?: string;
  /**
   * Single-input only: write the setup sheet (with optional histogram bars
   * when the lint summary spans ≥2 sources) as a hand-rolled minimal PDF1.4
   * file at the given path. Rejected with `--input-dir` (per-input batch PDF
   * is provided via `exportSetupSheetPdfBatch`).
   */
  exportSetupSheetPdf?: string;
  /**
   * Batch-only counterpart to `exportSetupSheetPdf`: when set together with
   * `--input-dir`, the CLI writes one `<basename>.pdf` per input under this
   * directory, mirroring the relative tree (same semantics as `--out-dir`).
   * Mutually exclusive with `exportSetupSheetPdf`; requires `inputDir`.
   */
  exportSetupSheetPdfBatch?: string;
  /**
   * Per-format extension overrides for `--out-dir`. Keys are the canonical
   * `--format` values (`json`/`text`/`ndjson`); values are the desired output
   * extension and MUST start with a literal `.`. Populated from one or more
   * `--out-dir-format <format>:<ext>` flags. Standalone use (without
   * `--out-dir`) is rejected at parse time.
   */
  outDirFormat?: Partial<Record<CliArgs["format"], string>>;
  strict: boolean;
  quiet: boolean;
  schemaVersion: boolean;
  help: boolean;
  /**
   * When true, the CLI flushes the memoized profile-pack auto-discovery
   * cache before running. Useful when a long-running shell session has
   * just installed a new pack — the next discovery walk picks it up.
   * Tied to the `--rediscover-profile-packs` flag.
   */
  rediscoverProfilePacks: boolean;
  /**
   * When true, profile-lint issues whose owning `ProfileRuleDoc` carries
   * a `deprecatedSince` value are filtered out before envelope assembly.
   * Lets shops tighten CI without forking the profile pack. Wired to the
   * `--no-deprecated-rules` flag.
   */
  noDeprecatedRules: boolean;
  /**
   * Schema v7: list of controller-grammar code patterns that, when matched
   * by any lint issue's `code`, flip `envelope.blocked = true` and surface
   * the matched code(s) in `envelope.strictControllerCodesGated`. Each entry
   * is either an exact code (`CG_FANUC_MACRO_IJK_ORDER`) or a family wildcard
   * with a trailing `*` (`CG_DUPLICATE_ADDRESSES_*`). Comma-separated on the
   * CLI; empty list rejected at parse time. Wired to `--strict-controller-codes`.
   */
  strictControllerCodes?: string[];
};

export class CliArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliArgumentError";
  }
}

function isControllerKey(value: string | undefined): value is CliControllerKey {
  return value === "haas-ngc" || value === "haas-legacy" || value === "fanuc";
}

function isPresetId(value: string | undefined): value is ParseDiagnosticsPolicyPresetId {
  if (value === undefined) return false;
  return (PARSE_DIAGNOSTICS_POLICY_PRESET_IDS as ReadonlyArray<string>).includes(value);
}

function requireValue(flag: string, value: string | undefined): string {
  if (value === undefined) {
    throw new CliArgumentError(`Missing value for ${flag}`);
  }
  return value;
}

export function parseCliArgs(argv: readonly string[]): CliArgs {
  const result: CliArgs = {
    controller: "haas-ngc",
    format: "json",
    recursive: false,
    strict: false,
    quiet: false,
    schemaVersion: false,
    help: false,
    rediscoverProfilePacks: false,
    noDeprecatedRules: false
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case "--input":
        result.input = requireValue(flag, argv[++i]);
        break;
      case "--input-dir":
        result.inputDir = requireValue(flag, argv[++i]);
        break;
      case "--controller": {
        const value = requireValue(flag, argv[++i]);
        if (!isControllerKey(value)) {
          throw new CliArgumentError(
            `Invalid --controller value: ${value} (expected haas-ngc | haas-legacy | fanuc)`
          );
        }
        result.controller = value;
        break;
      }
      case "--policy":
        result.policy = requireValue(flag, argv[++i]);
        break;
      case "--policy-preset": {
        const value = requireValue(flag, argv[++i]);
        if (!isPresetId(value)) {
          throw new CliArgumentError(
            `Invalid --policy-preset value: ${value} (expected strict | balanced | permissive)`
          );
        }
        result.policyPreset = value;
        break;
      }
      case "--format": {
        const value = requireValue(flag, argv[++i]);
        if (value !== "json" && value !== "text" && value !== "ndjson") {
          throw new CliArgumentError(
            `Invalid --format value: ${value} (expected json | text | ndjson)`
          );
        }
        result.format = value;
        break;
      }
      case "--out":
        result.out = requireValue(flag, argv[++i]);
        break;
      case "--export-setup-sheet-pdf":
        result.exportSetupSheetPdf = requireValue(flag, argv[++i]);
        break;
      case "--export-setup-sheet-pdf-batch":
        result.exportSetupSheetPdfBatch = requireValue(flag, argv[++i]);
        break;
      case "--out-dir":
        result.outDir = requireValue(flag, argv[++i]);
        break;
      case "--out-dir-format": {
        const value = requireValue(flag, argv[++i]);
        const colonIndex = value.indexOf(":");
        if (colonIndex <= 0 || colonIndex === value.length - 1) {
          throw new CliArgumentError(
            `Invalid --out-dir-format value: ${value} (expected <format>:<ext>, e.g. json:.envelope.json)`
          );
        }
        const formatPart = value.slice(0, colonIndex);
        const extPart = value.slice(colonIndex + 1);
        if (formatPart !== "json" && formatPart !== "text" && formatPart !== "ndjson") {
          throw new CliArgumentError(
            `Invalid --out-dir-format format: ${formatPart} (expected json | text | ndjson)`
          );
        }
        if (!extPart.startsWith(".")) {
          throw new CliArgumentError(
            `Invalid --out-dir-format extension: ${extPart} (must start with '.')`
          );
        }
        (result.outDirFormat ??= {})[formatPart] = extPart;
        break;
      }
      case "--recursive":
        result.recursive = true;
        break;
      case "--include":
        (result.include ??= []).push(requireValue(flag, argv[++i]));
        break;
      case "--exclude":
        (result.exclude ??= []).push(requireValue(flag, argv[++i]));
        break;
      case "--strict":
        result.strict = true;
        break;
      case "--quiet":
        result.quiet = true;
        break;
      case "--schema-version":
        result.schemaVersion = true;
        break;
      case "--rediscover-profile-packs":
        result.rediscoverProfilePacks = true;
        break;
      case "--no-deprecated-rules":
        result.noDeprecatedRules = true;
        break;
      case "--strict-controller-codes": {
        const value = requireValue(flag, argv[++i]);
        const codes = value
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (codes.length === 0) {
          throw new CliArgumentError(
            "--strict-controller-codes requires at least one code (got empty list)"
          );
        }
        result.strictControllerCodes = codes;
        break;
      }
      case "--help":
      case "-h":
        result.help = true;
        break;
      default:
        throw new CliArgumentError(`Unknown argument: ${flag}`);
    }
  }
  if (result.help || result.schemaVersion) return result;
  if (result.input === undefined && result.inputDir === undefined) {
    throw new CliArgumentError("Missing required --input <path> or --input-dir <path>");
  }
  if (result.input !== undefined && result.inputDir !== undefined) {
    throw new CliArgumentError("--input and --input-dir are mutually exclusive");
  }
  if (result.policy && result.policyPreset) {
    throw new CliArgumentError("--policy and --policy-preset are mutually exclusive");
  }
  if (result.out !== undefined && result.outDir !== undefined) {
    throw new CliArgumentError("--out and --out-dir are mutually exclusive");
  }
  if (result.outDir !== undefined && result.inputDir === undefined) {
    throw new CliArgumentError("--out-dir requires --input-dir (per-file output is batch-only)");
  }
  if (result.outDirFormat !== undefined && result.outDir === undefined) {
    throw new CliArgumentError("--out-dir-format requires --out-dir");
  }
  if (result.exportSetupSheetPdf !== undefined && result.inputDir !== undefined) {
    throw new CliArgumentError(
      "--export-setup-sheet-pdf is single-input only; use --export-setup-sheet-pdf-batch for --input-dir"
    );
  }
  if (
    result.exportSetupSheetPdfBatch !== undefined &&
    result.inputDir === undefined
  ) {
    throw new CliArgumentError(
      "--export-setup-sheet-pdf-batch requires --input-dir (per-file PDF output is batch-only)"
    );
  }
  if (
    result.exportSetupSheetPdf !== undefined &&
    result.exportSetupSheetPdfBatch !== undefined
  ) {
    throw new CliArgumentError(
      "--export-setup-sheet-pdf and --export-setup-sheet-pdf-batch are mutually exclusive"
    );
  }
  return result;
}

export function buildControllerProfile(controller: CliControllerKey): ControllerProfile {
  return {
    id: controller,
    name: CONTROLLER_NAMES[controller],
    defaultFormatStyle: {
      upperCaseWords: true,
      normalizeSpacing: true,
      removeStandaloneOptionalStops: false
    }
  };
}

export function formatJobCheckText(result: RunJobCheckResult): string {
  return [result.setupSheet.exportTxt, "", CLI_TEXT_SEPARATOR, "", result.proveout.code].join("\n");
}

export function formatBatchText(entries: { input: string; result: RunJobCheckResult }[]): string {
  if (entries.length === 0) return "";
  return entries
    .map(
      (entry) =>
        `${CLI_BATCH_FILE_SEPARATOR_PREFIX}${entry.input}${CLI_BATCH_FILE_SEPARATOR_SUFFIX}\n${formatJobCheckText(entry.result)}`
    )
    .join("\n\n");
}

export type CliDirEntry = { name: string; isDirectory: boolean };

export type CliIo = {
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
  readFileFn?: (filePath: string) => Promise<string>;
  /**
   * Optional binary read for the `verify-audit-trail` AES-GCM sidecar
   * and `rotate-audit-trail-key` input blob (other paths read UTF-8
   * text). Defaults to `node:fs/promises.readFile` with no encoding,
   * returning the raw bytes as a `Uint8Array`.
   */
  readFileBytesFn?: (filePath: string) => Promise<Uint8Array>;
  writeFileFn?: (filePath: string, content: string | Uint8Array) => Promise<void>;
  /**
   * Optional binary write seam for the `rotate-audit-trail-key`
   * subcommand. Defaults to `node:fs/promises.writeFile` (which
   * already accepts `Uint8Array`); kept distinct from `writeFileFn` so
   * test fakes can route binary writes to a separate channel.
   */
  writeFileBytesFn?: (filePath: string, bytes: Uint8Array) => Promise<void>;
  mkdirFn?: (dirPath: string) => Promise<void>;
  readDirFn?: (dirPath: string) => Promise<string[]>;
  readDirEntriesFn?: (dirPath: string) => Promise<CliDirEntry[]>;
  stdinReader?: () => Promise<string>;
};

async function readStdinChunks(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function loadProgramSource(
  inputFlag: string,
  io: { readFileFn: (p: string) => Promise<string>; stdinReader: () => Promise<string> }
): Promise<string> {
  if (inputFlag === "-") return io.stdinReader();
  return io.readFileFn(inputFlag);
}

function toForwardSlashRelative(fullPath: string, root: string): string {
  const rel = path.relative(root, fullPath);
  return rel.split(path.sep).join("/");
}

function outputExtensionForFormat(
  format: CliArgs["format"],
  overrides?: CliArgs["outDirFormat"]
): string {
  if (overrides) {
    const override = overrides[format];
    if (override !== undefined) return override;
  }
  if (format === "json") return ".json";
  if (format === "ndjson") return ".ndjson";
  return ".txt";
}

/**
 * Compute the per-file target path under --out-dir, mirroring the relative
 * structure under --input-dir. Returns `undefined` if the source path resolves
 * outside the input root (defense in depth against `..` escapes / absolute
 * paths sneaking in via custom IO).
 */
function resolveOutDirTarget(
  inputDir: string,
  sourcePath: string,
  outDir: string,
  ext: string
): string | undefined {
  const rel = path.relative(inputDir, sourcePath);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return undefined;
  const segments = rel.split(/[\\/]/);
  if (segments.some((s) => s === "..")) return undefined;
  const parsed = path.parse(rel);
  const renamed = path.join(parsed.dir, `${parsed.name}${ext}`);
  return path.join(outDir, renamed);
}

async function listBatchInputFiles(
  dirPath: string,
  options: {
    recursive: boolean;
    include?: ReadonlyArray<string>;
    exclude?: ReadonlyArray<string>;
    readDirEntriesFn: (dirPath: string) => Promise<CliDirEntry[]>;
  }
): Promise<{ files: string[]; skipped: number }> {
  const collected: string[] = [];
  let skipped = 0;
  const stack: string[] = [dirPath];
  while (stack.length > 0) {
    const current = stack.shift()!;
    const entries = await options.readDirEntriesFn(current);
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory) {
        if (options.recursive) stack.push(fullPath);
        continue;
      }
      const rel = toForwardSlashRelative(fullPath, dirPath);
      const classification = classifyBatchRelativePath(rel, {
        recursive: true, // walker already gated directory descent
        include: options.include,
        exclude: options.exclude
      });
      if (classification === "matched") collected.push(fullPath);
      else if (classification === "skipped") skipped += 1;
    }
  }
  collected.sort((a, b) => a.localeCompare(b));
  return { files: collected, skipped };
}

function resolvePolicyFromArgs(
  parsed: CliArgs,
  policyJson: string | undefined
): ParseDiagnosticsThresholdPolicy | undefined {
  if (parsed.policyPreset) {
    return resolveParseDiagnosticsPolicyPreset(parsed.policyPreset);
  }
  if (policyJson === undefined) return undefined;
  return JSON.parse(policyJson) as ParseDiagnosticsThresholdPolicy;
}

/**
 * Contract for a per-controller profile-lint loader. Each loader is responsible
 * for dynamically importing its own profile package and returning the raw
 * `LintIssue[]` from that package's `validateAst` hook. Loaders MUST swallow
 * import errors and return `undefined` so a missing/optional profile package
 * never blocks the CLI; the workflow-level lint pass already covers
 * controller-grammar and common-lint sources.
 */
export type CliProfileLintLoader = (ast: ProgramAst) => Promise<LintIssue[] | undefined>;

const PROFILE_LINT_LOADERS: Partial<Record<CliControllerKey, CliProfileLintLoader>> = {
  "haas-ngc": async (ast) => {
    try {
      const mod = (await import("@cnc/profile-haas-ngc")) as {
        haasNgcProfile?: { validateAst?: (ast: ProgramAst) => LintIssue[] };
      };
      return mod.haasNgcProfile?.validateAst?.(ast);
    } catch {
      return undefined;
    }
  },
  fanuc: async (ast) => {
    try {
      const mod = (await import("@cnc/profile-fanuc-iso")) as {
        fanucIsoProfile?: { validateAst?: (ast: ProgramAst) => LintIssue[] };
      };
      return mod.fanucIsoProfile?.validateAst?.(ast);
    } catch {
      return undefined;
    }
  }
};

/**
 * Memoized auto-discovery of additional profile packs that opt in via
 * `cnc-workbench.profilePack` metadata in their `package.json`. The promise
 * is resolved lazily on the first miss against the hand-wired
 * `PROFILE_LINT_LOADERS` so the fast-path stays free of filesystem I/O.
 *
 * Test seam: callers that need a deterministic fixture-only registry can
 * pre-seed this cache via `setDiscoveredProfilePackLoadersForTesting`.
 */
let discoveredProfilePackLoadersPromise:
  | Promise<Partial<Record<CliControllerKey, CliProfileLintLoader>>>
  | undefined;

function getDiscoveredProfilePackLoaders(): Promise<
  Partial<Record<CliControllerKey, CliProfileLintLoader>>
> {
  if (!discoveredProfilePackLoadersPromise) {
    discoveredProfilePackLoadersPromise = (async () => {
      try {
        const mod = await import("./cli/profilePackRegistry.js");
        return mod.discoverProfilePackLoaders();
      } catch {
        return {};
      }
    })();
  }
  return discoveredProfilePackLoadersPromise;
}

/**
 * Test-only: replace the memoized auto-discovery cache with a fixed map.
 * Pass `undefined` to reset and let the next call re-run discovery.
 */
export function setDiscoveredProfilePackLoadersForTesting(
  loaders: Partial<Record<CliControllerKey, CliProfileLintLoader>> | undefined
): void {
  discoveredProfilePackLoadersPromise =
    loaders === undefined ? undefined : Promise.resolve(loaders);
}

/**
 * Production-grade cache flush for profile-pack auto-discovery. Distinct
 * from {@link setDiscoveredProfilePackLoadersForTesting} (which is for
 * fixtures) — this clears the memoized promise so the next
 * `loadProfileLintIssues` call re-walks the configured scope roots.
 *
 * Useful when a long-running shell session installs a new pack mid-session,
 * or when the env var `CNC_PROFILE_PACK_SCOPE_ROOTS` changes between calls.
 * The CLI's `--rediscover-profile-packs` flag invokes this before running.
 */
export function clearDiscoveredProfilePackLoadersCache(): void {
  discoveredProfilePackLoadersPromise = undefined;
  discoveredProfilePackRuleDocsPromise = undefined;
}

/**
 * Hand-wired `ProfileRuleDoc[]` loaders for the built-in profile packs.
 * Mirrors `PROFILE_LINT_LOADERS` but for the doc registries — the CLI uses
 * these to drive the `--no-deprecated-rules` filter without re-walking
 * auto-discovery for built-in packs. Same try/catch swallowing as the lint
 * loaders so a missing pack never blocks linting.
 */
const PROFILE_RULE_DOCS_LOADERS: Partial<
  Record<CliControllerKey, () => Promise<ProfileRuleDoc[] | undefined>>
> = {
  "haas-ngc": async () => {
    try {
      const mod = (await import("@cnc/profile-haas-ngc")) as {
        haasNgcRuleDocs?: ProfileRuleDoc[];
      };
      return mod.haasNgcRuleDocs;
    } catch {
      return undefined;
    }
  },
  fanuc: async () => {
    try {
      const mod = (await import("@cnc/profile-fanuc-iso")) as {
        fanucIsoRuleDocs?: ProfileRuleDoc[];
      };
      return mod.fanucIsoRuleDocs;
    } catch {
      return undefined;
    }
  }
};

let discoveredProfilePackRuleDocsPromise:
  | Promise<Partial<Record<CliControllerKey, ProfileRuleDoc[]>>>
  | undefined;

function getDiscoveredProfilePackRuleDocs(): Promise<
  Partial<Record<CliControllerKey, ProfileRuleDoc[]>>
> {
  if (!discoveredProfilePackRuleDocsPromise) {
    discoveredProfilePackRuleDocsPromise = (async () => {
      try {
        const mod = await import("./cli/profilePackRegistry.js");
        return mod.discoverProfilePackRuleDocs();
      } catch {
        return {};
      }
    })();
  }
  return discoveredProfilePackRuleDocsPromise;
}

/**
 * Test-only: replace the memoized rule-docs auto-discovery cache with a
 * fixed map. Pass `undefined` to reset.
 */
export function setDiscoveredProfilePackRuleDocsForTesting(
  docs: Partial<Record<CliControllerKey, ProfileRuleDoc[]>> | undefined
): void {
  discoveredProfilePackRuleDocsPromise =
    docs === undefined ? undefined : Promise.resolve(docs);
}

async function loadProfileRuleDocs(
  controller: CliControllerKey
): Promise<ProfileRuleDoc[] | undefined> {
  const handWired = PROFILE_RULE_DOCS_LOADERS[controller];
  if (handWired) {
    const docs = await handWired();
    if (docs) return docs;
  }
  const discovered = await getDiscoveredProfilePackRuleDocs();
  return discovered[controller];
}

async function loadProfileLintIssues(
  controller: CliControllerKey,
  ast: ProgramAst,
  options: { suppressDeprecated?: boolean } = {}
): Promise<LintIssue[] | undefined> {
  const handWiredLoader = PROFILE_LINT_LOADERS[controller];
  let issues: LintIssue[] | undefined;
  if (handWiredLoader) {
    issues = await handWiredLoader(ast);
  } else {
    // Fallback: auto-discovered third-party profile packs declared via
    // `cnc-workbench.profilePack` metadata in their package.json.
    const discovered = await getDiscoveredProfilePackLoaders();
    const discoveredLoader = discovered[controller];
    issues = discoveredLoader ? await discoveredLoader(ast) : undefined;
  }
  if (!issues || !options.suppressDeprecated) return issues;
  const ruleDocs = await loadProfileRuleDocs(controller);
  if (!ruleDocs || ruleDocs.length === 0) return issues;
  return filterDeprecatedProfileLintIssues(issues, ruleDocs);
}

async function runOnce(
  source: string,
  controller: CliControllerKey,
  policy: ParseDiagnosticsThresholdPolicy | undefined,
  options: { suppressDeprecated?: boolean } = {}
): Promise<RunJobCheckResult> {
  const profile = buildControllerProfile(controller);
  const ast = parse(source, profile, { includeExpressionAst: true });
  const profileLintIssues = await loadProfileLintIssues(controller, ast, options);
  return runJobCheck({ ast, parseDiagnosticsPolicy: policy, profileLintIssues });
}

function emitStrictBlockedHint(
  writeErr: (chunk: string) => void,
  blockerCount: number,
  warningCount: number,
  inputLabel?: string
): void {
  const head = inputLabel
    ? `cnc-job-check: blocked=true (strict mode) input=${inputLabel}`
    : "cnc-job-check: blocked=true (strict mode)";
  writeErr(`${head}; blockers=${blockerCount} warnings=${warningCount}\n`);
}

export type VerifyAuditTrailIo = {
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
  readFileFn?: (filePath: string) => Promise<string>;
  readFileBytesFn?: (filePath: string) => Promise<Uint8Array>;
};

export async function runVerifyAuditTrail(
  parsed: VerifyAuditTrailArgs,
  io: VerifyAuditTrailIo = {}
): Promise<number> {
  const writeOut = io.stdout ?? ((chunk: string) => void process.stdout.write(chunk));
  const writeErr = io.stderr ?? ((chunk: string) => void process.stderr.write(chunk));
  const readText = io.readFileFn ?? ((p: string) => readFile(p, "utf8"));
  const readBytes =
    io.readFileBytesFn ??
    (async (p: string) => {
      const buf = await readFile(p);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    });

  let mainPayload: string;
  try {
    mainPayload = await readText(parsed.main!);
  } catch (err) {
    writeErr(
      `cnc-job-check verify-audit-trail: failed to read --main ${parsed.main}: ${(err as Error).message}\n`
    );
    return 2;
  }

  let mismatched = false;
  const log = (line: string): void => {
    if (!parsed.quiet) writeOut(`${line}\n`);
  };

  if (parsed.sha256 !== undefined) {
    let sidecarBody: string;
    try {
      sidecarBody = await readText(parsed.sha256);
    } catch (err) {
      writeErr(
        `cnc-job-check verify-audit-trail: failed to read --sha256 ${parsed.sha256}: ${(err as Error).message}\n`
      );
      return 2;
    }
    const expected = parseSidecarBodyDigest(sidecarBody);
    if (!expected) {
      writeErr(
        `cnc-job-check verify-audit-trail: --sha256 ${parsed.sha256} does not contain a hex digest\n`
      );
      return 2;
    }
    let actual: string;
    try {
      actual = await computeSha256(mainPayload);
    } catch (err) {
      writeErr(
        `cnc-job-check verify-audit-trail: sha256 compute failed: ${(err as Error).message}\n`
      );
      return 2;
    }
    if (actual !== expected) {
      writeErr(
        `cnc-job-check verify-audit-trail: sha256 mismatch (expected ${expected}, got ${actual})\n`
      );
      mismatched = true;
    } else {
      log(`cnc-job-check verify-audit-trail: sha256 OK (${actual})`);
    }
  }

  if (parsed.hmac !== undefined) {
    let sidecarBody: string;
    try {
      sidecarBody = await readText(parsed.hmac);
    } catch (err) {
      writeErr(
        `cnc-job-check verify-audit-trail: failed to read --hmac ${parsed.hmac}: ${(err as Error).message}\n`
      );
      return 2;
    }
    const expected = parseSidecarBodyDigest(sidecarBody);
    if (!expected) {
      writeErr(
        `cnc-job-check verify-audit-trail: --hmac ${parsed.hmac} does not contain a hex digest\n`
      );
      return 2;
    }
    let actual: string;
    try {
      actual = await computeHmacSha256(mainPayload, parsed.hmacSecret!);
    } catch (err) {
      writeErr(
        `cnc-job-check verify-audit-trail: hmac compute failed: ${(err as Error).message}\n`
      );
      return 2;
    }
    if (actual !== expected) {
      writeErr(
        `cnc-job-check verify-audit-trail: hmac mismatch (expected ${expected}, got ${actual})\n`
      );
      mismatched = true;
    } else {
      log(`cnc-job-check verify-audit-trail: hmac OK (${actual})`);
    }
  }

  if (parsed.encrypted !== undefined) {
    let blob: Uint8Array;
    try {
      blob = await readBytes(parsed.encrypted);
    } catch (err) {
      writeErr(
        `cnc-job-check verify-audit-trail: failed to read --encrypted ${parsed.encrypted}: ${(err as Error).message}\n`
      );
      return 2;
    }
    let plaintext: string;
    try {
      plaintext = await decryptAesGcm(blob, parsed.encryptionSecret!);
    } catch (err) {
      writeErr(
        `cnc-job-check verify-audit-trail: encrypted decrypt failed: ${(err as Error).message}\n`
      );
      mismatched = true;
      return 1;
    }
    if (plaintext !== mainPayload) {
      writeErr(
        `cnc-job-check verify-audit-trail: encrypted plaintext does not match --main payload\n`
      );
      mismatched = true;
    } else {
      log(`cnc-job-check verify-audit-trail: encrypted OK (${blob.length} bytes)`);
    }
  }

  return mismatched ? 1 : 0;
}

export type RotateAuditTrailKeyIo = {
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
  readFileBytesFn?: (filePath: string) => Promise<Uint8Array>;
  writeFileBytesFn?: (filePath: string, bytes: Uint8Array) => Promise<void>;
  /**
   * Optional rename hook for `--in-place`'s atomic temp-then-rename
   * step. Defaults to `node:fs/promises.rename`.
   */
  renameFn?: (from: string, to: string) => Promise<void>;
};

export async function runRotateAuditTrailKey(
  parsed: RotateAuditTrailKeyArgs,
  io: RotateAuditTrailKeyIo = {}
): Promise<number> {
  const writeOut = io.stdout ?? ((chunk: string) => void process.stdout.write(chunk));
  const writeErr = io.stderr ?? ((chunk: string) => void process.stderr.write(chunk));
  const readBytes =
    io.readFileBytesFn ??
    (async (p: string) => {
      const buf = await readFile(p);
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    });
  const writeBytes =
    io.writeFileBytesFn ?? ((p: string, bytes: Uint8Array) => writeFile(p, bytes));
  const renameOnDisk = io.renameFn ?? ((from: string, to: string) => rename(from, to));

  // Schema v8 recovery arm: validate the stranded temp file decrypts
  // under --new-secret, then atomically rename it onto --target.
  if (parsed.recoverTemp) {
    let tempBlob: Uint8Array;
    try {
      tempBlob = await readBytes(parsed.temp!);
    } catch (err) {
      writeErr(
        `cnc-job-check rotate-audit-trail-key: failed to read --temp ${parsed.temp}: ${(err as Error).message}\n`
      );
      return 2;
    }
    try {
      await decryptAesGcm(tempBlob, parsed.newSecret!);
    } catch {
      writeErr(
        `cnc-job-check rotate-audit-trail-key --recover-temp: temp file does not decrypt under --new-secret\n`
      );
      return 1;
    }
    try {
      await renameOnDisk(parsed.temp!, parsed.target!);
    } catch (err) {
      writeErr(
        `cnc-job-check rotate-audit-trail-key --recover-temp: failed to rename ${parsed.temp} -> ${parsed.target}: ${(err as Error).message}\n`
      );
      return 2;
    }
    if (!parsed.quiet) {
      writeOut(
        `cnc-job-check rotate-audit-trail-key --recover-temp: OK (${tempBlob.length} bytes, ${parsed.target})\n`
      );
    }
    return 0;
  }

  let blob: Uint8Array;
  try {
    blob = await readBytes(parsed.encrypted!);
  } catch (err) {
    writeErr(
      `cnc-job-check rotate-audit-trail-key: failed to read --encrypted ${parsed.encrypted}: ${(err as Error).message}\n`
    );
    return 2;
  }

  let rotated: Uint8Array;
  try {
    rotated = await rotateAuditTrailKey(blob, parsed.oldSecret!, parsed.newSecret!);
  } catch (err) {
    writeErr(`${(err as Error).message}\n`);
    return 1;
  }

  if (parsed.inPlace) {
    const tempPath = `${parsed.encrypted!}.rotating`;
    try {
      await writeBytes(tempPath, rotated);
    } catch (err) {
      writeErr(
        `cnc-job-check rotate-audit-trail-key: failed to write temp ${tempPath}: ${(err as Error).message}\n`
      );
      return 2;
    }
    try {
      await renameOnDisk(tempPath, parsed.encrypted!);
    } catch (err) {
      // Schema v8: a post-write rename failure leaves a temp file on
      // disk encrypted under the new secret. Throw the dedicated
      // stranded-temp error so the dispatcher can print the canonical
      // recovery hint and exit 3 (distinct from the read/write/argument
      // errors that exit 2).
      throw new AuditTrailRotationStrandedTempError(tempPath, err as Error);
    }
    if (!parsed.quiet) {
      writeOut(
        `cnc-job-check rotate-audit-trail-key: OK (${rotated.length} bytes, in-place ${parsed.encrypted})\n`
      );
    }
    return 0;
  }

  try {
    await writeBytes(parsed.out!, rotated);
  } catch (err) {
    writeErr(
      `cnc-job-check rotate-audit-trail-key: failed to write --out ${parsed.out}: ${(err as Error).message}\n`
    );
    return 2;
  }
  if (!parsed.quiet) {
    writeOut(
      `cnc-job-check rotate-audit-trail-key: OK (${rotated.length} bytes, ${parsed.out})\n`
    );
  }
  return 0;
}

/**
 * Pack identifier surfaced in the audit output for each built-in
 * controller. Mirrors the npm package name so CI dashboards show the
 * full `@cnc/profile-*` slug rather than the shorter controller key.
 * Discovered packs whose `controllerKey` is unknown to this map fall
 * back to the controller key itself.
 */
const BUILTIN_PACK_NPM_NAMES: Partial<Record<CliControllerKey, string>> = {
  fanuc: "@cnc/profile-fanuc-iso",
  "haas-ngc": "@cnc/profile-haas-ngc"
};

function packLabelForController(controller: CliControllerKey): string {
  return BUILTIN_PACK_NPM_NAMES[controller] ?? controller;
}

export type AuditDeprecatedRulesIo = {
  stdout?: (chunk: string) => void;
  stderr?: (chunk: string) => void;
  /**
   * Inject the rule-doc loader. Defaults to the same union the
   * `--no-deprecated-rules` CLI flag consumes (hand-wired
   * `PROFILE_RULE_DOCS_LOADERS` ∪ `discoverProfilePackRuleDocs`).
   * Tests pass a deterministic Map so the audit is reproducible.
   */
  loadRuleDocsByPackFn?: (
    scopeRoots?: string[]
  ) => Promise<ReadonlyMap<string, readonly ProfileRuleDoc[]>>;
  /** Inject the audit clock; defaults to `() => new Date()`. */
  nowFn?: () => Date;
};

async function defaultLoadRuleDocsByPack(
  scopeRoots?: string[]
): Promise<ReadonlyMap<string, readonly ProfileRuleDoc[]>> {
  const result = new Map<string, readonly ProfileRuleDoc[]>();

  // Hand-wired loaders first — every built-in pack the CLI already
  // recognises is enumerated here. Each entry is loaded at most once;
  // a missing or broken pack quietly drops out (mirrors the linting path).
  const builtInControllers: CliControllerKey[] = ["fanuc", "haas-ngc", "haas-legacy"];
  for (const controller of builtInControllers) {
    const loader = PROFILE_RULE_DOCS_LOADERS[controller];
    if (!loader) continue;
    const docs = await loader();
    if (docs && docs.length > 0) {
      result.set(packLabelForController(controller), docs);
    }
  }

  // Discovered third-party packs. When `--scope-roots` is supplied we do
  // a fresh discovery walk against those roots so operators can re-audit
  // after installing a new pack without also running
  // `--rediscover-profile-packs` first. Otherwise we consult the
  // memoized cache the lint hot-path already populates — that honors the
  // `setDiscoveredProfilePackRuleDocsForTesting` seam and avoids a
  // redundant filesystem walk on every audit.
  let discovered: Partial<Record<CliControllerKey, ProfileRuleDoc[]>> = {};
  try {
    if (scopeRoots && scopeRoots.length > 0) {
      const mod = await import("./cli/profilePackRegistry.js");
      discovered = await mod.discoverProfilePackRuleDocs({ scopeRoots });
    } else {
      discovered = await getDiscoveredProfilePackRuleDocs();
    }
  } catch {
    // Discovery is best-effort; a broken auto-discovery surface must not
    // block the operator from auditing the built-in packs.
  }
  for (const [controllerKey, docs] of Object.entries(discovered) as Array<
    [CliControllerKey, ProfileRuleDoc[] | undefined]
  >) {
    if (!docs || docs.length === 0) continue;
    const label = packLabelForController(controllerKey);
    if (result.has(label)) continue; // first-wins: hand-wired beats discovered
    result.set(label, docs);
  }

  return result;
}

export async function runAuditDeprecatedRules(
  parsed: AuditDeprecatedRulesArgs,
  io: AuditDeprecatedRulesIo = {}
): Promise<number> {
  const writeOut = io.stdout ?? ((chunk: string) => void process.stdout.write(chunk));
  const writeErr = io.stderr ?? ((chunk: string) => void process.stderr.write(chunk));
  const loadRuleDocsByPack = io.loadRuleDocsByPackFn ?? defaultLoadRuleDocsByPack;
  const nowFn = io.nowFn;

  let docsByPack: ReadonlyMap<string, readonly ProfileRuleDoc[]>;
  try {
    docsByPack = await loadRuleDocsByPack(parsed.scopeRoots);
  } catch (err) {
    writeErr(
      `cnc-job-check audit-deprecated-rules: failed to load profile-pack rule docs: ${(err as Error).message}\n`
    );
    return 2;
  }

  const thresholdMonths =
    parsed.olderThan !== undefined ? parseOlderThanThreshold(parsed.olderThan) : undefined;

  const rows = buildDeprecatedRuleAudit(docsByPack, {
    thresholdMonths,
    nowFn
  });

  if (parsed.format === "json") {
    writeOut(`${formatDeprecatedRuleAuditAsJson(rows)}\n`);
  } else if (rows.length === 0) {
    if (!parsed.quiet) {
      writeOut("cnc-job-check audit-deprecated-rules: (no deprecated rules found)\n");
    }
  } else {
    writeOut(`${formatDeprecatedRuleAuditAsText(rows)}\n`);
  }

  if (parsed.strict) {
    const overThreshold = rows.filter((r) => r.overThreshold);
    if (overThreshold.length > 0) {
      writeErr(
        `cnc-job-check audit-deprecated-rules: ${overThreshold.length} rule(s) over --older-than threshold\n`
      );
      return 1;
    }
  }

  return 0;
}

export async function main(argv: readonly string[], io: CliIo = {}): Promise<number> {
  const writeOut = io.stdout ?? ((chunk: string) => void process.stdout.write(chunk));
  const writeErr = io.stderr ?? ((chunk: string) => void process.stderr.write(chunk));
  if (argv[0] === "verify-audit-trail") {
    let parsedSub: VerifyAuditTrailArgs;
    try {
      parsedSub = parseVerifyAuditTrailArgs(argv.slice(1));
    } catch (err) {
      writeErr(`${(err as Error).message}\n`);
      writeErr(`${CLI_USAGE_VERIFY_AUDIT_TRAIL}\n`);
      return 2;
    }
    if (parsedSub.help) {
      writeOut(`${CLI_USAGE_VERIFY_AUDIT_TRAIL}\n`);
      return 0;
    }
    return runVerifyAuditTrail(parsedSub, {
      stdout: io.stdout,
      stderr: io.stderr,
      readFileFn: io.readFileFn,
      readFileBytesFn: io.readFileBytesFn
    });
  }
  if (argv[0] === "verify-batch-export") {
    let parsedSub: VerifyBatchExportArgs;
    try {
      parsedSub = parseVerifyBatchExportArgs(argv.slice(1));
    } catch (err) {
      writeErr(`${(err as Error).message}\n`);
      writeErr(`${CLI_USAGE_VERIFY_BATCH_EXPORT}\n`);
      return 2;
    }
    if (parsedSub.help) {
      writeOut(`${CLI_USAGE_VERIFY_BATCH_EXPORT}\n`);
      return 0;
    }
    return runVerifyBatchExport(parsedSub, {
      stdout: io.stdout,
      stderr: io.stderr,
      readFileFn: io.readFileFn,
      readFileBytesFn: io.readFileBytesFn
    });
  }
  if (argv[0] === "rotate-audit-trail-key") {
    let parsedSub: RotateAuditTrailKeyArgs;
    try {
      parsedSub = parseRotateAuditTrailKeyArgs(argv.slice(1));
    } catch (err) {
      writeErr(`${(err as Error).message}\n`);
      writeErr(`${CLI_USAGE_ROTATE_AUDIT_TRAIL_KEY}\n`);
      return 2;
    }
    if (parsedSub.help) {
      writeOut(`${CLI_USAGE_ROTATE_AUDIT_TRAIL_KEY}\n`);
      return 0;
    }
    try {
      return await runRotateAuditTrailKey(parsedSub, {
        stdout: io.stdout,
        stderr: io.stderr,
        readFileBytesFn: io.readFileBytesFn,
        writeFileBytesFn: io.writeFileBytesFn
      });
    } catch (err) {
      if (err instanceof AuditTrailRotationStrandedTempError) {
        writeErr(`cnc-job-check ${err.message}\n`);
        return 3;
      }
      throw err;
    }
  }
  if (argv[0] === "audit-deprecated-rules") {
    let parsedSub: AuditDeprecatedRulesArgs;
    try {
      parsedSub = parseAuditDeprecatedRulesArgs(argv.slice(1));
    } catch (err) {
      writeErr(`${(err as Error).message}\n`);
      writeErr(`${CLI_USAGE_AUDIT_DEPRECATED_RULES}\n`);
      return 2;
    }
    if (parsedSub.help) {
      writeOut(`${CLI_USAGE_AUDIT_DEPRECATED_RULES}\n`);
      return 0;
    }
    return runAuditDeprecatedRules(parsedSub, {
      stdout: io.stdout,
      stderr: io.stderr
    });
  }
  const readFn = io.readFileFn ?? ((p: string) => readFile(p, "utf8"));
  const writeFn =
    io.writeFileFn ??
    ((p: string, c: string | Uint8Array) =>
      typeof c === "string" ? writeFile(p, c, "utf8") : writeFile(p, c));
  const mkdirFn =
    io.mkdirFn ??
    (async (p: string) => {
      await mkdir(p, { recursive: true });
    });
  const readDirEntriesFn =
    io.readDirEntriesFn ??
    (async (p: string): Promise<CliDirEntry[]> => {
      if (io.readDirFn !== undefined) {
        const names = await io.readDirFn(p);
        return names.map((name) => ({ name, isDirectory: false }));
      }
      const dirents = await readdir(p, { withFileTypes: true });
      return dirents.map((d) => ({ name: d.name, isDirectory: d.isDirectory() }));
    });
  const stdinReader = io.stdinReader ?? readStdinChunks;

  let parsed: CliArgs;
  try {
    parsed = parseCliArgs(argv);
  } catch (err) {
    writeErr(`${(err as Error).message}\n`);
    writeErr(`${CLI_USAGE}\n`);
    return 2;
  }

  if (parsed.help) {
    writeOut(`${CLI_USAGE}\n`);
    return 0;
  }

  if (parsed.schemaVersion) {
    writeOut(`cnc-job-check schema=${CLI_SCHEMA_VERSION}\n`);
    return 0;
  }

  if (parsed.rediscoverProfilePacks) {
    clearDiscoveredProfilePackLoadersCache();
  }

  let policyJson: string | undefined;
  if (parsed.policy) {
    try {
      policyJson = await readFn(parsed.policy);
    } catch (err) {
      writeErr(`Failed to read --policy ${parsed.policy}: ${(err as Error).message}\n`);
      return 2;
    }
  }
  let policy: ParseDiagnosticsThresholdPolicy | undefined;
  try {
    policy = resolvePolicyFromArgs(parsed, policyJson);
  } catch (err) {
    writeErr(`Failed to parse policy: ${(err as Error).message}\n`);
    return 2;
  }

  if (parsed.inputDir !== undefined) {
    let files: string[];
    let walkSkipped = 0;
    try {
      const listed = await listBatchInputFiles(parsed.inputDir, {
        recursive: parsed.recursive,
        include: parsed.include,
        exclude: parsed.exclude,
        readDirEntriesFn
      });
      files = listed.files;
      walkSkipped = listed.skipped;
    } catch (err) {
      writeErr(`Failed to read --input-dir ${parsed.inputDir}: ${(err as Error).message}\n`);
      return 2;
    }
    if (files.length === 0) {
      if (!parsed.quiet) {
        writeErr(`No .nc/.tap/.gcode files found in ${parsed.inputDir}\n`);
      }
      return 2;
    }

    const batchWalk: CliBatchWalk = {
      recursive: parsed.recursive,
      include: parsed.include ? [...parsed.include] : [],
      exclude: parsed.exclude ? [...parsed.exclude] : [],
      matched: files.length,
      skipped: walkSkipped,
      root: parsed.inputDir
    };
    if (parsed.outDir !== undefined || parsed.exportSetupSheetPdfBatch !== undefined) {
      batchWalk.export = {
        ...(parsed.outDir !== undefined ? { outDir: parsed.outDir } : {}),
        ...(parsed.exportSetupSheetPdfBatch !== undefined
          ? { setupSheetPdfDir: parsed.exportSetupSheetPdfBatch }
          : {})
      };
    }

    const entries: CliBatchEntry[] = [];
    const textEntries: { input: string; result: RunJobCheckResult }[] = [];
    const perFileOutputs: { sourcePath: string; rendered: string }[] = [];
    const perFilePdfs: { sourcePath: string; bytes: Uint8Array }[] = [];
    const sourcesByInputDuringBatch = new Map<string, string>();
    let anyBlocked = 0;
    for (const filePath of files) {
      let source: string;
      try {
        source = await readFn(filePath);
      } catch (err) {
        writeErr(`Failed to read ${filePath}: ${(err as Error).message}\n`);
        return 2;
      }
      sourcesByInputDuringBatch.set(filePath, source);
      const result = await runOnce(source, parsed.controller, policy, {
        suppressDeprecated: parsed.noDeprecatedRules
      });
      const envelope = applyStrictControllerCodesGate(
        buildJobCheckEnvelope(result),
        parsed.strictControllerCodes
      );
      entries.push({ schemaVersion: CLI_SCHEMA_VERSION, input: filePath, envelope });
      textEntries.push({ input: filePath, result });
      if (parsed.outDir !== undefined) {
        let rendered: string;
        if (parsed.format === "json") rendered = formatJobCheckJson(result, envelope);
        else if (parsed.format === "ndjson") rendered = formatJobCheckNdjsonLine(result, envelope);
        else rendered = formatJobCheckText(result);
        perFileOutputs.push({
          sourcePath: filePath,
          rendered: rendered.endsWith("\n") ? rendered : `${rendered}\n`
        });
      }
      if (parsed.exportSetupSheetPdfBatch !== undefined) {
        try {
          const pdfBytes = buildSetupSheetPdf(result.setupSheet, {
            lintIssuesSummary: result.lintIssuesSummary
          });
          perFilePdfs.push({ sourcePath: filePath, bytes: pdfBytes });
        } catch (err) {
          writeErr(
            `Failed to build PDF for ${filePath}: ${(err as Error).message}\n`
          );
          return 2;
        }
      }
      if (envelope.blocked) {
        anyBlocked += 1;
        if (parsed.strict && !parsed.quiet) {
          emitStrictBlockedHint(writeErr, result.blockerCount, result.warningCount, filePath);
        }
      }
    }

    if (parsed.exportSetupSheetPdfBatch !== undefined) {
      const pdfOutDir = parsed.exportSetupSheetPdfBatch;
      let writtenPdfs = 0;
      for (const { sourcePath, bytes } of perFilePdfs) {
        const targetPath = resolveOutDirTarget(parsed.inputDir, sourcePath, pdfOutDir, ".pdf");
        if (targetPath === undefined) {
          writeErr(
            `cnc-job-check: refusing to write outside --export-setup-sheet-pdf-batch (input ${sourcePath} resolved outside --input-dir)\n`
          );
          return 2;
        }
        try {
          await mkdirFn(path.dirname(targetPath));
          await writeFn(targetPath, bytes);
          writtenPdfs += 1;
        } catch (err) {
          writeErr(
            `Failed to write --export-setup-sheet-pdf-batch entry ${targetPath}: ${(err as Error).message}\n`
          );
          return 2;
        }
      }
      if (!parsed.quiet) {
        writeOut(`cnc-job-check: wrote ${writtenPdfs} PDFs to ${pdfOutDir}\n`);
      }
      if (writtenPdfs > 0) {
        if (!batchWalk.export) batchWalk.export = {};
        batchWalk.export.setupSheetPdfDir = pdfOutDir;
        batchWalk.export.setupPdfCount = writtenPdfs;
      }
    }

    if (parsed.outDir !== undefined) {
      const outDir = parsed.outDir;
      const ext = outputExtensionForFormat(parsed.format, parsed.outDirFormat);
      let written = 0;
      const zipEntries: Array<{ path: string; data: string | Uint8Array }> = [];
      for (const { sourcePath, rendered } of perFileOutputs) {
        const targetPath = resolveOutDirTarget(parsed.inputDir, sourcePath, outDir, ext);
        if (targetPath === undefined) {
          writeErr(
            `cnc-job-check: refusing to write outside --out-dir (input ${sourcePath} resolved outside --input-dir)\n`
          );
          return 2;
        }
        try {
          await mkdirFn(path.dirname(targetPath));
          await writeFn(targetPath, rendered);
          written += 1;
          const rel = path.relative(outDir, targetPath).split(path.sep).join("/");
          zipEntries.push({ path: rel, data: rendered });
        } catch (err) {
          writeErr(
            `Failed to write --out-dir entry ${targetPath}: ${(err as Error).message}\n`
          );
          return 2;
        }
      }
      // Schema v23–v24: record export sidecar paths on walk.export before summaries.
      const zipPath = path.join(outDir, "batch-export.zip");
      const sarifPath = path.join(outDir, "batch-unbound-fixes.sarif.json");
      if (!batchWalk.export) batchWalk.export = { outDir };
      batchWalk.export.batchExportZip = zipPath;
      batchWalk.export.batchUnboundSarif = sarifPath;

      // Schema v24–v27: include setup-sheet TXT in the zip and write on-disk
      // sidecars under setup-txt/ (parity with patched-nc).
      let setupTxtCount = 0;
      const setupTxtDir = path.join(outDir, "setup-txt");
      for (const { input, result } of textEntries) {
        const base = path.basename(input).replace(/\.(nc|tap|gcode)$/i, "");
        const filename = `${base}.setup.txt`;
        const body = result.setupSheet.exportTxt;
        zipEntries.push({ path: `setup-txt/${filename}`, data: body });
        const diskPath = path.join(setupTxtDir, filename);
        try {
          await mkdirFn(path.dirname(diskPath));
          await writeFn(diskPath, body);
          written += 1;
        } catch (err) {
          writeErr(
            `Failed to write --out-dir setup TXT ${diskPath}: ${(err as Error).message}\n`
          );
          return 2;
        }
        setupTxtCount += 1;
      }
      if (setupTxtCount > 0) {
        if (!batchWalk.export) batchWalk.export = { outDir };
        batchWalk.export.setupTxtCount = setupTxtCount;
        batchWalk.export.setupTxtDir = setupTxtDir;
      }
      // Schema v24: include PDFs when --export-setup-sheet-pdf-batch also ran.
      for (const { sourcePath, bytes } of perFilePdfs) {
        const base = path.basename(sourcePath).replace(/\.(nc|tap|gcode)$/i, "");
        zipEntries.push({ path: `setup-pdf/${base}.pdf`, data: bytes });
      }
      if (perFilePdfs.length > 0) {
        if (!batchWalk.export) batchWalk.export = { outDir };
        batchWalk.export.setupPdfCount = perFilePdfs.length;
      }
      // Schema v25–v28: include patched NC + fix previews when @cnc/ide-bridge
      // is available; write on-disk sidecars and pack into the zip.
      let patchedNcCount = 0;
      const patchedNcDir = path.join(outDir, "patched-nc");
      try {
        const bridge = (await import("@cnc/ide-bridge")) as {
          buildIdeBatchPatchedPrograms?: (
            envelope: ReturnType<typeof buildBatchEnvelope>,
            sources: ReadonlyMap<string, string>
          ) => Array<{ filename: string; body: string }>;
          buildIdeBatchQuickFixPreviews?: (
            envelope: ReturnType<typeof buildBatchEnvelope>,
            sources: ReadonlyMap<string, string>
          ) => unknown[];
        };
        const sourcesByInput = new Map(
          [...sourcesByInputDuringBatch.entries()].filter(([, src]) => src.length > 0)
        );
        const prelimEnvelope = buildBatchEnvelope(entries, { batchWalk });
        if (typeof bridge.buildIdeBatchPatchedPrograms === "function") {
          const patched = bridge.buildIdeBatchPatchedPrograms(prelimEnvelope, sourcesByInput);
          for (const item of patched) {
            zipEntries.push({ path: `patched-nc/${item.filename}`, data: item.body });
            const diskPath = path.join(patchedNcDir, item.filename);
            try {
              await mkdirFn(path.dirname(diskPath));
              await writeFn(diskPath, item.body);
              written += 1;
            } catch (err) {
              writeErr(
                `Failed to write --out-dir patched NC ${diskPath}: ${(err as Error).message}\n`
              );
              return 2;
            }
            patchedNcCount += 1;
          }
        }
        if (typeof bridge.buildIdeBatchQuickFixPreviews === "function") {
          const previews = bridge.buildIdeBatchQuickFixPreviews(
            prelimEnvelope,
            sourcesByInput
          );
          if (previews.length > 0) {
            const fixPreviewsPath = path.join(outDir, "batch-fix-previews.json");
            const body = `${JSON.stringify(previews, null, 2)}\n`;
            try {
              await writeFn(fixPreviewsPath, body);
              written += 1;
              zipEntries.push({ path: "batch-fix-previews.json", data: body });
            } catch (err) {
              writeErr(
                `Failed to write --out-dir fix previews ${fixPreviewsPath}: ${(err as Error).message}\n`
              );
              return 2;
            }
            if (!batchWalk.export) batchWalk.export = { outDir };
            batchWalk.export.fixPreviewsPath = fixPreviewsPath;
            batchWalk.export.fixPreviewCount = previews.length;
          }
        }
      } catch {
        // Optional peer: monorepo installs ide-bridge; published CLI may omit it.
      }
      if (patchedNcCount > 0) {
        if (!batchWalk.export) batchWalk.export = { outDir };
        batchWalk.export.patchedNcCount = patchedNcCount;
        batchWalk.export.patchedNcDir = patchedNcDir;
      }

      // Schema v18–v33: summaries + SARIF, then manifest, then zip + sha256.
      // Predetermine exportManifestPath / writtenFileCount / zipEntryCount
      // before summary JSON so batchWalk.export in the envelope is complete.
      const manifestPath = path.join(outDir, "batch-export-manifest.json");
      const willWriteNdjson = parsed.format === "ndjson";
      // Remaining disk writes: summary.json, csv, sarif, [ndjson], manifest, zip, sha256.
      const remainingWrites = 6 + (willWriteNdjson ? 1 : 0);
      // Remaining zip entries (not including the zip file itself): same without zip/sha256.
      const remainingZipEntries = 4 + (willWriteNdjson ? 1 : 0);
      if (!batchWalk.export) batchWalk.export = { outDir };
      batchWalk.export.exportManifestPath = manifestPath;
      batchWalk.export.writtenFileCount = written + remainingWrites;
      batchWalk.export.zipEntryCount = zipEntries.length + remainingZipEntries;

      const summaryPath = path.join(outDir, "batch-summary.json");
      const batchEnvelope = buildBatchEnvelope(entries, { batchWalk });
      const summaryJson = `${formatBatchJson(entries, { batchWalk })}\n`;
      try {
        await writeFn(summaryPath, summaryJson);
        written += 1;
        zipEntries.push({ path: "batch-summary.json", data: summaryJson });
      } catch (err) {
        writeErr(
          `Failed to write --out-dir batch summary ${summaryPath}: ${(err as Error).message}\n`
        );
        return 2;
      }
      // Schema v21: dashboard CSV of aggregations.
      const csvSummaryPath = path.join(outDir, "batch-summary.csv");
      const summaryCsv = formatBatchAggregationsAsCsv(batchEnvelope);
      try {
        await writeFn(csvSummaryPath, summaryCsv);
        written += 1;
        zipEntries.push({ path: "batch-summary.csv", data: summaryCsv });
      } catch (err) {
        writeErr(
          `Failed to write --out-dir batch summary ${csvSummaryPath}: ${(err as Error).message}\n`
        );
        return 2;
      }
      // Schema v24: SARIF-lite report of fix templates that still need bindings.
      const sarifBody = formatBatchFixCandidatesAsSarifLite(
        buildBatchFixTemplateCandidates(batchEnvelope),
        { schemaVersion: CLI_SCHEMA_VERSION }
      );
      try {
        await writeFn(sarifPath, sarifBody);
        written += 1;
        zipEntries.push({ path: "batch-unbound-fixes.sarif.json", data: sarifBody });
      } catch (err) {
        writeErr(
          `Failed to write --out-dir unbound SARIF ${sarifPath}: ${(err as Error).message}\n`
        );
        return 2;
      }
      // Schema v20: when --format ndjson, also write a streaming-friendly
      // one-line NDJSON envelope summary (same CliBatchEnvelope body).
      if (willWriteNdjson) {
        const ndjsonSummaryPath = path.join(outDir, "batch-summary.ndjson");
        const ndjsonBody = `${JSON.stringify(batchEnvelope)}\n`;
        try {
          await writeFn(ndjsonSummaryPath, ndjsonBody);
          written += 1;
          zipEntries.push({ path: "batch-summary.ndjson", data: ndjsonBody });
        } catch (err) {
          writeErr(
            `Failed to write --out-dir batch summary ${ndjsonSummaryPath}: ${(err as Error).message}\n`
          );
          return 2;
        }
      }

      const utf8ByteLength = (data: string | Uint8Array): number =>
        typeof data === "string" ? new TextEncoder().encode(data).byteLength : data.byteLength;

      // Schema v29–v31: export manifest listing zip-bound paths + kinds + byKind (+ bytes).
      const manifestPaths = [
        ...zipEntries.map((e) => ({ path: e.path, bytes: utf8ByteLength(e.data) })),
        { path: "batch-export-manifest.json" },
        { path: "batch-export.zip" },
        { path: "batch-export.zip.sha256" }
      ];
      const manifest = buildBatchExportManifest(manifestPaths, {
        schemaVersion: CLI_SCHEMA_VERSION,
        outDir,
        writtenFileCount: batchWalk.export.writtenFileCount,
        zipEntryCount: batchWalk.export.zipEntryCount
      });
      const manifestBody = formatBatchExportManifest(manifest);
      try {
        await writeFn(manifestPath, manifestBody);
        written += 1;
        zipEntries.push({ path: "batch-export-manifest.json", data: manifestBody });
      } catch (err) {
        writeErr(
          `Failed to write --out-dir export manifest ${manifestPath}: ${(err as Error).message}\n`
        );
        return 2;
      }

      // Schema v23: pack per-file outputs + summaries into batch-export.zip.
      let zipBytes: Uint8Array;
      try {
        zipBytes = await createZip(zipEntries, { method: "deflate" });
        await writeFn(zipPath, zipBytes);
        written += 1;
      } catch (err) {
        writeErr(
          `Failed to write --out-dir batch export zip ${zipPath}: ${(err as Error).message}\n`
        );
        return 2;
      }

      // Schema v31–v33: seal zip integrity sidecar; rewrite disk summary/manifest.
      try {
        const zipSha256 = await computeSha256Bytes(zipBytes);
        const zipSha256Path = `${zipPath}.sha256`;
        const shaSidecarBody = formatBatchExportZipSha256Sidecar(zipSha256);
        await writeFn(zipSha256Path, shaSidecarBody);
        written += 1;
        const sealedAt = new Date().toISOString();
        batchWalk.export.zipSha256 = zipSha256;
        batchWalk.export.zipSha256Path = zipSha256Path;
        batchWalk.export.zipBytes = zipBytes.byteLength;
        batchWalk.export.sealedAt = sealedAt;

        // Disk copies are authoritative for integrity metadata; zip stays sealed.
        const manifestFinal = buildBatchExportManifest(
          [
            ...zipEntries.map((e) => ({
              path: e.path,
              bytes: utf8ByteLength(e.data)
            })),
            { path: "batch-export.zip", bytes: zipBytes.byteLength },
            {
              path: "batch-export.zip.sha256",
              bytes: utf8ByteLength(shaSidecarBody)
            }
          ],
          {
            schemaVersion: CLI_SCHEMA_VERSION,
            outDir,
            writtenFileCount: batchWalk.export.writtenFileCount,
            zipEntryCount: batchWalk.export.zipEntryCount,
            zipSha256,
            sealedAt
          }
        );
        if (manifestFinal.totalBytes !== undefined) {
          batchWalk.export.totalBytes = manifestFinal.totalBytes;
        }
        const summaryJsonFinal = `${formatBatchJson(entries, { batchWalk })}\n`;
        await writeFn(summaryPath, summaryJsonFinal);
        await writeFn(manifestPath, formatBatchExportManifest(manifestFinal));
      } catch (err) {
        writeErr(
          `Failed to write --out-dir batch export zip sha256 ${zipPath}.sha256: ${(err as Error).message}\n`
        );
        return 2;
      }
      if (!parsed.quiet) {
        writeOut(`cnc-job-check: wrote ${written} files to ${outDir}\n`);
      }
      return parsed.strict && anyBlocked > 0 ? 1 : 0;
    }

    let output: string;
    if (parsed.format === "json") {
      output = formatBatchJson(entries, { batchWalk });
    } else if (parsed.format === "ndjson") {
      output = formatBatchNdjson(entries);
    } else {
      output = formatBatchText(textEntries);
    }
    const finalOutput = output.endsWith("\n") ? output : `${output}\n`;
    if (parsed.out) {
      try {
        await writeFn(parsed.out, finalOutput);
      } catch (err) {
        writeErr(`Failed to write --out ${parsed.out}: ${(err as Error).message}\n`);
        return 2;
      }
    } else {
      writeOut(finalOutput);
    }
    return parsed.strict && anyBlocked > 0 ? 1 : 0;
  }

  let source: string;
  try {
    source = await loadProgramSource(parsed.input!, { readFileFn: readFn, stdinReader });
  } catch (err) {
    writeErr(`Failed to read --input ${parsed.input}: ${(err as Error).message}\n`);
    return 2;
  }

  const result = await runOnce(source, parsed.controller, policy, {
    suppressDeprecated: parsed.noDeprecatedRules
  });
  const envelope = applyStrictControllerCodesGate(
    buildJobCheckEnvelope(result),
    parsed.strictControllerCodes
  );

  if (parsed.exportSetupSheetPdf !== undefined) {
    try {
      const pdfBytes = buildSetupSheetPdf(result.setupSheet, {
        lintIssuesSummary: result.lintIssuesSummary
      });
      await writeFn(parsed.exportSetupSheetPdf, pdfBytes);
    } catch (err) {
      writeErr(
        `Failed to write --export-setup-sheet-pdf ${parsed.exportSetupSheetPdf}: ${(err as Error).message}\n`
      );
      return 2;
    }
  }

  let output: string;
  if (parsed.format === "json") {
    output = formatJobCheckJson(result, envelope);
  } else if (parsed.format === "ndjson") {
    output = formatJobCheckNdjsonLine(result, envelope);
  } else {
    output = formatJobCheckText(result);
  }
  const finalOutput = output.endsWith("\n") ? output : `${output}\n`;

  if (parsed.out) {
    try {
      await writeFn(parsed.out, finalOutput);
    } catch (err) {
      writeErr(`Failed to write --out ${parsed.out}: ${(err as Error).message}\n`);
      return 2;
    }
  } else {
    writeOut(finalOutput);
  }

  if (parsed.strict && envelope.blocked) {
    if (!parsed.quiet) {
      emitStrictBlockedHint(writeErr, result.blockerCount, result.warningCount);
    }
    return 1;
  }
  return 0;
}

function isInvokedDirectly(): boolean {
  if (!process.argv[1]) return false;
  try {
    const here = fileURLToPath(import.meta.url);
    const invoked = path.resolve(process.argv[1]);
    return path.normalize(here) === path.normalize(invoked);
  } catch {
    return false;
  }
}

if (isInvokedDirectly()) {
  void main(process.argv.slice(2)).then((exitCode) => {
    process.exit(exitCode);
  });
}
