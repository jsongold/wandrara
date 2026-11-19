// 自分が登録した dest の公開状態を変える（API キーの principal 用）
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublishStatus = "published" | "draft";
export type PublishResult =
  | { ref: string; ok: true; slug: string; status: PublishStatus }
  | { ref: string; ok: false; error: string };

/** onWrite：書き込みを始める直前に slug を知らせる。書き込みが失敗・途中で例外でも、DB に届いたかもしれないので呼び側が無効化に使う */
export async function setStatus(
  db: SupabaseClient,
  refs: string[],
  status: PublishStatus,
  principal: { keyId: string; userId: string },
  onWrite?: (slug: string) => void,
): Promise<PublishResult[]> {
  const { data, error } = await db.from("destinations").select("dest_id, ref, slug, created_by").in("ref", refs);
  if (error) throw new Error(`destinations(ref): ${error.message}`);
  const byRef = new Map((data ?? []).map((d) => [d.ref as string, d]));

  const results: PublishResult[] = [];
  for (const ref of refs) {
    const d = byRef.get(ref);
    if (!d) {
      results.push({ ref, ok: false, error: "見つからない" });
      continue;
    }
    // created_by が null のものも変えられない
    if (d.created_by !== principal.userId) {
      results.push({ ref, ok: false, error: "別の登録者のもの" });
      continue;
    }
    const now = new Date().toISOString();
    const patch =
      status === "published"
        ? { status, published_at: now, approved_by: principal.userId, updated_at: now }
        : { status, published_at: null, approved_by: null, updated_at: now };
    onWrite?.(d.slug as string);
    const { data: rows, error: ue } = await db.from("publications").update(patch).eq("dest_id", d.dest_id).select("dest_id");
    if (ue) {
      results.push({ ref, ok: false, error: ue.message });
      continue;
    }
    if (!rows || rows.length === 0) {
      results.push({ ref, ok: false, error: "公開状態の行が無い" });
      continue;
    }
    results.push({ ref, ok: true, slug: d.slug as string, status });
  }
  return results;
}
