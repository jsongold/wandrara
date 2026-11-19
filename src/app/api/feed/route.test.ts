// /api/feed のキャッシュの出し方（MS2c）：公開の読み取りは CDN に 30 秒だけ。q（自由入力）・失敗・不正は持たせない
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFeedPage } = vi.hoisted(() => ({ getFeedPage: vi.fn() }));
vi.mock("@/lib/feed-page", async (orig) => ({ ...(await orig<typeof import("@/lib/feed-page")>()), getFeedPage }));

import { NextRequest } from "next/server";
import { FeedCursorError } from "@/lib/feed-page";
import { GET } from "./route";

const get = (qs: string) => GET(new NextRequest(`http://x/api/feed?${qs}`));
const cc = (r: Response) => r.headers.get("Cache-Control");

describe("GET /api/feed の Cache-Control", () => {
  beforeEach(() => getFeedPage.mockReset());

  it("成功は CDN に 30 秒（ブラウザには持たせない）", async () => {
    getFeedPage.mockResolvedValue({ cards: [], nextCursor: null });
    const r = await get("lang=ja&mode=stay&cursor=abc");
    expect(r.status).toBe(200);
    expect(cc(r)).toBe("public, max-age=0, s-maxage=30");
  });

  it("q があるものは持たせない（組が無限に増える）", async () => {
    getFeedPage.mockResolvedValue({ cards: [], nextCursor: null });
    expect(cc(await get("lang=ja&q=onsen"))).toBe("no-store");
  });

  it("不正な lang・cursor の不一致・DB の失敗は持たせない", async () => {
    expect(cc(await get("lang=xx"))).toBe("no-store");
    getFeedPage.mockRejectedValueOnce(new FeedCursorError("query-mismatch"));
    const mismatch = await get("lang=ja&cursor=x");
    expect([mismatch.status, cc(mismatch)]).toEqual([409, "no-store"]);
    getFeedPage.mockRejectedValueOnce(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = await get("lang=ja");
    expect([failed.status, cc(failed)]).toEqual([502, "no-store"]);
  });
});
