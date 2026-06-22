/**
 * Shared, dependency-free audit-trail integrity primitives. Mirrors the
 * desktop helpers in `apps/desktop/src/auditTrailDownload.ts` so that the
 * CLI verifier (`cnc-job-check verify-audit-trail`) and the desktop
 * download path stay in lock-step.
 *
 * Pure Web Crypto — works in both browser and Node.js (>=18 ships
 * `globalThis.crypto.subtle`). No external dependencies, no Node-only
 * imports, so this module is import-safe from `index.browser.ts`.
 *
 * Layout for AES-GCM blobs (matches the desktop encrypt helper):
 *   [salt(16) | iv(12) | ciphertext+tag]
 * The salt feeds PBKDF2-SHA-256 (250k iterations) to derive a 256-bit AES
 * key; the iv is consumed by AES-GCM directly.
 */

export const AUDIT_AES_GCM_PARAMS = Object.freeze({
  saltBytes: 16,
  ivBytes: 12,
  pbkdf2Iterations: 250_000,
  derivedKeyBits: 256,
  pbkdf2Hash: "SHA-256" as const
});

function requireSubtle(): SubtleCrypto {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto subtle API is not available in this environment");
  }
  return subtle;
}

function bytesToHex(view: Uint8Array): string {
  let out = "";
  for (let i = 0; i < view.length; i += 1) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * SHA-256 of `payload` as a lower-case hex string. Mirrors
 * `computeAuditTrailSha256` in the desktop helper.
 */
export async function computeSha256(payload: string): Promise<string> {
  const subtle = requireSubtle();
  const bytes = new TextEncoder().encode(payload);
  const digest = await subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * HMAC-SHA-256 of `payload` with `secretKey`, as a lower-case hex string.
 * Empty / whitespace-only `secretKey` is REJECTED — silently falling back
 * to a no-op key would defeat the integrity check.
 */
export async function computeHmacSha256(
  payload: string,
  secretKey: string
): Promise<string> {
  if (secretKey.trim().length === 0) {
    throw new Error("HMAC verification requires a non-empty secret key");
  }
  const subtle = requireSubtle();
  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await subtle.sign("HMAC", key, encoder.encode(payload));
  return bytesToHex(new Uint8Array(signature));
}

/**
 * AES-256-GCM at-rest decrypt. Inverse of the desktop
 * `computeAuditTrailEncryptedAesGcm`. Consumes the
 * `[salt(16) | iv(12) | ciphertext+tag]` blob produced by the encrypt
 * helper, derives the AES key from `secretKey` via PBKDF2-SHA-256, and
 * returns the plaintext as a UTF-8 string.
 *
 * Throws if the blob is too short, if `secretKey` is empty, or if Web
 * Crypto is missing. Authentication-tag failures bubble up from
 * `subtle.decrypt` as a generic error — callers MUST treat any throw as
 * a verification failure (the canonical CLI exit code is 1).
 */
export async function decryptAesGcm(
  encrypted: Uint8Array,
  secretKey: string
): Promise<string> {
  if (secretKey.trim().length === 0) {
    throw new Error("AES-GCM decryption requires a non-empty secret key");
  }
  if (
    encrypted.length <
    AUDIT_AES_GCM_PARAMS.saltBytes + AUDIT_AES_GCM_PARAMS.ivBytes + 1
  ) {
    throw new Error("AES-GCM blob too short — missing salt, iv, or ciphertext");
  }
  const subtle = requireSubtle();
  // Copy each segment into a fresh ArrayBuffer-backed Uint8Array. TS' strict
  // DOM lib types reject Uint8Array<ArrayBufferLike> against `BufferSource`
  // (which requires a non-shared ArrayBuffer), so we go through a fresh
  // length-allocated Uint8Array whose backing buffer is provably ArrayBuffer.
  const copyBytes = (start: number, end: number): Uint8Array => {
    const out = new Uint8Array(end - start);
    out.set(encrypted.subarray(start, end));
    return out;
  };
  const salt = copyBytes(0, AUDIT_AES_GCM_PARAMS.saltBytes);
  const iv = copyBytes(
    AUDIT_AES_GCM_PARAMS.saltBytes,
    AUDIT_AES_GCM_PARAMS.saltBytes + AUDIT_AES_GCM_PARAMS.ivBytes
  );
  const ciphertext = copyBytes(
    AUDIT_AES_GCM_PARAMS.saltBytes + AUDIT_AES_GCM_PARAMS.ivBytes,
    encrypted.byteLength
  );

  const baseKey = await subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const aesKey = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: AUDIT_AES_GCM_PARAMS.pbkdf2Iterations,
      hash: AUDIT_AES_GCM_PARAMS.pbkdf2Hash
    },
    baseKey,
    { name: "AES-GCM", length: AUDIT_AES_GCM_PARAMS.derivedKeyBits },
    false,
    ["decrypt"]
  );
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    aesKey,
    ciphertext as BufferSource
  );
  return new TextDecoder().decode(new Uint8Array(plaintext));
}

