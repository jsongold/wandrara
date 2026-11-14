// スクリプト用の Supabase クライアント。シークレットキーで API を呼ぶ（RLS を通らない）。
// 環境変数: NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY（.env.local に書けば pnpm のスクリプトが読む）

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY を環境変数か .env.local に設定する（シークレットキーは Supabase の Settings → API Keys）");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
