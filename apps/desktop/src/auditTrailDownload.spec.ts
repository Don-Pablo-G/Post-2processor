import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AES_GCM_PARAMS,
  buildAuditTrailDownloadFilename,
  buildAuditTrailEncryptedFilename,
  buildAuditTrailHmacSidecarBody,
  buildAuditTrailHmacSidecarFilename,
  buildAuditTrailSidecarBody,
  buildAuditTrailSidecarFilename,
  computeAuditTrailEncryptedAesGcm,
  computeAuditTrailHmacSha256,
  computeAuditTrailSha256,
  downloadPolicyAuditTrail,
  extensionForAuditTrailFormat,
  formatAuditTrailFilenameTimestamp,
  mimeTypeForAuditTrailFormat,
  type AuditTrailDownloadEnvironment
} from "./auditTrailDownload";
import type { AuditTrailExportFormat } from "./policyPresetHint";

const ALL_FORMATS: AuditTrailExportFormat[] = ["text", "markdown", "csv", "ndjson"];

function makeStubEnv(): {
  env: AuditTrailDownloadEnvironment;
  log: {
    objectUrls: string[];
    revokes: string[];
    anchorState: { href?: string; download?: string; clicks: number };
    blobs: Blob[];
  };
} {
  const log = {
    objectUrls: [] as string[],
    revokes: [] as string[],
    anchorState: { href: undefined as string | undefined, download: undefined as string | undefined, clicks: 0 },
    blobs: [] as Blob[]
  };
  let urlSeq = 0;
  const env: AuditTrailDownloadEnvironment = {
    createObjectURL: (blob) => {
      log.blobs.push(blob);
      const url = `blob:cnc-test/${++urlSeq}`;
      log.objectUrls.push(url);
      return url;
    },
    revokeObjectURL: (url) => {
      log.revokes.push(url);
    },
    createAnchor: () => ({
      set href(value: string) {
        log.anchorState.href = value;
      },
      set download(value: string) {
        log.anchorState.download = value;
      },
      click: () => {
        log.anchorState.clicks += 1;
      }
    }),
    scheduleRevoke: (cb) => cb()
  };
  return { env, log };
}

