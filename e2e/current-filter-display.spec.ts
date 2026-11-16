import { expect, test } from "@playwright/test";

// current-filter-display：ヘッダーの真ん中に、今のエリアを 1 文字で出す
const mark = (page: import("@playwright/test").Page) => page.getByTestId("current-filter-display").filter({ visible: true });

test("全エリアなら「全」", async ({ page }) => {
  await page.goto("/ja");
  await expect(mark(page)).toHaveText("全");
});

test("箱根なら「箱」", async ({ page }) => {
  await page.goto("/ja?area=hakone");
  await expect(mark(page)).toHaveText("箱");
});
