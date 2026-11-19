// 保存（お気に入り）の読み書き。表 user_saves は RLS で自分の行だけ見え、書ける。
// client は引数で受ける（ブラウザの client を渡す。テストでは fake を渡す）
import type { SupabaseClient } from "@supabase/supabase-js";
import { selectAll } from "./supabase/select-all";

/** 自分が保存した dest_id を全部読む（1000 件を超えてもページを送って読み切る）。エラーは throw */
export async function listSavedIds(client: SupabaseClient): Promise<Set<string>> {
  const rows = await selectAll<{ dest_id: string }>(client, "user_saves", "dest_id", ["dest_id"]);
  return new Set(rows.map((r) => r.dest_id));
}

/** 保存する（on=true）・外す（on=false）。既に保存済みなら成功扱い */
export async function setSaved(
  client: SupabaseClient,
  userId: string,
  destId: string,
  on: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (on) {
    const { error } = await client.from("user_saves").insert({ user_id: userId, dest_id: destId });
    // 23505：主キー (user_id, dest_id) の重複。既に保存済み
    if (error && error.code !== "23505") return { ok: false, error: error.message };
    return { ok: true };
  }
  const { error } = await client.from("user_saves").delete().eq("user_id", userId).eq("dest_id", destId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
