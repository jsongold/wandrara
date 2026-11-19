import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// 通信量を抑える（Save-Data。MS4 #105）：先読み・写真の 2 枚目・地図の自動読み込みを止める。通常の利用者は今のまま。
// Save-Data は、リクエストヘッダ Save-Data: on と navigator.connection.saveData の両方で再現する（scripts/perf/measure.ts と同じ。
// Chromium は実機のデータセーバー設定を自動化できない）。DB のデータ（本番または seed）に依存する。

// 地図のある詳細：トップの最初のカードの詳細（宿は座標を持つ）
async function detailPath(page: Page): Promise<string> {
  await page.goto("/ja");
  const href = await page.locator("[data-feed] article").first().locator("a[href^='/ja/d/']").first().getAttribute("href");
  return href!;
}

const forceConnectionSaveData = (page: Page) =>
  page.addInitScript(() => {
    try {
      Object.defineProperty(Object.getPrototypeOf((navigator as unknown as { connection: object }).connection), "saveData", { get: () => true });
    } catch {} // WebKit は navigator.connection を持たない（その場合は、ヘッダ・cookie が効く）
  });

// /d/ の先読み（RSC の取得）
const isDetailPrefetch = (url: string, headers: Record<string, string>) =>
  /\/d\//.test(new URL(url).pathname) && (!!headers["next-router-prefetch"] || !!headers["next-router-segment-prefetch"] || headers["rsc"] === "1");

async function settle(page: Page, path = "/ja") {
  await page.goto(path);
  await expect(page.locator("[data-feed] article").first()).toBeVisible();
  await page.waitForTimeout(2500); // 先読みが走る時間
}

const firstCardPhotoCount = (page: Page) => page.locator("[data-feed] article").first().locator("img[data-index]").count();

test.describe("Save-Data あり（ヘッダ + connection）", () => {
  test.use({ extraHTTPHeaders: { "Save-Data": "on" } });
  test.beforeEach(async ({ page }) => forceConnectionSaveData(page));

  test("詳細の先読みをしない・写真は 1 枚目だけ", async ({ page }) => {
    const prefetches: string[] = [];
    page.on("request", (r) => isDetailPrefetch(r.url(), r.headers()) && prefetches.push(r.url()));
    await settle(page);
    expect(prefetches).toEqual([]);
    expect(await firstCardPhotoCount(page)).toBe(1);
  });

  test("先読みをしなくても、カードを押せば詳細が開く", async ({ page }) => {
    await settle(page);
    await page.locator("[data-feed] article").first().locator("a[href^='/ja/d/']").first().click();
    await expect(page.getByRole("dialog", { name: "スポットの詳細" }).getByRole("heading", { level: 1 })).toBeVisible();
  });

  // 詳細ページ（サーバーが Save-Data を知らない静的なページ）はクライアントの値で決める。WebKit は connection を持たないので cookie で選ぶ
  const withCookieOnWebkit = async (context: BrowserContext, browserName: string, baseURL: string | undefined) => {
    if (browserName === "webkit") await context.addCookies([{ name: "savedata", value: "1", url: baseURL! }]);
  };

  test("地図は押すまで読まない。押すと出る", async ({ page, context, browserName, baseURL }) => {
    await withCookieOnWebkit(context, browserName, baseURL);
    const mapRequests: string[] = [];
    page.on("request", (r) => /openfreemap\.org/.test(r.url()) && mapRequests.push(r.url()));
    await page.goto(await detailPath(page));
    const load = page.getByTestId("map-load");
    await load.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    expect(mapRequests).toEqual([]);
    await load.click();
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
    expect(mapRequests.length).toBeGreaterThan(0);
  });

  test("地図の読み込みに失敗したら、局所のエラーと「もう一度」が出る（読み込みの上限を超えても画面は残る）", async ({ page, context, browserName, baseURL }) => {
    await withCookieOnWebkit(context, browserName, baseURL);
    let failing = true;
    await page.route(/tiles\.openfreemap\.org\/styles/, (route) => (failing ? route.abort() : route.continue()));
    await page.goto(await detailPath(page));
    await page.getByTestId("map-load").click();
    await expect(page.getByText("地図を読み込めませんでした")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    failing = false;
    await page.getByRole("button", { name: "もう一度読み込む" }).click();
    await expect(page.locator(".maplibregl-canvas")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("Save-Data あり（connection だけ。ヘッダが無いブラウザ）", () => {
  test.beforeEach(async ({ page }) => forceConnectionSaveData(page));
  test("水和のあとに詳細の先読みをしない・写真は 1 枚目だけ", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "WebKit は navigator.connection を持たない");
    const prefetches: string[] = [];
    page.on("request", (r) => isDetailPrefetch(r.url(), r.headers()) && prefetches.push(r.url()));
    await settle(page);
    expect(prefetches).toEqual([]);
    expect(await firstCardPhotoCount(page)).toBe(1);
  });
});

test.describe("Save-Data に対応しないブラウザ（cookie で選ぶ）", () => {
  test("スイッチを押すと cookie に残り、先読みと写真の先読みが止まる", async ({ page, context }) => {
    await page.goto("/ja/login");
    const sw = page.getByTestId("save-data-switch").first();
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await Promise.all([page.waitForEvent("load"), sw.click()]);
    expect((await context.cookies()).some((c) => c.name === "savedata" && c.value === "1")).toBe(true);
    await expect(page.getByTestId("save-data-switch").first()).toHaveAttribute("aria-checked", "true");
    const prefetches: string[] = [];
    page.on("request", (r) => isDetailPrefetch(r.url(), r.headers()) && prefetches.push(r.url()));
    await settle(page);
    expect(prefetches).toEqual([]);
    expect(await firstCardPhotoCount(page)).toBe(1);
  });
});

// サーバーが Save-Data を知らない静的な詳細ページ：水和の前にブラウザが前後 1 枚を取ってしまわないよう、サーバーの HTML には 1 枚目だけを入れる
test("詳細のサーバー描画（HTML）には 1 枚目の写真だけ入る", async ({ page, request }) => {
  const html = await (await request.get(await detailPath(page))).text();
  expect(html).toContain('data-index="0"');
  expect(html).not.toContain('data-index="1"');
});

test.describe("Save-Data なし（通常の利用者は変わらない）", () => {
  test("詳細を先読みし、写真は前後 1 枚まで先に持つ", async ({ page, browserName }) => {
    const prefetches: string[] = [];
    page.on("request", (r) => isDetailPrefetch(r.url(), r.headers()) && prefetches.push(r.url()));
    await settle(page);
    expect(prefetches.length).toBeGreaterThan(0);
    expect(await firstCardPhotoCount(page)).toBe(2);
    expect(browserName).toBeTruthy();
  });

  test("地図の「読み込む」ボタンは出ない", async ({ page }) => {
    await page.goto(await detailPath(page));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("map-load")).toHaveCount(0);
  });
});
