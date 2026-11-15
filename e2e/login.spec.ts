import { expect, test } from "@playwright/test";

test("ログイン画面が開き、Google は出ず、メール欄・送るボタンが見える", async ({ page }) => {
  await page.goto("/ja/login");
  await expect(page.getByRole("button", { name: "Google で続ける" })).toHaveCount(0);
  await expect(page.getByLabel("メールアドレス")).toBeVisible();
  await expect(page.getByRole("button", { name: "ログイン用のリンクを送る" })).toBeVisible();
  await expect(page.getByTestId("login-next")).toHaveValue("/ja");
});

test("next が外部サイトなら今の言語のトップになる", async ({ page }) => {
  await page.goto("/ja/login?next=//evil.com");
  await expect(page.getByTestId("login-next")).toHaveValue("/ja");
});

test("next が相対パスならそのまま使う", async ({ page }) => {
  await page.goto("/ja/login?next=/ja/d/x");
  await expect(page.getByTestId("login-next")).toHaveValue("/ja/d/x");
});

test("言語の無い next には今の言語を付ける", async ({ page }) => {
  await page.goto("/ja/login?next=/d/x");
  await expect(page.getByTestId("login-next")).toHaveValue("/ja/d/x");
});

test("端末が日本語でも、/en/login からの戻り先は英語のまま", async ({ browser }) => {
  const page = await (await browser.newContext({ locale: "ja-JP" })).newPage();
  await page.goto("/en/login");
  await expect(page.getByTestId("login-next")).toHaveValue("/en");
});

test("認証に失敗したら、next の言語のエラー画面へ", async ({ browser }) => {
  const page = await (await browser.newContext({ locale: "ja-JP" })).newPage();
  await page.goto("/auth/callback?next=%2Fen%2Faccount");
  await expect(page).toHaveURL(/\/en\/auth\/error$/);
});
