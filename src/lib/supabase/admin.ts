// シークレットキーの Supabase クライアント（RLS を通らない）。サーバーとスクリプトの両方から使う。
// 環境変数: NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY を環境変数か .env.local に設定する");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
