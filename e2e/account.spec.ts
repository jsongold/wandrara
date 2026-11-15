import { expect, test } from "@playwright/test";

test("未ログインで /account を開くと /login に行く", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)account/);
});

test("トップのアカウントボタンが /login へのリンクになっている", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("account-button")).toHaveAttribute("href", /^\/login\?next=/);
});
