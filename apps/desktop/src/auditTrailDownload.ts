import type { AuditTrailExportFormat } from "./policyPresetHint.js";

const MIME_BY_FORMAT: Record<AuditTrailExportFormat, string> = {
  text: "text/plain;charset=utf-8",
  markdown: "text/markdown;charset=utf-8",
  csv: "text/csv;charset=utf-8",
  ndjson: "application/x-ndjson;charset=utf-8"
};

const EXTENSION_BY_FORMAT: Record<AuditTrailExportFormat, string> = {
  text: "txt",
  markdown: "md",
  csv: "csv",
  ndjson: "ndjson"
};

export function mimeTypeForAuditTrailFormat(format: AuditTrailExportFormat): string {
  return MIME_BY_FORMAT[format];
}

export function extensionForAuditTrailFormat(format: AuditTrailExportFormat): string {
  return EXTENSION_BY_FORMAT[format];
}

/**
 * Render an ISO-8601 timestamp into a filename-safe compact form
 * `YYYYMMDDTHHMMSS` (drops fractional seconds + timezone for portability).
 * Falls back to the literal string `unknown-time` when parsing fails.
 */
export function formatAuditTrailFilenameTimestamp(timestampIso: string): string {
  const match = timestampIso.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  );
  if (!match) return "unknown-time";
  const [, y, m, d, hh, mm, ss] = match;
  return `${y}${m}${d}T${hh}${mm}${ss}`;
}

export function buildAuditTrailDownloadFilename(
  format: AuditTrailExportFormat,
  timestampIso: string
): string {
  const stamp = formatAuditTrailFilenameTimestamp(timestampIso);
  return `cnc-audit-trail-${stamp}.${extensionForAuditTrailFormat(format)}`;
}

export type AuditTrailDownloadEnvironment = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  createAnchor: () => {
    set href(value: string);
    set download(value: string);
    click: () => void;
  };
  scheduleRevoke: (callback: () => void) => void;
};

function defaultEnvironment(): AuditTrailDownloadEnvironment {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    createAnchor: () => {
      const anchor = document.createElement("a");
      return anchor;
    },
    scheduleRevoke: (callback) => {
      if (typeof queueMicrotask === "function") queueMicrotask(callback);
      else setTimeout(callback, 0);
    }
  };
}

/**
 * SHA-256 digest of the audit-trail payload, returned as a lower-case hex
 * string. Uses the standard Web Crypto API (`crypto.subtle.digest`) — no
 * dependencies. Throws if the hosting environment lacks Web Crypto (mirrors
 * the existing Blob/URL fallback contract: callers should surface a status
 * message and skip the sidecar instead of crashing the UI).
 */
export async function computeAuditTrailSha256(payload: string): Promise<string> {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto subtle.digest is not available in this environment");
  }
  const bytes = new TextEncoder().encode(payload);
  const digest = await subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(digest);
  let out = "";
  for (let i = 0; i < view.length; i += 1) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * BSD shasum / GNU sha256sum -compatible sidecar body: `<hex>  <name>\n`.
 * Two literal spaces between the digest and the filename — required by both
 * tools' `-c` / `--check` modes.
 */
export function buildAuditTrailSidecarBody(digestHex: string, mainFilename: string): string {
  return `${digestHex}  ${mainFilename}\n`;
}

export function buildAuditTrailSidecarFilename(mainFilename: string): string {
  return `${mainFilename}.sha256`;
}

/**
 * HMAC-SHA-256 of the audit-trail payload using the supplied shared secret,
 * returned as a lower-case hex string. Uses Web Crypto's `subtle.importKey` +
 * `subtle.sign` — no dependencies. Throws if Web Crypto is missing OR if the
 * supplied `secretKey` is empty / whitespace-only (callers MUST surface a UI
 * status and skip the sidecar instead of silently downgrading to the
 * unauthenticated SHA-256 sidecar — that downgrade would defeat the whole
 * point of opting in to a shared key).
 */
