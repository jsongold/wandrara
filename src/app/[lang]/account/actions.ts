"use server";

import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, withLocale } from "@/lib/i18n/locale";
import { createClient } from "@/lib/supabase/server";

export async function signOut(formData: FormData) {
  const raw = String(formData.get("lang") ?? "");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(withLocale(isLocale(raw) ? raw : DEFAULT_LOCALE, "/"));
}
