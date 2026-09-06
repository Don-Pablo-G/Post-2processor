import { describe, expect, it } from "vitest";

import { createStoreZip, createZip, crc32, deflateRaw } from "../src/workshop/storeZip.js";

describe("createStoreZip", () => {
  it("builds a STORE zip with local + central headers", () => {
    const data = new TextEncoder().encode("hello");
    const zip = createStoreZip([{ path: "a.txt", data: "hello" }]);
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4b); // K
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    let foundEocd = false;
    for (let i = zip.length - 22; i >= 0; i -= 1) {
      if (view.getUint32(i, true) === 0x06054b50) {
        foundEocd = true;
        expect(view.getUint16(i + 8, true)).toBe(1); // total entries
        break;
      }
    }
    expect(foundEocd).toBe(true);
    expect(crc32(data)).toBe(0x3610a686);
  });

  it("packs multiple entries", () => {
    const zip = createStoreZip([
      { path: "pdf/a.pdf", data: new Uint8Array([1, 2, 3]) },
      { path: "txt/b.txt", data: "line\n" }
    ]);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("pdf/a.pdf");
    expect(text).toContain("txt/b.txt");
  });
});

describe("createZip deflate", () => {
  it("createZip store matches createStoreZip", async () => {
    const entries = [{ path: "a.txt", data: "hello world ".repeat(20) }];
    const store = createStoreZip(entries);
    const viaCreate = await createZip(entries, { method: "store" });
    expect(viaCreate).toEqual(store);
  });

  it("deflateRaw shrinks repetitive payloads when CompressionStream exists", async () => {
    if (typeof CompressionStream !== "function") return;
    const data = new TextEncoder().encode("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    const compressed = await deflateRaw(data);
    expect(compressed).toBeDefined();
    expect(compressed!.length).toBeLessThan(data.length);
  });

  it("createZip deflate uses method 8 when compression succeeds", async () => {
    if (typeof CompressionStream !== "function") return;
    const zip = await createZip(
      [{ path: "big.txt", data: "hello world ".repeat(40) }],
      { method: "deflate" }
    );
    // local header method at offset 8
    expect(zip[8]).toBe(8);
  });
});
