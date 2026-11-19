// 表示の速さと通信量を測る（docs/perf/README.md の MS0）。
// 使い方: pnpm perf
//   PERF_BASE_URL を渡すとそのサーバーを測る。無ければ pnpm build → next start --port $PERF_PORT（既定 3127）で立てる。
//   PERF_SKIP_BUILD=1 で build を省く。PERF_RUNS（既定 3）、PERF_OUT（既定 perf-out/result.json）。

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium, type CDPSession, type Page } from "@playwright/test";

const LANG_PATH = "/ja";
const RUNS = Number(process.env.PERF_RUNS ?? 3);
const OUT = process.env.PERF_OUT ?? "perf-out/result.json";
const PORT = Number(process.env.PERF_PORT ?? 3127);
const SCROLL_CARDS = 10;

// 回線：Lighthouse の Slow 4G 相当（下り 1.6Mbps・上り 750Kbps・RTT 150ms）
const PROFILES = {
  none: null,
  slow4g: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
} as const;
type ProfileName = keyof typeof PROFILES;

const TYPES = ["document", "rsc", "script", "image", "font", "other"] as const;
type Kind = (typeof TYPES)[number];
type Bucket = { bytes: number; requests: number; prefetch: number; byType: Record<Kind, number> };
type Nav = { ttfb: number; docMs: number; lcp: number | null };
type Run = { first: Bucket & Nav; scroll: Bucket; detail: Bucket; repeat: Bucket & Nav };

const emptyBucket = (): Bucket => ({ bytes: 0, requests: 0, prefetch: 0, byType: { document: 0, rsc: 0, script: 0, image: 0, font: 0, other: 0 } });

function classify(type: string, url: string, headers: Record<string, string>): Kind {
  if (type === "Document") return "document";
  if (type === "Script") return "script";
  if (type === "Image") return "image";
  if (type === "Font") return "font";
  if (headers["rsc"] || url.includes("_rsc=")) return "rsc";
  return "other";
}

// CDP でリクエストを集める。フェーズ（first / scroll / ...）ごとに、リクエストを出した時点のフェーズへ数える
function track(cdp: CDPSession) {
  const buckets = new Map<string, Bucket>();
  const inflight = new Set<string>();
  const meta = new Map<string, { phase: string; kind: Kind }>();
  let phase = "";
  let lastActivity = Date.now();

  cdp.on("Network.requestWillBeSent", (e) => {
    if (e.request.url.startsWith("data:")) return;
    const headers = Object.fromEntries(Object.entries(e.request.headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
    const b = buckets.get(phase) ?? emptyBucket();
    buckets.set(phase, b);
    b.requests++;
    if (headers["next-router-prefetch"] || headers["next-router-segment-prefetch"]) b.prefetch++;
    meta.set(e.requestId, { phase, kind: classify(e.type ?? "Other", e.request.url, headers) });
    inflight.add(e.requestId);
    lastActivity = Date.now();
  });
  const done = (id: string, bytes: number) => {
    inflight.delete(id);
    lastActivity = Date.now();
    const m = meta.get(id);
    const b = m && buckets.get(m.phase);
    if (!m || !b) return;
    b.bytes += bytes;
    b.byType[m.kind] += bytes;
  };
  cdp.on("Network.loadingFinished", (e) => done(e.requestId, e.encodedDataLength));
  cdp.on("Network.loadingFailed", (e) => done(e.requestId, 0));

  return {
    start(name: string) {
      phase = name;
      buckets.set(name, buckets.get(name) ?? emptyBucket());
    },
    get: (name: string) => buckets.get(name) ?? emptyBucket(),
    // リクエストが 1 秒出ず、実行中も無くなるまで待つ
    async idle(timeout = 60_000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        if (inflight.size === 0 && Date.now() - lastActivity > 1000) return;
        await new Promise((r) => setTimeout(r, 200));
      }
      throw new Error(`network idle timeout (${phase}, inflight ${inflight.size})`);
    },
  };
}

async function navTiming(page: Page): Promise<Nav> {
  return page.evaluate(async () => {
    const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const lcp = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 2000);
      const po = new PerformanceObserver((list) => {
        const es = list.getEntries();
        clearTimeout(timer);
        po.disconnect();
        resolve(es[es.length - 1].startTime);
      });
      po.observe({ type: "largest-contentful-paint", buffered: true });
    });
    return { ttfb: n.responseStart - n.requestStart, docMs: n.responseEnd - n.requestStart, lcp };
  });
}

async function throttle(cdp: CDPSession, profile: ProfileName) {
  const p = PROFILES[profile];
  await cdp.send("Network.enable");
  if (p) await cdp.send("Network.emulateNetworkConditions", { offline: false, ...p });
}