export async function computeAuditTrailHmacSha256(
  payload: string,
  secretKey: string
): Promise<string> {
  if (secretKey.trim().length === 0) {
    throw new Error("HMAC sidecar requires a non-empty secret key");
  }
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto subtle.importKey/sign is not available in this environment");
  }
  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(secretKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await subtle.sign("HMAC", key, encoder.encode(payload));
  const view = new Uint8Array(signature);
  let out = "";
  for (let i = 0; i < view.length; i += 1) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Sidecar body for the HMAC variant. Same `<hex>  <name>\n` shape as the
 * SHA-256 sidecar so existing checksum-style tooling can ingest it; the
 * filename suffix (`.hmac-sha256`) carries the algorithm tag.
 */
export function buildAuditTrailHmacSidecarBody(
  hmacHex: string,
  mainFilename: string
): string {
  return `${hmacHex}  ${mainFilename}\n`;
}

export function buildAuditTrailHmacSidecarFilename(mainFilename: string): string {
  return `${mainFilename}.hmac-sha256`;
}

/**
 * AES-256-GCM at-rest encryption parameters. Tweakable via the
 * {@link AES_GCM_PARAMS} const but pinned to OWASP-recommended defaults
 * to keep the call sites and verifier in lock-step.
 */
export const AES_GCM_PARAMS = Object.freeze({
  /** PBKDF2 salt length in bytes. 16 is the OWASP minimum for SHA-256. */
  saltBytes: 16,
  /** AES-GCM IV length in bytes. 12 is the NIST-recommended GCM IV length. */
  ivBytes: 12,
  /** PBKDF2 iteration count. 250k matches OWASP 2023 minimum for SHA-256. */
  pbkdf2Iterations: 250_000,
  /** Derived key length in bits. */
  derivedKeyBits: 256,
  /** PBKDF2 hash algorithm (matches the WebCrypto string). */
  pbkdf2Hash: "SHA-256" as const
});

/**
 * AES-256-GCM at-rest encryption of the audit-trail payload using a
 * password-derived key (PBKDF2-SHA-256, 250k iterations). The output blob
 * carries `[salt(16) | iv(12) | ciphertext+tag]` in that order so the
 * verifier (`packages/core/src/audit/auditTrailIntegrity.ts`) can
 * round-trip without an out-of-band key/IV exchange.
 *
 * Empty / whitespace-only `secretKey` is REJECTED at compute time —
 * silently encrypting with an empty password would produce an artifact
 * indistinguishable from one secured by a real key, defeating the whole
 * point of opting in to encryption (mirrors the HMAC contract).
 */
export async function computeAuditTrailEncryptedAesGcm(
  payload: string,
  secretKey: string
): Promise<Uint8Array> {
  if (secretKey.trim().length === 0) {
    throw new Error("AES-GCM encryption requires a non-empty secret key");
  }
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  const subtle = cryptoApi?.subtle;
  if (!subtle || typeof cryptoApi?.getRandomValues !== "function") {
    throw new Error(
      "Web Crypto subtle.deriveKey/encrypt or getRandomValues is not available in this environment"
    );
  }

  const encoder = new TextEncoder();
  const salt = new Uint8Array(AES_GCM_PARAMS.saltBytes);
  cryptoApi.getRandomValues(salt);
  const iv = new Uint8Array(AES_GCM_PARAMS.ivBytes);
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
      iterations: AES_GCM_PARAMS.pbkdf2Iterations,
      hash: AES_GCM_PARAMS.pbkdf2Hash
    },
    baseKey,
    { name: "AES-GCM", length: AES_GCM_PARAMS.derivedKeyBits },
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
 * Filename for the AES-GCM ciphertext sidecar. Distinct from `.sha256`
 * and `.hmac-sha256` so that operators see at a glance which artifact
 * carries which guarantee.
 */
export function buildAuditTrailEncryptedFilename(mainFilename: string): string {
  return `${mainFilename}.aes-gcm`;
}

export type DownloadPolicyAuditTrailOptions = {
  /**
   * When true, after the main file is downloaded a second download is fired
   * for `<filename>.sha256` whose body is the BSD shasum-compatible
   * `<hex>  <filename>\n` line. Defaults to false (back-compat with the
   * pre-sidecar contract).
   */
  withSidecar?: boolean;
  /**
   * When set, after the main (and any optional SHA-256 sidecar) download a
   * third download is fired for `<filename>.hmac-sha256`. The body is an
   * HMAC-SHA-256 of the payload signed with `secretKey`, in the same
   * `<hex>  <filename>\n` shape as the SHA-256 sidecar. Composable with
   * `withSidecar`. An empty / whitespace-only `secretKey` causes the HMAC
   * sidecar to be REJECTED at compute time (no silent downgrade).
   */
  withHmacSidecar?: { secretKey: string };
  /**
   * When set, after the main (and any optional SHA-256/HMAC sidecars) the
   * encrypted at-rest copy `<filename>.aes-gcm` is downloaded as a binary
   * blob (`application/octet-stream`). Composable with `withSidecar` and
   * `withHmacSidecar`. An empty / whitespace-only `secretKey` is REJECTED
   * at compute time (mirrors the HMAC contract — silent encryption with a
   * blank password would defeat the opt-in).
   */
  withEncryption?: { secretKey: string };
};

export type DownloadPolicyAuditTrailResult = {
  filename: string;
  sidecarFilename?: string;
  hmacSidecarFilename?: string;
  encryptedFilename?: string;
};

/**
 * Trigger a browser download of the supplied audit-trail payload as a file.
 * Pure browser plumbing (Blob + object URL + injected anchor click) — no
 * Electron / native dialog dependency. Returns `{ filename, sidecarFilename? }`
 * so callers can echo both names in telemetry / status text. When
 * `options.withSidecar` is true, a second `.sha256` download is fired AFTER
 * the main download click using the SHA-256 of `payload`.
 */
export async function downloadPolicyAuditTrail(
  payload: string,
  format: AuditTrailExportFormat,
  timestampIso: string,
  envOrOptions: AuditTrailDownloadEnvironment | DownloadPolicyAuditTrailOptions = defaultEnvironment(),
  maybeOptions?: DownloadPolicyAuditTrailOptions
): Promise<DownloadPolicyAuditTrailResult> {
  const isEnvironment =
    typeof (envOrOptions as Partial<AuditTrailDownloadEnvironment>).createObjectURL === "function";
  const env = isEnvironment
    ? (envOrOptions as AuditTrailDownloadEnvironment)
    : defaultEnvironment();
  const options = isEnvironment
    ? maybeOptions ?? {}
    : (envOrOptions as DownloadPolicyAuditTrailOptions);

  const filename = buildAuditTrailDownloadFilename(format, timestampIso);
  const blob = new Blob([payload], { type: mimeTypeForAuditTrailFormat(format) });
  const url = env.createObjectURL(blob);
  const anchor = env.createAnchor();
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  env.scheduleRevoke(() => env.revokeObjectURL(url));

  let sidecarFilename: string | undefined;
  if (options.withSidecar) {
    const digest = await computeAuditTrailSha256(payload);
    sidecarFilename = buildAuditTrailSidecarFilename(filename);
    const sidecarBody = buildAuditTrailSidecarBody(digest, filename);
    const sidecarBlob = new Blob([sidecarBody], { type: "text/plain;charset=utf-8" });
    const sidecarUrl = env.createObjectURL(sidecarBlob);
    const sidecarAnchor = env.createAnchor();
    sidecarAnchor.href = sidecarUrl;
    sidecarAnchor.download = sidecarFilename;
    sidecarAnchor.click();
    env.scheduleRevoke(() => env.revokeObjectURL(sidecarUrl));
  }

  let hmacSidecarFilename: string | undefined;
  if (options.withHmacSidecar) {
    const hmac = await computeAuditTrailHmacSha256(payload, options.withHmacSidecar.secretKey);
    hmacSidecarFilename = buildAuditTrailHmacSidecarFilename(filename);
    const hmacBody = buildAuditTrailHmacSidecarBody(hmac, filename);
    const hmacBlob = new Blob([hmacBody], { type: "text/plain;charset=utf-8" });
    const hmacUrl = env.createObjectURL(hmacBlob);
    const hmacAnchor = env.createAnchor();
    hmacAnchor.href = hmacUrl;
    hmacAnchor.download = hmacSidecarFilename;
    hmacAnchor.click();
    env.scheduleRevoke(() => env.revokeObjectURL(hmacUrl));
  }

  let encryptedFilename: string | undefined;
  if (options.withEncryption) {
    const encrypted = await computeAuditTrailEncryptedAesGcm(
      payload,
      options.withEncryption.secretKey
    );
    encryptedFilename = buildAuditTrailEncryptedFilename(filename);
    // Cast through BlobPart: TS' DOM lib types Uint8Array as
    // Uint8Array<ArrayBufferLike>, but Blob accepts a stricter
    // ArrayBuffer-backed view. Slicing into a fresh ArrayBuffer would copy
    // the bytes for no win — the cast is sound because computeAuditTrailEncryptedAesGcm
    // always returns a plain ArrayBuffer-backed Uint8Array.
    const encryptedBlob = new Blob([encrypted as unknown as BlobPart], {
      type: "application/octet-stream"
    });
    const encryptedUrl = env.createObjectURL(encryptedBlob);
    const encryptedAnchor = env.createAnchor();
    encryptedAnchor.href = encryptedUrl;
    encryptedAnchor.download = encryptedFilename;
    encryptedAnchor.click();
    env.scheduleRevoke(() => env.revokeObjectURL(encryptedUrl));
  }

  return {
    filename,
    ...(sidecarFilename ? { sidecarFilename } : {}),
    ...(hmacSidecarFilename ? { hmacSidecarFilename } : {}),
    ...(encryptedFilename ? { encryptedFilename } : {})
  };
}
