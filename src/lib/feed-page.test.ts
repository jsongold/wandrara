// feed_page の呼び出しと、cursor・総件数・重複の間引きの引き継ぎ（MS2b）。DB の中身の一致は feed-page.db.test.ts（opt-in）
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_QUERY } from "./discover-query";
import { decodeCursor, encodeCursor, fetchFeedPage, FeedCursorError, feedQueryKey, FEED_PAGE_MAX } from "./feed-page";

vi.mock("./data", () => ({ env: () => ({ url: "https://x.supabase.co" }), supabase: () => ({}), photoUrl: (b: string, k: string) => `${b}/${k}` }));

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const name = (s: string) => ({ ja: s });
const tile = (n: number) => ({ dest_id: id(n), slug: `t${n}`, name: name(`タイル${n}`), photo: null, region_name: name("地区"), parent_region_name: name("エリア") });
const card = (n: number, tiles: number[]) => ({
  dest_id: id(n), core_type: "accommodation", slug: `d${n}`, name: name(`宿${n}`), photos: [{ storage_key: `k${n}`, license: null, credit: null }],
  region_name: name("地区"), parent_region_name: null, sort_key: `2026-01-0${n}T00:00:00+00:00`, tiles: tiles.map(tile),
});

function fake(result: unknown) {
  const rpc = vi.fn(async () => ({ data: result, error: null }));
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}
const args = { query: DEFAULT_QUERY, locale: "ja" as const };

describe("fetchFeedPage", () => {
  it("先頭ページ：DB の呼び出し・FeedCard の形・総件数・次の cursor", async () => {
    const { db, rpc } = fake({ cards: [card(1, [10, 11])], has_more: true, total: 1000, total_capped: true });
    const r = await fetchFeedPage(db, "https://x.supabase.co", { ...args, query: { ...DEFAULT_QUERY, area: "tokyo", cat: "onsen", q: "湯" }, limit: 99 });
    expect(rpc).toHaveBeenCalledWith("feed_page", expect.objectContaining({
      p_core_types: ["accommodation"], p_related_core_types: ["accommodation", "experience", "nature", "village", "building", "hotspring"],
      p_area: "tokyo", p_cat: "onsen", p_q: "湯", p_sort: "editorial", p_limit: FEED_PAGE_MAX, p_after_key: null, p_after_id: null, p_with_total: true,
    }));
    expect(r.cards[0]).toMatchObject({
      key: id(1), destId: id(1), title: "宿1", areaLabel: "地区", href: "/ja/d/d1",
      photos: [{ url: "https://x.supabase.co/k1", isDemo: false }],
    });
    expect(r.cards[0].tiles.map((x) => [x.destId, x.sub, x.href])).toEqual([[id(10), "エリア・地区", "/ja/d/t10"], [id(11), "エリア・地区", "/ja/d/t11"]]);
    expect(r.total).toBe(1000);
    expect(r.totalIsLowerBound).toBe(true);
    expect(r.queryKey).toBe(feedQueryKey({ ...DEFAULT_QUERY, area: "tokyo", cat: "onsen", q: "湯" }, "ja"));
    expect(r.nextCursor).not.toBeNull();
  });

  it("次のページ：cursor を DB に渡し、総件数は返さず、前のページの最後のカードのタイルを最初のカードから間引く", async () => {
    const first = fake({ cards: [card(1, [10, 11, 12]), card(2, [11, 12, 13])], has_more: true, total: 5, total_capped: false });
    const p1 = await fetchFeedPage(first.db, "u", { ...args, limit: 2 });
    // 2 枚目は 11・12 が直前と重なるので 13 だけ（残りが 1 枚以上ある）
    expect(p1.cards[1].tiles.map((x) => x.destId)).toEqual([id(13)]);

    const second = fake({ cards: [card(3, [13, 14])], has_more: false, total: null, total_capped: false });
    const p2 = await fetchFeedPage(second.db, "u", { ...args, cursor: p1.nextCursor });
    expect(second.rpc).toHaveBeenCalledWith("feed_page", expect.objectContaining({ p_after_key: "2026-01-02T00:00:00+00:00", p_after_id: id(2), p_with_total: false }));
    expect(p2.cards[0].tiles.map((x) => x.destId)).toEqual([id(14)]);   // 13 は前のページの最後のカードに出したので出さない
    expect(p2.total).toBeNull();
    expect(p2.nextCursor).toBeNull();
    expect(p2.emptyReason).toBeNull();
  });

  it("0 件：先頭ページだけ no-match。続きのページが空でも no-match にしない", async () => {
    const empty = { cards: [], has_more: false, total: 0, total_capped: false };
    expect((await fetchFeedPage(fake(empty).db, "u", args)).emptyReason).toBe("no-match");
    const cursor = encodeCursor({ v: 1, q: feedQueryKey(DEFAULT_QUERY, "ja"), k: "-infinity", i: id(1), p: [] });
    expect((await fetchFeedPage(fake(empty).db, "u", { ...args, cursor })).emptyReason).toBeNull();
  });

  it("DB のエラーは throw する（欠けたページを返さない）", async () => {
    const db = { rpc: async () => ({ data: null, error: { message: "boom" } }) } as unknown as SupabaseClient;
    await expect(fetchFeedPage(db, "u", args)).rejects.toThrow("feed_page: boom");
  });
});

