// フィードの表示とクリックの記録。どの並べ方（algorithm＝戦略の名前と版）で何を出し、何が押されたかを残す。
// 送り先（PostHog など）はまだ決めていない。決めたら setFeedEventSink で差し替える（既定は捨てる）
import type { DiscoverQuery } from "./types";

// 1 回のフィード表示に共通する条件。全イベントに付ける
export type FeedEventContext = Pick<DiscoverQuery, "mode" | "sort" | "area" | "cat" | "q"> & { algorithm: string };

// position は 0 始まりの並び位置
export type FeedEvent =
  // count：この表示で最初に出した枚数、total：先頭ページが数えた総件数（1000 件で打ち切り。totalIsLowerBound のとき「1000 件以上」）。続きから開いたときは null
  | { name: "feed_view"; count: number; total: number | null; totalIsLowerBound: boolean }
  | { name: "card_view"; destId: string; position: number }
  | { name: "card_click"; destId: string; position: number }
  | { name: "tile_click"; destId: string; position: number; fromDestId: string }
  // カルーセルのエリアの一言（Stories）の 1 枚を押した。storiesArea はその地区（条件の area と別。条件の area で上書きされない名前にする）、position はカルーセルの中の位置
  | { name: "stories_click"; storiesArea: string; position: number; fromDestId: string };

export type FeedEventRecord = FeedEvent & FeedEventContext;
export type FeedEventSink = (record: FeedEventRecord) => void;

const discard: FeedEventSink = () => {};
let sink: FeedEventSink = discard;

export function setFeedEventSink(next: FeedEventSink | null): void {
  sink = next ?? discard;
}

// 記録の失敗で画面を止めない
export function trackFeedEvent(ctx: FeedEventContext, event: FeedEvent): void {
  try {
    sink({ ...event, ...ctx });
  } catch {
    // 送り先の不具合は無視する
  }
}

// IntersectionObserver の最初の通知は少しでも見えていれば isIntersecting になるので、見えている割合で決める
export function viewedEnough(entries: Pick<IntersectionObserverEntry, "isIntersecting" | "intersectionRatio">[], threshold: number): boolean {
  return entries.some((e) => e.isIntersecting && e.intersectionRatio >= threshold);
}

// カードの中で押されたリンク（か Stories のボタン）から、カードのクリックか関連タイルのクリックかを決める。どちらでもなければ null
export function clickEventOf(
  link: { tileDestId: string | null; tilePosition: string | null; storiesArea?: string | null } | null,
  card: { destId: string; position: number },
): FeedEvent | null {
  if (!link) return null;
  if (link.storiesArea) {
    return { name: "stories_click", storiesArea: link.storiesArea, position: Number(link.tilePosition ?? -1), fromDestId: card.destId };
  }
  if (link.tileDestId) {
    return { name: "tile_click", destId: link.tileDestId, position: Number(link.tilePosition ?? -1), fromDestId: card.destId };
  }
  return { name: "card_click", destId: card.destId, position: card.position };
}
