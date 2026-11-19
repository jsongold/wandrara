import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { runFeedScoreBatch } = vi.hoisted(() => ({ runFeedScoreBatch: vi.fn() }));
vi.mock("@/lib/feed-score-batch", () => ({ runFeedScoreBatch }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({}) }));

import { GET } from "./route";

const call = (auth?: string) =>
  GET(new NextRequest("http://x/api/cron/feed-score", { headers: auth ? { authorization: auth } : {} }));

describe("GET /api/cron/feed-score", () => {
  beforeEach(() => {
    runFeedScoreBatch.mockReset();
    runFeedScoreBatch.mockResolvedValue({ algorithm: "order=score@1", targets: 1, counts: 0, scored: 1 });
    vi.stubEnv("CRON_SECRET", "s3cret-s3cret-123");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("CRON_SECRET が合えば batch を走らせる", async () => {
    const res = await call("Bearer s3cret-s3cret-123");
    expect(res.status).toBe(200);
    expect(runFeedScoreBatch).toHaveBeenCalledTimes(1);
  });

  it.each([[undefined], ["Bearer wrong"], ["s3cret-s3cret-123"]])("合わなければ 401 で走らせない（%s）", async (auth) => {
    expect((await call(auth)).status).toBe(401);
    expect(runFeedScoreBatch).not.toHaveBeenCalled();
  });

  it("CRON_SECRET が未設定なら誰も走らせられない", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call("Bearer ")).status).toBe(401);
  });

  it("batch が落ちたら 500", async () => {
    runFeedScoreBatch.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call("Bearer s3cret-s3cret-123")).status).toBe(500);
  });
});
