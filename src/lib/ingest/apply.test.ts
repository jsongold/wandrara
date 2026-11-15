import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerDest } from "./apply.ts";
import { coreByType } from "./cores.ts";
import { parseDestInput } from "./bundle.ts";
import { contentHash } from "./hash.ts";
import { withAccommodationQuality } from "./test-fixtures.ts";

const acc = coreByType("accommodation")!;
const principal = { keyId: "k1", userId: "u1" };
const body = () => withAccommodationQuality({
  ref: "WR-x-001",
  core: { kind: "private_rental", region_id: "atami" },
  texts: [{ lang: "ja", name: "ヴィラ" }],
  categories: ["onsen"],
});

// from(table) の問い合わせ結果を表ごとに返す最小のモック。rpc の引数を記録する。
// last を渡すと、rpc は dest_apply と同じく「既存の dest で content_hash が前回と同じなら unchanged」を返す（本物の判定は SQL。supabase/tests で確かめる）
function mockDb(
  existing?: { dest_id: string; slug: string; core_type?: string; created_by?: string | null },
  last?: { content_hash: string | null; status: string },
) {
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
      const hash = (args.p.import as { content_hash: string }).content_hash;
      if (existing && last?.content_hash && last.content_hash === hash) {
        return { data: { dest_id: d.dest_id, slug: existing.slug, unchanged: true, status: last.status }, error: null };
      }
      return { data: { dest_id: d.dest_id, slug: d.slug, unchanged: false, status: "draft" }, error: null };
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
    const { db, rpcCalls } = mockDb({ dest_id: "00000000-0000-0000-0000-000000000001", slug: "keep-me", core_type: "accommodation", created_by: "u1" });
    const r = await registerDest(db, acc, body(), principal);
    expect(r).toMatchObject({ ok: true, dest_id: "00000000-0000-0000-0000-000000000001", slug: "keep-me" });
    expect((rpcCalls[0].args.p.destination as { dest_id: string }).dest_id).toBe("00000000-0000-0000-0000-000000000001");
  });

  const ex = { dest_id: "00000000-0000-0000-0000-000000000001", slug: "keep-me", core_type: "accommodation", created_by: "u1" };

  it("別の core_type の ref は 409 で dest_apply を呼ばない", async () => {
    const { db, rpcCalls } = mockDb({ ...ex, core_type: "experience" });
    const r = await registerDest(db, acc, body(), principal);
    expect(r).toMatchObject({ ok: false, status: 409 });
    if (!r.ok) expect(r.errors[0]).toContain("experience");
    expect(rpcCalls).toHaveLength(0);
  });

  it("別の created_by（null 含む）の ref は 409 で dest_apply を呼ばない", async () => {
    for (const created_by of ["u2", null]) {
      const { db, rpcCalls } = mockDb({ ...ex, created_by });
      const r = await registerDest(db, acc, body(), principal);
      expect(r).toMatchObject({ ok: false, status: 409 });
      expect(rpcCalls).toHaveLength(0);
    }
  });

  it("同じ登録者・同じ種類なら通る", async () => {
    const { db, rpcCalls } = mockDb(ex);
    const r = await registerDest(db, acc, body(), principal);
    expect(r.ok).toBe(true);
    expect(rpcCalls).toHaveLength(1);
  });

  const hashOf = (b: unknown) => {
    const p = parseDestInput(acc, b);
    if (!p.ok) throw new Error(p.errors.join());
    return contentHash(p.value);
  };

  it("dest_imports に content_hash を渡す", async () => {
    const { db, rpcCalls } = mockDb();
    await registerDest(db, acc, body(), principal);
    expect((rpcCalls[0].args.p.import as { content_hash: string }).content_hash).toBe(hashOf(body()));
  });

  it("dest_apply が unchanged を返したら、公開状態のまま unchanged を返す（sources だけの違いは同じ中身）", async () => {
    const { db } = mockDb(ex, { content_hash: hashOf(body()), status: "published" });
    const r = await registerDest(db, acc, { ...body(), sources: [{ retrieved_at: "2026-11-16" }] }, principal);
    expect(r).toMatchObject({ ok: true, unchanged: true, status: "published", slug: "keep-me", dest_id: ex.dest_id });
  });

  it("中身が変われば draft", async () => {
    const { db } = mockDb(ex, { content_hash: hashOf(body()), status: "published" });
    const r = await registerDest(db, acc, { ...body(), texts: [{ lang: "ja", name: "別の名前", summary: "s", address: "a" }] }, principal);
    expect(r).toMatchObject({ ok: true, unchanged: false, status: "draft" });
  });

  it("古いサーバー（unchanged を返さない dest_apply）でも draft として扱う", async () => {
    const { db } = mockDb(ex);
    (db as unknown as { rpc: unknown }).rpc = async () => ({ data: { dest_id: ex.dest_id, slug: "keep-me" }, error: null });
    const r = await registerDest(db, acc, body(), principal);
    expect(r).toMatchObject({ ok: true, unchanged: false, status: "draft" });
  });

  it("別の登録者なら、中身が同じでも 409", async () => {
    const { db } = mockDb({ ...ex, created_by: "u2" }, { content_hash: hashOf(body()), status: "published" });
    const r = await registerDest(db, acc, body(), principal);
    expect(r).toMatchObject({ ok: false, status: 409 });
  });
});
