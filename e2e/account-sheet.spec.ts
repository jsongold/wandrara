import { expect, test } from "@playwright/test";
import { hasAuthEnv, loginAs } from "./support/login";

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

// ログイン中：アカウントのシートでログアウトの確認を出してから閉じても、トップに戻ってシートが残らない
test.describe("ログイン中", () => {
  test.skip(!hasAuthEnv(), "Supabase の env（URL・secret key・publishable key）が無い");

  test("ログアウトの確認を出し入れしてから Esc で閉じると、トップに戻る", async ({ context, page, baseURL }, testInfo) => {
    process.env.E2E_USER_EMAIL = `e2e-account-sheet-${testInfo.project.name}@wandrara.test`;
    await loginAs(context, baseURL!);
    await page.goto("/ja?area=hakone");
    await page.getByTestId("account-button").filter({ visible: true }).click();
    const sheet = page.getByRole("dialog", { name: "アカウント" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "ログアウト" }).click();
    await expect(page.getByRole("dialog", { name: "ログアウトしますか" })).toBeVisible();
    await page.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByRole("dialog", { name: "ログアウトしますか" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/ja\?area=hakone$/);
    await expect(sheet).toHaveCount(0);
    // 閉じた後もトップを押せる（透明なシートが覆っていない）
    await page.getByTestId("account-button").filter({ visible: true }).click();
    await expect(sheet).toBeVisible();
  });
});
