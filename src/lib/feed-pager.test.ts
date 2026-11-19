// FeedPager の契約（MS2b #109）：古い応答を捨てる・destId で重複を除く・上限つきの再試行・取得は 1 本だけ
import { describe, expect, it, vi } from "vitest";
import type { FeedPageResult } from "./feed-page";
import { apiFetchPage, CursorMismatch, FeedPager, mergeCards, nextPageHref, type FetchPage } from "./feed-pager";
import type { FeedCard } from "./types";

const card = (n: number): FeedCard => ({
  key: `d${n}`, destId: `d${n}`, title: `宿${n}`, areaLabel: "", kindLabel: "", relLabel: "", photos: [], href: `/ja/d/${n}`, carousel: [],
});
const page = (ids: number[], over: Partial<FeedPageResult> = {}): FeedPageResult => ({
  cards: ids.map(card), orderLabel: "", algorithm: "a", emptyReason: null,
  queryKey: "Q1", nextCursor: "c1", total: null, totalIsLowerBound: false, ...over,
});
const first = page([1, 2], { total: 5 });
const noSleep = async () => {};

// 外から解決できる取得
function deferred() {
  const calls: { cursor: string | null; signal: AbortSignal; resolve: (r: FeedPageResult) => void; reject: (e: unknown) => void }[] = [];
  const fetchPage: FetchPage = (cursor, signal) =>
    new Promise((resolve, reject) => {
      calls.push({ cursor, signal, resolve, reject });
    });
  return { calls, fetchPage };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("mergeCards", () => {
  it("destId が同じカードは 1 回だけ。先にあるものを残し、順を保つ", () => {
    const merged = mergeCards([card(1), card(2)], [card(2), card(3), card(3)]);
    expect(merged.map((c) => c.destId)).toEqual(["d1", "d2", "d3"]);
  });
  it("足すものが無ければ同じ配列を返す（再描画しない）", () => {
    const a = [card(1)];
    expect(mergeCards(a, [card(1)])).toBe(a);
  });
});

describe("FeedPager.loadMore", () => {
  it("続きを足し、cursor を進め、総件数は先頭ページのまま", async () => {
    const fetchPage = vi.fn<FetchPage>(async () => page([3, 4], { nextCursor: null, total: null }));
    const p = new FeedPager(first, fetchPage);
    await p.loadMore();
    const s = p.getSnapshot();
    expect(fetchPage).toHaveBeenCalledWith("c1", expect.any(AbortSignal));
    expect(s.cards.map((c) => c.destId)).toEqual(["d1", "d2", "d3", "d4"]);
    expect(s).toMatchObject({ nextCursor: null, status: "idle", total: 5 });
  });

  it("読んでいる間に動いた dest が重なっても destId で 1 回にする", async () => {
    const p = new FeedPager(first, async () => page([2, 3], { nextCursor: null }));
    await p.loadMore();
    expect(p.getSnapshot().cards.map((c) => c.destId)).toEqual(["d1", "d2", "d3"]);
  });

  it("取得は 1 本だけ（同じ cursor の二重送信をしない）。続きが無ければ呼ばない", async () => {
    const d = deferred();
    const p = new FeedPager(first, d.fetchPage);
    const a = p.loadMore();
    void p.loadMore();
    await tick();
    expect(d.calls).toHaveLength(1);
    d.calls[0].resolve(page([3], { nextCursor: null }));
    await a;
    await p.loadMore();
    expect(d.calls).toHaveLength(1);
  });

  it("今の条件と違う queryKey の応答は捨てる（反映せず error で止める。自動でやり直さない）", async () => {
    const p = new FeedPager(first, async () => page([9], { queryKey: "Q2" }));
    await p.loadMore();
    const s = p.getSnapshot();
    expect(s.cards.map((c) => c.destId)).toEqual(["d1", "d2"]);
    expect(s).toMatchObject({ nextCursor: "c1", status: "error" });
  });

  it("dispose（条件の変更）で進行中の取得を止め、後から来た応答は反映しない", async () => {
    const d = deferred();
    const p = new FeedPager(first, d.fetchPage);
    const run = p.loadMore();
    await tick();
    p.dispose();
    expect(d.calls[0].signal.aborted).toBe(true);
    d.calls[0].resolve(page([7, 8]));
    await run;
    expect(p.getSnapshot().cards.map((c) => c.destId)).toEqual(["d1", "d2"]);
    expect(p.getSnapshot().status).toBe("idle");
  });

  it("止められた取得の失敗は再試行しない", async () => {
    const d = deferred();
    const p = new FeedPager(first, d.fetchPage, { sleep: noSleep });
    const run = p.loadMore();
    await tick();
    p.dispose();
    d.calls[0].reject(new DOMException("aborted", "AbortError"));
    await run;
    expect(d.calls).toHaveLength(1);
    expect(p.getSnapshot().status).toBe("idle");
  });

  it("失敗は上限つきで再試行し、途中で成功すれば反映する", async () => {
    let n = 0;
    const fetchPage = vi.fn<FetchPage>(async () => {
      if (++n < 3) throw new Error("net");
      return page([3], { nextCursor: null });
    });
    const slept: number[] = [];
    const sleep = async (ms: number) => {
      slept.push(ms);
    };
    const p = new FeedPager(first, fetchPage, { retries: 2, backoffMs: [10, 20], sleep });
    await p.loadMore();
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(slept).toEqual([10, 20]);
    expect(p.getSnapshot().cards).toHaveLength(3);
  });

  it("再試行が尽きたら error で止まり、cursor は残る。もう一度 loadMore すれば取れる", async () => {
    let fail = true;
    const fetchPage = vi.fn<FetchPage>(async () => {
      if (fail) throw new Error("net");
      return page([3], { nextCursor: null });
    });
    const p = new FeedPager(first, fetchPage, { retries: 2, sleep: noSleep });
    await p.loadMore();
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(p.getSnapshot()).toMatchObject({ status: "error", nextCursor: "c1" });
    fail = false;
    await p.loadMore();
    expect(p.getSnapshot()).toMatchObject({ status: "idle", nextCursor: null });
    expect(p.getSnapshot().cards).toHaveLength(3);
  });

  it("別の条件の cursor（409）は先頭ページから取り直して置き換える", async () => {
    const fetchPage = vi.fn<FetchPage>(async (cursor) => {
      if (cursor) throw new CursorMismatch();
      return page([5, 6], { nextCursor: "c9", total: 7 });
    });
    const p = new FeedPager(first, fetchPage, { sleep: noSleep });
    await p.loadMore();
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual(["c1", null]);
    expect(p.getSnapshot()).toMatchObject({ nextCursor: "c9", total: 7, status: "idle" });
    expect(p.getSnapshot().cards.map((c) => c.destId)).toEqual(["d5", "d6"]);
  });

  it("並べ方が変わって 409 になったら、取り直した先頭ページの queryKey ごと置き換え、その後の続きも読める", async () => {
    const fetchPage = vi.fn<FetchPage>(async (cursor) => {
      if (cursor === "c1") throw new CursorMismatch();
      return cursor === null
        ? page([5], { queryKey: "Q1+score", nextCursor: "s1", algorithm: "order=score@1" })
        : page([6], { queryKey: "Q1+score", nextCursor: null, algorithm: "order=score@1" });
    });
    const p = new FeedPager(first, fetchPage, { sleep: noSleep });
    await p.loadMore();
    expect(p.getSnapshot()).toMatchObject({ queryKey: "Q1+score", nextCursor: "s1", status: "idle", algorithm: "order=score@1" });
    await p.loadMore();
    expect(p.getSnapshot()).toMatchObject({ nextCursor: null, status: "idle" });
    expect(p.getSnapshot().cards.map((c) => c.destId)).toEqual(["d5", "d6"]);
  });

  it("状態の変化を購読者に知らせる", async () => {
    const p = new FeedPager(first, async () => page([3], { nextCursor: null }));
    const seen: string[] = [];
    p.subscribe(() => seen.push(p.getSnapshot().status));
    await p.loadMore();
    expect(seen).toEqual(["loading", "idle"]);
  });
});

describe("apiFetchPage / nextPageHref", () => {
  it("条件と cursor を /api/feed に載せる。409 は CursorMismatch、それ以外の失敗は Error", async () => {
    const res = (status: number, body: unknown = {}) => ({ status, ok: status < 400, json: async () => body }) as Response;
    const f = vi.fn().mockResolvedValueOnce(res(200, { ok: 1 })).mockResolvedValueOnce(res(409)).mockResolvedValueOnce(res(502));
    vi.stubGlobal("fetch", f);
    const fetchPage = apiFetchPage({ mode: "do", area: "tokyo", cat: "all", sort: "fresh", q: "湯" }, "ja");
    const signal = new AbortController().signal;
    await expect(fetchPage("abc", signal)).resolves.toEqual({ ok: 1 });
    const url = new URL(f.mock.calls[0][0], "http://x");
    expect(Object.fromEntries(url.searchParams)).toEqual({ lang: "ja", mode: "do", area: "tokyo", cat: "all", sort: "fresh", q: "湯", cursor: "abc" });
    expect(f.mock.calls[0][1]).toEqual({ signal });
    await expect(fetchPage(null, signal)).rejects.toBeInstanceOf(CursorMismatch);
    await expect(fetchPage(null, signal)).rejects.toThrow("feed 502");
    vi.unstubAllGlobals();
  });

  it("次のページへのリンクは条件のクエリに after を足す", () => {
    expect(nextPageHref("/ja", "a b")).toBe("/ja?after=a%20b");
    expect(nextPageHref("/ja?area=tokyo", "x")).toBe("/ja?area=tokyo&after=x");
  });
});
