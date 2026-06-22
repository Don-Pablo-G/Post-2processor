import { decryptAesGcm, encryptAesGcm } from "./auditTrailIntegrity.js";

/**
 * Re-key an AES-256-GCM encrypted audit-trail blob. Decrypts under
 * `oldSecret`, then re-encrypts the recovered plaintext under `newSecret`,
 * generating a fresh salt + IV in the process (mandatory — re-using the
 * old salt + IV with the new key would expose the new key to the same
 * known-plaintext attack as nonce reuse).
 *
 * Pure / dependency-free. Used by the CLI subcommand
 * `cnc-job-check rotate-audit-trail-key`. On success returns the new
 * blob in the canonical `[salt(16) | iv(12) | ciphertext+tag]` layout
 * that `decryptAesGcm` (and the desktop UI) accept.
 *
 * Throws when:
 *   - `oldSecret` cannot decrypt the blob (canonical "decryption failed"
 *     message; CLI surfaces exit code 1).
 *   - `newSecret` is empty / whitespace-only (`encryptAesGcm` rejects).
 *
 * The decrypt-then-encrypt round-trip happens entirely in memory; the
 * intermediate plaintext is never written to disk by this function. The
 * CLI is responsible for atomic on-disk replacement (temp + rename).
 */
export async function rotateAuditTrailKey(
  encryptedBlob: Uint8Array,
  oldSecret: string,
  newSecret: string
): Promise<Uint8Array> {
  let plaintext: string;
  try {
    plaintext = await decryptAesGcm(encryptedBlob, oldSecret);
  } catch (err) {
    throw new Error(
      `rotate-audit-trail-key: decryption with old secret failed (${
        (err as Error).message ?? "unknown"
      })`
    );
  }
  return encryptAesGcm(plaintext, newSecret);
}

/**
 * Surfaced by the CLI dispatcher when an `--in-place` rotation
 * succeeds in writing the new ciphertext to its `.rotating` temp file
 * but then FAILS to atomically rename the temp onto the original
 * input path (typically because another process opened the file, or
 * the rename crossed a filesystem boundary).
 *
 * The temp file IS still on disk, encrypted under the new secret —
 * `--recover-temp --temp <path> --target <input> --new-secret <key>`
 * validates and renames it. Operators who prefer a fresh rotation can
 * delete the temp manually instead.
 *
 * Carries the temp path and chains the original rename failure as
 * `cause` so callers (CLI dispatcher, integration tests) can drive
 * the exit-code-3 surface deterministically.
 */
export class AuditTrailRotationStrandedTempError extends Error {
  readonly tempPath: string;

  constructor(tempPath: string, cause?: Error) {
    // ES2022 `Error.cause` is set via the constructor options dict so
    // omitting `cause` from the call leaves the property absent rather
    // than installing an own `cause: undefined`. Lets downstream
    // serialisers (JSON.stringify, structured logs) round-trip the
    // error without introducing a noisy `cause: undefined` field.
    super(
      `rotate-audit-trail-key: stranded temp file at ${tempPath} (run --recover-temp to finish)`,
      cause !== undefined ? { cause } : undefined
    );
    this.name = "AuditTrailRotationStrandedTempError";
    this.tempPath = tempPath;
  }
}
