"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { localizedNextPath } from "@/lib/auth/next";
import { DEFAULT_LOCALE, isLocale, withLocale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import { createClient } from "@/lib/supabase/server";

export type EmailLoginState = { error: string | null };

// メールのリンクを送る。成功したら /<lang>/login/sent へ、失敗は画面に短く出す
export async function sendMagicLink(_prev: EmailLoginState, formData: FormData): Promise<EmailLoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const rawLang = String(formData.get("lang") ?? "");
  const lang = isLocale(rawLang) ? rawLang : DEFAULT_LOCALE;
  const next = localizedNextPath(String(formData.get("next") ?? ""), lang);
  const m = messages(lang).login;
  if (!email) return { error: m.errorEmpty };

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: m.errorSend };
  redirect(withLocale(lang, `/login/sent?email=${encodeURIComponent(email)}`));
}