describe("cursor", () => {
  const key = feedQueryKey(DEFAULT_QUERY, "ja");
  const good = { v: 1 as const, q: key, k: "2026-01-01T00:00:00.123456+00:00", i: id(1), p: [id(2)] };

  it("往復できる", () => expect(decodeCursor(encodeCursor(good), key)).toEqual(good));
  it("別の条件の cursor は query-mismatch", () => {
    expect(() => decodeCursor(encodeCursor(good), feedQueryKey({ ...DEFAULT_QUERY, mode: "do" }, "ja"))).toThrow(FeedCursorError);
    try { decodeCursor(encodeCursor(good), "other"); } catch (e) { expect((e as FeedCursorError).code).toBe("query-mismatch"); }
  });
  it.each([
    ["壊れた文字列", "!!!"],
    ["並びの値が日付でない", encodeCursor({ ...good, k: "'; drop table x" })],
    ["dest_id が uuid でない", encodeCursor({ ...good, i: "abc" })],
    ["タイルが多すぎる", encodeCursor({ ...good, p: Array.from({ length: 7 }, (_, n) => id(n)) })],
  ])("不正な cursor は invalid：%s", (_, raw) => {
    try { decodeCursor(raw, key); throw new Error("no throw"); } catch (e) { expect((e as FeedCursorError).code).toBe("invalid"); }
  });
  it("-infinity（公開日なし）の cursor を受け付ける", () => {
    expect(decodeCursor(encodeCursor({ ...good, k: "-infinity" }), key).k).toBe("-infinity");
  });
});

