import { expect, test } from "@playwright/test";

// エリア選択シートの「地図」は 1 枚の地図。親エリアを押すとそこへ寄り、子エリア（市区町村・町丁字・点）が出る。
// 図形は表示の外にはみ出すことがあり押す位置が決まらないので、図形はキーボード（Enter）で選ぶ
const openMap = async (page: import("@playwright/test").Page) => {
  await page.goto("/ja");
  await page.getByRole("button", { name: /エリアを選ぶ/ }).click();
  await page.getByRole("button", { name: "地図", exact: true }).click();
  return page.getByRole("dialog", { name: "エリアを選ぶ" });
};

test("親エリアを押すと ?area=<親> になって寄り、子エリアを選べる。シートは開いたまま", async ({ page }) => {
  const sheet = await openMap(page);
  await sheet.getByRole("button", { name: "伊豆", exact: true }).press("Enter");
  await expect(page).toHaveURL(/[?&]area=izu/);
  await sheet.getByRole("button", { name: "伊東", exact: true }).press("Enter");
  await expect(page).toHaveURL(/[?&]area=ito/);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "伊東", exact: true })).toHaveAttribute("aria-pressed", "true");

  // 引いてから箱根へ。町丁字の子と点（大涌谷）も選べる
  await sheet.getByRole("button", { name: "引く" }).click();
  await sheet.getByRole("button", { name: "引く" }).click();
  await sheet.getByRole("button", { name: "箱根", exact: true }).press("Enter");
  await expect(page).toHaveURL(/[?&]area=hakone/);
  await sheet.getByRole("button", { name: "大涌谷", exact: true }).press("Enter");
  await expect(page).toHaveURL(/[?&]area=owakudani/);
  await sheet.getByRole("button", { name: "解除" }).click();
  await expect(page).not.toHaveURL(/[?&]area=owakudani/);
});

test("特性で絞ると、合わないエリアは押せなくなる。出典が出ている", async ({ page }) => {
  const sheet = await openMap(page);
  await expect(sheet.getByText(/出典：国土数値情報/)).toBeVisible();
  // ローカルの見本の宿・体験：芦ノ湖（箱根）に湖畔、修善寺（伊豆）に温泉街
  await sheet.getByRole("group", { name: "特性で絞る" }).getByRole("button", { name: "湖畔" }).click();
  await expect(sheet.getByText("1 のエリアが合う")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "伊豆", exact: true })).toHaveAttribute("aria-disabled", "true");
  await expect(sheet.getByRole("button", { name: "箱根", exact: true })).not.toHaveAttribute("aria-disabled", "true");
  await sheet.getByRole("button", { name: "伊豆", exact: true }).press("Enter").catch(() => {});
  await expect(page).not.toHaveURL(/[?&]area=izu/);
  // 外すと全部押せる
  await sheet.getByRole("group", { name: "特性で絞る" }).getByRole("button", { name: "湖畔" }).click();
  await expect(sheet.getByRole("button", { name: "伊豆", exact: true })).not.toHaveAttribute("aria-disabled", "true");
});

test("地図はドラッグで動かせ、動かしただけではエリアを選ばない", async ({ page }) => {
  const sheet = await openMap(page);
  const map = sheet.getByRole("group", { name: "エリアの地図" });
  const before = await map.getAttribute("viewBox");
  const b = (await map.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 60, b.y + b.height / 2 - 40, { steps: 6 });
  await page.mouse.up();
  await expect(map).not.toHaveAttribute("viewBox", before ?? "");
  await expect(page).not.toHaveURL(/[?&]area=/);
});
