// 表示の速さと通信量を測る（docs/perf/README.md の MS0、docs/perf/baseline.md に結果）。
//   pnpm perf                      ローカルで pnpm build → next start --port $PERF_PORT（既定 3127）を立てて測る
//   pnpm perf https://wandrara.vercel.app   指定の URL を測る（build しない。本番には軽く：1 条件 3 回 + 計測の補助）
// 環境変数: PERF_RUNS（既定 3）/ PERF_CONDITIONS（既定 "none,slow4g-cpu4x"）/ PERF_OUT（既定 perf-out/result.json）
//           PERF_WARMUP=0 で最初の「サーバー・画像 CDN を温める 1 回」を省く / PERF_SKIP_BUILD=1 で build を省く
// 条件: Chromium・幅 390・DPR 2・モバイル。none = 制限なし、slow4g-cpu4x = 1.6Mbps・RTT 150ms・CPU 4x。
// 1 回 = ブラウザキャッシュ空（cold）の context で 初回表示 → 10 枚スクロール → 2 回目の訪問（warm）。
//        別の cold context で詳細のタップ、さらに別の cold context で Save-Data の初回表示。

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { brotliCompressSync } from "node:zlib";
import { chromium, type Browser, type CDPSession } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PATHNAME = "/ja";
const RUNS = Number(process.env.PERF_RUNS ?? 3);
const OUT = process.env.PERF_OUT ?? "perf-out/result.json";
const PORT = Number(process.env.PERF_PORT ?? 3127);
const SCROLL_CARDS = 10;
const UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

type Condition = { name: string; net: { latency: number; down: number; up: number } | null; cpu: number };
const CONDITIONS: Record<string, Condition> = {
  none: { name: "none", net: null, cpu: 1 },
  "slow4g-cpu4x": { name: "slow4g-cpu4x", net: { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (0.75 * 1024 * 1024) / 8 }, cpu: 4 },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Req = { url: string; type: string; phase: string; headers: Record<string, string>; bytes: number; status: number; rh: Record<string, string> };
const KINDS = ["document", "rsc", "script", "image", "font", "other"] as const;
type Kind = (typeof KINDS)[number];
const lower = (h: Record<string, unknown>) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k.toLowerCase(), String(v)]));

function kindOf(r: Req): Kind {
  if (r.type === "Document") return "document";
  if (r.type === "Script") return "script";
  if (r.type === "Image") return "image";
  if (r.type === "Font") return "font";
  if (r.headers["rsc"] || r.url.includes("_rsc=")) return "rsc"; // 追加の RSC（先読み・遷移）
  return "other";
}
const isPrefetch = (r: Req) => !!(r.headers["next-router-prefetch"] || r.headers["next-router-segment-prefetch"]);
const isSupabase = (r: Req) => new URL(r.url).hostname.endsWith(".supabase.co");
// 先読みの URL：パス + セグメント先読みなら対象のセグメント（クエリの _rsc は外す）
const pathOf = (r: Req) => new URL(r.url).pathname + (r.headers["next-router-segment-prefetch"] ? `#${r.headers["next-router-segment-prefetch"]}` : "");

