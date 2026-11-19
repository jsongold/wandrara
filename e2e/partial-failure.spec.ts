import { expect, test, type Page } from "@playwright/test";

// 部分的な失敗（MS4 #105）：続きのページ・エリア選択のデータが取れなくても、フィードは表示を続ける。
// 失敗はその場の表示にとどめ、上限つきで自動に再試行し、尽きたら押して取り直せる。
// DB のデータ（本番または seed）に依存する。stay は 6 枚を超える dest がある前提
const cards = (page: Page) => page.locator("[data-feed] article");
const scrollFeedEnd = (page: Page) => page.locator("[data-feed]:visible").evaluate((el) => el.scrollTo(0, el.scrollHeight));
const scrollEndUntil = (page: Page, done: () => Promise<boolean>) =>
  expect.poll(async () => { await scrollFeedEnd(page); return done(); }, { timeout: 15_000 }).toBe(true);

test("/api/feed が失敗しても、出ている 6 枚はそのまま。再試行の上限で止まり、押すと続きが出る", async ({ page }) => {
  let calls = 0;
  let failing = true;
  await page.route("**/api/feed*", (route) => {
    calls++;
    return failing ? route.fulfill({ status: 500, body: "{}" }) : route.continue();
  });
  await page.goto("/ja");
  await expect(cards(page)).toHaveCount(6);
  const next = page.locator("a[rel=next]:visible");
  await scrollEndUntil(page, async () => /もう一度/.test((await next.textContent()) ?? ""));
  expect(calls).toBe(3);
  await expect(cards(page)).toHaveCount(6); // 失敗しても出ているものは消えない
  // 画面の他の操作も生きている（カテゴリの切り替えはサーバーの描画で、/api/feed を使わない）
  await page.locator("nav button[aria-pressed=false]").first().click();
  await expect(page).toHaveURL(/cat=/);
  await expect(cards(page).first()).toBeVisible();
  failing = false;
  await page.goto("/ja");
  await expect(cards(page)).toHaveCount(6);
  await scrollEndUntil(page, async () => (await cards(page).count()) >= 12);
});

test("/api/feed が通信断でも、フィードは出たまま。復帰して押すと続きが出る", async ({ page }) => {
  let down = true;
  await page.route("**/api/feed*", (route) => (down ? route.abort("connectionfailed") : route.continue()));
  await page.goto("/ja");
  await expect(cards(page)).toHaveCount(6);
  const next = page.locator("a[rel=next]:visible");
  await scrollEndUntil(page, async () => /もう一度/.test((await next.textContent()) ?? ""));
  await expect(cards(page)).toHaveCount(6);
  down = false;
  await next.click();
  await expect.poll(() => cards(page).count()).toBeGreaterThanOrEqual(12);
});

test("/api/area-sheet が失敗しても、フィードは出たまま。シートは局所のエラーを出し、押すと一覧が出る", async ({ page }) => {
  let calls = 0;
  let failing = true;
  await page.route("**/api/area-sheet*", (route) => {
    calls++;
    return failing ? route.fulfill({ status: 503, body: "{}" }) : route.continue();
  });
  await page.goto("/ja");
  await expect(cards(page)).toHaveCount(6);
  await page.getByRole("button", { name: /エリアを選ぶ/ }).click();
  const sheet = page.getByRole("dialog", { name: "エリアを選ぶ" });
  const retry = sheet.getByRole("button", { name: "読み込めませんでした。もう一度" });
  await expect(retry).toBeVisible({ timeout: 10_000 });
  expect(calls).toBeGreaterThanOrEqual(3); // 1 回 + 再試行 2 回（シートを開く操作が取り直しを始めることもある）
  // 「すべてのエリア」は通信なしで使える
  await expect(sheet.getByRole("button", { name: "すべてのエリア" })).toBeVisible();
  await sheet.getByRole("button", { name: "閉じる" }).first().click();
  await expect(cards(page)).toHaveCount(6);
  failing = false;
  // 開き直すと取り直す（失敗の状態のまま放置しない）。復旧していれば、押さなくても一覧が出る
  await page.getByRole("button", { name: /エリアを選ぶ/ }).click();
  await expect(sheet.getByRole("heading", { name: "箱根" })).toBeVisible();
});
