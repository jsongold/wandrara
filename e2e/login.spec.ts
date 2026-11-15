import { expect, test } from "@playwright/test";

test("ログイン画面が開き、Google は出ず、メール欄・送るボタンが見える", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Google で続ける" })).toHaveCount(0);
  await expect(page.getByLabel("メールアドレス")).toBeVisible();
  await expect(page.getByRole("button", { name: "ログイン用のリンクを送る" })).toBeVisible();
  await expect(page.getByTestId("login-next")).toHaveValue("/");
});

test("next が外部サイトなら / になる", async ({ page }) => {
  await page.goto("/login?next=//evil.com");
  await expect(page.getByTestId("login-next")).toHaveValue("/");
});

test("next が相対パスならそのまま使う", async ({ page }) => {
  await page.goto("/login?next=/d/x");
  await expect(page.getByTestId("login-next")).toHaveValue("/d/x");
});
