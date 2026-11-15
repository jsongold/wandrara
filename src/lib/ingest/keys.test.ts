import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateCollector } from "./auth.ts";
import { generateApiKey, hashApiKey, parseBearer } from "./keys.ts";

describe("keys", () => {
  it("形式と hash", () => {
    const { key, hash } = generateApiKey();
    expect(key).toMatch(/^wdr_[A-Za-z0-9_-]{43}$/);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(key)).toBe(hash);
    expect(generateApiKey().key).not.toBe(key);
  });
  it("parseBearer", () => {
    expect(parseBearer("Bearer wdr_abc")).toBe("wdr_abc");
    expect(parseBearer("Bearer abc")).toBeNull();
    expect(parseBearer("wdr_abc")).toBeNull();
    expect(parseBearer(null)).toBeNull();
  });
});

// 表ごとの結果を返す最小のモック
function mockDb(tables: Record<string, unknown>): SupabaseClient {
  const q = (result: unknown): unknown => {
    const chain: unknown = new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (prop === "then") return (res: (v: unknown) => void) => res({ data: result });
          if (prop === "maybeSingle") return async () => ({ data: result });
          return () => chain;
        },
      },
    );
    return chain;
  };
  return { from: (t: string) => q(tables[t]) } as unknown as SupabaseClient;
}
const req = (k: string) => new Request("http://x", { headers: { authorization: `Bearer ${k}` } });

describe("authenticateCollector", () => {
  const key = generateApiKey().key;
  it("キーが違う -> 401", async () => {
    const r = await authenticateCollector(req(key), mockDb({ collector_keys: null }));
    expect(r).toMatchObject({ ok: false, status: 401 });
  });
  it("所属なし -> 403", async () => {
    const db = mockDb({ collector_keys: { id: "k1", user_id: "u1" }, operator_memberships: [] });
    expect(await authenticateCollector(req(key), db)).toMatchObject({ ok: false, status: 403 });
  });
  it("通る", async () => {
    const db = mockDb({ collector_keys: { id: "k1", user_id: "u1" }, operator_memberships: [{ operator_id: "o1" }] });
    expect(await authenticateCollector(req(key), db)).toEqual({ ok: true, principal: { keyId: "k1", userId: "u1" } });
  });
});
