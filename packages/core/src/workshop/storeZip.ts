/**
 * Minimal ZIP (STORE / method 0) writer — no compression, no extra deps.
 * Suitable for desktop multi-file batch downloads as a single archive.
 */

export type StoreZipEntry = {
  /** Archive path using forward slashes (e.g. `setup/a.pdf`). */
  path: string;
  data: Uint8Array | string;
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

/**
 * Build an uncompressed (STORE) ZIP archive from entries.
 * Paths are normalized to forward slashes; empty paths are skipped.
 */
export function createStoreZip(entries: ReadonlyArray<StoreZipEntry>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  let fileCount = 0;

  for (const entry of entries) {
    const name = entry.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (name.length === 0) continue;
    const data = toBytes(entry.data);
    const nameBytes = enc.encode(name);
    const checksum = crc32(data);
    const size = data.length;

    const localHeader = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(checksum),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),
      nameBytes
    ]);
    localParts.push(localHeader, data);

    const centralHeader = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(checksum),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes
    ]);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
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
