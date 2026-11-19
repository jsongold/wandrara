// 公開状態・中身が変わった dest のキャッシュを捨てる。Route Handler から呼ぶ（updateTag は Server Action 専用）。
// { expire: 0 }：古い内容を一切出さず、次のリクエストが取り直す。非公開にしたものを stale で出さないため。
// 失敗しても書き込みは済んでいるので投げない（応答を 500 にすると再試行で二重に見える）。残るのは cacheLife の寿命まで
import { revalidateTag } from "next/cache";
import { CATALOG_TAG, destTag } from "./cache-tags";

export function invalidateDests(slugs: Iterable<string>): void {
  const unique = [...new Set(slugs)];
  if (unique.length === 0) return;
  try {
    revalidateTag(CATALOG_TAG, { expire: 0 });
    for (const slug of unique) revalidateTag(destTag(slug), { expire: 0 });
  } catch (e) {
    console.error("キャッシュの無効化に失敗した（寿命が来るまで古い内容が残る）", e);
  }
}
