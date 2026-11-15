import { expect, test } from "@playwright/test";
import { hasAuthEnv, loginAs } from "./support/login";

test.skip(!hasAuthEnv(), "Supabase の env（URL・secret key・publishable key）が無い");

test("テスト用ログインの後は /account が開き、テスト用の email が出る", async ({ context, page, baseURL }) => {
  const user = await loginAs(context, baseURL!);
  await page.goto("/ja/account");
  await expect(page).not.toHaveURL(/\/login/);
  // streaming 中は待ち表示と本体が同じ testid で一時的に 2 つ並ぶ。1 つに落ち着いてから見る
  const email = page.getByTestId("account-email");
  await expect(email).toHaveCount(1);
  await expect(email).toContainText(user.email);
});
