import { expect, test } from "@playwright/test";

// current-filter-display：ロゴの右に、Feed で今見ているカードのエリアの名前を出す（見る前は先頭のカード）
const mark = (page: import("@playwright/test").Page) => page.getByTestId("current-filter-display").filter({ visible: true });
const cardArea = (page: import("@playwright/test").Page, i: number) => page.locator("[data-feed] article").nth(i).locator("span.text-\\[13px\\].text-white\\/90").first();

test("全エリアでも先頭のカードのエリアを出す", async ({ page }) => {
  await page.goto("/ja");
  // 読み込み中は React の差し替えで一瞬 2 つになることがあるので、見えている 1 つを待つ
  await expect(page.locator("[data-home]").filter({ visible: true })).toHaveCount(1);
  await expect(mark(page)).toHaveText((await cardArea(page, 0).textContent()) ?? "");
});

test("箱根なら箱根のカードのエリア", async ({ page }) => {
  await page.goto("/ja?area=hakone");
  await expect(mark(page)).toHaveText(/^箱根/);
});

test("スクロールすると、見ているカードのエリアに変わる", async ({ page }) => {
  await page.goto("/ja");
  await expect(page.locator("[data-home]").filter({ visible: true })).toHaveCount(1);
  const second = page.locator("[data-feed] article").nth(1);
  await second.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await expect(mark(page)).toHaveText((await cardArea(page, 1).textContent()) ?? "");
});
