import { expect, test } from "@playwright/test";

// 宿の詳細（details のある宿）。DB のデータに依存する（wr-ito-033 の値で確かめる）
const SLUG = process.env.E2E_ACC_SLUG ?? "wr-ito-033";

// ページのエラーはテストごとに集め、最後に無いことを確かめる（worker の中ではテストは 1 つずつ走る）
let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`/ja/d/${SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test.afterEach(() => {
  expect(errors).toEqual([]);
});

test("紹介文の下にチェックイン・アウトを出す", async ({ page }) => {
  const main = page.locator("main").last();
  await expect(main).toContainText(/IN\s*15:00/);
  await expect(main).toContainText(/OUT\s*10:00/);
});

test("料金（参考）は部屋ごとに 1 行。押すと詳細を開き、もう一度押すと閉じる", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "料金（参考）" })).toBeVisible();
  const row = page.locator("tbody tr").first();
  await expect(row.locator("th, td")).toHaveText(["1 棟", "2〜8", "45,000", "170,000", /.*/]);

  const button = row.getByRole("button");
  const panel = page.locator(`[id="${await button.getAttribute("aria-controls")}"]`);
  await expect(panel).toBeHidden();
  await row.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await row.click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
});

test("トピックは決まった順に並び、アクセスの見出しは 1 つ", async ({ page }) => {
  const order = ["料金（参考）", "部屋", "食事", "風呂", "設備", "ペット", "条件", "駐車場", "アクセス", "周辺", "注意点", "許可・届出", "予約", "出典"];
  const headings = await page.locator("main").last().locator("h2").allInnerTexts();
  const shown = headings.filter((h) => order.includes(h));
  expect(shown).toEqual(order.filter((h) => shown.includes(h)));
  // wr-ito-033 にあるトピックは必ず出る
  for (const h of ["料金（参考）", "部屋", "風呂", "設備", "ペット", "駐車場", "アクセス", "注意点", "予約", "出典"]) {
    expect(headings).toContain(h);
  }
  expect(headings.filter((h) => h === "アクセス")).toHaveLength(1);
  // 古い「設備・条件」は出さない
  expect(headings).not.toContain("設備・条件");
});

test("部屋の行はキーボードで開閉でき、寝室の名前が見える", async ({ page }) => {
  const card = page.locator("section", { has: page.getByRole("heading", { name: "部屋" }) });
  const button = card.getByRole("button").first();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(card).toContainText("1F");
  await page.keyboard.press("Space");
  await expect(button).toHaveAttribute("aria-expanded", "false");
});

test("区分ごとの料金（平日・土曜の値）を出さない", async ({ page }) => {
  const main = page.locator("main").last();
  for (const v of ["75,000", "105,000", "147,000", "平日"]) await expect(main.getByText(v)).toHaveCount(0);
});

test("未検証のラベルを出さない", async ({ page }) => {
  await expect(page.getByText("未検証")).toHaveCount(0);
});

// details の無い宿は、今までどおり「設備・条件」とアクセスを出す
const PLAIN_SLUG = process.env.E2E_ACC_PLAIN_SLUG ?? "wr-ito-054";

test("details の無い宿は、設備・条件とアクセスの今の出し方のまま", async ({ page }) => {
  await page.goto(`/ja/d/${PLAIN_SLUG}`);
  const main = page.locator("main").last();
  await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(main.locator("h2")).toHaveText(["設備・条件", "アクセス"]);
  await expect(main.getByText("料金（参考）")).toHaveCount(0);
});
