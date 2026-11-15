// bundle の photos（file / url）を読んで、sha256 と content_type を出す。

import { createHash } from "node:crypto";

export const MAX_BYTES = 10 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

export type BundlePhoto = { file?: string; url?: string; [k: string]: unknown };

export type Collected = {
  bytes: Uint8Array;
  sha256: string;
  content_type: string;
  storage_key: string;
  /** bundle の photo から file / url を除き、storage_key（url なら original_url も）を足したもの */
  photo: Record<string, unknown>;
};

export type CollectDeps = {
  readFile: (path: string) => Promise<Uint8Array>;
  download: (url: string) => Promise<Uint8Array>;
};

/** 拡張子や応答ヘッダーではなく、ファイルの先頭のバイトで画像の種類を決める */
export function sniffContentType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return "image/avif";
  return null;
}

export async function collectPhoto(p: BundlePhoto, bundleDir: string, deps: CollectDeps): Promise<Collected> {
  const bytes = p.file ? await deps.readFile(`${bundleDir}/${p.file}`) : await deps.download(p.url as string);
  const content_type = sniffContentType(bytes);
  if (!content_type) throw new Error("jpeg / png / webp / avif ではない");
  if (bytes.length > MAX_BYTES) throw new Error("10MB を超えている");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storage_key = `${sha256}.${EXT[content_type]}`;
  const { file: _f, url, ...rest } = p;
  return { bytes, sha256, content_type, storage_key, photo: { ...rest, ...(url ? { original_url: url } : {}), storage_key } };
}
