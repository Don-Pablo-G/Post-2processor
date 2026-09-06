/**
 * Minimal ZIP writer — STORE (method 0) by default; optional DEFLATE
 * (method 8) via native `CompressionStream("deflate-raw")` when available.
 * No compression library dependencies.
 */

export type StoreZipEntry = {
  /** Archive path using forward slashes (e.g. `setup/a.pdf`). */
  path: string;
  data: Uint8Array | string;
};

export type CreateZipOptions = {
  /**
   * `"store"` (default) — uncompressed.
   * `"deflate"` — raw DEFLATE when `CompressionStream` is available;
   * falls back to STORE per-entry when compression fails or is unavailable.
   */
  method?: "store" | "deflate";
};

const enc = new TextEncoder();

function toBytes(data: Uint8Array | string): Uint8Array {
  return typeof data === "string" ? enc.encode(data) : data;
}

/** CRC-32 (ISO 3309 / ZIP) over `data`. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc ^= data[i]!;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  return b;
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  b[0] = n & 0xff;
  b[1] = (n >>> 8) & 0xff;
  b[2] = (n >>> 16) & 0xff;
  b[3] = (n >>> 24) & 0xff;
  return b;
}

function concat(parts: ReadonlyArray<Uint8Array>): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function compressionStreamAvailable(): boolean {
  return typeof CompressionStream === "function";
}

/**
 * Raw DEFLATE (no zlib wrapper) via `CompressionStream("deflate-raw")`.
 * Returns `undefined` when the platform lacks support or compression fails.
 */
export async function deflateRaw(data: Uint8Array): Promise<Uint8Array | undefined> {
  if (!compressionStreamAvailable() || data.length === 0) return undefined;
  try {
    const stream = new Blob([data as BlobPart])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    const buf = await new Response(stream).arrayBuffer();
    const out = new Uint8Array(buf);
    // Prefer STORE when DEFLATE does not shrink the payload.
    if (out.length >= data.length) return undefined;
    return out;
  } catch {
    return undefined;
  }
}

type PreparedEntry = {
  nameBytes: Uint8Array;
  data: Uint8Array;
  payload: Uint8Array;
  method: number;
  checksum: number;
};

function buildZipFromPrepared(prepared: ReadonlyArray<PreparedEntry>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  let fileCount = 0;

  for (const entry of prepared) {
    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(entry.method),
      u16(0),
      u16(0),
      u32(entry.checksum),
      u32(entry.payload.length),
      u32(entry.data.length),
      u16(entry.nameBytes.length),
      u16(0),
      entry.nameBytes
    ]);
    localParts.push(localHeader, entry.payload);

    const centralHeader = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(entry.method),
      u16(0),
      u16(0),
      u32(entry.checksum),
      u32(entry.payload.length),
      u32(entry.data.length),
      u16(entry.nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      entry.nameBytes
    ]);
    centralParts.push(centralHeader);

    offset += localHeader.length + entry.payload.length;
    fileCount += 1;
  }

  const centralDir = concat(centralParts);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(fileCount),
    u16(fileCount),
    u32(centralDir.length),
    u32(offset),
    u16(0)
  ]);

  return concat([...localParts, centralDir, end]);
}

/**
 * Build an uncompressed (STORE) ZIP archive from entries.
 * Paths are normalized to forward slashes; empty paths are skipped.
 */
export function createStoreZip(entries: ReadonlyArray<StoreZipEntry>): Uint8Array {
  const prepared: PreparedEntry[] = [];
  for (const entry of entries) {
    const name = entry.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (name.length === 0) continue;
    const data = toBytes(entry.data);
    prepared.push({
      nameBytes: enc.encode(name),
      data,
      payload: data,
      method: 0,
      checksum: crc32(data)
    });
  }
  return buildZipFromPrepared(prepared);
}

/**
 * Build a ZIP archive. Default is STORE; `method: "deflate"` uses native
 * raw DEFLATE when available and falls back to STORE per entry otherwise.
 */
export async function createZip(
  entries: ReadonlyArray<StoreZipEntry>,
  options?: CreateZipOptions
): Promise<Uint8Array> {
  const wantDeflate = options?.method === "deflate";
  const prepared: PreparedEntry[] = [];
  for (const entry of entries) {
    const name = entry.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (name.length === 0) continue;
    const data = toBytes(entry.data);
    const checksum = crc32(data);
    let payload = data;
    let method = 0;
    if (wantDeflate) {
      const compressed = await deflateRaw(data);
      if (compressed) {
        payload = compressed;
        method = 8;
      }
    }
    prepared.push({
      nameBytes: enc.encode(name),
      data,
      payload,
      method,
      checksum
    });
  }
  return buildZipFromPrepared(prepared);
}
