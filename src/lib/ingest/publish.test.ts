import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { setStatus } from "./publish.ts";

const principal = { keyId: "k1", userId: "u1" };

type Dest = { dest_id: string; ref: string; slug: string; created_by: string | null };
const dests: Dest[] = [
  { dest_id: "d1", ref: "WR-a", slug: "a-slug", created_by: "u1" },
  { dest_id: "d2", ref: "WR-b", slug: "b-slug", created_by: "u2" },
  { dest_id: "d3", ref: "WR-c", slug: "c-slug", created_by: null },
];

function mockDb() {
  const updates: { dest_id: string; patch: Record<string, unknown> }[] = [];
  const db = {
    from(table: string) {
      if (table === "destinations") {
        return {
          select: () => ({
            in: async (_c: string, refs: string[]) => ({ data: dests.filter((d) => refs.includes(d.ref)), error: null }),
          }),
        };
      }
      return {
        update: (patch: Record<string, unknown>) => ({
          eq: (_c: string, id: string) => {
            updates.push({ dest_id: id, patch });
            return { select: async () => ({ data: [{ dest_id: id }], error: null }) };
          },
        }),
      };
    },
  };
  return { db: db as unknown as SupabaseClient, updates };
}

describe("setStatus", () => {
  it("自分の dest を公開できる", async () => {
    const { db, updates } = mockDb();
    const r = await setStatus(db, ["WR-a"], "published", principal);
    expect(r).toEqual([{ ref: "WR-a", ok: true, slug: "a-slug", status: "published" }]);
    expect(updates).toHaveLength(1);
    expect(updates[0].patch).toMatchObject({ status: "published", approved_by: "u1" });
    expect(typeof updates[0].patch.published_at).toBe("string");
    expect(typeof updates[0].patch.updated_at).toBe("string");
  });

  it("別の登録者・created_by が null のものは変えない", async () => {
    const { db, updates } = mockDb();
    const r = await setStatus(db, ["WR-b", "WR-c"], "published", principal);
    expect(r).toEqual([
      { ref: "WR-b", ok: false, error: "別の登録者のもの" },
      { ref: "WR-c", ok: false, error: "別の登録者のもの" },
    ]);
    expect(updates).toHaveLength(0);
  });

  it("見つからない ref は失敗にし、他は続ける", async () => {
    const { db } = mockDb();
    const r = await setStatus(db, ["WR-zzz", "WR-a"], "published", principal);
    expect(r[0]).toEqual({ ref: "WR-zzz", ok: false, error: "見つからない" });
    expect(r[1].ok).toBe(true);
  });

  it("draft に戻すと published_at と approved_by が null", async () => {
    const { db, updates } = mockDb();
    const r = await setStatus(db, ["WR-a"], "draft", principal);
    expect(r[0]).toMatchObject({ ok: true, status: "draft" });
    expect(updates[0].patch).toMatchObject({ status: "draft", published_at: null, approved_by: null });
  });

  it("onWrite：書き込みを試みた dest の slug だけ知らせる（見つからない・別の登録者は呼ばない）", async () => {
    const { db } = mockDb();
    const slugs: string[] = [];
    await setStatus(db, ["WR-zzz", "WR-b", "WR-a"], "draft", principal, (s) => slugs.push(s));
    expect(slugs).toEqual(["a-slug"]);
  });

  it("onWrite：update が失敗しても、その前に slug を知らせてある", async () => {
    const { db } = mockDb();
    const slugs: string[] = [];
    const failing = {
      from: (t: string) =>
        t === "destinations"
          ? (db as unknown as { from: (t: string) => unknown }).from(t)
          : { update: () => ({ eq: () => ({ select: async () => ({ data: null, error: { message: "boom" } }) }) }) },
    } as unknown as SupabaseClient;
    const r = await setStatus(failing, ["WR-a"], "published", principal, (s) => slugs.push(s));
    expect(r[0]).toMatchObject({ ok: false, error: "boom" });
    expect(slugs).toEqual(["a-slug"]);
  });
});
