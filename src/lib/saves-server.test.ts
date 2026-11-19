import { describe, expect, it } from "vitest";
import type { Catalog } from "./feed";
import { getSavedDests } from "./saves-server";
import { fakeDb } from "./supabase/fake-db";
import type { DestCard, Photo } from "./types";

const photo: Photo = { url: "https://x/p.jpg", license: null, credit: null, isDemo: false, placeholderSky: null, placeholderLand: null };

const dest = (id: string, over: Partial<DestCard> = {}): DestCard => ({
  id, coreType: "accommodation", slug: `s-${id}`, regionId: null, name: { ja: `宿${id}`, en: `Stay ${id}` }, summary: null,
  isDemo: false, createdAt: "2026-01-01", publishedAt: null, categoryIds: [], photos: [], ...over,
});

const catalog: Catalog = {
  regions: [
    { id: "hakone", parentId: null, name: { ja: "箱根", en: "Hakone" }, sort: 0 },
    { id: "ashinoko", parentId: "hakone", name: { ja: "芦ノ湖", en: "Lake Ashi" }, sort: 0 },
  ],
  categories: [],
  dests: [
    dest("a", { regionId: "ashinoko", photos: [photo] }),
    dest("b", { coreType: "experience", name: { ja: "体験b" } }),
  ],
};

const save = (dest_id: string, created_at: string) => ({ dest_id, created_at });
const run = (rows: ReturnType<typeof save>[], opts?: Parameters<typeof fakeDb>[1], cat: Catalog = catalog) =>
  getSavedDests(fakeDb({ user_saves: rows }, opts).db, cat, "ja");

describe("getSavedDests", () => {
  it("user_saves を created_at の新しい順に読み、その順で返す", async () => {
    const views = await run([save("a", "2026-01-01"), save("b", "2026-02-02")]);
    expect(views.map((v) => v.destId)).toEqual(["b", "a"]);
  });

  it("同じ時刻なら dest_id の降順で、毎回同じ順になる", async () => {
    const rows = [save("a", "2026-01-01"), save("b", "2026-01-01")];
    expect((await run(rows)).map((v) => v.destId)).toEqual(["b", "a"]);
    expect((await run([...rows].reverse())).map((v) => v.destId)).toEqual(["b", "a"]);
  });

  it("1000 件を超えても新しい順のまま全部返す（同じ時刻が多数でもページの境目で落ちない）", async () => {
    const dests = Array.from({ length: 2500 }, (_, i) => dest(`d${String(i).padStart(5, "0")}`));
    // 時刻は 100 件ずつ同じ。新しい順は (時刻, dest_id) の降順
    const rows = dests.map((d, i) => save(d.id, `2026-01-${String(1 + Math.floor(i / 100)).padStart(2, "0")}`));
    const views = await run(rows, undefined, { ...catalog, dests });
    expect(views).toHaveLength(2500);
    expect(views.map((v) => v.destId)).toEqual(dests.map((d) => d.id).reverse());
  });

  it("途中のページが失敗したら throw する", async () => {
    const dests = Array.from({ length: 2500 }, (_, i) => dest(`d${i}`));
    const rows = dests.map((d) => save(d.id, "2026-01-01"));
    await expect(run(rows, { failAtFrom: 1000 }, { ...catalog, dests })).rejects.toThrow("page failed");
  });

  it("ページの境目で同じ行を 2 回読んでも 1 回だけ返す", async () => {
    const views = await run([save("a", "2026-01-01"), save("a", "2026-01-01")]);
    expect(views.map((v) => v.destId)).toEqual(["a"]);
  });

  it("catalog に無いもの（非公開）は出さない", async () => {
    expect((await run([save("gone", "2026-03-03"), save("a", "2026-01-01")])).map((v) => v.destId)).toEqual(["a"]);
  });

  it("タイトル・地域・種類・写真・リンクを言語に合わせて作る", async () => {
    const db = fakeDb({ user_saves: [save("b", "2026-01-01"), save("a", "2026-01-02")] }).db;
    expect(await getSavedDests(db, catalog, "ja")).toEqual([
      { destId: "a", title: "宿a", areaLabel: "箱根・芦ノ湖", kindLabel: "宿", photo, href: "/ja/d/s-a" },
      { destId: "b", title: "体験b", areaLabel: "", kindLabel: "体験", photo: null, href: "/ja/d/s-b" },
    ]);
    const en = await getSavedDests(db, catalog, "en");
    expect(en[0]).toMatchObject({ title: "Stay a", areaLabel: "Hakone・Lake Ashi", kindLabel: "Stay", href: "/en/d/s-a" });
    // 英語の名前が無ければ日本語で出す
    expect(en[1]).toMatchObject({ title: "体験b", kindLabel: "Experience" });
  });

  it("0 件なら空配列", async () => {
    expect(await run([])).toEqual([]);
  });
});
