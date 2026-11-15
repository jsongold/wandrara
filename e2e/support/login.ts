// e2e 用のログイン。メールを送らず、secret key の admin client で発行した magic link の token を
// @supabase/ssr で検証し、出てきたセッション cookie をブラウザに入れる。値はどこにも出さない・保存しない。
import type { BrowserContext } from "@playwright/test";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type TestUser = { id: string; email: string };

const email = () => process.env.E2E_USER_EMAIL ?? "e2e-saves@wandrara.test";

export function hasAuthEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SECRET_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

// src/lib/supabase/admin.ts と同じ作り方（アプリのコードは import しない）
function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY が要る");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// テスト用 User を探し、無ければ作る（public.users の行は trigger で作られる）
export async function ensureTestUser(): Promise<TestUser> {
  const client = admin();
  const target = email().toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers に失敗: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return { id: found.id, email: found.email ?? target };
    if (data.users.length < 1000) break;
  }
  const { data, error } = await client.auth.admin.createUser({ email: target, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser に失敗: ${error?.message}`);
  return { id: data.user.id, email: data.user.email ?? target };
}

const sameSite = (v: CookieOptions["sameSite"]): "Strict" | "Lax" | "None" | undefined => {
  if (v === "strict" || v === true) return "Strict";
  if (v === "lax") return "Lax";
  if (v === "none") return "None";
  return undefined;
};

export async function loginAs(context: BrowserContext, baseURL: string): Promise<TestUser> {
  const user = await ensureTestUser();
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (error) throw new Error(`generateLink に失敗: ${error.message}`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY が要る");
  // cookie の名前と形式は @supabase/ssr に任せる。setAll で来たものを手元の配列に溜める
  let jar: { name: string; value: string; options: CookieOptions }[] = [];
  const ssr = createServerClient(url, key, {
    cookies: {
      getAll: () => jar.map(({ name, value }) => ({ name, value })),
      setAll(list) {
        for (const c of list) jar = [...jar.filter((j) => j.name !== c.name), c];
      },
    },
  });
  const verified = await ssr.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (verified.error) throw new Error(`verifyOtp に失敗: ${verified.error.message}`);

  const base = new URL(baseURL);
  const now = Date.now() / 1000;
  const cookies = jar
    .filter((c) => c.value !== "" && c.options.maxAge !== 0)
    .map(({ name, value, options }) => ({
      name,
      value,
      domain: base.hostname,
      path: options.path ?? "/",
      expires: options.maxAge ? Math.floor(now + options.maxAge) : -1,
      httpOnly: options.httpOnly ?? false,
      secure: base.protocol === "https:",
      sameSite: sameSite(options.sameSite),
    }));
  if (cookies.length === 0) throw new Error("セッションの cookie が出てこなかった");
  await context.addCookies(cookies);
  return user;
}

// その User の保存を全部消す
export async function resetSaves(userId: string): Promise<void> {
  const { error } = await admin().from("user_saves").delete().eq("user_id", userId);
  if (error) throw new Error(`user_saves の削除に失敗: ${error.message}`);
}
