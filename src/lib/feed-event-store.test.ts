import { describe, expect, it, vi } from "vitest";

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("./supabase/admin.ts", () => ({ adminClient: () => ({ from: (t: string) => ({ insert: (rows: unknown) => insert(t, rows) }) }) }));

import { loadFeedEventStore } from "./feed-event-store";

const row = { name: "card_view" as const, dest_id: "d", position: 0, from_dest_id: null, session_id: "s", algorithm: "a", mode: "stay", sort: "editorial", area: "all", cat: "all" };

describe("loadFeedEventStore", () => {
  it("既定は supabase で、feed_events に書く。失敗は throw", async () => {
    const store = loadFeedEventStore(undefined);
    expect(store.name).toBe("supabase");
    insert.mockResolvedValueOnce({ error: null });
    await store.write([row]);
    expect(insert).toHaveBeenCalledWith("feed_events", [row]);
    insert.mockResolvedValueOnce({ error: { message: "down" } });
    await expect(store.write([row])).rejects.toThrow("feed_events: down");
  });

  it("none は書かない", async () => {
    insert.mockClear();
    await loadFeedEventStore("none").write([row]);
    expect(insert).not.toHaveBeenCalled();
  });

  it("知らない名前は throw（黙って既定にしない）", () => {
    expect(() => loadFeedEventStore("posthgo")).toThrow("FEED_EVENTS_STORE=posthgo");
  });
});
