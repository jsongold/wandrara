// ログイン済みらしい cookie があるか。Supabase の JS を読み込むかどうかのヒントにだけ使う
// （cookie の中身は見ない。認証の検証はしない。本当にログイン中かは Supabase client が決める）
// 名前は @supabase/ssr の既定：sb-<project>-auth-token、長いと sb-<project>-auth-token.0, .1 … に分割される
// sb-<project>-auth-token-code-verifier（ログイン途中のもの）は含めない
const AUTH_COOKIE = /(?:^|;\s*)sb-[^=;\s]+-auth-token(?:\.\d+)?=/;

export function hasAuthCookie(cookie: string): boolean {
  return AUTH_COOKIE.test(cookie);
}
