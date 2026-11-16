import { expect, test } from "@playwright/test";

// エリア選択シートの「地図」から、全国 → 地方（関東）→ 箱根 と寄ってエリアを選べる。
// 地図の図形は拡大した表示の外にはみ出すので、押す位置が決まらない。図形はキーボード（Enter）で選ぶ
test("地図からエリアを選ぶと ?area=<id> になり、シートは開いたまま続けて選べる", async ({ page }) => {
  await page.goto("/ja");
  await page.getByRole("button", { name: /エリアを選ぶ/ }).click();
  await page.getByRole("button", { name: "地図", exact: true }).click();

  await page.getByRole("button", { name: "関東の地図を開く" }).press("Enter");
  await page.getByRole("button", { name: "伊東" }).press("Enter");
  await expect(page).toHaveURL(/[?&]area=ito/);
  await expect(page.getByRole("dialog", { name: "エリアを選ぶ" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "エリアを選ぶ" }).getByRole("button", { name: "伊東" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "箱根の地図を開く" }).press("Enter");
  await page.getByRole("button", { name: "大涌谷" }).press("Enter");
  await expect(page).toHaveURL(/[?&]area=owakudani/);
});

test("地図の「戻る」で一つ前の地図に戻り、出典が出ている", async ({ page }) => {
  await page.goto("/ja");
  await page.getByRole("button", { name: /エリアを選ぶ/ }).click();
  await page.getByRole("button", { name: "地図", exact: true }).click();
  await expect(page.getByText(/出典：国土数値情報/)).toBeVisible();
  await page.getByRole("button", { name: "関東の地図を開く" }).press("Enter");
  await expect(page.getByRole("group", { name: "関東" })).toBeVisible();
  await page.getByRole("button", { name: /戻る/ }).click();
  await expect(page.getByRole("group", { name: "日本" })).toBeVisible();
});

test("地図はドラッグで動かせ、動かしただけではエリアを選ばない", async ({ page }) => {
  await page.goto("/ja");
  await page.getByRole("button", { name: /エリアを選ぶ/ }).click();
  await page.getByRole("button", { name: "地図", exact: true }).click();
  await page.getByRole("button", { name: "関東の地図を開く" }).press("Enter");
  const map = page.getByRole("group", { name: "関東" });
  const before = await map.getAttribute("viewBox");
  const b = (await map.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 60, b.y + b.height / 2 - 40, { steps: 6 });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute("viewBox", before ?? "");
  await expect(page).not.toHaveURL(/[?&]area=/);
});
