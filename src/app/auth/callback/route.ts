import { NextResponse, type NextRequest } from "next/server";
import { callbackTargets } from "../../../lib/auth/next";
import { LOCALE_COOKIE, pickLocale } from "../../../lib/i18n/locale";
import { createClient } from "../../../lib/supabase/server";

// ログインのリンク・OAuth の戻り先。成功は next（言語つき）へ、失敗は同じ言語のエラー画面へ
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const fallback = pickLocale(request.cookies.get(LOCALE_COOKIE)?.value, request.headers.get("accept-language"));
  const to = callbackTargets(searchParams.get("next"), fallback);
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${to.next}`);
  }
  return NextResponse.redirect(`${origin}${to.error}`);
}
