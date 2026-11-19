import { describe, expect, it } from "vitest";
import { getSavedDests } from "./saves-server";
import { fakeDb } from "./supabase/fake-db";
import type { Region } from "./types";

const regions: Region[] = [
  { id: "hakone", parentId: null, name: { ja: "箱根", en: "Hakone" }, sort: 0 },
  { id: "ashinoko", parentId: "hakone", name: { ja: "芦ノ湖", en: "Lake Ashi" }, sort: 0 },
];
const ctx = { regions, photoBase: (k: string) => `https://x/${k}` };

// dest_cards の行（photo は photos->0 の結果）
const card = (id: string, over: Record<string, unknown> = {}) => ({
  dest_id: id, core_type: "accommodation", slug: `s-${id}`, region_id: null, name: { ja: `宿${id}`, en: `Stay ${id}` }, photo: null, ...over,
});
const save = (dest_id: string, created_at: string) => ({ dest_id, created_at });
const run = (saves: ReturnType<typeof save>[], cards: ReturnType<typeof card>[], opts?: Parameters<typeof fakeDb>[1]) =>
  getSavedDests(fakeDb({ user_saves: saves, dest_cards: cards }, opts).db, ctx, "ja");

const base = [card("a", { region_id: "ashinoko", photo: { storage_key: "k/a.jpg", license: "cc", credit: "me" } }), card("b", { core_type: "experience", name: { ja: "体験b" } })];

describe("getSavedDests", () => {
  it("user_saves を created_at の新しい順に読み、その順で返す", async () => {
    const views = await run([save("a", "2026-01-01"), save("b", "2026-02-02")], base);
    expect(views.map((v) => v.destId)).toEqual(["b", "a"]);
  });

  it("同じ時刻なら dest_id の降順で、毎回同じ順になる", async () => {
    const rows = [save("a", "2026-01-01"), save("b", "2026-01-01")];
    expect((await run(rows, base)).map((v) => v.destId)).toEqual(["b", "a"]);
    expect((await run([...rows].reverse(), base)).map((v) => v.destId)).toEqual(["b", "a"]);
  });

  it("1000 件を超えても新しい順のまま全部返す（同じ時刻が多数でもページの境目で落ちない）", async () => {
    const cards = Array.from({ length: 2500 }, (_, i) => card(`d${String(i).padStart(5, "0")}`));
    // 時刻は 100 件ずつ同じ。新しい順は (時刻, dest_id) の降順
    const rows = cards.map((d, i) => save(d.dest_id, `2026-01-${String(1 + Math.floor(i / 100)).padStart(2, "0")}`));
    const views = await run(rows, cards);
    expect(views).toHaveLength(2500);
    expect(views.map((v) => v.destId)).toEqual(cards.map((d) => d.dest_id).reverse());
  });

  it("保存した dest だけを 100 件ずつ引く（dest_cards の全件は読まない）", async () => {
    const cards = Array.from({ length: 250 }, (_, i) => card(`d${String(i).padStart(3, "0")}`));
    const { db, ranges } = fakeDb({ user_saves: [save("d001", "2026-01-01"), save("d002", "2026-01-02")], dest_cards: cards });
    const calls: string[] = [];
    const from = db.from.bind(db);
    db.from = ((t: string) => (calls.push(t), from(t))) as typeof db.from;
    const views = await getSavedDests(db, ctx, "ja");
    expect(views.map((v) => v.destId)).toEqual(["d002", "d001"]);
    expect(calls).toEqual(["user_saves", "dest_cards"]); // 2 件の保存 → dest_cards は 1 回
    expect(ranges).toEqual([[0, 999]]); // dest_cards を range で全件読んでいない
  });

  it("途中のページが失敗したら throw する", async () => {
    const cards = Array.from({ length: 2500 }, (_, i) => card(`d${i}`));
    await expect(run(cards.map((d) => save(d.dest_id, "2026-01-01")), cards, { failAtFrom: 1000 })).rejects.toThrow("page failed");
  });

  it("dest_cards の取得が失敗したら throw する", async () => {
    await expect(run([save("a", "2026-01-01")], base, { failAtFrom: -1 })).rejects.toThrow("page failed");
  });

  it("ページの境目で同じ行を 2 回読んでも 1 回だけ返す", async () => {
    const views = await run([save("a", "2026-01-01"), save("a", "2026-01-01")], base);
    expect(views.map((v) => v.destId)).toEqual(["a"]);
  });

  it("dest_cards に無いもの（非公開）は出さない", async () => {
    expect((await run([save("gone", "2026-03-03"), save("a", "2026-01-01")], base)).map((v) => v.destId)).toEqual(["a"]);
  });

  it("タイトル・地域・種類・写真・リンクを言語に合わせて作る", async () => {
    const db = fakeDb({ user_saves: [save("b", "2026-01-01"), save("a", "2026-01-02")], dest_cards: base }).db;
    const photo = { url: "https://x/k/a.jpg", license: "cc", credit: "me", isDemo: false, placeholderSky: null, placeholderLand: null };
    expect(await getSavedDests(db, ctx, "ja")).toEqual([
      { destId: "a", title: "宿a", areaLabel: "箱根・芦ノ湖", kindLabel: "宿", photo, href: "/ja/d/s-a" },
      { destId: "b", title: "体験b", areaLabel: "", kindLabel: "体験", photo: null, href: "/ja/d/s-b" },
    ]);
    const en = await getSavedDests(db, ctx, "en");
    expect(en[0]).toMatchObject({ title: "Stay a", areaLabel: "Hakone・Lake Ashi", kindLabel: "Stay", href: "/en/d/s-a" });
    // 英語の名前が無ければ日本語で出す
    expect(en[1]).toMatchObject({ title: "体験b", kindLabel: "Experience" });
  });

  it("0 件なら空配列で、dest_cards は引かない", async () => {
    expect(await run([], base)).toEqual([]);
  });
});