// ページに CDP をつないで、リクエストをフェーズごとに集める
async function open(browser: Browser, c: Condition, opts: { saveData?: boolean } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
  const page = await context.newPage();
  await page.addInitScript(() => {
    (window as unknown as { __feedAt: number | null }).__feedAt = null;
    const mo = new MutationObserver(() => {
      if (document.querySelector("[data-feed] article")) {
        (window as unknown as { __feedAt: number }).__feedAt = performance.now();
        mo.disconnect();
      }
    });
    mo.observe(document, { childList: true, subtree: true });
  });
  if (opts.saveData) {
    // Save-Data の利用者の再現：リクエストヘッダ Save-Data: on と navigator.connection.saveData = true（Chromium は実機のデータセーバー設定を自動化できないため）
    await context.setExtraHTTPHeaders({ "Save-Data": "on" });
    await page.addInitScript(() => {
      try {
        Object.defineProperty(Object.getPrototypeOf((navigator as unknown as { connection: object }).connection), "saveData", { get: () => true });
      } catch {}
    });
  }
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  if (c.net) await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: c.net.latency, downloadThroughput: c.net.down, uploadThroughput: c.net.up });
  if (c.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: c.cpu });

  const reqs = new Map<string, Req>();
  const t = { phase: "load" };
  cdp.on("Network.requestWillBeSent", (e) => {
    if (e.request.url.startsWith("data:")) return;
    reqs.set(e.requestId, { url: e.request.url, type: e.type ?? "Other", phase: t.phase, headers: lower(e.request.headers), bytes: 0, status: 0, rh: {} });
  });
  cdp.on("Network.responseReceived", (e) => {
    const r = reqs.get(e.requestId);
    if (r) Object.assign(r, { status: e.response.status, rh: lower(e.response.headers) });
  });
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.bytes = e.encodedDataLength;
  });
  return { context, page, cdp, reqs, setPhase: (p: string) => (t.phase = p) };
}

type Flat = Record<string, number>;
function summarizePhase(prefix: string, reqs: Map<string, Req>, phase: string, out: Flat) {
  const rs = [...reqs.values()].filter((r) => r.phase === phase);
  out[`${prefix}.bytes`] = rs.reduce((a, r) => a + r.bytes, 0);
  out[`${prefix}.reqs`] = rs.length;
  for (const k of KINDS) out[`${prefix}.b.${k}`] = rs.filter((r) => kindOf(r) === k).reduce((a, r) => a + r.bytes, 0);
  const pf = rs.filter(isPrefetch);
  out[`${prefix}.prefetch`] = pf.length;
  out[`${prefix}.prefetchUnique`] = new Set(pf.map(pathOf)).size;
  out[`${prefix}.supabaseReqs`] = rs.filter(isSupabase).length;
  return pf;
}

async function navTiming(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const lcp = await new Promise<number | null>((res) => {
      let last: number | null = null;
      const po = new PerformanceObserver((l) => {
        for (const e of l.getEntries()) last = e.startTime;
      });
      po.observe({ type: "largest-contentful-paint", buffered: true });
      setTimeout(() => (po.disconnect(), res(last)), 200);
    });
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    return { ttfb: n.responseStart, fcp: fcp?.startTime ?? NaN, lcp: lcp ?? NaN, feed: (window as unknown as { __feedAt: number | null }).__feedAt ?? NaN };
  });
}

