// 計画の写真を取得してバケットに置き、spot_photos に書く行を返す。

import { createHash } from "node:crypto";
import type { ImportPlan } from "./plan.ts";

export const BUCKET = "spot-photos";

export type PhotoRow = Omit<ImportPlan["photos"][number], "src"> & { url: string; original_url: string | null };

export type PhotoDeps = {
  readFile: (path: string) => Promise<Uint8Array>;
  download: (url: string) => Promise<Uint8Array>;
  // すでに同じパスにあるときも成功として返す
  upload: (bytes: Uint8Array, objectPath: string, contentType: string) => Promise<void>;
  publicUrl: (objectPath: string) => string;
};

// 拡張子や応答ヘッダーではなく、中身の先頭バイトで画像の種類を決める
export function sniffImage(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { ext: "webp", type: "image/webp" };
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return { ext: "avif", type: "image/avif" };
  return null;
}

export async function uploadPhotos(photos: ImportPlan["photos"], bundleDir: string, deps: PhotoDeps): Promise<{ rows: PhotoRow[]; errors: string[] }> {
  const rows: PhotoRow[] = [];
  const errors: string[] = [];
  for (const p of photos) {
    const { src, ...rest } = p;
    const label = "file" in src ? src.file : src.url;
    try {
      const bytes = "file" in src ? await deps.readFile(`${bundleDir}/${src.file}`) : await deps.download(src.url);
      const kind = sniffImage(bytes);
      if (!kind) throw new Error("jpeg / png / webp / avif ではない");
      if (bytes.length > 10 * 1024 * 1024) throw new Error("10MB を超えている");
      const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
      const objectPath = `spots/${p.spot_id}/${hash}.${kind.ext}`;
      await deps.upload(bytes, objectPath, kind.type);
      rows.push({ ...rest, url: deps.publicUrl(objectPath), original_url: "url" in src ? src.url : null });
    } catch (e) {
      errors.push(`${p.spot_id}: 写真 ${label} を置けなかった（${(e as Error).message}）`);
    }
  }
  return { rows, errors };
}
