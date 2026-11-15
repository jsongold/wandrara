// API キーの認証。キーの User がどれかの運営者に所属していることも確かめる
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "../supabase/admin.ts";
import { hashApiKey, parseBearer } from "./keys.ts";

export type CollectorAuth =
  | { ok: true; principal: { keyId: string; userId: string } }
  | { ok: false; status: 401 | 403; error: string };

export async function authenticateCollector(
  req: Request,
  db: SupabaseClient = adminClient(),
): Promise<CollectorAuth> {
  const key = parseBearer(req.headers.get("authorization"));
  if (!key) return { ok: false, status: 401, error: "API キーが無い" };

  const { data: row } = await db
    .from("collector_keys")
    .select("id, user_id")
    .eq("key_hash", hashApiKey(key))
    .is("revoked_at", null)
    .maybeSingle();
  if (!row) return { ok: false, status: 401, error: "API キーが違う、または取り消されている" };

  const { data: memberships } = await db
    .from("operator_memberships")
    .select("operator_id")
    .eq("user_id", row.user_id)
    .limit(1);
  if (!memberships || memberships.length === 0) {
    return { ok: false, status: 403, error: "このキーの User はどの運営者にも所属していない" };
  }

  // 失敗しても通す
  try {
    await db.from("collector_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  } catch {}

  return { ok: true, principal: { keyId: row.id, userId: row.user_id } };
}
