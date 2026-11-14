import { defineConfig, devices } from "@playwright/test";

// e2e は本番ビルドを next start で立てて確かめる（BASE_URL を渡せば既存のサーバーに向ける）
const port = 3124;
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${port}`,
    ...devices["iPhone 13"],
    browserName: "chromium",
    // 保護されたプレビューに向けるとき：vercel env run -- で VERCEL_OIDC_TOKEN を渡す
    extraHTTPHeaders: process.env.BASE_URL && process.env.VERCEL_OIDC_TOKEN
      ? { "x-vercel-trusted-oidc-idp-token": process.env.VERCEL_OIDC_TOKEN }
      : undefined,
  },
  webServer: process.env.BASE_URL
    ? undefined
    : { command: `pnpm build && pnpm start --port ${port}`, url: `http://localhost:${port}`, timeout: 180_000, reuseExistingServer: false },
});
