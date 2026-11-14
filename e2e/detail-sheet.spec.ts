import { expect, test, type Page } from "@playwright/test";

// トップ → 詳細はシートで出し、閉じても・戻っても条件が残ることを確かめる。
// 公開済みのスポットを 1 件使う（DB のデータに依存する）
const SPOT = process.env.E2E_SPOT ?? "wr-atami-008";
const QUERY = "/?area=atami&sort=fresh";

const sheet = (page: Page) => page.getByRole("dialog", { name: "スポットの詳細" });

async function openSheet(page: Page) {
  await page.locator(`a[href="/spots/${SPOT}"]`).first().click();
  await expect(sheet(page).getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/spots/${SPOT}$`));
  // せり上がるアニメーションが終わってから操作する（途中だとハンドルの位置がずれる）
  await sheet(page).locator(":scope > div").evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
}

async function expectHomeWithQuery(page: Page) {
  await expect(page).toHaveURL(QUERY);
  await expect(sheet(page)).toBeHidden();
  await expect(page.locator(`a[href="/spots/${SPOT}"]`).first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto(QUERY);
  await expect(page.locator(`a[href="/spots/${SPOT}"]`).first()).toBeVisible();
});

test("カードを押すと、トップの上に下からシートが出る", async ({ page }) => {
  await openSheet(page);
  // トップは裏に残っている
  await expect(page.locator("input[name=q]")).toBeAttached();
  const animation = await sheet(page).locator(":scope > div").evaluate((el) => getComputedStyle(el).animationName);
  expect(animation).toBe("sheet-up");
});

test("閉じるボタンで閉じると、条件つきのトップに戻る", async ({ page }) => {
  await openSheet(page);
  await sheet(page).getByRole("button", { name: "閉じる" }).last().click();
  await expectHomeWithQuery(page);
});

test("ブラウザの戻るで閉じ、進むでまた開く", async ({ page }) => {
  await openSheet(page);
  await page.goBack();
  await expectHomeWithQuery(page);
  await page.goForward();
  await expect(sheet(page).getByRole("heading", { level: 1 })).toBeVisible();
});

test("Esc で閉じる", async ({ page }) => {
  await openSheet(page);
  await page.keyboard.press("Escape");
  await expectHomeWithQuery(page);
});

test("ハンドルを下に引くと閉じる", async ({ page }) => {
  await openSheet(page);
  const handle = sheet(page).locator(".cursor-grab");
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + 300, { steps: 8 });
  await page.mouse.up();
  await expectHomeWithQuery(page);
});

test("詳細で再読み込みすると全画面になり、戻るで条件つきのトップに戻る", async ({ page }) => {
  await openSheet(page);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(sheet(page)).toBeHidden();
  await page.getByRole("button", { name: "戻る" }).click();
  await expectHomeWithQuery(page);
});

test("閉じるときは下へ滑ってから戻り、裏のトップも元の大きさに戻る", async ({ page }) => {
  await openSheet(page);
  await expect(page.locator("[data-home]")).toHaveCSS("transform", "matrix(0.94, 0, 0, 0.94, 0, 0)");
  await sheet(page).getByRole("button", { name: "閉じる" }).last().click();
  // 滑っている間はまだ詳細の URL のまま
  await expect(sheet(page).locator(".sheet-panel")).toHaveAttribute("style", /translateY\(100%\)/);
  await expect(page).toHaveURL(new RegExp(`/spots/${SPOT}$`));
  await expectHomeWithQuery(page);
  await expect(page.locator("[data-home]")).toHaveCSS("transform", "none");
});

async function swipeTo(page: Page, scope: ReturnType<Page["locator"]>, index: number) {
  // スワイプ＝横スクロール。scroll-snap で 1 枚ずつ止まる
  await scope.locator("[aria-roledescription=carousel] > div").first().evaluate((el, i) => el.scrollTo({ left: el.clientWidth * i }), index);
}

test("トップのカードの写真を横にスワイプして切り替え、タップで詳細を開く", async ({ page }) => {
  const card = page.getByRole("group", { name: /ヴィラ キング 熱海/ }).first();
  await expect(card.getByText(/^1 \/ \d+$/)).toBeVisible();
  await swipeTo(page, page.locator("article").first(), 1);
  await expect(card.getByText(/^2 \/ \d+$/)).toBeVisible();
  await card.locator("[aria-roledescription=slide]").nth(1).locator("a").click({ force: true });
  await expect(sheet(page).getByRole("heading", { level: 1 })).toBeVisible();
});

test("詳細の写真も横にスワイプして切り替えられる", async ({ page }) => {
  await openSheet(page);
  const photos = sheet(page).getByRole("group", { name: /ヴィラ キング 熱海/ });
  await expect(photos.getByText(/^1 \/ \d+$/)).toBeVisible();
  await swipeTo(page, sheet(page), 2);
  await expect(photos.getByText(/^3 \/ \d+$/)).toBeVisible();
});
