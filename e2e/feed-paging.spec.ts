import { expect, test, type Page } from "@playwright/test";

// フィードの分割取得（MS2b #109）：最初の 6 枚はサーバーから、続きはスクロールで /api/feed から取る。
// DB のデータ（本番または seed）に依存する。stay は 6 枚を超える dest がある前提
const cards = (page: Page) => page.locator("[data-feed] article");
const hrefs = (page: Page) => cards(page).evaluateAll((els) => els.map((el) => el.querySelector("a[href^='/ja/d/']")?.getAttribute("href") ?? ""));
const scrollFeed = (page: Page, to: "end" | number) =>
  page.locator("[data-feed]:visible").evaluate((el, t) => el.scrollTo(0, t === "end" ? el.scrollHeight : t), to);
const scrollTopOf = (page: Page) => page.locator("[data-feed]:visible").evaluate((el) => el.scrollTop);

test("最初の 6 枚と総件数・次のページへのリンクがサーバーから出る", async ({ page }) => {
  const feedCalls: string[] = [];
  page.on("request", (r) => r.url().includes("/api/feed") && feedCalls.push(r.url()));
  await page.goto("/ja");
  await expect(cards(page)).toHaveCount(6);
  expect(Number(await page.locator("[data-feed]:visible").getAttribute("data-feed-total"))).toBeGreaterThan(6);
  expect(feedCalls).toEqual([]);
  const next = page.locator("a[rel=next]:visible");
  await expect(next).toHaveAttribute("href", /^\/ja\?after=/);
  await expect(next).toHaveText("続きを見る");
});

test("検索エンジンがたどる次のページは、先頭と重ならない 6 枚を出す", async ({ page }) => {
  await page.goto("/ja");
  const firstPage = await hrefs(page);
  await page.goto((await page.locator("a[rel=next]:visible").getAttribute("href"))!);
  await expect(cards(page)).toHaveCount(6);
  const second = await hrefs(page);
  expect(second.filter((h) => firstPage.includes(h))).toEqual([]);
});

test("スクロールで続きを足し、重ならない", async ({ page }) => {
  await page.goto("/ja");
  await expect(cards(page)).toHaveCount(6);
  await scrollFeed(page, "end");
  await expect(cards(page)).toHaveCount(12);
  const all = await hrefs(page);
  expect(new Set(all).size).toBe(12);
});

test("条件（mode）を変えたら、進行中の続きの応答は反映しない", async ({ page }) => {
  let held: (() => Promise<void>) | null = null;
  await page.route("**/api/feed*", (route) => {
    held = () => route.continue();
  });
  await page.goto("/ja");
  await expect(cards(page)).toHaveCount(6);
  const stayFirst = await hrefs(page);
  await scrollFeed(page, "end");
  await expect.poll(() => held).not.toBeNull(); // stay の続きが止まっている
  await page.getByRole("button", { name: /から探す/ }).first().click();
  await expect(page).toHaveURL(/mode=do/);
  await expect(page.locator("[data-feed]:visible")).toHaveAttribute("data-feed-algorithm", /.+/);
  await expect(cards(page)).toHaveCount(6);
  const doFirst = await hrefs(page);
  expect(doFirst).not.toEqual(stayFirst);
  await held!(); // 古い応答を今返す
  await page.waitForTimeout(800);
  expect(await hrefs(page)).toEqual(doFirst);
  await expect(cards(page)).toHaveCount(6);
});

test("取得が失敗したら自動で再試行し、尽きたら押して取り直せる", async ({ page }) => {
  let calls = 0;
  let failing = true;
  await page.route("**/api/feed*", (route) => {
    calls++;
    return failing ? route.fulfill({ status: 502, body: "{}" }) : route.continue();
  });
  await page.goto("/ja");
  await expect(cards(page)).toHaveCount(6);
  await scrollFeed(page, "end");
  const next = page.locator("a[rel=next]:visible");
  await expect(next).toHaveText(/もう一度/, { timeout: 10_000 });
  expect(calls).toBe(3); // 1 回 + 再試行 2 回で止まる
  failing = false;
  await next.click();
  await expect(cards(page)).toHaveCount(12);
});

test("詳細を開いて戻っても、読み込んだ分とスクロール位置が残る", async ({ page }) => {
  await page.goto("/ja");
  await expect(cards(page)).toHaveCount(6);
  await scrollFeed(page, "end");
  await expect(cards(page)).toHaveCount(12);
  // 2 枚目の途中から、画面にまるごと見えているリンクを 1 本探す。同じ dest のタイルは複数のカードに出るので、
  // href ではなく見えているその 1 本に印を付けて押す（href で探すと画面の外の別のカードを押して、勝手にスクロールする）
  await scrollFeed(page, 3000);
  let marked = false;
  for (let y = 3000; y < 6000 && !marked; y += 250) {
    await scrollFeed(page, y);
    marked = await page.evaluate(() => {
      const feed = document.querySelector("[data-feed]")!;
      const box = feed.getBoundingClientRect();
      const a = [...feed.querySelectorAll<HTMLAnchorElement>("article a[href^='/ja/d/']")].find((el) => {
        const r = el.getBoundingClientRect();
        return r.top > box.top + 60 && r.bottom < box.bottom - 20 && r.height > 100 && r.left >= 0 && r.right <= window.innerWidth;
      });
      a?.setAttribute("data-e2e-target", "");
      return !!a;
    });
  }
  const before = await scrollTopOf(page);
  expect(marked).toBe(true);
  await page.locator("[data-e2e-target]").click();
  await expect(page.getByRole("dialog", { name: "スポットの詳細" }).getByRole("heading", { level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "スポットの詳細" })).toBeHidden();
  await expect(cards(page)).toHaveCount(12);
  expect(Math.abs((await scrollTopOf(page)) - before)).toBeLessThan(4);
});
