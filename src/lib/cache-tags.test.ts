// 一覧（getCatalog）と詳細（getDestDetail）は、更新経路が捨てる tag を付け、寿命の指定を持つ（MS2a）。
// 付ける tag と捨てる tag（invalidate.test.ts）が同じ名前で揃っていることを、実際の関数で確かめる
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cacheTag, cacheLife } = vi.hoisted(() => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("next/cache", () => ({ cacheTag, cacheLife }));

const state = vi.hoisted(() => ({ dest: null as null | { dest_id: string; core_type: string; is_demo: boolean } }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "range"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: table === "destinations" ? state.dest : null, error: null });
      q.then = (res: (v: unknown) => unknown) => res({ data: [], error: null });
      return q;
    },
  }),
}));

describe("キャッシュの tag と寿命", () => {
  beforeEach(() => {
    cacheTag.mockClear();
    cacheLife.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "key");
  });

  it("getCatalog は catalog（公開・非公開で捨てる）と regions を付け、main と同じ約 1 分で取り直し・1 時間で失効（remote ではなくインスタンス内）", async () => {
    const { getCatalog } = await import("./data");
    await getCatalog();
    const tags = cacheTag.mock.calls.flat();
    expect(tags).toEqual(expect.arrayContaining(["catalog", "regions"]));
    expect(cacheLife).toHaveBeenCalledWith({ stale: 300, revalidate: 60, expire: 3600 });
  });

  it("getDestDetail は slug ごとの tag（dest:<slug>）を付ける。見つからない slug も付き、寿命は短い", async () => {
    state.dest = null;
    cacheLife.mockClear();
    const { getDestDetail } = await import("./detail");
    expect(await getDestDetail("nothing-here", "ja")).toBeNull();
    expect(cacheTag.mock.calls.flat()).toContain("dest:nothing-here");
    expect(cacheLife).toHaveBeenCalledTimes(1);
    expect(cacheLife).toHaveBeenCalledWith({ stale: 300, revalidate: 60, expire: 600 });
  });
});
