import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { listSavedIds, setSaved } from "./saves";
import { fakeDb } from "./supabase/fake-db";

type Err = { message: string; code?: string } | null;

// 呼ばれ方を記録し、決めた結果を返す fake
function fake(result: { data?: unknown; error: Err }) {
  const calls: { op: string; args: unknown[] }[] = [];
  const chain = {
    insert: (...args: unknown[]) => (calls.push({ op: "insert", args }), Promise.resolve(result)),
    delete: (...args: unknown[]) => (calls.push({ op: "delete", args }), filter),
  };
  const filter = {
    eq: (...args: unknown[]) => (calls.push({ op: "eq", args }), filterThen),
  };
  const filterThen = Object.assign(Promise.resolve(result), filter);
  const client = {
    from: (table: string) => (calls.push({ op: "from", args: [table] }), chain),
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe("listSavedIds", () => {
  it("dest_id の集合を返す", async () => {
    const { db } = fakeDb({ user_saves: [{ dest_id: "a" }, { dest_id: "b" }] });
    expect(await listSavedIds(db)).toEqual(new Set(["a", "b"]));
  });

  it("1000 件を超えても全部読む（1001 件目が落ちない）", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ dest_id: `d${String(i).padStart(5, "0")}` }));
    const { db, ranges } = fakeDb({ user_saves: rows });
    const ids = await listSavedIds(db);
    expect(ids.size).toBe(2500);
    expect(ids.has("d02499")).toBe(true);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("途中のページが失敗したら throw する（黙って欠けた一覧を返さない）", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ dest_id: `d${i}` }));
    const { db } = fakeDb({ user_saves: rows }, { failAtFrom: 1000 });
    await expect(listSavedIds(db)).rejects.toThrow("page failed");
  });
});

describe("setSaved", () => {
  it("保存：insert する", async () => {
    const { client, calls } = fake({ error: null });
    expect(await setSaved(client, "u1", "d1", true)).toEqual({ ok: true });
    expect(calls).toContainEqual({ op: "insert", args: [{ user_id: "u1", dest_id: "d1" }] });
  });

  it("保存：重複（23505）は成功扱い", async () => {
    const { client } = fake({ error: { message: "duplicate key", code: "23505" } });
    expect(await setSaved(client, "u1", "d1", true)).toEqual({ ok: true });
  });

  it("保存：ほかのエラーは失敗", async () => {
    const { client } = fake({ error: { message: "denied", code: "42501" } });
    expect(await setSaved(client, "u1", "d1", true)).toEqual({ ok: false, error: "denied" });
  });

  it("解除：user_id と dest_id で delete する", async () => {
    const { client, calls } = fake({ error: null });
    expect(await setSaved(client, "u1", "d1", false)).toEqual({ ok: true });
    expect(calls.map((c) => c.op)).toEqual(["from", "delete", "eq", "eq"]);
    expect(calls.filter((c) => c.op === "eq").map((c) => c.args)).toEqual([
      ["user_id", "u1"],
      ["dest_id", "d1"],
    ]);
  });

  it("解除：エラーは失敗", async () => {
    const { client } = fake({ error: { message: "nope" } });
    expect(await setSaved(client, "u1", "d1", false)).toEqual({ ok: false, error: "nope" });
  });
});
