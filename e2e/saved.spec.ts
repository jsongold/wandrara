import { expect, test } from "@playwright/test";

test("未ログインで /saved を開くと /login に行き、next が /ja/saved を指す", async ({ page }) => {
  await page.goto("/ja/saved");
  await expect(page).toHaveURL(/\/ja\/login\?next=/);
  expect(new URL(page.url()).searchParams.get("next")).toBe("/ja/saved");
});
