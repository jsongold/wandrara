/* eslint-disable @typescript-eslint/no-explicit-any -- 検証のテストで、わざと形の崩れた入力を作るため */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { areaContentCounts, toAreaLocal } from "./area-content.ts";
import { parseBundle } from "./bundle.ts";

const fixture = async () =>
  JSON.parse(await readFile(new URL("../../../scripts/import-bundle/fixtures/area-content.json", import.meta.url), "utf8"));

const errorsOf = (b: unknown) => {
  const r = parseBundle(b);
  return r.ok ? [] : r.errors;
};

describe("bundle の area_content", () => {
  it("fixture が通り、件数を出せる", async () => {
    const r = parseBundle(await fixture());
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(areaContentCounts(r.value.area_content!)).toBe("products 2 / services 1 / shops 4 / shop_items 4 / popular 1");
  });

  it("area_content の無い bundle は今まで通り通る", async () => {
    const { area_content: _a, ...b } = await fixture();
    expect(parseBundle(b).ok).toBe(true);
  });

  it("出典が無い・写真の権利が欠けている・license が none を弾く", async () => {
    const b = await fixture();
    b.area_content.products[0].sources = [];
    b.area_content.products[1].photo.credit = undefined;
    b.area_content.services[0].photo.license = "none";
    const e = errorsOf(b);
    expect(e.some((x) => x.startsWith("/area_content/products/0/sources 出典を 1 件以上"))).toBe(true);
    expect(e.some((x) => x.startsWith("/area_content/products/1/photo/credit"))).toBe(true);
    expect(e.some((x) => x.startsWith("/area_content/services/0/photo/license"))).toBe(true);
  });

  it("旬の月は 1〜12。en が無い文・知らないキーを弾く", async () => {
    const b = await fixture();
    b.area_content.products[1].season = { from: 0, to: 13 };
    delete b.area_content.services[0].summary.en;
    b.area_content.shops[0].phone = "0557";
    b.area_content.shops[1].hours = "9:00-17:00"; // 営業時間・定休・価格のメモも ja / en の文
    b.area_content.shop_items[0].price_note = { ja: "目方により変動" };
    const e = errorsOf(b);
    expect(e.some((x) => x.startsWith("/area_content/shops/1/hours"))).toBe(true);
    expect(e.some((x) => x.startsWith("/area_content/shop_items/0/price_note/en"))).toBe(true);
    expect(e).toContain("/area_content/products/1/season/from 月は 1〜12");
    expect(e).toContain("/area_content/products/1/season/to 月は 1〜12");
    expect(e.some((x) => x.startsWith("/area_content/services/0/summary/en"))).toBe(true);
    expect(e.some((x) => x.startsWith("/area_content/shops/0") && x.includes("phone"))).toBe(true);
  });

  it("shop_items は product と service のちょうど 1 つ。参照する id が無いと弾く", async () => {
    const b = await fixture();
    const items = b.area_content.shop_items;
    items[0].service = "atami-baien"; // 両方
    items[1].product = null; // どちらも無い
    items[2].shop = "no-such-shop";
    items[3].service = "no-such-service";
    b.area_content.popular = ["no-such-item"];
    expect(errorsOf(b)).toEqual([
      "/area_content/shop_items/0 product と service のちょうど 1 つを書く",
      "/area_content/shop_items/1 product と service のちょうど 1 つを書く",
      "/area_content/shop_items/2/shop shop no-such-shop が shops に無い",
      "/area_content/shop_items/3/service service no-such-service が services に無い",
      "/area_content/popular/0 popular の no-such-item が products / services に無い",
    ]);
  });

  it("product の id を service として指すと弾く。id の重なり・組の重なりを弾く", async () => {
    const b = await fixture();
    const a = b.area_content;
    a.shop_items[3].service = "himono";
    a.services.push({ ...a.services[0], id: "daidai" });
    a.shops.push({ ...a.shops[0] });
    a.shop_items.push({ ...a.shop_items[0] });
    expect(errorsOf(b)).toEqual([
      "/area_content/services/1/id id daidai が products / services の中で重なっている",
      "/area_content/shops/4/id id kamatsuru-himono が shops の中で重なっている",
      "/area_content/shop_items/3/service service himono が services に無い",
      "/area_content/shop_items/4 shop kamatsuru-himono と product himono の組が重なっている",
    ]);
  });

  it("region_id は形だけ確かめる。確かめた日は YYYY-MM-DD", async () => {
    const b = await fixture();
    b.area_content.region_id = "Atami City";
    b.area_content.shop_items[0].checked_at = "2026/11/19";
    const e = errorsOf(b);
    expect(e.some((x) => x.startsWith("/area_content/region_id"))).toBe(true);
    expect(e.some((x) => x.startsWith("/area_content/shop_items/0/checked_at"))).toBe(true);
    const ok = await fixture();
    ok.area_content.region_id = "no-such-region-yet";
    expect(parseBundle(ok).ok).toBe(true);
  });
});

describe("toAreaLocal", () => {
  it("画面が読む形（camelCase）に変える。省いた欄は null、shops の photos は書いたときだけ", async () => {
    const b = await fixture();
    delete b.area_content.services[0].description;
    b.area_content.shops[1].photos = [b.area_content.products[1].photo];
    const r = parseBundle(b);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    const out = toAreaLocal(r.value.area_content!) as any;
    expect(Object.keys(out)).toEqual(["products", "services", "shops", "shopItems", "popular"]);
    expect(Object.keys(out.products[0]).slice(0, 2)).toEqual(["id", "kind"]);
    expect(out.services[0].description).toBeNull();
    expect(out.shops[0]).not.toHaveProperty("photos");
    expect(out.shops[1].photos).toHaveLength(1);
    expect(out.shopItems[1]).toEqual({
      shop: "aoki-himono",
      product: "himono",
      service: null,
      price: 432,
      priceNote: { ja: "真あじ干物（1枚〜、税込）", en: "Dried horse mackerel (from 1 piece, tax incl.)" },
      checkedAt: "2026-11-19",
      url: "https://www.aoki-himono.co.jp/",
      sources: ["https://www.aoki-himono.co.jp/"],
    });
    expect(out.popular).toEqual(["daidai"]);
  });

  it("popular を書かなければ出さない", async () => {
    const b = await fixture();
    delete b.area_content.popular;
    const r = parseBundle(b);
    if (!r.ok) throw new Error(r.errors.join("\n"));
    expect(toAreaLocal(r.value.area_content!)).not.toHaveProperty("popular");
  });
});