describe("点数の順（#156）", () => {
  const plan = { order: "score" as const, algorithm: "order=score@1 primary=by-mode@2 secondary=related-any-kind@1 paging=keyset@1" };
  const scored = (n: number, score: string) => ({ ...card(n, []), sort_key: score });

  it("p_sort=score で呼び、続きは p_after_score に数で渡す。ラベルと algorithm は点数の順", async () => {
    const first = fake({ cards: [scored(1, "0.9"), scored(2, "0.25")], has_more: true, total: 3, total_capped: false });
    const p1 = await fetchFeedPage(first.db, "u", { ...args, limit: 2, plan });
    expect(first.rpc).toHaveBeenCalledWith("feed_page", expect.objectContaining({ p_sort: "score", p_after_key: null, p_after_score: null }));
    expect(p1.orderLabel).toBe("おすすめ順");
    expect(p1.algorithm).toBe(plan.algorithm);

    const second = fake({ cards: [scored(3, "1e-05")], has_more: false, total: null, total_capped: false });
    await fetchFeedPage(second.db, "u", { ...args, cursor: p1.nextCursor, plan });
    expect(second.rpc).toHaveBeenCalledWith("feed_page", expect.objectContaining({ p_sort: "score", p_after_key: null, p_after_score: 0.25, p_after_id: id(2) }));
  });

  it("新着順は戦略によらず作成日の順", async () => {
    const { db, rpc } = fake({ cards: [], has_more: false, total: 0, total_capped: false });
    const r = await fetchFeedPage(db, "u", { ...args, query: { ...DEFAULT_QUERY, sort: "fresh" }, plan });
    expect(rpc).toHaveBeenCalledWith("feed_page", expect.objectContaining({ p_sort: "fresh", p_after_score: null }));
    expect(r.orderLabel).toBe("新着順");
  });

  const codeOf = async (p: Promise<unknown>) => p.then(() => null, (e) => (e as FeedCursorError).code);

  it("並べ方を切り替えた直後の古い cursor は、どちら向きでも query-mismatch（409 で先頭から取り直させる）", async () => {
    const editorialCursor = encodeCursor({ v: 1, q: feedQueryKey(DEFAULT_QUERY, "ja"), k: "2026-01-01T00:00:00+00:00", i: id(1), p: [] });
    expect(await codeOf(fetchFeedPage(fake({}).db, "u", { ...args, cursor: editorialCursor, plan }))).toBe("query-mismatch");
    const scoreCursor = encodeCursor({ v: 1, q: feedQueryKey(DEFAULT_QUERY, "ja", "score"), k: "0.25", i: id(1), p: [] });
    expect(await codeOf(fetchFeedPage(fake({}).db, "u", { ...args, cursor: scoreCursor }))).toBe("query-mismatch");
  });

  it("同じ条件で並びの値の形が違うものは invalid", () => {
    const scoreKey = feedQueryKey(DEFAULT_QUERY, "ja", "score");
    expect(() => decodeCursor(encodeCursor({ v: 1, q: scoreKey, k: "2026-01-01T00:00:00+00:00", i: id(1), p: [] }), scoreKey, "score")).toThrow(
      expect.objectContaining({ code: "invalid" }),
    );
  });
});

describe("dbFeedPlan", () => {
  it("並びが editorial か score で、メイン・関連タイルが既定なら DB 版", async () => {
    const { loadFeedStrategies } = await import("./feed-config");
    const { dbFeedPlan } = await import("./feed-page");
    expect(dbFeedPlan(loadFeedStrategies({}))?.order).toBe("editorial");
    expect(dbFeedPlan(loadFeedStrategies({ order: "score" }))).toEqual({
      order: "score", algorithm: "order=score@1 primary=by-mode@2 secondary=related-any-kind@1 paging=keyset@1",
    });
  });

  it("関連タイルを差し替えているときは点数の順を選べず、編集部の順の全件版になる", async () => {
    const { loadFeedStrategies } = await import("./feed-config");
    const { dbFeedPlan } = await import("./feed-page");
    const s = loadFeedStrategies({ order: "score", secondary: "related-other-mode" });
    expect(s.id.startsWith("order=editorial@1 ")).toBe(true);
    expect(dbFeedPlan(s)).toBeNull();
  });
});

describe("dbFeedApplies", () => {
  it("既定の 3 戦略だけ DB 版。差し替えているときは buildFeed に分岐する", async () => {
    const { loadFeedStrategies } = await import("./feed-config");
    const { dbFeedApplies } = await import("./feed-page");
    expect(dbFeedApplies(loadFeedStrategies({}))).toBe(true);
    expect(dbFeedApplies({ ...loadFeedStrategies({}), id: "order=popular@1 primary=by-mode@1 secondary=related-other-mode@1" })).toBe(false);
  });
});
