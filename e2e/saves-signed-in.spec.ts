import { expect, test, type Locator, type Page } from "@playwright/test";
import { hasAuthEnv, loginAs, resetSaves } from "./support/login";

// ログインした User の保存：詳細で保存 → 一覧に出る → 外すと一覧から消える。
// chromium と webkit が同じ User を使うので、直列に流し、各テストの中で保存 → 確認 → 解除 → 確認まで終える。
// DB のデータに依存する（トップに 1 枚以上カードがあること）

test.skip(!hasAuthEnv(), "Supabase の env（URL・secret key・publishable key）が無い");
test.describe.configure({ mode: "serial" });

let userId = "";

// project（chromium / webkit）は別の worker で並走する。同じ User だと互いの resetSaves で保存が消えるので、
// project ごとに別のテスト用 User を使う（loginAs は E2E_USER_EMAIL を呼ぶたびに読む。worker ごとの process なので他へ漏れない）
test.beforeEach(async ({ context, baseURL }, testInfo) => {
  process.env.E2E_USER_EMAIL = `e2e-saves-${testInfo.project.name}@wandrara.test`;
  const user = await loginAs(context, baseURL!);
  userId = user.id;
  await resetSaves(userId);
});

test.afterEach(async () => {
  if (userId) await resetSaves(userId);
});

// トップの最初のカードの詳細リンクから slug を取る
async function firstSlug(page: Page): Promise<string> {
  await page.goto("/ja");
  const link = page.locator('article a[href^="/ja/d/"]').first();
  await expect(link).toBeAttached();
  const href = await link.getAttribute("href");
  expect(href).toMatch(/^\/ja\/d\/[^/]+$/);
  return href!.replace("/ja/d/", "");
}

// streaming 中は待ち表示と本体が同じ testid で一時的に並ぶ。1 つに落ち着いてから返す
async function settled(page: Page, testId: string): Promise<Locator> {
  const target = page.getByTestId(testId);
  await expect(target).toHaveCount(1);
  return target;
}

// ログイン状態を読み終えるまでボタンは何もしない。読み終えるまで押し直し、押せたら押し直さない。
// 画面は先に変わるので、DB への書き込み（user_saves への insert / delete）が終わるまで待つ
async function press(page: Page, button: Locator, expected: "true" | "false") {
  const written = page.waitForResponse((r) => r.url().includes("/rest/v1/user_saves") && r.request().method() !== "GET");
  await expect(async () => {
    await button.click({ timeout: 2000 });
    await expect(button).toHaveAttribute("aria-pressed", expected, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
  expect((await written).ok()).toBe(true);
}

test("詳細で保存すると一覧に出て、詳細でもう一度押すと一覧から消える", async ({ page }) => {
  const slug = await firstSlug(page);

  await page.goto(`/ja/d/${slug}`);
  const button = await settled(page, "save-button");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await press(page, button, "true");

  // 再読み込みしても保存されたまま
  await page.reload();
  await expect(await settled(page, "save-button")).toHaveAttribute("aria-pressed", "true");

  // 一覧にその dest が 1 つ出る。押すと詳細に行く
  await page.goto("/ja/saved");
  const items = page.getByTestId("saved-item");
  await expect(items).toHaveCount(1);
  await expect(items).toHaveAttribute("href", `/ja/d/${slug}`);
  await items.click();
  await expect(page).toHaveURL(new RegExp(`/ja/d/${slug}$`));

  // 詳細でもう一度押すと外れ、一覧から消える
  const again = await settled(page, "save-button");
  await expect(again).toHaveAttribute("aria-pressed", "true");
  await press(page, again, "false");
  await page.goto("/ja/saved");
  await expect(page.getByTestId("saved-empty")).toHaveCount(1);
  await expect(page.getByTestId("saved-item")).toHaveCount(0);
});

test("トップのカードで保存すると、一覧に出る", async ({ page }) => {
  const slug = await firstSlug(page);

  const card = page.locator("article").first();
  const button = card.getByTestId("save-button");
  await expect(button).toHaveCount(1);
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await press(page, button, "true");

  await page.goto("/ja/saved");
  const items = page.getByTestId("saved-item");
  await expect(items).toHaveCount(1);
  await expect(items).toHaveAttribute("href", `/ja/d/${slug}`);

  await resetSaves(userId);
});
