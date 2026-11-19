// 投入の経路：既存の dest を書き換える（公開が draft に戻る）ときだけ、一覧と詳細のキャッシュを捨てる
import { beforeEach, describe, expect, it, vi } from "vitest";

const { revalidateTag, registerDest } = vi.hoisted(() => ({ revalidateTag: vi.fn(), registerDest: vi.fn() }));
vi.mock("next/cache", () => ({ revalidateTag }));
vi.mock("@/lib/supabase/admin", () => ({ adminClient: () => ({}) }));
vi.mock("@/lib/ingest/auth", () => ({ authenticateCollector: async () => ({ ok: true, principal: { keyId: "k", userId: "u" } }) }));
vi.mock("@/lib/ingest/apply", () => ({ registerDest }));

import { POST } from "./route";

const post = () =>
  POST(new Request("http://x/api/accommodations", { method: "POST", body: "{}" }), { params: Promise.resolve({ core: "accommodations" }) });
const tags = () => revalidateTag.mock.calls.map((c) => c[0]);
const ok = (unchanged: boolean) => ({ ok: true, dest_id: "d", slug: "s", status: unchanged ? "published" : "draft", unchanged });

describe("POST /api/[core] の無効化", () => {
  beforeEach(() => {
    revalidateTag.mockReset();
    registerDest.mockReset();
  });

  it("既存の dest を書き換えた（公開が draft に戻る）ら、一覧と詳細を捨てる", async () => {
    registerDest.mockImplementation(async (_db, _core, _json, _p, _deps, onWrite) => (onWrite("keep-me"), ok(false)));
    expect((await post()).status).toBe(200);
    expect(revalidateTag.mock.calls).toEqual([["catalog", { expire: 0 }], ["dest:keep-me", { expire: 0 }]]);
  });

  it("中身が前回と同じ（unchanged）なら何も変わらないので捨てない", async () => {
    registerDest.mockImplementation(async (_db, _core, _json, _p, _deps, onWrite) => (onWrite("keep-me"), ok(true)));
    await post();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("新規（onWrite が呼ばれない）・検証エラーでは捨てない", async () => {
    registerDest.mockResolvedValueOnce(ok(false));
    await post();
    registerDest.mockResolvedValueOnce({ ok: false, status: 400, errors: ["x"] });
    await post();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("dest_apply が例外でも、書き込みを試みた slug は捨てる（DB に届いたか分からない）", async () => {
    registerDest.mockImplementation(async (_db, _core, _json, _p, _deps, onWrite) => {
      onWrite("keep-me");
      throw new Error("dest_apply: timeout");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await post()).status).toBe(500);
    expect(tags()).toEqual(["catalog", "dest:keep-me"]);
  });
});
