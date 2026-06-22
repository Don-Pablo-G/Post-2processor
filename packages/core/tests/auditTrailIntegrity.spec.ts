import { describe, expect, it } from "vitest";
import {
  AUDIT_AES_GCM_PARAMS,
  computeHmacSha256,
  computeSha256,
  decryptAesGcm,
  encryptAesGcm,
  parseSidecarBodyDigest
} from "../src/audit/auditTrailIntegrity.js";

const REAL_CRYPTO_AVAILABLE = !!(globalThis as { crypto?: { subtle?: SubtleCrypto } })
  .crypto?.subtle;

describe("auditTrailIntegrity primitives", () => {
  it("computeSha256 returns a stable 64-char lower-case hex digest for a known payload", async () => {
    if (!REAL_CRYPTO_AVAILABLE) return;
    const hex = await computeSha256("hello");
    expect(hex).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("computeSha256 differs between distinct payloads", async () => {
    if (!REAL_CRYPTO_AVAILABLE) return;
    const a = await computeSha256("payload-a");
    const b = await computeSha256("payload-b");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("computeHmacSha256 rejects empty / whitespace secrets", async () => {
    await expect(computeHmacSha256("payload", "")).rejects.toThrow(
      /requires a non-empty secret/
    );
    await expect(computeHmacSha256("payload", "   ")).rejects.toThrow(
      /requires a non-empty secret/
    );
  });

  it("computeHmacSha256 returns a stable 64-char hex digest that varies with the secret", async () => {
    if (!REAL_CRYPTO_AVAILABLE) return;
    const a = await computeHmacSha256("payload", "secret-a");
    const b = await computeHmacSha256("payload", "secret-b");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    // Stability: same inputs -> same digest.
    const aDup = await computeHmacSha256("payload", "secret-a");
    expect(aDup).toBe(a);
  });

  it("encryptAesGcm + decryptAesGcm round-trips arbitrary unicode payloads", async () => {
    if (!REAL_CRYPTO_AVAILABLE) return;
    const payload = "shop-secret 你好\n\"escape\"\u0001";
    const blob = await encryptAesGcm(payload, "shop-key");
    expect(blob).toBeInstanceOf(Uint8Array);
    expect(blob.length).toBeGreaterThanOrEqual(
      AUDIT_AES_GCM_PARAMS.saltBytes + AUDIT_AES_GCM_PARAMS.ivBytes + 16 + payload.length
    );
    const decrypted = await decryptAesGcm(blob, "shop-key");
    expect(decrypted).toBe(payload);
  });

  it("decryptAesGcm rejects with the wrong secret (auth-tag failure)", async () => {
    if (!REAL_CRYPTO_AVAILABLE) return;
    const blob = await encryptAesGcm("payload", "right-secret");
    await expect(decryptAesGcm(blob, "wrong-secret")).rejects.toBeDefined();
  });

  it("decryptAesGcm rejects empty / whitespace secrets without invoking Web Crypto", async () => {
    const fakeBlob = new Uint8Array(64);
    await expect(decryptAesGcm(fakeBlob, "")).rejects.toThrow(
      /requires a non-empty secret/
    );
    await expect(decryptAesGcm(fakeBlob, "   ")).rejects.toThrow(
      /requires a non-empty secret/
    );
  });

  it("decryptAesGcm rejects blobs that are too short", async () => {
    await expect(
      decryptAesGcm(new Uint8Array(AUDIT_AES_GCM_PARAMS.saltBytes), "secret")
    ).rejects.toThrow(/too short/);
  });

  it("encryptAesGcm rejects empty / whitespace secrets", async () => {
    await expect(encryptAesGcm("payload", "")).rejects.toThrow(
      /requires a non-empty secret/
    );
  });

  it("parseSidecarBodyDigest extracts the leading hex token and lower-cases it", () => {
    const sha256Hex = "DE".repeat(32);
    expect(parseSidecarBodyDigest(`${sha256Hex}  cnc-audit-trail-x.ndjson\n`)).toBe(
      sha256Hex.toLowerCase()
    );
    const padded = `  ${"a".repeat(64)}  file\n`;
    expect(parseSidecarBodyDigest(padded)).toBe("a".repeat(64));
    expect(parseSidecarBodyDigest("not a digest")).toBeNull();
    expect(parseSidecarBodyDigest("")).toBeNull();
    // 16-char hex tokens are too short for any audit-trail digest we accept.
    expect(parseSidecarBodyDigest("deadbeefcafebabe  file\n")).toBeNull();
  });
});
