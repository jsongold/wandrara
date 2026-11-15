import { expect, test, type Page } from "@playwright/test";

// トップ → 詳細はシートで出し、閉じても・戻っても条件が残ることを確かめる。
// seed のデモ（lakeside-stay）を使う（DB のデータに依存する）
const SLUG = process.env.E2E_SLUG ?? "lakeside-stay";
const QUERY = "/ja?area=hakone&sort=fresh";

const sheet = (page: Page) => page.getByRole("dialog", { name: "スポットの詳細" });

async function openSheet(page: Page) {
  await page.locator(`a[href="/ja/d/${SLUG}"]`).first().click();
  await expect(sheet(page).getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/ja/d/${SLUG}$`));
  // せり上がるアニメーションが終わってから操作する（途中だとハンドルの位置がずれる）
  await sheet(page).locator(":scope > div").evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
}

async function expectHomeWithQuery(page: Page) {
  await expect(page).toHaveURL(QUERY);
  await expect(sheet(page)).toBeHidden();
  await expect(page.locator(`a[href="/ja/d/${SLUG}"]`).first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto(QUERY);
  await expect(page.locator(`a[href="/ja/d/${SLUG}"]`).first()).toBeVisible();
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
  await expect(page).toHaveURL(new RegExp(`/ja/d/${SLUG}$`));
  await expectHomeWithQuery(page);
  await expect(page.locator("[data-home]")).toHaveCSS("transform", "none");
});

test("写真の上で指を動かした後は、詳細を開かない（スワイプをタップと取り違えない）", async ({ page }) => {
  const card = page.getByRole("group", { name: /芦ノ湖畔の一棟貸し宿/ }).first();
  const box = (await card.boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 80, { steps: 6 }); // 上へ
  await page.mouse.move(x, y + 40, { steps: 6 }); // そして下へ
  await page.mouse.up();
  await page.waitForTimeout(800);
  await expect(page).toHaveURL(QUERY);
  await expect(sheet(page)).toBeHidden();
  // 普通のタップでは開く
  await openSheet(page);
});

test("シートの背景はスワイプを受けない（指の操作がページ全体に伝わらない）", async ({ page }) => {
  await openSheet(page);
  expect(await sheet(page).locator(".sheet-backdrop").evaluate((el) => getComputedStyle(el).touchAction)).toBe("none");
});

test("?debug=1 の診断表示は出ても操作を邪魔しない", async ({ page }) => {
  await page.goto(QUERY + "&debug=1");
  await expect(page.getByText(/^beat \d+/)).toBeVisible();
  await openSheet(page);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp("/ja\\?area=hakone"));
  await page.getByRole("button", { name: /エリアを選ぶ/ }).click();
  await expect(page.getByText("すべてのエリア")).toBeVisible();
});

async function expectHomeUsable(page: Page) {
  await page.getByRole("button", { name: /エリアを選ぶ/ }).click();
  await expect(page.getByText("すべてのエリア")).toBeVisible();
}

test("閉じてから同じ dest を開き直しても、シートが出て、閉じた後もトップを操作できる", async ({ page }) => {
  await openSheet(page);
  await sheet(page).getByRole("button", { name: "閉じる" }).last().click();
  await expectHomeWithQuery(page);
  // 閉じたシートは隠れて残る（cacheComponents）。開き直したときに「閉じている途中」のままだと画面が固まる
  await openSheet(page);
  await expect(sheet(page).locator(".sheet-panel")).not.toHaveAttribute("style", /translateY\(100%\)/);
  await page.keyboard.press("Escape");
  await expectHomeWithQuery(page);
  await expectHomeUsable(page);
});

test("ブラウザの戻るで閉じても、裏のトップが縮んだまま残らない", async ({ page }) => {
  await openSheet(page);
  await page.goBack();
  await expectHomeWithQuery(page);
  await expect(page.locator("[data-home]")).toHaveCSS("transform", "none");
  await expectHomeUsable(page);
});
