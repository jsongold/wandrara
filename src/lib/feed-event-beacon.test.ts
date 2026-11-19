import { describe, expect, it } from "vitest";
import { createBeaconSink, FEED_EVENTS_MAX, type FeedEventPayload } from "./feed-event-beacon";
import type { FeedEventRecord } from "./feed-events";

const ctx = { algorithm: "order=editorial@1", mode: "stay", sort: "editorial", area: "all", cat: "all", q: "温泉" } as const;
const view = (i: number): FeedEventRecord => ({ name: "card_view", destId: `d${i}`, position: i, ...ctx });

function setup() {
  const sent: FeedEventPayload[] = [];
  let pending: (() => void) | null = null;
  const { sink, flush } = createBeaconSink({
    sessionId: "s1",
    send: (p) => sent.push(p),
    setTimer: (fn) => (pending = fn),
    clearTimer: () => (pending = null),
  });
  return { sent, sink, flush, fireTimer: () => pending?.() };
}

describe("createBeaconSink", () => {
  it("時間がたつとまとめて送る。検索語 q は送らない", () => {
    const { sent, sink, fireTimer } = setup();
    sink(view(0));
    sink({ name: "tile_click", destId: "t1", position: 2, fromDestId: "d0", ...ctx });
    expect(sent).toEqual([]);
    fireTimer();
    expect(sent).toHaveLength(1);
    expect(sent[0].sessionId).toBe("s1");
    expect(sent[0].events.map((e) => e.name)).toEqual(["card_view", "tile_click"]);
    expect(sent[0].events.every((e) => !("q" in e))).toBe(true);
  });

  it("feed_view は送らない", () => {
    const { sent, sink, flush } = setup();
    sink({ name: "feed_view", count: 6, total: 10, totalIsLowerBound: false, ...ctx });
    flush();
    expect(sent).toEqual([]);
  });

  it("上限の件数でその場で送り、残りは次にまとめる", () => {
    const { sent, sink, flush } = setup();
    for (let i = 0; i < FEED_EVENTS_MAX + 1; i++) sink(view(i));
    expect(sent).toHaveLength(1);
    expect(sent[0].events).toHaveLength(FEED_EVENTS_MAX);
    flush();
    expect(sent).toHaveLength(2);
    expect(sent[1].events).toHaveLength(1);
  });

  it("空なら送らない", () => {
    const { sent, flush } = setup();
    flush();
    expect(sent).toEqual([]);
  });
});
