import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { collectPhoto, sniffContentType } from "./collect.ts";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]);
const webp = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP")]);
const avif = new Uint8Array([0, 0, 0, 0, ...Buffer.from("ftypavif")]);

describe("sniffContentType", () => {
  it("先頭のバイトで判定する", () => {
    expect(sniffContentType(jpeg)).toBe("image/jpeg");
    expect(sniffContentType(png)).toBe("image/png");
    expect(sniffContentType(webp)).toBe("image/webp");
    expect(sniffContentType(avif)).toBe("image/avif");
    expect(sniffContentType(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});

describe("collectPhoto", () => {
  const deps = {
    readFile: async (p: string) => (p === "/b/images/a.jpg" ? jpeg : new Uint8Array([1])),
    download: async (u: string) => (u.endsWith("x.png") ? png : new Uint8Array([1])),
  };

  it("file は bundle の場所からの相対パスで読む", async () => {
    const c = await collectPhoto({ file: "images/a.jpg", license: "none" }, "/b", deps);
    const sha = createHash("sha256").update(jpeg).digest("hex");
    expect(c.sha256).toBe(sha);
    expect(c.content_type).toBe("image/jpeg");
    expect(c.photo).toEqual({ license: "none", storage_key: `${sha}.jpg` });
  });

  it("url はダウンロードし、original_url に残す", async () => {
    const c = await collectPhoto({ url: "https://e.com/x.png" }, "/b", deps);
    expect(c.content_type).toBe("image/png");
    expect(c.photo).toMatchObject({ original_url: "https://e.com/x.png", storage_key: `${c.sha256}.png` });
    expect(c.photo).not.toHaveProperty("url");
  });

  it("画像でなければ失敗する", async () => {
    await expect(collectPhoto({ file: "other" }, "/b", deps)).rejects.toThrow("ではない");
  });
});
