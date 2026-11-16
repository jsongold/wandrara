import { expect, test } from "@playwright/test";

// 画面の言語：本人が選んだ言語（cookie）> 端末の言語（Accept-Language）> ja
test.describe("端末が英語", () => {
  test.use({ locale: "en-US" });

  test("言語の無い URL は /en へ送られ、条件はそのまま", async ({ page }) => {
    await page.goto("/?area=hakone");
    await expect(page).toHaveURL(/\/en\?area=hakone$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator('a[href^="/en/d/"]').first()).toBeVisible();
  });

  // 言語の切り替えはトップではなくアカウント／ログインの画面にある
  test("トップに言語の切り替えは無い", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByTestId("language-switch")).toHaveCount(0);
  });

  test("ログイン画面で切り替えると同じページの日本語へ移り、次からも日本語になる", async ({ page }) => {
    await page.goto("/en/login");
    await page.getByTestId("language-switch").click();
    await expect(page).toHaveURL(/\/ja\/login$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    await page.goto("/");
    await expect(page).toHaveURL(/\/ja$/);
  });
});

test.describe("端末が日本語・フランス語", () => {
  test("ja なら /ja", async ({ browser }) => {
    const page = await (await browser.newContext({ locale: "ja-JP" })).newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/ja$/);
  });

  test("対応しない言語なら /ja", async ({ browser }) => {
    const page = await (await browser.newContext({ locale: "fr-FR" })).newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/ja$/);
  });
});
