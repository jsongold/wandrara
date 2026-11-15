"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "../../lib/auth/next";
import { createClient } from "../../lib/supabase/server";

export type EmailLoginState = { error: string | null };

// メールのリンクを送る。成功したら /login/sent へ、失敗は画面に短く出す
export async function sendMagicLink(_prev: EmailLoginState, formData: FormData): Promise<EmailLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNextPath(String(formData.get("next") ?? ""));
  if (!email) return { error: "メールアドレスを入力してください" };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: "リンクを送れませんでした。時間をおいてもう一度お試しください" };
  redirect(`/login/sent?email=${encodeURIComponent(email)}`);
}
