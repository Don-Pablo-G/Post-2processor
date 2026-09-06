import { describe, expect, it } from "vitest";

import { createStoreZip, crc32 } from "../src/workshop/storeZip.js";

describe("createStoreZip", () => {
  it("builds a STORE zip with local + central headers", () => {
    const data = new TextEncoder().encode("hello");
    const zip = createStoreZip([{ path: "a.txt", data: "hello" }]);
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4b); // K
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    // End of central directory signature somewhere near the end
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
