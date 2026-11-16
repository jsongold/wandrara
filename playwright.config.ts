import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// .env.local があれば読む（e2e のテスト用ログインが Supabase の env を使う）
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// e2e は本番ビルドを next start で立てて確かめる（BASE_URL を渡せば既存のサーバーに向ける）
const port = Number(process.env.E2E_PORT ?? 3124);
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${port}`,
    // 保護されたプレビューに向けるとき：vercel env run -- で VERCEL_OIDC_TOKEN を渡す
    extraHTTPHeaders: process.env.BASE_URL && process.env.VERCEL_OIDC_TOKEN
      ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
      : undefined,
  },
  // スマホの画面を Chromium と WebKit（Safari のエンジン）の両方で確かめる
  projects: [
    { name: "chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "webkit", use: { ...devices["iPhone 13"], browserName: "webkit" } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: `pnpm build && pnpm start --port ${port}`, url: `http://localhost:${port}`, timeout: 180_000, reuseExistingServer: false },
});
