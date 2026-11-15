// API キーの生成・ハッシュ・Authorization ヘッダーの解釈（純関数）
import { createHash, randomBytes } from "node:crypto";

export const KEY_PREFIX = "wdr_";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { key: string; hash: string } {
  const key = KEY_PREFIX + randomBytes(32).toString("base64url");
  return { key, hash: hashApiKey(key) };
}

export function parseBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer (wdr_\S+)$/.exec(header.trim());
  return m ? m[1] : null;
}
