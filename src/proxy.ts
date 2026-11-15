import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, localeOfPath, pickLocale, withLocale } from "./lib/i18n/locale";

// 言語の無い画面の URL は、選んだ言語の URL へ送る（API と認証の戻り先は除く）
function needsLocale(pathname: string): boolean {
  if (localeOfPath(pathname)) return false;
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/callback")) return false;
  return !/\.[a-z0-9]+$/i.test(pathname); // robots.txt などのファイル
}

// 言語の付け足しと、セッションの更新だけ行う。未ログインのリダイレクトはしない
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (needsLocale(pathname)) {
    const locale = pickLocale(request.cookies.get(LOCALE_COOKIE)?.value, request.headers.get("accept-language"));
    const to = request.nextUrl.clone();
    to.pathname = withLocale(locale, pathname);
    return NextResponse.redirect(to);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
