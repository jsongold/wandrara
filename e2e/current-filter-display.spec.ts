import { expect, test } from "@playwright/test";

// current-filter-display：ロゴの右に、今のエリアを 1 文字で出す。全エリアなら出さない
const mark = (page: import("@playwright/test").Page) => page.getByTestId("current-filter-display").filter({ visible: true });

test("全エリアなら出さない", async ({ page }) => {
  await page.goto("/ja");
  await expect(page.locator("[data-home]")).toBeVisible();
  await expect(mark(page)).toHaveCount(0);
});

test("箱根なら「箱」", async ({ page }) => {
  await page.goto("/ja?area=hakone");
  await expect(mark(page)).toHaveText("箱");
});
