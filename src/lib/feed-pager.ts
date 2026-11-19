// フィードの続きの取得（クライアント側）。MS2b #109 の契約：
// - 条件を変えたら進行中の取得を止め、今の条件と違う queryKey の応答は捨てる
// - 追加取得は 1 本だけ。destId で重複を 1 回にする（読んでいる間に並びの値が動いた dest が重ならない）
// - 失敗は上限つきで自動で再試行し、それでも駄目なら error で止める（呼び出し側が押されたら loadMore をもう一度呼ぶ）
// サーバー側のモジュールは import しない（型だけ）。
import type { FeedPageResult } from "./feed-page";
import type { DiscoverQuery, FeedCard, Locale } from "./types";

export type PagerState = {
  queryKey: string;
  cards: FeedCard[];
  nextCursor: string | null;
  status: "idle" | "loading" | "error";
  total: number | null;
  totalIsLowerBound: boolean;
};

// cursor が null なら先頭ページ
export type FetchPage = (cursor: string | null, signal: AbortSignal) => Promise<FeedPageResult>;

// 別の条件の cursor を渡した（サーバーが 409）。先頭ページから取り直す
export class CursorMismatch extends Error {}

type Options = { retries?: number; backoffMs?: number[]; sleep?: (ms: number, signal: AbortSignal) => Promise<void> };

const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF = [400, 1200];

function sleepDefault(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const id = setTimeout(done, ms);
    function done() {
      clearTimeout(id);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done);
  });
}

// 先にあるカードを残して、destId が重ならないように足す
export function mergeCards(existing: FeedCard[], incoming: FeedCard[]): FeedCard[] {
  const seen = new Set(existing.map((c) => c.destId));
  const added = incoming.filter((c) => !seen.has(c.destId) && seen.add(c.destId));
  return added.length === 0 ? existing : [...existing, ...added];
}

export class FeedPager {
  private state: PagerState;
  private listeners = new Set<() => void>();
  private inflight: AbortController | null = null;
  private retries: number;
  private backoff: number[];
  private sleep: (ms: number, signal: AbortSignal) => Promise<void>;

  constructor(initial: FeedPageResult, private fetchPage: FetchPage, opts: Options = {}) {
    this.state = {
      queryKey: initial.queryKey,
      cards: initial.cards,
      nextCursor: initial.nextCursor,
      status: "idle",
      total: initial.total,
      totalIsLowerBound: initial.totalIsLowerBound,
    };
    this.retries = opts.retries ?? DEFAULT_RETRIES;
    this.backoff = opts.backoffMs ?? DEFAULT_BACKOFF;
    this.sleep = opts.sleep ?? sleepDefault;
  }

  // useSyncExternalStore 用
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): PagerState => this.state;

  private set(patch: Partial<PagerState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  // 進行中の取得を止める。応答が後から来ても反映しない（この pager を捨てるとき・条件が変わるとき）
  dispose(): void {
    this.inflight?.abort();
    this.inflight = null;
    if (this.state.status === "loading") this.set({ status: "idle" });
  }

  async loadMore(): Promise<void> {
    const { nextCursor, queryKey } = this.state;
    if (this.inflight || !nextCursor) return;
    const ctrl = new AbortController();
    this.inflight = ctrl;
    this.set({ status: "loading" });
    // 止められた・別の取得に置き換わったあとの応答は反映しない
    const current = () => this.inflight === ctrl && !ctrl.signal.aborted;
    try {
      let res: FeedPageResult;
      let restarted = false;
      try {
        res = await this.fetchWithRetry(nextCursor, ctrl.signal);
      } catch (e) {
        if (!(e instanceof CursorMismatch)) throw e;
        restarted = true;
        res = await this.fetchWithRetry(null, ctrl.signal);
      }
      if (!current()) return;
      // 取り直した先頭ページは、この pager の条件で取ったもの。queryKey が違うのはサーバーの並べ方が変わったとき（例：編集部の順 → 点数の順）なので、
      // その queryKey ごと置き換える（そうしないと 409 → 取り直し → 不一致を繰り返し、続きが読めなくなる）
      if (!restarted && res.queryKey !== queryKey) {
        // 今の条件と違う答え。反映せず、自動の再取得もしない（error で止めて、押されたときだけやり直す）
        this.set({ status: "error" });
        return;
      }
      this.set({
        cards: restarted ? res.cards : mergeCards(this.state.cards, res.cards),
        queryKey: res.queryKey,
        nextCursor: res.nextCursor,
        status: "idle",
        ...(restarted ? { total: res.total, totalIsLowerBound: res.totalIsLowerBound } : {}),
      });
    } catch {
      if (current()) this.set({ status: "error" });
    } finally {
      if (this.inflight === ctrl) this.inflight = null;
    }
  }

  private async fetchWithRetry(cursor: string | null, signal: AbortSignal): Promise<FeedPageResult> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.fetchPage(cursor, signal);
      } catch (e) {
        if (signal.aborted || e instanceof CursorMismatch || attempt >= this.retries) throw e;
        await this.sleep(this.backoff[attempt] ?? this.backoff.at(-1) ?? 0, signal);
        if (signal.aborted) throw e;
      }
    }
  }
}

// /api/feed を呼ぶ取得関数。条件は URL に載せ、サーバーが同じ条件の cursor かを確かめる
export function apiFetchPage(query: DiscoverQuery, locale: Locale): FetchPage {
  return async (cursor, signal) => {
    const p = new URLSearchParams({ lang: locale, mode: query.mode, area: query.area, cat: query.cat, sort: query.sort });
    if (query.q) p.set("q", query.q);
    if (cursor) p.set("cursor", cursor);
    const res = await fetch(`/api/feed?${p}`, { signal });
    if (res.status === 409) throw new CursorMismatch();
    if (!res.ok) throw new Error(`feed ${res.status}`);
    return (await res.json()) as FeedPageResult;
  };
}

// サーバーが描く「次のページ」へのリンク（検索エンジンがたどる）。JS が動くときは loadMore に置き換わる
export function nextPageHref(baseUrl: string, cursor: string): string {
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}after=${encodeURIComponent(cursor)}`;
}