async function runOnce(baseUrl: string, profile: ProfileName): Promise<Run> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

    // 1. 初回表示
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await throttle(cdp, profile);
    const t = track(cdp);
    t.start("first");
    await page.goto(baseUrl + LANG_PATH, { waitUntil: "load", timeout: 120_000 });
    await page.locator("[data-feed] article").first().waitFor({ timeout: 60_000 });
    await t.idle();
    const firstNav = await navTiming(page);

    // 2. フィードを 10 枚ぶんスクロール（1 枚ずつ先頭へ。出ているカードが足りなければ最後まで）
    t.start("scroll");
    for (let i = 1; i <= SCROLL_CARDS; i++) {
      await page.evaluate((n) => {
        const cards = document.querySelectorAll("[data-feed] article");
        cards[Math.min(n, cards.length - 1)]?.scrollIntoView({ block: "start" });
      }, i);
      await page.waitForTimeout(500);
    }
    await t.idle();

    // 3. 詳細を 1 件開く（画面の先頭にあるカードの最初のリンク）
    t.start("detail");
    const href = await page.evaluate(() => {
      const feed = document.querySelector("[data-feed]")!;
      const top = feed.getBoundingClientRect().top;
      const card = [...feed.querySelectorAll("article")].find((a) => a.getBoundingClientRect().bottom > top + 100);
      return card?.querySelector("a")?.getAttribute("href") ?? null;
    });
    if (!href) throw new Error("detail link not found");
    await page.locator(`[data-feed] a[href="${href}"]`).first().click();
    await page.getByRole("dialog").getByRole("heading", { level: 1 }).waitFor({ timeout: 60_000 });
    await t.idle();

    // 4. 2 回目の訪問（同じ context なので HTTP キャッシュあり）
    const page2 = await context.newPage();
    const cdp2 = await context.newCDPSession(page2);
    await throttle(cdp2, profile);
    const t2 = track(cdp2);
    t2.start("repeat");
    await page2.goto(baseUrl + LANG_PATH, { waitUntil: "load", timeout: 120_000 });
    await page2.locator("[data-feed] article").first().waitFor({ timeout: 60_000 });
    await t2.idle();
    const repeatNav = await navTiming(page2);

    return {
      first: { ...t.get("first"), ...firstNav },
      scroll: t.get("scroll"),
      detail: t.get("detail"),
      repeat: { ...t2.get("repeat"), ...repeatNav },
    };
  } finally {
    await browser.close();
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length === 0 ? NaN : s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const medBucket = (bs: Bucket[]): Bucket => ({
  bytes: median(bs.map((b) => b.bytes)),
  requests: median(bs.map((b) => b.requests)),
  prefetch: median(bs.map((b) => b.prefetch)),
  byType: Object.fromEntries(TYPES.map((k) => [k, median(bs.map((b) => b.byType[k]))])) as Record<Kind, number>,
});
const medNav = (ns: Nav[]): Nav => ({
  ttfb: median(ns.map((n) => n.ttfb)),
  docMs: median(ns.map((n) => n.docMs)),
  lcp: median(ns.flatMap((n) => (n.lcp === null ? [] : [n.lcp]))),
});
const summarize = (runs: Run[]) => ({
  first: { ...medBucket(runs.map((r) => r.first)), ...medNav(runs.map((r) => r.first)) },
  scroll: medBucket(runs.map((r) => r.scroll)),
  detail: medBucket(runs.map((r) => r.detail)),
  repeat: { ...medBucket(runs.map((r) => r.repeat)), ...medNav(runs.map((r) => r.repeat)) },
});

const kb = (n: number) => (n / 1024).toFixed(1);
const ms = (n: number) => (Number.isNaN(n) ? "-" : String(Math.round(n)));

function table(results: Record<string, ReturnType<typeof summarize>>): string {
  const head = "| profile | phase | total KB | requests | prefetch | document | rsc | script | image | font | other | TTFB ms | doc ms | LCP ms |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|";
  const rows: string[] = [];
  for (const [profile, s] of Object.entries(results)) {
    for (const phase of ["first", "scroll", "detail", "repeat"] as const) {
      const b = s[phase];
      const n = phase === "first" || phase === "repeat" ? (b as Bucket & Nav) : null;
      rows.push(
        `| ${profile} | ${phase} | ${kb(b.bytes)} | ${b.requests} | ${b.prefetch} | ${TYPES.map((k) => kb(b.byType[k])).join(" | ")} | ${n ? ms(n.ttfb) : "-"} | ${n ? ms(n.docMs) : "-"} | ${n ? ms(n.lcp ?? NaN) : "-"} |`,
      );
    }
  }
  return `${head}\n${rows.join("\n")}`;
}

async function waitForServer(url: string, timeout = 120_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try {
      if ((await fetch(url, { redirect: "manual" })).status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server not ready: ${url}`);
}

async function main() {
  let server: ChildProcess | null = null;
  let baseUrl = process.env.PERF_BASE_URL;
  if (!baseUrl) {
    if (process.env.PERF_SKIP_BUILD !== "1") {
      const b = spawnSync("pnpm", ["build"], { stdio: "inherit" });
      if (b.status !== 0) throw new Error("pnpm build failed");
    }
    baseUrl = `http://localhost:${PORT}`;
    server = spawn("./node_modules/.bin/next", ["start", "--port", String(PORT)], { stdio: "inherit" });
    await waitForServer(baseUrl + LANG_PATH);
  }

  try {
    const all: Record<string, Run[]> = {};
    for (const profile of Object.keys(PROFILES) as ProfileName[]) {
      all[profile] = [];
      for (let i = 0; i < RUNS; i++) {
        console.error(`[perf] ${profile} run ${i + 1}/${RUNS}`);
        all[profile].push(await runOnce(baseUrl, profile));
      }
    }
    const median_ = Object.fromEntries(Object.entries(all).map(([p, runs]) => [p, summarize(runs)]));
    const result = { measuredAt: new Date().toISOString(), baseUrl, runs: RUNS, viewport: "390x844 DPR2 Chromium", scrollCards: SCROLL_CARDS, median: median_, all };
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log(`\n${table(median_)}\n\n(median of ${RUNS} runs, bytes are transferred sizes. JSON: ${OUT})`);
  } finally {
    server?.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
