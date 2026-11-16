import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Catalog } from "./feed";
import { getSavedDests } from "./saves-server";
import type { DestCard, Photo } from "./types";

type Err = { message: string } | null;

// 呼ばれ方を記録し、決めた結果を返す fake（from → select → order）
function fake(result: { data?: unknown; error: Err }) {
  const calls: { op: string; args: unknown[] }[] = [];
  const chain = {
    select: (...args: unknown[]) => (calls.push({ op: "select", args }), chain),
    order: (...args: unknown[]) => (calls.push({ op: "order", args }), Promise.resolve(result)),
  };
  const client = {
    from: (table: string) => (calls.push({ op: "from", args: [table] }), chain),
  } as unknown as SupabaseClient;
  return { client, calls };
}

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

describe("getSavedDests", () => {
  it("user_saves を created_at の新しい順に読み、その順で返す", async () => {
    const { client, calls } = fake({
      data: [{ dest_id: "b", created_at: "2026-02-02" }, { dest_id: "a", created_at: "2026-01-01" }],
      error: null,
    });
    const views = await getSavedDests(client, catalog, "ja");
    expect(views.map((v) => v.destId)).toEqual(["b", "a"]);
    expect(calls).toEqual([
      { op: "from", args: ["user_saves"] },
      { op: "select", args: ["dest_id, created_at"] },
      { op: "order", args: ["created_at", { ascending: false }] },
    ]);
  });

  it("catalog に無いもの（非公開）は出さない", async () => {
    const { client } = fake({ data: [{ dest_id: "gone", created_at: "2026-03-03" }, { dest_id: "a", created_at: "2026-01-01" }], error: null });
    expect((await getSavedDests(client, catalog, "ja")).map((v) => v.destId)).toEqual(["a"]);
  });

  it("タイトル・地域・種類・写真・リンクを言語に合わせて作る", async () => {
    const { client } = fake({ data: [{ dest_id: "a", created_at: "x" }, { dest_id: "b", created_at: "y" }], error: null });
    expect(await getSavedDests(client, catalog, "ja")).toEqual([
      { destId: "a", title: "宿a", areaLabel: "箱根・芦ノ湖", kindLabel: "宿", photo, href: "/ja/d/s-a" },
      { destId: "b", title: "体験b", areaLabel: "", kindLabel: "体験", photo: null, href: "/ja/d/s-b" },
    ]);
    const en = await getSavedDests(client, catalog, "en");
    expect(en[0]).toMatchObject({ title: "Stay a", areaLabel: "Hakone・Lake Ashi", kindLabel: "Stay", href: "/en/d/s-a" });
    // 英語の名前が無ければ日本語で出す
    expect(en[1]).toMatchObject({ title: "体験b", kindLabel: "Experience" });
  });

  it("0 件なら空配列", async () => {
    const { client } = fake({ data: [], error: null });
    expect(await getSavedDests(client, catalog, "ja")).toEqual([]);
  });

  it("エラーは throw", async () => {
    const { client } = fake({ data: null, error: { message: "boom" } });
    await expect(getSavedDests(client, catalog, "ja")).rejects.toThrow("boom");
  });
});
