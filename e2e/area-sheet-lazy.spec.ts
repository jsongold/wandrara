import { expect, test } from "@playwright/test";

// エリア選択シートの地域・特性は、トップの props に載せず /api/area-sheet から取る（MS2c #110）。
// DB のデータ（本番または seed）に依存する。箱根・伊豆のエリアがある前提
const openSheet = (page: import("@playwright/test").Page) => page.getByRole("button", { name: /エリアを選ぶ/ }).click();

test("初回の document に地域の一覧（エリアの親子）は入っていない", async ({ request }) => {
  const html = await (await request.get("/ja")).text();
  expect(html).not.toMatch(/\\?"subs\\?":/);
  expect(html).not.toContain("byRegion");
});

test("表示が落ち着いたら先に取り、シートを開くと一覧がすぐ出る。開き直しても取り直さない", async ({ page }) => {
  const calls: string[] = [];
  page.on("request", (r) => r.url().includes("/api/area-sheet") && calls.push(r.url()));
  const prefetched = page.waitForRequest(/\/api\/area-sheet\?lang=ja/, { timeout: 10_000 });
  await page.goto("/ja");
  await prefetched;
  await openSheet(page);
  const sheet = page.getByRole("dialog", { name: "エリアを選ぶ" });
  await expect(sheet.getByRole("heading", { name: "箱根" })).toBeVisible();
  await sheet.getByRole("button", { name: "閉じる" }).click();
  await openSheet(page);
  await expect(sheet.getByRole("heading", { name: "箱根" })).toBeVisible();
  expect(calls).toHaveLength(1);
});

// 先に取る 1 回目と、シートを開いたときの 2 回目が失敗しても、「もう一度」で取り直せる
test("取得に失敗したら「もう一度」が出て、押すと一覧が出る", async ({ page }) => {
  let n = 0;
  await page.route("**/api/area-sheet*", (route) => (n++ < 2 ? route.fulfill({ status: 502, body: "{}" }) : route.continue()));
  const prefetched = page.waitForRequest(/\/api\/area-sheet/, { timeout: 10_000 });
  await page.goto("/ja");
  await prefetched;
  await openSheet(page);
  const sheet = page.getByRole("dialog", { name: "エリアを選ぶ" });
  await sheet.getByRole("button", { name: "読み込めませんでした。もう一度" }).click();
  await expect(sheet.getByRole("heading", { name: "箱根" })).toBeVisible();
});

test("今のエリアの名前は props（サーバー）から出る：?area=hakone でシートを開かなくても分かる", async ({ page }) => {
  await page.goto("/ja?area=hakone");
  await expect(page.getByRole("button", { name: /エリアを選ぶ.*箱根/ })).toBeVisible();
});
