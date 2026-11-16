// dest の中身のハッシュ。同じ ref に同じ中身が来たとき、書き込みを飛ばすのに使う
import { createHash } from "node:crypto";
import type { DestInput } from "./bundle.ts";

/** 中身の作りを変えたら上げる（古いハッシュと一致しなくなり、次の投入は書き込まれる） */
const HASH_VERSION = "v2"; // v2：位置から決めた region_id と索引の版も含める

/** 表に入らないもの（dest_imports の payload にだけ残る）。毎回変わる日時を含むのでハッシュから外す */
const NOT_STORED = new Set(["sources", "verification_status"]);

/** キーを並べ替えた JSON。配列の順は保つ（sort は配列の順で決まる） */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

/** derived：入力から決めた値（region_id・索引の版）。索引が変われば同じ入力でも書き込む */
export function contentHash(input: DestInput, derived: Record<string, unknown> = {}): string {
  const kept = Object.fromEntries(Object.entries(input).filter(([k]) => !NOT_STORED.has(k)));
  return `${HASH_VERSION}:${createHash("sha256").update(canonical({ input: kept, derived })).digest("hex")}`;
}