/**
 * Encrypts `payload` under `secretKey` and returns the canonical at-rest
 * blob layout `[salt(16) | iv(12) | ciphertext+tag]` that
 * `decryptAesGcm` (and the desktop UI) consume. Salt + IV are freshly
 * generated per call from `crypto.getRandomValues`, which is exactly what
 * the rotation flow needs (re-encrypting under a new secret MUST NOT
 * reuse the previous IV under the new key).
 *
 * Production-grade — used by:
 *   - the test suite (round-trip fixtures for `decryptAesGcm`)
 *   - `rotateAuditTrailKey` in `audit/auditTrailRotation.ts` (sibling of
 *     `verify-audit-trail`'s decryptor; powers the
 *     `cnc-job-check rotate-audit-trail-key` subcommand)
 */
export async function encryptAesGcm(
  payload: string,
  secretKey: string
): Promise<Uint8Array> {
  if (secretKey.trim().length === 0) {
    throw new Error("AES-GCM encryption requires a non-empty secret key");
  }
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  const subtle = cryptoApi?.subtle;
  if (!subtle || typeof cryptoApi?.getRandomValues !== "function") {
    throw new Error("Web Crypto subtle/getRandomValues is not available in this environment");
  }
  const encoder = new TextEncoder();
  const salt = new Uint8Array(AUDIT_AES_GCM_PARAMS.saltBytes);
  cryptoApi.getRandomValues(salt);
  const iv = new Uint8Array(AUDIT_AES_GCM_PARAMS.ivBytes);
  cryptoApi.getRandomValues(iv);
  const baseKey = await subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const aesKey = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: AUDIT_AES_GCM_PARAMS.pbkdf2Iterations,
      hash: AUDIT_AES_GCM_PARAMS.pbkdf2Hash
    },
    baseKey,
    { name: "AES-GCM", length: AUDIT_AES_GCM_PARAMS.derivedKeyBits },
    false,
    ["encrypt"]
  );
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(payload)
  );
  const ctView = new Uint8Array(ciphertext);
  const out = new Uint8Array(salt.length + iv.length + ctView.length);
  out.set(salt, 0);
  out.set(iv, salt.length);
  out.set(ctView, salt.length + iv.length);
  return out;
}

/**
 * Parse the BSD shasum-compatible sidecar body (`<hex>  <name>\n`) into
 * its hex digest component. Tolerates surrounding whitespace and a
 * missing trailing newline. Returns `null` if no plausible hex digest
 * can be extracted.
 */
export function parseSidecarBodyDigest(body: string): string | null {
  const trimmed = body.trim();
  const match = /^([0-9a-fA-F]{32,128})\b/.exec(trimmed);
  return match ? match[1].toLowerCase() : null;
}
