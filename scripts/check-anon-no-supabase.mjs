// 未ログインで /ja を開いたとき、Supabase のブラウザ用クライアントを含む JS が読まれないことを確かめる（読まれたら exit 1）。
// 使い方: node scripts/check-anon-no-supabase.mjs mock   … 何も返さない Supabase の代わり（ポート 54399）を立てる
//         node scripts/check-anon-no-supabase.mjs check http://localhost:3199
import { createServer } from "node:http";
import { chromium } from "@playwright/test";

const [mode, base = "http://localhost:3199"] = process.argv.slice(2);

if (mode === "mock") {
  createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json", "content-range": "0-0/0" });
    res.end(String(req.headers.accept).includes("vnd.pgrst.object") ? "null" : "[]");
  }).listen(54399, () => console.log("mock supabase on :54399"));
} else if (mode === "check") {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  const prefetched = new Set();
  const hits = [];
  let scripts = 0;
  page.on("response", async (res) => {
    const url = res.url();
    if (res.request().headers()["next-router-prefetch"]) prefetched.add(url.replace(base, "").replace(/&?_rsc=[^&]*/, ""));
    if (!/\.js(\?|$)/.test(url)) return;
    scripts++;
    const body = await res.text().catch(() => "");
    if (/GoTrueClient|createBrowserClient/.test(body)) hits.push(url.replace(base, ""));
  });
  await page.goto(`${base}/ja`, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 5000));
  await browser.close();
  console.log(`js: ${scripts} files / prefetch: ${[...prefetched].join(" ") || "(none)"}`);
  console.log(hits.length ? `FAIL supabase chunk loaded: ${hits.join(", ")}` : "OK no supabase chunk loaded");
  process.exit(hits.length ? 1 : 0);
} else {
  console.error("usage: mock | check <baseUrl>");
  process.exit(2);
}
