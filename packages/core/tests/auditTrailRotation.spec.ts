import { describe, expect, it } from "vitest";

import {
  AUDIT_AES_GCM_PARAMS,
  decryptAesGcm,
  encryptAesGcm
} from "../src/audit/auditTrailIntegrity.js";
import {
  AuditTrailRotationStrandedTempError,
  rotateAuditTrailKey
} from "../src/audit/auditTrailRotation.js";

const PAYLOAD = "audit-trail body\nline 2\nline 3\n";
const OLD_SECRET = "old-secret-please-rotate-2025-q4";
const NEW_SECRET = "new-secret-fresh-2026-q2";

describe("rotateAuditTrailKey", () => {
  it("decrypt(rotated, newSecret) === decrypt(original, oldSecret)", async () => {
    const original = await encryptAesGcm(PAYLOAD, OLD_SECRET);
    const rotated = await rotateAuditTrailKey(original, OLD_SECRET, NEW_SECRET);
    const recovered = await decryptAesGcm(rotated, NEW_SECRET);
    expect(recovered).toBe(PAYLOAD);
  });

  it("rotated blob has the canonical [salt(16) | iv(12) | ct+tag] layout", async () => {
    const original = await encryptAesGcm(PAYLOAD, OLD_SECRET);
    const rotated = await rotateAuditTrailKey(original, OLD_SECRET, NEW_SECRET);
    expect(rotated.length).toBeGreaterThan(
      AUDIT_AES_GCM_PARAMS.saltBytes + AUDIT_AES_GCM_PARAMS.ivBytes
    );
  });

  it("uses a FRESH salt + IV (rotated blob differs in salt/iv even when payload + secret are constant)", async () => {
    const original = await encryptAesGcm(PAYLOAD, OLD_SECRET);
    const rotated = await rotateAuditTrailKey(original, OLD_SECRET, NEW_SECRET);
    const originalSaltIv = original.subarray(
      0,
      AUDIT_AES_GCM_PARAMS.saltBytes + AUDIT_AES_GCM_PARAMS.ivBytes
    );
    const rotatedSaltIv = rotated.subarray(
      0,
      AUDIT_AES_GCM_PARAMS.saltBytes + AUDIT_AES_GCM_PARAMS.ivBytes
    );
    expect(Array.from(rotatedSaltIv)).not.toEqual(Array.from(originalSaltIv));
  });

  it("the rotated blob CANNOT be decrypted with the old secret (key rotation actually rotated)", async () => {
    const original = await encryptAesGcm(PAYLOAD, OLD_SECRET);
    const rotated = await rotateAuditTrailKey(original, OLD_SECRET, NEW_SECRET);
    await expect(decryptAesGcm(rotated, OLD_SECRET)).rejects.toThrow();
  });

  it("rejects with a canonical error when old secret cannot decrypt the input blob", async () => {
    const original = await encryptAesGcm(PAYLOAD, OLD_SECRET);
    await expect(
      rotateAuditTrailKey(original, "wrong-old-secret", NEW_SECRET)
    ).rejects.toThrow(/decryption with old secret failed/);
  });

  it("rejects with the encryptAesGcm contract when the new secret is empty", async () => {
    const original = await encryptAesGcm(PAYLOAD, OLD_SECRET);
    await expect(rotateAuditTrailKey(original, OLD_SECRET, "")).rejects.toThrow(
      /requires a non-empty secret key/
    );
  });

  it("two consecutive rotations chain correctly (A -> B -> C round-trip)", async () => {
    const SECRET_A = "secret-A";
    const SECRET_B = "secret-B";
    const SECRET_C = "secret-C";
    const blobA = await encryptAesGcm(PAYLOAD, SECRET_A);
    const blobB = await rotateAuditTrailKey(blobA, SECRET_A, SECRET_B);
    const blobC = await rotateAuditTrailKey(blobB, SECRET_B, SECRET_C);
    expect(await decryptAesGcm(blobC, SECRET_C)).toBe(PAYLOAD);
    await expect(decryptAesGcm(blobC, SECRET_A)).rejects.toThrow();
    await expect(decryptAesGcm(blobC, SECRET_B)).rejects.toThrow();
  });
});

describe("AuditTrailRotationStrandedTempError", () => {
  it("carries the tempPath and includes it in the canonical message", () => {
    const err = new AuditTrailRotationStrandedTempError("/tmp/audit.aes-gcm.rotating");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AuditTrailRotationStrandedTempError");
    expect(err.tempPath).toBe("/tmp/audit.aes-gcm.rotating");
    expect(err.message).toMatch(/stranded temp file at \/tmp\/audit\.aes-gcm\.rotating/);
    expect(err.message).toMatch(/run --recover-temp to finish/);
  });

  it("chains the underlying cause when supplied", () => {
    const cause = new Error("EBUSY: rename failed");
    const err = new AuditTrailRotationStrandedTempError(
      "/tmp/audit.aes-gcm.rotating",
      cause
    );
    expect(err.cause).toBe(cause);
  });

  it("omits cause when none is supplied (no `cause: undefined` enumerable property)", () => {
    const err = new AuditTrailRotationStrandedTempError("/tmp/x.rotating");
    expect(err.cause).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(err, "cause")).toBe(false);
  });
});
