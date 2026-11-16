import { expect, test } from "@playwright/test";

// 建物・日帰り温泉・まちの詳細（details のあるもの）。DB に無いので、スラッグが環境変数で渡されたときだけ走らせる
const BLD = process.env.E2E_BLD_SLUG;
const HOT = process.env.E2E_HOT_SLUG;
const VIL = process.env.E2E_VIL_SLUG;

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

// 行を押すと詳細が開き、もう一度押すと閉じる（内訳のある行が無ければ skip）
async function checkExpand(page: import("@playwright/test").Page) {
  const button = page.locator("main").last().locator("button[aria-controls]").first();
  test.skip((await button.count()) === 0, "内訳のある行が無い");
  const panel = page.locator(`[id="${await button.getAttribute("aria-controls")}"]`);
  await expect(panel).toBeHidden();
  await button.click();
  await expect(panel).toBeVisible();
  await button.click();
  await expect(panel).toBeHidden();
}

const open = (slug: string | undefined) => async ({ page }: { page: import("@playwright/test").Page }) => {
  await page.goto(`/ja/d/${slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
};

test.describe("建物", () => {
  test.skip(!BLD, "E2E_BLD_SLUG が未設定");
  test.beforeEach(async ({ page }) => open(BLD)({ page }));

  test("トピックは決まった順に並ぶ", async ({ page }) => {
    await checkOrder(page, ["時間", "料金", "催し", "アクセス", "注意点", "予約", "出典"], ["アクセス", "料金"]);
    // 新しい画面につながっていれば、概要の丸い行（開館・入館）が出る
    await expect(page.getByText("入館").first()).toBeVisible();
  });

  test("行を押すと開き、もう一度押すと閉じる", async ({ page }) => {
    await checkExpand(page);
  });
});

test.describe("日帰り温泉", () => {
  test.skip(!HOT, "E2E_HOT_SLUG が未設定");
  test.beforeEach(async ({ page }) => open(HOT)({ page }));

  test("トピックは決まった順に並ぶ", async ({ page }) => {
    await checkOrder(page, ["風呂", "料金", "時間", "設備", "アクセス", "注意点", "出典"], ["アクセス", "風呂", "料金"]);
  });

  test("行を押すと開き、もう一度押すと閉じる", async ({ page }) => {
    await checkExpand(page);
  });
});

test.describe("まち", () => {
  test.skip(!VIL, "E2E_VIL_SLUG が未設定");
  test.beforeEach(async ({ page }) => open(VIL)({ page }));

  test("トピックは決まった順に並ぶ", async ({ page }) => {
    await checkOrder(page, ["歩き方", "店の時間", "催し", "アクセス", "注意点", "出典"], ["アクセス"]);
    // まち専用のカード（歩き方・店の時間）のどちらかが出る
    const headings = await page.locator("main").last().locator("h2").allInnerTexts();
    expect(headings.some((h) => h === "歩き方" || h === "店の時間")).toBe(true);
  });

  test("行を押すと開き、もう一度押すと閉じる", async ({ page }) => {
    await checkExpand(page);
  });
});
