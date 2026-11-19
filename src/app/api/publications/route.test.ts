// 公開・非公開の経路は、書き込みを試みた dest の一覧と詳細のキャッシュを必ず捨てる（部分的な成功・途中の例外でも）
import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag, setStatus } = vi.hoisted(() => ({ revalidateTag: vi.fn(), setStatus: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({}) }));
vi.mock("@/lib/ingest/auth", () => ({ authenticateCollector: async () => ({ ok: true, principal: { keyId: "k", userId: "u" } }) }));
vi.mock("@/lib/ingest/publish", () => ({ setStatus }));

import { POST } from "./route";

const post = (refs: string[], status = "draft") =>
  POST(new Request("http://x/api/publications", { method: "POST", body: JSON.stringify({ refs, status }) }));
const tags = () => revalidateTag.mock.calls.map((c) => c[0]);

describe("POST /api/publications の無効化", () => {
  beforeEach(() => {
    revalidateTag.mockReset();
    setStatus.mockReset();
  });

  it("非公開にした dest の一覧と詳細を捨てる（stale を出さない expire: 0）", async () => {
    setStatus.mockImplementation(async (_db, _refs, _s, _p, onWrite) => {
      onWrite("a-slug");
      return [{ ref: "WR-a", ok: true, slug: "a-slug", status: "draft" }];
    });
    expect((await post(["WR-a"])).status).toBe(200);
    expect(revalidateTag.mock.calls).toEqual([["catalog", { expire: 0 }], ["dest:a-slug", { expire: 0 }]]);
  });

  it("部分的な成功：書き込みを試みたものは、失敗した行も捨てる。試みていないもの（別の登録者）は捨てない", async () => {
    setStatus.mockImplementation(async (_db, _refs, _s, _p, onWrite) => {
      onWrite("ok-slug");
      onWrite("failed-slug"); // update が失敗（DB に届いたか分からない）
      return [
        { ref: "WR-1", ok: true, slug: "ok-slug", status: "published" },
        { ref: "WR-2", ok: false, error: "boom" },
        { ref: "WR-3", ok: false, error: "別の登録者のもの" },
      ];
    });
    await post(["WR-1", "WR-2", "WR-3"], "published");
    expect(tags()).toEqual(["catalog", "dest:ok-slug", "dest:failed-slug"]);
  });

  it("途中で例外になっても、それまでに書き込みを試みた分は捨てて 500 を返す", async () => {
    setStatus.mockImplementation(async (_db, _refs, _s, _p, onWrite) => {
      onWrite("half");
      throw new Error("boom");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post(["WR-a"])).status).toBe(500);
    expect(tags()).toEqual(["catalog", "dest:half"]);
  });

  it("何も書いていなければ（全部見つからない・読み込みで例外）捨てない", async () => {
    setStatus.mockResolvedValue([{ ref: "WR-z", ok: false, error: "見つからない" }]);
    await post(["WR-z"]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
