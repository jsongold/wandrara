import { afterEach, describe, expect, it } from "vitest";
import { clickEventOf, setFeedEventSink, viewedEnough, trackFeedEvent, type FeedEventContext, type FeedEventRecord } from "./feed-events";

const ctx: FeedEventContext = {
  algorithm: "order=editorial@1 primary=by-mode@1 secondary=related-other-mode@1",
  mode: "stay", sort: "editorial", area: "all", cat: "all", q: "",
};

afterEach(() => setFeedEventSink(null));

describe("trackFeedEvent", () => {
  it("全イベントに algorithm と条件を付けて送り先に渡す", () => {
    const got: FeedEventRecord[] = [];
    setFeedEventSink((r) => got.push(r));
    trackFeedEvent(ctx, { name: "card_view", destId: "d1", position: 2 });
    expect(got).toEqual([{ name: "card_view", destId: "d1", position: 2, ...ctx }]);
  });
  it("送り先が落ちても投げない", () => {
    setFeedEventSink(() => { throw new Error("down"); });
    expect(() => trackFeedEvent(ctx, { name: "feed_view", count: 3, total: 194, totalIsLowerBound: false })).not.toThrow();
  });
  it("送り先が無いときは捨てる", () => {
    expect(() => trackFeedEvent(ctx, { name: "feed_view", count: 0, total: 0, totalIsLowerBound: false })).not.toThrow();
  });
});

describe("viewedEnough", () => {
  it("少しだけ見えている通知では送らず、半分見えたら送る", () => {
    expect(viewedEnough([{ isIntersecting: true, intersectionRatio: 0.01 }], 0.5)).toBe(false);
    expect(viewedEnough([{ isIntersecting: true, intersectionRatio: 0.5 }], 0.5)).toBe(true);
    expect(viewedEnough([{ isIntersecting: false, intersectionRatio: 0 }], 0.5)).toBe(false);
  });
});

describe("clickEventOf", () => {
  const card = { destId: "inn", position: 1 };
  it("関連タイルのリンクは tile_click（元のカードも残す）", () => {
    expect(clickEventOf({ tileDestId: "bath", tilePosition: "0" }, card))
      .toEqual({ name: "tile_click", destId: "bath", position: 0, fromDestId: "inn" });
  });
  it("stories_click の地区は、条件の area（全国など）で上書きされない", () => {
    const got: FeedEventRecord[] = [];
    setFeedEventSink((r) => got.push(r));
    trackFeedEvent(ctx, clickEventOf({ tileDestId: null, tilePosition: "0", storiesArea: "atami" }, card)!);
    expect(got[0]).toMatchObject({ name: "stories_click", storiesArea: "atami", area: "all" });
  });
  it("Stories のボタンは stories_click（エリアとカルーセルの中の位置）", () => {
    expect(clickEventOf({ tileDestId: null, tilePosition: "0", storiesArea: "atami" }, card))
      .toEqual({ name: "stories_click", storiesArea: "atami", position: 0, fromDestId: "inn" });
  });
  it("それ以外のリンクは card_click", () => {
    expect(clickEventOf({ tileDestId: null, tilePosition: null }, card)).toEqual({ name: "card_click", destId: "inn", position: 1 });
  });
  it("リンクでなければ記録しない", () => {
    expect(clickEventOf(null, card)).toBeNull();
  });
});
