import { expect, test } from "@playwright/test";

// 体験・自然の詳細（details のあるもの）。DB に無いので、スラッグが環境変数で渡されたときだけ走らせる
const EXP = process.env.E2E_EXP_SLUG;
const NAT = process.env.E2E_NAT_SLUG;

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

// 見出し（h2）が決まった順に並び、必ず出るものは出ている
async function checkOrder(page: import("@playwright/test").Page, order: string[], required: string[]) {
  const headings = await page.locator("main").last().locator("h2").allInnerTexts();
  const shown = headings.filter((h) => order.includes(h));
  expect(shown).toEqual(order.filter((h) => shown.includes(h)));
  for (const h of required) expect(headings).toContain(h);
}

test.describe("体験", () => {
  test.skip(!EXP, "E2E_EXP_SLUG が未設定");

  test.beforeEach(async ({ page }) => {
    await page.goto(`/ja/d/${EXP}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("トピックは決まった順に並ぶ", async ({ page }) => {
    await checkOrder(page, ["料金（参考）", "コース", "開催", "集合場所", "含まれるもの", "注意点", "予約", "出典"], ["集合場所"]);
  });

  test("料金の行を押すと開き、もう一度押すと閉じる", async ({ page }) => {
    const row = page.locator("tbody tr").first();
    const button = row.getByRole("button");
    test.skip((await button.count()) === 0, "この体験の先頭の料金行には内訳が無い");
    const panel = page.locator(`[id="${await button.getAttribute("aria-controls")}"]`);
    await expect(panel).toBeHidden();
    await row.click();
    await expect(panel).toBeVisible();
    await row.click();
    await expect(panel).toBeHidden();
  });
});

test.describe("自然", () => {
  test.skip(!NAT, "E2E_NAT_SLUG が未設定");

  test.beforeEach(async ({ page }) => {
    await page.goto(`/ja/d/${NAT}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("トピックは決まった順に並ぶ", async ({ page }) => {
    await checkOrder(page, ["見頃", "時間・料金", "アクセス", "歩く道", "規制", "注意点", "出典"], ["アクセス"]);
  });
});