type Meta = { xcache?: string; vercelId?: string; cards?: number; scrolledTo?: number; tapHref?: string; prefetchTop?: Record<string, number> };
async function oneRun(base: string, c: Condition, browser: Browser): Promise<{ flat: Flat; meta: Meta }> {
  const flat: Flat = {};
  const meta: Meta = {};
  const slow = c.net !== null;

  // 1. 初回表示（cold）→ 2. 10 枚スクロール → 3. 2 回目の訪問（warm）
  {
    const s = await open(browser, c);
    await s.page.goto(base + PATHNAME, { waitUntil: "load", timeout: 120_000 });
    await s.page.waitForSelector("[data-feed] article", { timeout: 120_000 });
    await sleep(slow ? 6000 : 3500);
    const nav = await navTiming(s.page);
    Object.assign(flat, { "cold.ttfb": nav.ttfb, "cold.fcp": nav.fcp, "cold.feed": nav.feed, "cold.lcp": nav.lcp });
    const doc = [...s.reqs.values()].find((r) => r.type === "Document" && r.phase === "load");
    if (doc) {
      meta.xcache = doc.rh["x-vercel-cache"];
      meta.vercelId = doc.rh["x-vercel-id"];
      // document に入っている初期 RSC の大きさ（転送ではなく、取り出して brotli し直した目安）
      const id = [...s.reqs.entries()].find(([, r]) => r === doc)![0];
      const body = await (s.cdp as CDPSession).send("Network.getResponseBody", { requestId: id }).then((b) => (b.base64Encoded ? Buffer.from(b.body, "base64").toString() : b.body), () => "");
      const rsc = [...body.matchAll(/<script>self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g)].map((m) => m[1]).join("");
      flat["cold.docDecoded"] = Buffer.byteLength(body);
      flat["cold.docRscDecoded"] = Buffer.byteLength(rsc);
      flat["cold.docRscBrotli"] = brotliCompressSync(Buffer.from(rsc)).length;
      meta.cards = (rsc.match(/relLabel/g) ?? []).length / 2; // カード 1 枚につき 2 回（measure3.js と同じ数え方）
    }
    summarizePhase("cold", s.reqs, "load", flat);

    s.setPhase("scroll");
    let reached = 0;
    for (let i = 1; i <= SCROLL_CARDS; i++) {
      const ok = await s.page.waitForFunction((n) => document.querySelectorAll("[data-feed] article").length > n, i, { timeout: 8000 }).then(() => true, () => false);
      if (!ok) break;
      // フィードは内側の要素がスクロールする（HomeScreen の data-feed）。i 枚目の先頭まで動かす
      await s.page.evaluate((n) => {
        const f = document.querySelector("[data-feed]")!;
        f.scrollTo({ top: (f.querySelectorAll("article")[n] as HTMLElement).offsetTop, behavior: "instant" });
      }, i);
      reached = i;
      await sleep(slow ? 1200 : 600);
    }
    await sleep(slow ? 8000 : 3500);
    meta.scrolledTo = reached;
    flat["scroll.scrolledTo"] = reached;
    const pf = summarizePhase("scroll", s.reqs, "scroll", flat);
    flat["scroll.cumulativeBytes"] = flat["cold.bytes"] + flat["scroll.bytes"];
    const top: Record<string, number> = {};
    for (const r of pf) top[pathOf(r)] = (top[pathOf(r)] ?? 0) + 1;
    meta.prefetchTop = top;

    // 詳細の先読み（/d/）が初回〜スクロールで使った転送バイト
    flat["detailPrefetch.bytes"] = [...s.reqs.values()].filter((r) => isPrefetch(r) && /\/d\//.test(r.url)).reduce((a, r) => a + r.bytes, 0);

    s.setPhase("repeat");
    await s.page.evaluate(() => document.querySelector("[data-feed]")!.scrollTo(0, 0));
    await s.page.goto(base + PATHNAME, { waitUntil: "load", timeout: 120_000 });
    await s.page.waitForSelector("[data-feed] article", { timeout: 120_000 });
    await sleep(slow ? 5000 : 3000);
    const w = await navTiming(s.page);
    Object.assign(flat, { "repeat.ttfb": w.ttfb, "repeat.feed": w.feed, "repeat.lcp": w.lcp });
    summarizePhase("repeat", s.reqs, "repeat", flat);
    await s.context.close();
  }

  // 4. 詳細を開く：cold の context で 1 枚目のカードをタップ（タップから表示まで・転送バイト）
  {
    const s = await open(browser, c);
    await s.page.goto(base + PATHNAME, { waitUntil: "load", timeout: 120_000 });
    await s.page.waitForSelector("[data-feed] article", { timeout: 120_000 });
    await sleep(slow ? 9000 : 4000); // 先読みが終わるのを待つ（普通に見ているときの状態）
    const sel = '[data-feed] article:first-child a[aria-label][href^="/ja/d/"]';
    const href = await s.page.locator(sel).first().getAttribute("href");
    const box = (await s.page.locator(sel).first().boundingBox())!;
    meta.tapHref = href ?? undefined;
    flat["tap.prefetched"] = [...s.reqs.values()].some((r) => isPrefetch(r) && href && pathOf(r).startsWith(href)) ? 1 : 0;
    s.setPhase("tap");
    const t0 = Date.now();
    await s.page.touchscreen.tap(Math.min(box.x + box.width / 2, 380), box.y + Math.min(box.height / 2, 200));
    // 開かなかったら黙って欠けさせず失敗にする（回帰が改善に見えないように）
    await s.page.waitForSelector("[role=dialog]", { timeout: 30_000 });
    flat["tap.sheetMs"] = Date.now() - t0;
    await s.page.waitForSelector("[role=dialog] h1", { timeout: 30_000 });
    flat["tap.h1Ms"] = Date.now() - t0;
    await sleep(slow ? 4000 : 1500);
    summarizePhase("tap", s.reqs, "tap", flat);
    await s.context.close();
  }

  // 5. Save-Data の初回表示（cold）
  {
    const s = await open(browser, c, { saveData: true });
    await s.page.goto(base + PATHNAME, { waitUntil: "load", timeout: 120_000 });
    await s.page.waitForSelector("[data-feed] article", { timeout: 120_000 });
    await sleep(slow ? 6000 : 3500);
    const nav = await navTiming(s.page);
    Object.assign(flat, { "saveData.feed": nav.feed, "saveData.lcp": nav.lcp });
    summarizePhase("saveData", s.reqs, "load", flat);
    await s.context.close();
  }
  return { flat, meta };
}

const median = (xs: number[]) => {
  const s = xs.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
  if (s.length === 0) return NaN;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
function aggregate(runs: Flat[]) {
  const keys = [...new Set(runs.flatMap((r) => Object.keys(r)))];
  return Object.fromEntries(
    keys.map((k) => {
      const xs = runs.map((r) => r[k]).filter((x) => x !== undefined && !Number.isNaN(x));
      return [k, { median: median(xs), min: Math.min(...xs), max: Math.max(...xs), n: xs.length }];
    }),
  );
}

const kb = (n: number) => (Number.isNaN(n) ? "-" : (n / 1024).toFixed(0));
const sec = (n: number) => (Number.isNaN(n) ? "-" : (n / 1000).toFixed(2));
type Agg = ReturnType<typeof aggregate>;
function table(name: string, a: Agg): string {
  const m = (k: string) => a[k]?.median ?? NaN;
  const rng = (k: string, f: (n: number) => string) => (a[k] ? `${f(a[k].median)} [${f(a[k].min)}..${f(a[k].max)}]` : "-");
  const row = (label: string, ...cells: string[]) => `| ${label} | ${cells.join(" | ")} |`;
  return [
    `### ${name}`,
    "",
    "| 区間 | 転送 KB | リクエスト | document | 追加 RSC | JS | 画像 | フォント | その他 | prefetch（重複除く） | Supabase 宛 |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...["cold", "scroll", "repeat", "tap", "saveData"].map((p) =>
      row(
        { cold: "初回（cold）", scroll: "10 枚スクロールの追加", repeat: "2 回目（warm）", tap: "詳細を開く（タップ後）", saveData: "Save-Data の初回" }[p]!,
        rng(`${p}.bytes`, kb),
        String(m(`${p}.reqs`)),
        ...KINDS.map((k) => kb(m(`${p}.b.${k}`))),
        `${m(`${p}.prefetch`)}（${m(`${p}.prefetchUnique`)}）`,
        String(m(`${p}.supabaseReqs`)),
      ),
    ),
    "",
    `- スクロール込みの累計：${rng("scroll.cumulativeBytes", kb)} KB（${m("scroll.scrolledTo")} 枚目まで）`,
    `- 初回：TTFB ${rng("cold.ttfb", sec)}s / FCP ${sec(m("cold.fcp"))}s / 最初のカード ${rng("cold.feed", sec)}s / LCP ${rng("cold.lcp", sec)}s`,
    `- 初回の document：展開後 ${kb(m("cold.docDecoded"))}KB のうち初期 RSC ${kb(m("cold.docRscDecoded"))}KB（brotli し直し ${kb(m("cold.docRscBrotli"))}KB）`,
    `- 2 回目：TTFB ${sec(m("repeat.ttfb"))}s / 最初のカード ${sec(m("repeat.feed"))}s / LCP ${sec(m("repeat.lcp"))}s`,
    `- 詳細の先読み（初回〜スクロール中の /d/ 宛）：${kb(m("detailPrefetch.bytes"))}KB（上の初回・スクロールに含まれる）`,
    `- 詳細：タップから dialog ${rng("tap.sheetMs", sec)}s / 見出し ${rng("tap.h1Ms", sec)}s（先読み済み ${m("tap.prefetched")}）`,
    `- Save-Data：最初のカード ${sec(m("saveData.feed"))}s / LCP ${sec(m("saveData.lcp"))}s`,
  ].join("\n");
}

// 公開されているデータの件数（anon キー・RLS のとおり）
async function dataCounts(): Promise<Record<string, number> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const out: Record<string, number> = {};
  for (const t of ["dest_cards", "regions", "dest_photos"]) {
    try {
      const r = await fetch(`${url}/rest/v1/${t}?select=*`, { method: "HEAD", headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" } });
      const n = Number(r.headers.get("content-range")?.split("/")[1]);
      if (!Number.isNaN(n)) out[t] = n;
    } catch {}
  }
  return out;
}

async function waitForServer(url: string, timeout = 120_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if ((await fetch(url, { redirect: "manual" })).status < 500) return;
    } catch {}
    await sleep(500);
  }
  throw new Error(`server not ready: ${url}`);
}

