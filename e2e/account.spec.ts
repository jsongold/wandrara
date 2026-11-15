import { expect, test } from "@playwright/test";

test("未ログインで /account を開くと /login に行く", async ({ page }) => {
  await page.goto("/ja/account");
  await expect(page).toHaveURL(/\/ja\/login\?next=(%2F|\/)ja(%2F|\/)account/);
});

test("トップのアカウントボタンが /login へのリンクになっている", async ({ page }) => {
  await page.goto("/ja");
  await expect(page.getByTestId("account-button")).toHaveAttribute("href", /^\/ja\/login\?next=/);
});
