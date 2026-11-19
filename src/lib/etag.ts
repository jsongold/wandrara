// 本文から強い ETag を作り、If-None-Match と照合する（#143）。再訪で max-age が切れたとき、本文を取り直さず 304 で済ませる。
import { createHash } from "node:crypto";

export function etagOf(body: string): string {
  return `"${createHash("sha256").update(body).digest("base64url").slice(0, 22)}"`;
}

// If-None-Match の照合は weak 比較（RFC 9110 13.1.2）。CDN の圧縮で W/ が付いても一致させる。`*` は常に一致
export function matchesEtag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const strip = (t: string) => t.trim().replace(/^W\//, "");
  return ifNoneMatch.split(",").some((t) => strip(t) === "*" || strip(t) === strip(etag));
}
