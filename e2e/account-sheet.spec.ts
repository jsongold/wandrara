import { expect, test } from "@playwright/test";

// トップのユーザーアイコンを押すと、トップを残したままログイン（ログイン中はアカウント）が下からシートで出る
test("ユーザーアイコンでログインがシートで出て、Esc で閉じると条件つきのトップに戻る", async ({ page }) => {
  await page.goto("/ja?area=hakone");
  await page.getByTestId("account-button").filter({ visible: true }).click();
  await expect(page.getByRole("dialog", { name: "ログイン" })).toBeVisible();
  await expect(page).toHaveURL(/\/ja\/login\?next=/);
  await expect(page.locator("[data-home]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "ログイン" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/ja\?area=hakone$/);
});

test("ログインを直接開くと全画面（シートではない）", async ({ page }) => {
  await page.goto("/ja/login");
  await expect(page.getByRole("heading", { name: "ログイン" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "ログイン" })).toHaveCount(0);
});