describe("auditTrailDownload helpers", () => {
  it("maps every AuditTrailExportFormat to a unique MIME + extension pair", () => {
    const seen = new Set<string>();
    for (const f of ALL_FORMATS) {
      const key = `${mimeTypeForAuditTrailFormat(f)}|${extensionForAuditTrailFormat(f)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    expect(extensionForAuditTrailFormat("text")).toBe("txt");
    expect(extensionForAuditTrailFormat("markdown")).toBe("md");
    expect(extensionForAuditTrailFormat("csv")).toBe("csv");
    expect(extensionForAuditTrailFormat("ndjson")).toBe("ndjson");
    expect(mimeTypeForAuditTrailFormat("ndjson")).toMatch(/application\/x-ndjson/);
  });

  it("formats ISO timestamps into compact filename-safe stamps and falls back gracefully", () => {
    expect(formatAuditTrailFilenameTimestamp("2026-05-02T06:30:15.123Z")).toBe(
      "20260502T063015"
    );
    expect(formatAuditTrailFilenameTimestamp("2026-05-02T06:30:15+02:00")).toBe(
      "20260502T063015"
    );
    expect(formatAuditTrailFilenameTimestamp("not-an-iso")).toBe("unknown-time");
  });

  it("buildAuditTrailDownloadFilename concatenates the canonical prefix + timestamp + extension", () => {
    expect(
      buildAuditTrailDownloadFilename("ndjson", "2026-05-02T06:30:15Z")
    ).toBe("cnc-audit-trail-20260502T063015.ndjson");
    expect(
      buildAuditTrailDownloadFilename("markdown", "2026-05-02T06:30:15Z")
    ).toBe("cnc-audit-trail-20260502T063015.md");
  });
});

describe("downloadPolicyAuditTrail", () => {
  for (const format of ALL_FORMATS) {
    it(`builds the right Blob + filename + MIME for format=${format} and revokes the object URL`, async () => {
      const { env, log } = makeStubEnv();
      const result = await downloadPolicyAuditTrail(
        `payload-${format}`,
        format,
        "2026-05-02T06:30:15Z",
        env
      );
      expect(result.filename).toBe(
        `cnc-audit-trail-20260502T063015.${extensionForAuditTrailFormat(format)}`
      );
      expect(result.sidecarFilename).toBeUndefined();
      expect(log.blobs).toHaveLength(1);
      expect(log.blobs[0].type).toBe(mimeTypeForAuditTrailFormat(format));
      expect(log.anchorState.href).toBe(log.objectUrls[0]);
      expect(log.anchorState.download).toBe(result.filename);
      expect(log.anchorState.clicks).toBe(1);
      expect(log.revokes).toEqual([log.objectUrls[0]]);
    });
  }

  it("schedules revoke AFTER click (URL stays valid for the click)", async () => {
    const callOrder: string[] = [];
    const env: AuditTrailDownloadEnvironment = {
      createObjectURL: () => {
        callOrder.push("createObjectURL");
        return "blob:order-test";
      },
      revokeObjectURL: () => {
        callOrder.push("revokeObjectURL");
      },
      createAnchor: () => ({
        set href(_v: string) {},
        set download(_v: string) {},
        click: () => callOrder.push("click")
      }),
      scheduleRevoke: (cb) => {
        callOrder.push("scheduleRevoke");
        cb();
      }
    };
    await downloadPolicyAuditTrail("p", "text", "2026-05-02T06:30:15Z", env);
    expect(callOrder).toEqual([
      "createObjectURL",
      "click",
      "scheduleRevoke",
      "revokeObjectURL"
    ]);
  });

  it("returns the same filename buildAuditTrailDownloadFilename would generate (callers can echo it in status text)", async () => {
    const { env } = makeStubEnv();
    const result = await downloadPolicyAuditTrail(
      "{}",
      "ndjson",
      "2026-05-02T06:30:15Z",
      env
    );
    expect(result.filename).toBe(
      buildAuditTrailDownloadFilename("ndjson", "2026-05-02T06:30:15Z")
    );
    expect(result.sidecarFilename).toBeUndefined();
  });

  it("preserves arbitrary unicode + control payload bytes inside the Blob", async () => {
    const payload = "{\"event\":\"x\",\"note\":\"线上\\n\\\"Q\\\"\"}";
    const { env, log } = makeStubEnv();
    await downloadPolicyAuditTrail(payload, "ndjson", "2026-05-02T06:30:15Z", env);
    expect(log.blobs).toHaveLength(1);
    expect(log.blobs[0].size).toBe(new Blob([payload]).size);
  });
});

describe("computeAuditTrailSha256 + sidecar helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {
      subtle: {
        digest: async (_algo: string, data: ArrayBuffer | Uint8Array) => {
          // Deterministic stub: emit the first byte of the payload repeated 32x
          // so tests can assert digest plumbing without depending on the real
          // SHA-256 algorithm being available in vitest's default env.
          const view = data instanceof Uint8Array ? data : new Uint8Array(data);
          const seed = view.length > 0 ? view[0] : 0;
          return new Uint8Array(32).fill(seed).buffer;
        }
      }
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("computeAuditTrailSha256 returns a lower-case 64-char hex string", async () => {
    const digest = await computeAuditTrailSha256("hello");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    // First byte of 'hello' is 0x68; stub fills 32 bytes with 0x68.
    expect(digest).toBe("68".repeat(32));
  });

  it("computeAuditTrailSha256 throws when subtle.digest is unavailable", async () => {
    vi.stubGlobal("crypto", {});
    await expect(computeAuditTrailSha256("x")).rejects.toThrow(/Web Crypto/);
  });

  it("buildAuditTrailSidecarFilename appends .sha256 to the main filename", () => {
    expect(buildAuditTrailSidecarFilename("cnc-audit-trail-20260502T063015.ndjson")).toBe(
      "cnc-audit-trail-20260502T063015.ndjson.sha256"
    );
  });

  it("buildAuditTrailSidecarBody emits BSD-shasum compatible '<hex>  <name>\\n'", () => {
    const body = buildAuditTrailSidecarBody("deadbeef".padEnd(64, "0"), "cnc-audit-trail-x.ndjson");
    expect(body).toBe(`${"deadbeef".padEnd(64, "0")}  cnc-audit-trail-x.ndjson\n`);
    // Two literal spaces between digest and filename.
    expect(body).toMatch(/\s\s/);
  });
});

describe("downloadPolicyAuditTrail withSidecar", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", {
      subtle: {
        digest: async (_algo: string, data: ArrayBuffer | Uint8Array) => {
          const view = data instanceof Uint8Array ? data : new Uint8Array(data);
          const seed = view.length > 0 ? view[0] : 0;
          return new Uint8Array(32).fill(seed).buffer;
        }
      }
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("withSidecar=true triggers two downloads (main + .sha256) and revokes both URLs", async () => {
    const { env, log } = makeStubEnv();
    const result = await downloadPolicyAuditTrail(
      "payload",
      "ndjson",
      "2026-05-02T06:30:15Z",
      env,
      { withSidecar: true }
    );
    expect(result.filename).toBe("cnc-audit-trail-20260502T063015.ndjson");
    expect(result.sidecarFilename).toBe("cnc-audit-trail-20260502T063015.ndjson.sha256");
    expect(log.objectUrls).toHaveLength(2);
    expect(log.revokes).toHaveLength(2);
    expect(log.revokes).toEqual(log.objectUrls);
    expect(log.blobs).toHaveLength(2);
    expect(log.blobs[0].type).toBe(mimeTypeForAuditTrailFormat("ndjson"));
    expect(log.blobs[1].type).toBe("text/plain;charset=utf-8");
    const sidecarText = await log.blobs[1].text();
    expect(sidecarText).toBe(
      `${"70".repeat(32)}  cnc-audit-trail-20260502T063015.ndjson\n`
    );
  });

  it("withSidecar=false (default) preserves single-download behavior", async () => {
    const { env, log } = makeStubEnv();
    const result = await downloadPolicyAuditTrail(
      "payload",
      "text",
      "2026-05-02T06:30:15Z",
      env
    );
    expect(result.sidecarFilename).toBeUndefined();
    expect(log.objectUrls).toHaveLength(1);
    expect(log.revokes).toHaveLength(1);
    expect(log.blobs).toHaveLength(1);
  });

  it("supports the options-as-fourth-arg overload (no env injected)", async () => {
    // When the caller skips the env, the helper falls back to defaults; the
    // browser DOM is not available in vitest, so this overload throws BEFORE
    // touching crypto. We assert the call shape by spying on the failure.
    await expect(
      downloadPolicyAuditTrail("p", "text", "2026-05-02T06:30:15Z", { withSidecar: true })
    ).rejects.toBeDefined();
  });
});

describe("computeAuditTrailHmacSha256 + HMAC sidecar helpers", () => {
  // Trace the algorithm/key/data triples actually requested so tests can
  // assert that the HMAC plumbing routes the secret through importKey + sign.
  const importKeyCalls: Array<{ rawKey: Uint8Array; algorithm: unknown }> = [];
  const signCalls: Array<{ key: unknown; data: Uint8Array }> = [];

  beforeEach(() => {
    importKeyCalls.length = 0;
    signCalls.length = 0;
    vi.stubGlobal("crypto", {
      subtle: {
        importKey: async (
          format: string,
          rawKey: ArrayBuffer | Uint8Array,
          algorithm: unknown
        ) => {
          expect(format).toBe("raw");
          const view = rawKey instanceof Uint8Array ? rawKey : new Uint8Array(rawKey);
          importKeyCalls.push({ rawKey: view, algorithm });
          return { __stubKey: true, rawKey: view, algorithm };
        },
        sign: async (algo: string, key: unknown, data: ArrayBuffer | Uint8Array) => {
          expect(algo).toBe("HMAC");
          const view = data instanceof Uint8Array ? data : new Uint8Array(data);
          signCalls.push({ key, data: view });
          // Deterministic: byte 0 = key[0] XOR data[0], remaining 31 bytes = data[0].
          const seed = view.length > 0 ? view[0] : 0;
          const keyView = (key as { rawKey?: Uint8Array }).rawKey ?? new Uint8Array();
          const out = new Uint8Array(32).fill(seed);
          out[0] = (keyView[0] ?? 0) ^ seed;
          return out.buffer;
        }
      }
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects empty / whitespace secrets WITHOUT touching Web Crypto", async () => {
    await expect(computeAuditTrailHmacSha256("payload", "")).rejects.toThrow(
      /requires a non-empty secret/
    );
    await expect(computeAuditTrailHmacSha256("payload", "   ")).rejects.toThrow(
      /requires a non-empty secret/
    );
    expect(importKeyCalls).toHaveLength(0);
    expect(signCalls).toHaveLength(0);
  });

  it("returns a 64-char lower-case hex string and routes the secret through importKey", async () => {
    const hex = await computeAuditTrailHmacSha256("hello", "topsecret");
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(importKeyCalls).toHaveLength(1);
    expect(new TextDecoder().decode(importKeyCalls[0].rawKey)).toBe("topsecret");
    expect(importKeyCalls[0].algorithm).toEqual({ name: "HMAC", hash: "SHA-256" });
    expect(signCalls).toHaveLength(1);
    expect(new TextDecoder().decode(signCalls[0].data)).toBe("hello");
  });

  it("buildAuditTrailHmacSidecarFilename appends .hmac-sha256 (distinct from .sha256)", () => {
    const name = "cnc-audit-trail-20260502T063015.ndjson";
    expect(buildAuditTrailHmacSidecarFilename(name)).toBe(`${name}.hmac-sha256`);
    expect(buildAuditTrailHmacSidecarFilename(name)).not.toBe(buildAuditTrailSidecarFilename(name));
  });

  it("buildAuditTrailHmacSidecarBody uses the same '<hex>  <name>\\n' shape as the SHA-256 sidecar", () => {
    const name = "cnc-audit-trail-20260502T063015.ndjson";
    expect(buildAuditTrailHmacSidecarBody("a".repeat(64), name)).toBe(`${"a".repeat(64)}  ${name}\n`);
  });

  it("downloadPolicyAuditTrail withHmacSidecar fires a third download (main + sha256 + hmac-sha256)", async () => {
    const { env, log } = makeStubEnv();
    // Plain SHA-256 stub (mirrors the prior describe block) so withSidecar still works.
    vi.stubGlobal("crypto", {
      subtle: {
        digest: async () => new Uint8Array(32).fill(0x70).buffer,
        importKey: async (format: string, rawKey: ArrayBuffer | Uint8Array) => ({
          __stubKey: true,
          rawKey: rawKey instanceof Uint8Array ? rawKey : new Uint8Array(rawKey)
        }),
        sign: async () => new Uint8Array(32).fill(0xab).buffer
      }
    });
    const result = await downloadPolicyAuditTrail(
      "payload",
      "ndjson",
      "2026-05-02T06:30:15Z",
      env,
      { withSidecar: true, withHmacSidecar: { secretKey: "shop-secret" } }
    );
    expect(result.filename).toBe("cnc-audit-trail-20260502T063015.ndjson");
    expect(result.sidecarFilename).toBe("cnc-audit-trail-20260502T063015.ndjson.sha256");
    expect(result.hmacSidecarFilename).toBe(
      "cnc-audit-trail-20260502T063015.ndjson.hmac-sha256"
    );
    expect(log.objectUrls).toHaveLength(3);
    expect(log.revokes).toHaveLength(3);
    expect(log.revokes).toEqual(log.objectUrls);
    expect(log.blobs).toHaveLength(3);
    expect(log.anchorState.clicks).toBe(3);
    const hmacBody = await log.blobs[2].text();
    expect(hmacBody).toBe(
      `${"ab".repeat(32)}  cnc-audit-trail-20260502T063015.ndjson\n`
    );
  });

  it("downloadPolicyAuditTrail withHmacSidecar (no SHA-256 sidecar) fires exactly two downloads", async () => {
    const { env, log } = makeStubEnv();
    vi.stubGlobal("crypto", {
      subtle: {
        importKey: async (format: string, rawKey: ArrayBuffer | Uint8Array) => ({
          __stubKey: true,
          rawKey: rawKey instanceof Uint8Array ? rawKey : new Uint8Array(rawKey)
        }),
        sign: async () => new Uint8Array(32).fill(0xcd).buffer
      }
    });
    const result = await downloadPolicyAuditTrail(
      "payload",
      "text",
      "2026-05-02T06:30:15Z",
      env,
      { withHmacSidecar: { secretKey: "shop-secret" } }
    );
    expect(result.sidecarFilename).toBeUndefined();
    expect(result.hmacSidecarFilename).toBe(
      "cnc-audit-trail-20260502T063015.txt.hmac-sha256"
    );
    expect(log.objectUrls).toHaveLength(2);
    expect(log.blobs).toHaveLength(2);
  });

  it("downloadPolicyAuditTrail rejects when withHmacSidecar.secretKey is empty (no silent downgrade)", async () => {
    const { env, log } = makeStubEnv();
    await expect(
      downloadPolicyAuditTrail(
        "payload",
        "text",
        "2026-05-02T06:30:15Z",
        env,
        { withHmacSidecar: { secretKey: "" } }
      )
    ).rejects.toThrow(/requires a non-empty secret/);
    // Main download still went through before HMAC step rejected — caller is
    // expected to surface the failure via the catch arm in App.tsx.
    expect(log.anchorState.clicks).toBe(1);
  });
});

describe("computeAuditTrailEncryptedAesGcm + AES-GCM helpers", () => {
  // Snapshot every PBKDF2 / AES-GCM call so tests can assert that the secret,
  // salt and iv are routed correctly through Web Crypto without depending on
  // a real implementation in vitest's default node environment.
  const importKeyCalls: Array<{ rawKey: Uint8Array; algorithm: unknown; usages: readonly KeyUsage[] }> = [];
  const deriveKeyCalls: Array<{ algorithm: { name: string; salt: Uint8Array; iterations: number; hash: string }; baseKey: unknown; derivedAlgorithm: { name: string; length: number }; usages: readonly KeyUsage[] }> = [];
  const encryptCalls: Array<{ algorithm: { name: string; iv: Uint8Array }; key: unknown; data: Uint8Array }> = [];
  const randomFills: Uint8Array[] = [];

  beforeEach(() => {
    importKeyCalls.length = 0;
    deriveKeyCalls.length = 0;
    encryptCalls.length = 0;
    randomFills.length = 0;
    let randSeed = 0;
    vi.stubGlobal("crypto", {
      getRandomValues: (buf: Uint8Array) => {
        // Deterministic seed: each successive byte is (++randSeed) mod 256.
        for (let i = 0; i < buf.length; i += 1) {
          buf[i] = ++randSeed & 0xff;
        }
        randomFills.push(new Uint8Array(buf));
        return buf;
      },
      subtle: {
        importKey: async (
          format: string,
          rawKey: ArrayBuffer | Uint8Array,
          algorithm: unknown,
          _extractable: boolean,
          usages: readonly KeyUsage[]
        ) => {
          expect(format).toBe("raw");
          const view = rawKey instanceof Uint8Array ? rawKey : new Uint8Array(rawKey);
          importKeyCalls.push({ rawKey: view, algorithm, usages });
          return { __pbkdf2BaseKey: true, rawKey: view };
        },
        deriveKey: async (
          algorithm: { name: string; salt: ArrayBuffer | Uint8Array; iterations: number; hash: string },
          baseKey: unknown,
          derivedAlgorithm: { name: string; length: number },
          _extractable: boolean,
          usages: readonly KeyUsage[]
        ) => {
          const saltView =
            algorithm.salt instanceof Uint8Array ? algorithm.salt : new Uint8Array(algorithm.salt);
          deriveKeyCalls.push({
            algorithm: { name: algorithm.name, salt: saltView, iterations: algorithm.iterations, hash: algorithm.hash },
            baseKey,
            derivedAlgorithm,
            usages
          });
          return { __aesKey: true, derivedFrom: baseKey };
        },
        encrypt: async (
          algorithm: { name: string; iv: ArrayBuffer | Uint8Array },
          key: unknown,
          data: ArrayBuffer | Uint8Array
        ) => {
          const ivView = algorithm.iv instanceof Uint8Array ? algorithm.iv : new Uint8Array(algorithm.iv);
          const dataView = data instanceof Uint8Array ? data : new Uint8Array(data);
          encryptCalls.push({ algorithm: { name: algorithm.name, iv: ivView }, key, data: dataView });
          // Deterministic ciphertext = data XOR 0xff, plus a 16-byte 'tag'
          // appended (matching the GCM contract that ciphertext.length =
          // plaintext.length + 16).
          const ct = new Uint8Array(dataView.length + 16);
          for (let i = 0; i < dataView.length; i += 1) ct[i] = dataView[i] ^ 0xff;
          for (let i = 0; i < 16; i += 1) ct[dataView.length + i] = 0xaa;
          return ct.buffer;
        }
      }
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects empty / whitespace secrets WITHOUT touching Web Crypto", async () => {
    await expect(computeAuditTrailEncryptedAesGcm("payload", "")).rejects.toThrow(
      /requires a non-empty secret/
    );
    await expect(computeAuditTrailEncryptedAesGcm("payload", "   ")).rejects.toThrow(
      /requires a non-empty secret/
    );
    expect(importKeyCalls).toHaveLength(0);
    expect(deriveKeyCalls).toHaveLength(0);
    expect(encryptCalls).toHaveLength(0);
    expect(randomFills).toHaveLength(0);
  });

  it("emits [salt(16) | iv(12) | ciphertext+tag] in that order", async () => {
    const out = await computeAuditTrailEncryptedAesGcm("hello", "topsecret");
    expect(out).toBeInstanceOf(Uint8Array);
    expect(out.length).toBe(AES_GCM_PARAMS.saltBytes + AES_GCM_PARAMS.ivBytes + 5 + 16);
    // First 16 bytes match the recorded salt fill, next 12 match the iv.
    expect(randomFills.length).toBe(2);
    expect(out.subarray(0, AES_GCM_PARAMS.saltBytes)).toEqual(randomFills[0]);
    expect(
      out.subarray(
        AES_GCM_PARAMS.saltBytes,
        AES_GCM_PARAMS.saltBytes + AES_GCM_PARAMS.ivBytes
      )
    ).toEqual(randomFills[1]);
    // Tail is ciphertext (data XOR 0xff) + 16-byte tag (0xaa).
    const tail = out.subarray(AES_GCM_PARAMS.saltBytes + AES_GCM_PARAMS.ivBytes);
    const helloBytes = new TextEncoder().encode("hello");
    for (let i = 0; i < helloBytes.length; i += 1) {
      expect(tail[i]).toBe(helloBytes[i] ^ 0xff);
    }
    for (let i = 0; i < 16; i += 1) {
      expect(tail[helloBytes.length + i]).toBe(0xaa);
    }
  });

  it("routes the secret through PBKDF2 importKey and derives an AES-GCM key with OWASP-grade params", async () => {
    await computeAuditTrailEncryptedAesGcm("hello", "topsecret");
    expect(importKeyCalls).toHaveLength(1);
    expect(new TextDecoder().decode(importKeyCalls[0].rawKey)).toBe("topsecret");
    expect(importKeyCalls[0].algorithm).toEqual({ name: "PBKDF2" });
    expect(importKeyCalls[0].usages).toEqual(["deriveKey"]);

    expect(deriveKeyCalls).toHaveLength(1);
    expect(deriveKeyCalls[0].algorithm.name).toBe("PBKDF2");
    expect(deriveKeyCalls[0].algorithm.iterations).toBe(AES_GCM_PARAMS.pbkdf2Iterations);
    expect(deriveKeyCalls[0].algorithm.hash).toBe(AES_GCM_PARAMS.pbkdf2Hash);
    expect(deriveKeyCalls[0].algorithm.salt.length).toBe(AES_GCM_PARAMS.saltBytes);
    expect(deriveKeyCalls[0].derivedAlgorithm).toEqual({
      name: "AES-GCM",
      length: AES_GCM_PARAMS.derivedKeyBits
    });
    expect(deriveKeyCalls[0].usages).toEqual(["encrypt"]);
  });

  it("buildAuditTrailEncryptedFilename appends .aes-gcm (distinct from .sha256 and .hmac-sha256)", () => {
    const name = "cnc-audit-trail-20260502T063015.ndjson";
    expect(buildAuditTrailEncryptedFilename(name)).toBe(`${name}.aes-gcm`);
    expect(buildAuditTrailEncryptedFilename(name)).not.toBe(buildAuditTrailSidecarFilename(name));
    expect(buildAuditTrailEncryptedFilename(name)).not.toBe(
      buildAuditTrailHmacSidecarFilename(name)
    );
  });

  it("downloadPolicyAuditTrail withEncryption fires a second download with the AES-GCM blob", async () => {
    const { env, log } = makeStubEnv();
    const result = await downloadPolicyAuditTrail(
      "payload",
      "text",
      "2026-05-02T06:30:15Z",
      env,
      { withEncryption: { secretKey: "shop-secret" } }
    );
    expect(result.encryptedFilename).toBe(
      "cnc-audit-trail-20260502T063015.txt.aes-gcm"
    );
    expect(result.sidecarFilename).toBeUndefined();
    expect(result.hmacSidecarFilename).toBeUndefined();
    expect(log.objectUrls).toHaveLength(2);
    expect(log.blobs).toHaveLength(2);
    expect(log.blobs[1].type).toBe("application/octet-stream");
    const tail = new Uint8Array(await log.blobs[1].arrayBuffer());
    expect(tail.length).toBe(AES_GCM_PARAMS.saltBytes + AES_GCM_PARAMS.ivBytes + 7 + 16);
    expect(log.anchorState.clicks).toBe(2);
  });

  it("downloadPolicyAuditTrail composes withSidecar + withHmacSidecar + withEncryption -> four downloads", async () => {
    const { env, log } = makeStubEnv();
    // Reuse one super-stub that handles SHA-256, HMAC and AES-GCM.
    let randSeed = 0;
    vi.stubGlobal("crypto", {
      getRandomValues: (buf: Uint8Array) => {
        for (let i = 0; i < buf.length; i += 1) buf[i] = ++randSeed & 0xff;
        return buf;
      },
      subtle: {
        digest: async () => new Uint8Array(32).fill(0x70).buffer,
        importKey: async (_format: string, rawKey: ArrayBuffer | Uint8Array) => ({
          __key: true,
          rawKey: rawKey instanceof Uint8Array ? rawKey : new Uint8Array(rawKey)
        }),
        deriveKey: async () => ({ __aesKey: true }),
        sign: async () => new Uint8Array(32).fill(0xab).buffer,
        encrypt: async (_algo: unknown, _key: unknown, data: ArrayBuffer | Uint8Array) => {
          const view = data instanceof Uint8Array ? data : new Uint8Array(data);
          const ct = new Uint8Array(view.length + 16);
          for (let i = 0; i < view.length; i += 1) ct[i] = view[i] ^ 0x55;
          return ct.buffer;
        }
      }
    });
    const result = await downloadPolicyAuditTrail(
      "payload",
      "ndjson",
      "2026-05-02T06:30:15Z",
      env,
      {
        withSidecar: true,
        withHmacSidecar: { secretKey: "shop-secret" },
        withEncryption: { secretKey: "encrypt-secret" }
      }
    );
    expect(result.filename).toBe("cnc-audit-trail-20260502T063015.ndjson");
    expect(result.sidecarFilename).toBe("cnc-audit-trail-20260502T063015.ndjson.sha256");
    expect(result.hmacSidecarFilename).toBe(
      "cnc-audit-trail-20260502T063015.ndjson.hmac-sha256"
    );
    expect(result.encryptedFilename).toBe(
      "cnc-audit-trail-20260502T063015.ndjson.aes-gcm"
    );
    expect(log.objectUrls).toHaveLength(4);
    expect(log.revokes).toHaveLength(4);
    expect(log.revokes).toEqual(log.objectUrls);
    expect(log.blobs).toHaveLength(4);
    expect(log.blobs[3].type).toBe("application/octet-stream");
    expect(log.anchorState.clicks).toBe(4);
  });

  it("downloadPolicyAuditTrail rejects when withEncryption.secretKey is empty (no silent downgrade)", async () => {
    const { env, log } = makeStubEnv();
    await expect(
      downloadPolicyAuditTrail(
        "payload",
        "text",
        "2026-05-02T06:30:15Z",
        env,
        { withEncryption: { secretKey: "" } }
      )
    ).rejects.toThrow(/requires a non-empty secret/);
    expect(log.anchorState.clicks).toBe(1);
  });
});
