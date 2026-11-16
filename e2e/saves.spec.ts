import { expect, test, type Page } from "@playwright/test";

// 保存ボタン（未ログインの流れだけ）：押すとログインへ送られ、戻り先（next）が残る。
// DB のデータに依存する（トップに 1 枚以上カードがあること）

// ログイン状態を読み終えるまでボタンは何もしない。ログインへ飛ぶまで押し直す
async function pressUntilLogin(page: Page) {
  await expect(async () => {
    await page.getByTestId("save-button").first().click({ timeout: 1000 });
    await expect(page).toHaveURL(/\/ja\/login\?next=/, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
}

test("トップのカードの保存ボタンを押すと、ログインへ送られる", async ({ page }) => {
  await page.goto("/ja");
  const button = page.getByTestId("save-button").first();
  await expect(button).toBeVisible();
  await pressUntilLogin(page);
});

test("詳細の保存ボタンを押すと、詳細へ戻るログインへ送られる", async ({ page }) => {
  await page.goto("/ja");
  const link = page.locator('a[href^="/ja/d/"]').first();
  await expect(link).toBeAttached();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/ja\/d\/[^/]+$/);

  await page.goto(href!);
  const button = page.getByTestId("save-button").first();
  await expect(button).toBeVisible();
  await pressUntilLogin(page);
  expect(new URL(page.url()).searchParams.get("next")).toBe(href);
});
