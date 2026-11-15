import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { listSavedIds, setSaved } from "./saves";

type Err = { message: string; code?: string } | null;

// 呼ばれ方を記録し、決めた結果を返す fake
function fake(result: { data?: unknown; error: Err }) {
  const calls: { op: string; args: unknown[] }[] = [];
  const chain = {
    select: (...args: unknown[]) => (calls.push({ op: "select", args }), Promise.resolve(result)),
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
    const { client, calls } = fake({ data: [{ dest_id: "a" }, { dest_id: "b" }], error: null });
    expect(await listSavedIds(client)).toEqual(new Set(["a", "b"]));
    expect(calls[0]).toEqual({ op: "from", args: ["user_saves"] });
  });

  it("エラーは throw", async () => {
    const { client } = fake({ data: null, error: { message: "boom" } });
    await expect(listSavedIds(client)).rejects.toThrow("boom");
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
