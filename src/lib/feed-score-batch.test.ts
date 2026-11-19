import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { runFeedScoreBatch } from "./feed-score-batch";

const W = { version: 7, actions: { card_click: 1, tile_click: 1.5, save: 8 }, priorStrength: 10 };

function fake(inputs: unknown, applied = 2) {
  const rpc = vi.fn(async (fn: string) =>
    fn === "feed_score_inputs" ? { data: inputs, error: null } : { data: applied, error: null });
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}

describe("runFeedScoreBatch", () => {
  it("読み元を差し替えられる（書き込みは db のまま）", async () => {
    const { db, rpc } = fake(null);
    const source = { name: "other", load: vi.fn(async () => ({ targets: [{ dest_id: "a", core_type: "stay" }], counts: [] })) };
    const r = await runFeedScoreBatch(db, new Date("2026-11-19T00:00:00Z"), W, source);
    expect(source.load).toHaveBeenCalledWith("2026-08-21T00:00:00.000Z");
    expect(rpc.mock.calls.map((c) => c[0])).toEqual(["feed_scores_apply"]);
    expect(r.source).toBe("other");
  });

  it("知らない読み元は throw", async () => {
    const { loadFeedScoreSource } = await import("./feed-score-source");
    expect(() => loadFeedScoreSource(fake(null).db, "posthgo")).toThrow("FEED_SCORE_SOURCE=posthgo");
  });

  it("直近 90 日を読み、点数と種類の平均を書き、重みの版を algorithm に付ける", async () => {
    const { db, rpc } = fake({
      targets: [{ dest_id: "a", core_type: "stay" }, { dest_id: "b", core_type: "stay" }],
      counts: [
        { dest_id: "a", action: "card_view", position: 0, n: 10 },
        { dest_id: "a", action: "card_click", position: 0, n: "2" },
        { dest_id: "b", action: "card_view", position: 0, n: 10 },
        { dest_id: "b", action: "unknown", position: 0, n: 5 },
      ],
    });
    const r = await runFeedScoreBatch(db, new Date("2026-11-19T00:00:00Z"), W);
    expect(rpc).toHaveBeenNthCalledWith(1, "feed_score_inputs", { p_since: "2026-08-21T00:00:00.000Z" });
    const [, args] = rpc.mock.calls[1] as unknown as [string, { p_scores: { dest_id: string; score: number }[]; p_priors: unknown; p_algorithm: string }];
    expect(args.p_algorithm).toBe("order=score@7");
    expect(args.p_priors).toEqual([{ core_type: "stay", score: 0.1 }]);
    const a = args.p_scores.find((x) => x.dest_id === "a")!.score;
    const b = args.p_scores.find((x) => x.dest_id === "b")!.score;
    expect(a).toBeGreaterThan(b);
    expect(r).toEqual({ source: "supabase", algorithm: "order=score@7", targets: 2, counts: 3, scored: 2 });
  });

  it("読めなければ書かずに throw する", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: "down" } }));
    await expect(runFeedScoreBatch({ rpc } as unknown as SupabaseClient)).rejects.toThrow("feed_score_inputs: down");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
