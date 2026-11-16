import { expect, test } from "@playwright/test";

// エリア選択シートの「地図」から、全国 → 地方（関東）→ 箱根 と寄ってエリアを選べる
test("地図からエリアを選ぶと ?area=<id> になり、シートは開いたまま続けて選べる", async ({ page }) => {
  await page.goto("/ja");
  await page.getByRole("button", { name: /エリアを選ぶ/ }).click();
  await page.getByRole("button", { name: "地図", exact: true }).click();

  await page.getByRole("button", { name: "関東の地図を開く" }).click();
  await page.getByRole("button", { name: "伊東" }).click();
  await expect(page).toHaveURL(/[?&]area=ito/);
  await expect(page.getByRole("dialog", { name: "エリアを選ぶ" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "エリアを選ぶ" }).getByRole("button", { name: "伊東" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "箱根の地図を開く" }).click();
  await page.getByRole("button", { name: "大涌谷" }).click();
  await expect(page).toHaveURL(/[?&]area=owakudani/);
});

test("地図の「戻る」で一つ前の地図に戻り、出典が出ている", async ({ page }) => {
  await page.goto("/ja");
  await page.getByRole("button", { name: /エリアを選ぶ/ }).click();
  await page.getByRole("button", { name: "地図", exact: true }).click();
  await expect(page.getByText(/出典：国土数値情報/)).toBeVisible();
  await page.getByRole("button", { name: "関東の地図を開く" }).click();
  await expect(page.getByRole("group", { name: "関東" })).toBeVisible();
  await page.getByRole("button", { name: /戻る/ }).click();
  await expect(page.getByRole("group", { name: "日本" })).toBeVisible();
});
