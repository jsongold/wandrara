import { beforeEach, describe, expect, it, vi } from "vitest";

const { write } = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("@/lib/feed-event-store", () => ({ loadFeedEventStore: () => ({ name: "test", write }) }));

import { POST } from "./route";

const S = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const D = "00000000-0000-0000-0000-000000000001";
const T = "00000000-0000-0000-0000-000000000002";
const base = { algorithm: "order=editorial@1", mode: "stay", sort: "editorial", area: "all", cat: "all" };
const post = (body: unknown) =>
  POST(new Request("http://x/api/feed/events", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

describe("POST /api/feed/events", () => {
  beforeEach(() => {
    write.mockReset();
    write.mockResolvedValue(undefined);
  });

  it("行の形にして書く。from_dest_id は tile_click だけ", async () => {
    const res = await post({
      sessionId: S,
      events: [
        { name: "card_click", destId: D, position: 3, fromDestId: T, ...base },
        { name: "tile_click", destId: T, position: 1, fromDestId: D, ...base },
      ],
    });
    expect(res.status).toBe(204);
    const rows = write.mock.calls[0][0];
    expect(rows).toEqual([
      { name: "card_click", dest_id: D, position: 3, from_dest_id: null, session_id: S, ...base },
      { name: "tile_click", dest_id: T, position: 1, from_dest_id: D, session_id: S, ...base },
    ]);
  });

  it.each([
    ["JSON でない", "{"],
    ["知らないイベント", { sessionId: S, events: [{ name: "feed_view", destId: D, position: 0, ...base }] }],
    ["uuid でない", { sessionId: S, events: [{ name: "card_view", destId: "x", position: 0, ...base }] }],
    ["空", { sessionId: S, events: [] }],
    ["多すぎる", { sessionId: S, events: Array.from({ length: 51 }, () => ({ name: "card_view", destId: D, position: 0, ...base })) }],
  ])("%s は 400 で書かない", async (_label, body) => {
    expect((await post(body)).status).toBe(400);
    expect(write).not.toHaveBeenCalled();
  });

  it("書けなければ 500", async () => {
    write.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post({ sessionId: S, events: [{ name: "card_view", destId: D, position: 0, ...base }] })).status).toBe(500);
  });
});
