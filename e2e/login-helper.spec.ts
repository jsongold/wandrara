import { expect, test } from "@playwright/test";
import { hasAuthEnv, loginAs } from "./support/login";

test.skip(!hasAuthEnv(), "Supabase の env（URL・secret key・publishable key）が無い");

test("テスト用ログインの後は /account が開き、テスト用の email が出る", async ({ context, page, baseURL }) => {
  const user = await loginAs(context, baseURL!);
  await page.goto("/ja/account");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByTestId("account-email")).toContainText(user.email);
});