async function main() {
  let server: ChildProcess | null = null;
  let base = process.argv[2] ?? process.env.PERF_BASE_URL;
  const local = !base;
  if (!base) {
    if (process.env.PERF_SKIP_BUILD !== "1") {
      const b = spawnSync("pnpm", ["build"], { stdio: "inherit" });
      if (b.status !== 0) throw new Error("pnpm build failed");
    }
    base = `http://localhost:${PORT}`;
    server = spawn("./node_modules/.bin/next", ["start", "--port", String(PORT)], { stdio: "inherit" });
    await waitForServer(base + PATHNAME);
  }
  base = base.replace(/\/$/, "");

  try {
    const names = (process.env.PERF_CONDITIONS ?? "none,slow4g-cpu4x").split(",");
    const browser = await chromium.launch();
    const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).stdout.trim();
    const result: Record<string, unknown> = { measuredAt: new Date().toISOString(), commit, base, local, runs: RUNS, viewport: "390x844 DPR2 Chromium mobile", scrollCards: SCROLL_CARDS, warmup: process.env.PERF_WARMUP !== "0", counts: await dataCounts() };
    const conditions: Record<string, { aggregate: Agg; runs: { flat: Flat; meta: Meta }[] }> = {};
    let md = "";
    if (process.env.PERF_WARMUP !== "0") {
      // サーバーと画像 CDN のキャッシュを温めるための、計測しない 1 回（cold のときは PERF_WARMUP=0）
      console.error("[perf] warm-up");
      await oneRun(base, CONDITIONS.none, browser);
    }
    for (const name of names) {
      const c = CONDITIONS[name];
      if (!c) throw new Error(`unknown condition: ${name}`);
      const runs: { flat: Flat; meta: Meta }[] = [];
      for (let i = 0; i < RUNS; i++) {
        console.error(`[perf] ${name} run ${i + 1}/${RUNS}`);
        runs.push(await oneRun(base, c, browser));
      }
      const agg = aggregate(runs.map((r) => r.flat));
      conditions[name] = { aggregate: agg, runs: runs.map((r) => ({ flat: r.flat, meta: r.meta })) };
      md += `${table(name, agg)}\n\n`;
    }
    await browser.close();
    result.conditions = conditions;
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log(`\n対象 ${base}（${local ? "ローカルの本番ビルド" : "デプロイ"}）commit ${commit}  ${RUNS} 回の中央値 [最小..最大]  データ件数 ${JSON.stringify(result.counts)}\n`);
    console.log(md + `JSON: ${OUT}`);
  } finally {
    server?.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
