import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerDest } from "./apply.ts";
import { coreByType } from "./cores.ts";

const acc = coreByType("accommodation")!;
const principal = { keyId: "k1", userId: "u1" };
const body = () => ({
  ref: "WR-x-001",
  core: { kind: "private_rental", region_id: "atami" },
  texts: [{ lang: "ja", name: "ヴィラ" }],
  categories: ["onsen"],
});

// from(table) の問い合わせ結果を表ごとに返す最小のモック。rpc の引数を記録する
function mockDb(existing?: { dest_id: string; slug: string }) {
  const rpcCalls: { fn: string; args: { p: Record<string, unknown> } }[] = [];
  const chain = (table: string) => {
    const q: Record<string, unknown> = {};
    const result = () => {
      if (table === "destinations") return { data: existing ?? null, error: null };
      return { data: [], error: null };
    };
    for (const m of ["select", "eq", "like", "in", "limit"]) q[m] = () => q;
    q.maybeSingle = async () => result();
    q.then = (res: (v: unknown) => unknown) => res(table === "destinations" ? { data: existing ? [existing] : [], error: null } : result());
    return q;
  };
  const db = {
    from: chain,
    rpc: async (fn: string, args: { p: Record<string, unknown> }) => {
      rpcCalls.push({ fn, args });
      const d = args.p.destination as { dest_id: string; slug: string };
      return { data: { dest_id: d.dest_id, slug: d.slug }, error: null };
    },
  };
  return { db: db as unknown as SupabaseClient, rpcCalls };
}

describe("registerDest", () => {
  it("検証に落ちると 400 と errors", async () => {
    const { db, rpcCalls } = mockDb();
    const r = await registerDest(db, acc, { core: { kind: "nope" }, texts: [] }, principal);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.errors.length).toBeGreaterThan(0);
    }
    expect(rpcCalls).toHaveLength(0);
  });

  it("dest_apply に p を渡し draft を返す", async () => {
    const { db, rpcCalls } = mockDb();
    const r = await registerDest(db, acc, body(), principal);
    expect(r).toMatchObject({ ok: true, status: "draft", slug: "wr-x-001" });
    expect(rpcCalls[0].fn).toBe("dest_apply");
    const p = rpcCalls[0].args.p as { destination: Record<string, unknown>; tables: { table: string }[]; import: Record<string, unknown> };
    expect(p.destination).toMatchObject({ core_type: "accommodation", ref: "WR-x-001", created_by: "u1" });
    expect(p.tables[0].table).toBe("accommodations");
    expect(p.import).toMatchObject({ collector_key_id: "k1" });
  });

  it("既存の ref は同じ dest_id と slug", async () => {
    const { db, rpcCalls } = mockDb({ dest_id: "00000000-0000-0000-0000-000000000001", slug: "keep-me" });
    const r = await registerDest(db, acc, body(), principal);
    expect(r).toMatchObject({ ok: true, dest_id: "00000000-0000-0000-0000-000000000001", slug: "keep-me" });
    expect((rpcCalls[0].args.p.destination as { dest_id: string }).dest_id).toBe("00000000-0000-0000-0000-000000000001");
  });
});
