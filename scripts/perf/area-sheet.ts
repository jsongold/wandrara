// エリア選択シート・地図を開く待ちと、/ja の document・RSC の大きさを測る（MS2c #110）。
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/perf/area-sheet.ts http://localhost:3141
// 環境変数: PERF_RUNS（既定 5）。1 回 = cold の context。条件は none（制限なし）と slow4g（1.6Mbps・RTT 150ms・CPU 4x）。
// 測るもの：
//   doc.*     /ja の document の転送（brotli 等の encoded）・展開後・その中の初期 RSC
//   list.*    エリアのボタンを押してから、シートに地域の一覧（見出し）が出るまで（tap = 押した瞬間に離す / press = 120ms 押してから離す）
//   map.*     「地図」を押してから、地図の中のエリアのボタンが出るまで
//   sheetBytes シートを開いて地図を出すまでに増えた転送（JS・地図データ・areas の取得を含む）
import { chromium, type Browser, type Page } from "@playwright/test";

const base = (process.argv[2] ?? "http://localhost:3141").replace(/\/$/, "");
const RUNS = Number(process.env.PERF_RUNS ?? 5);
const UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const CONDITIONS = {
  none: null,
  slow4g: { latency: 150, down: (1.6 * 1024 * 1024) / 8, up: (0.75 * 1024 * 1024) / 8, cpu: 4 },
} as const;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

async function session(browser: Browser, cond: (typeof CONDITIONS)[keyof typeof CONDITIONS]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  if (cond) {
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: cond.latency, downloadThroughput: cond.down, uploadThroughput: cond.up });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: cond.cpu });
  }
  const bytes = { total: 0 };
  let doc: { id: string; encoded: number } | null = null;
  const ids = new Map<string, string>();
  cdp.on("Network.responseReceived", (e) => {
    if (e.type === "Document" && !doc) ids.set(e.requestId, "doc");
  });
  cdp.on("Network.loadingFinished", (e) => {
    bytes.total += e.encodedDataLength;
    if (ids.get(e.requestId) === "doc" && !doc) doc = { id: e.requestId, encoded: e.encodedDataLength };
  });
  return { context, page, cdp, bytes, getDoc: () => doc };
}

// 戻り値は「離した（click の）時刻」。待ちはここから測る（press は押してから 120ms 後。その間に先読みが走る）
async function openSheet(page: Page, how: "tap" | "press"): Promise<number> {
  const btn = page.getByRole("button", { name: /エリアを選ぶ/ });
  const box = (await btn.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (how === "tap") {
    const t = Date.now();
    await page.touchscreen.tap(x, y);
    return t;
  } else {
    // 押している間（touchstart/pointerdown から click まで）。指が触れてから離すまでの 120ms
    await page.mouse.move(x, y);
    await page.mouse.down();
    await sleep(120);
    const t = Date.now();
    await page.mouse.up();
    return t;
  }
}

async function oneRun(browser: Browser, cond: (typeof CONDITIONS)[keyof typeof CONDITIONS], how: "tap" | "press") {
  const s = await session(browser, cond);
  const out: Record<string, number> = {};
  await s.page.goto(`${base}/ja`, { waitUntil: "load", timeout: 120_000 });
  await s.page.waitForSelector("[data-feed] article", { timeout: 120_000 });
  await sleep(cond ? 6000 : 2500); // ハイドレーションと先読みが落ち着くまで
  const doc = s.getDoc();
  if (doc) {
    const body = await s.cdp.send("Network.getResponseBody", { requestId: doc.id }).then((b) => (b.base64Encoded ? Buffer.from(b.body, "base64").toString() : b.body), () => "");
    const rsc = [...body.matchAll(/<script>self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g)].map((m) => m[1]).join("");
    out["doc.encoded"] = doc.encoded;
    out["doc.decoded"] = Buffer.byteLength(body);
    out["doc.rsc"] = Buffer.byteLength(rsc);
  }
  const before = s.bytes.total;
  const dialog = s.page.getByRole("dialog", { name: "エリアを選ぶ" });
  const t0 = await openSheet(s.page, how);
  await dialog.locator("h3").first().waitFor({ timeout: 60_000 });
  out["list.ms"] = Date.now() - t0;
  const t1 = Date.now();
  await dialog.getByRole("button", { name: "地図", exact: true }).tap();
  await dialog.getByRole("group", { name: "エリアの地図" }).getByRole("button").first().waitFor({ timeout: 60_000 });
  out["map.ms"] = Date.now() - t1;
  await sleep(cond ? 3000 : 800);
  out["sheetBytes"] = s.bytes.total - before;
  await s.context.close();
  return out;
}

const browser = await chromium.launch();
try {
  for (const [name, cond] of Object.entries(CONDITIONS)) {
    for (const how of ["tap", "press"] as const) {
      const runs: Record<string, number>[] = [];
      for (let i = 0; i < RUNS; i++) runs.push(await oneRun(browser, cond, how));
      const keys = Object.keys(runs[0]);
      const med = Object.fromEntries(keys.map((k) => [k, Math.round(median(runs.map((r) => r[k]).filter((x) => x !== undefined)))]));
      console.log(`${name}/${how}`, JSON.stringify(med), `list.ms[${Math.min(...runs.map((r) => r["list.ms"]))}..${Math.max(...runs.map((r) => r["list.ms"]))}] map.ms[${Math.min(...runs.map((r) => r["map.ms"]))}..${Math.max(...runs.map((r) => r["map.ms"]))}]`);
    }
  }
} finally {
  await browser.close();
}
