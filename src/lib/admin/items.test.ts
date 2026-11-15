import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin, listItems, PAGE_SIZE } from "./items.ts";

type Row = Record<string, unknown>;
const MAX_ROWS = 1000; // supabase/config.toml の api.max_rows と同じ

// 表ごとの行を持つ最小のモック。in / eq / order / range / count / head と、1 回 1000 行の上限をまねる。fail の表は error を返す
function mockDb(tables: Record<string, Row[]>, fail: string[] = []): SupabaseClient {
  return {
    from: (t: string) => {
      const ins: [string, unknown[]][] = [];
      const eqs: [string, unknown][] = [];
      const orders: [string, boolean][] = [];
      let range: [number, number] | null = null;
      let count = false;
      let head = false;
      const q: Record<string, unknown> = {
        select: (_c: string, o?: { count?: string; head?: boolean }) => ((count = !!o?.count), (head = !!o?.head), q),
        in: (c: string, v: unknown[]) => (ins.push([c, v]), q),
        eq: (c: string, v: unknown) => (eqs.push([c, v]), q),
        order: (c: string, o?: { ascending?: boolean }) => (orders.push([c, o?.ascending !== false]), q),
        range: (f: number, to: number) => ((range = [f, to]), q),
        then: (res: (v: unknown) => void) => {
          if (fail.includes(t)) return res({ data: null, error: { message: `${t} boom` }, count: null });
          let rs = (tables[t] ?? []).filter((r) => ins.every(([c, v]) => v.includes(r[c])) && eqs.every(([c, v]) => r[c] === v));
          rs = [...rs].sort((a, b) => {
            for (const [c, asc] of orders) {
              const x = String(a[c]), y = String(b[c]);
              if (x !== y) return (x < y ? -1 : 1) * (asc ? 1 : -1);
            }
            return 0;
          });
          const total = rs.length;
          const [f, to] = range ?? [0, rs.length - 1];
          rs = rs.slice(f, Math.min(to + 1, f + MAX_ROWS));
          res({ data: head ? null : rs, error: null, count: count ? total : null });
        },
      };
      return q;
    },
  } as unknown as SupabaseClient;
}

const iso = (n: number) => new Date(Date.UTC(2026, 0, 1) + n * 60_000).toISOString();

describe("isAdmin", () => {
  it("カンマ区切りに入っていれば true", () => {
    expect(isAdmin("u2", "u1, u2")).toBe(true);
  });
  it("入っていない・未設定なら false", () => {
    expect(isAdmin("u3", "u1,u2")).toBe(false);
    expect(isAdmin("u1", undefined)).toBe(false);
  });
});

describe("listItems", () => {
  const base = () => ({
    destinations: [
      { dest_id: "a", core_type: "accommodation", slug: "aaa", ref: "R-1", updated_at: "2026-01-01T00:00:00Z" },
      { dest_id: "b", core_type: "experience", slug: "bbb", ref: null, updated_at: "2026-02-01T15:30:00Z" },
      { dest_id: "c", core_type: "nature", slug: "ccc", ref: null, updated_at: "2026-01-15T00:00:00Z" },
    ],
    publications: [{ dest_id: "a", status: "published" }],
    accommodation_texts: [{ dest_id: "a", lang: "en", name: "A en" }, { dest_id: "a", lang: "ja", name: "A ja" }],
    experience_texts: [{ dest_id: "b", lang: "en", name: "B en" }],
    dest_imports: [
      { id: "i2", dest_id: "a", collector_key_id: "k2", imported_at: "2026-01-02" },
      { id: "i1", dest_id: "a", collector_key_id: "k1", imported_at: "2026-01-01" },
    ],
    collector_keys: [{ id: "k1", name: "old" }, { id: "k2", name: "new" }],
  });

  it("名前の言語・投入キー名・並び・件数", async () => {
    const r = await listItems(mockDb(base()));
    expect(r.items.map((i) => i.slug)).toEqual(["bbb", "ccc", "aaa"]);
    expect(r.items.map((i) => i.name)).toEqual(["B en", "ccc", "A ja"]);
    expect(r.items.map((i) => i.keyName)).toEqual(["-", "-", "new"]);
    expect(r.items.map((i) => i.status)).toEqual(["draft", "draft", "published"]);
    expect(r.items[2].typeLabel).toBe("宿");
    expect(r).toMatchObject({ total: 3, published: 1, page: 1, pageCount: 1 });
  });

  it("どの問い合わせが失敗しても投げる（draft や空の表として出さない）", async () => {
    for (const t of ["destinations", "publications", "dest_imports", "accommodation_texts", "collector_keys"]) {
      await expect(listItems(mockDb(base(), [t]))).rejects.toThrow(t);
    }
  });

  it("1000 件を超える dest はページに分け、件数は全体で数える", async () => {
    const n = 1001;
    const destinations = Array.from({ length: n }, (_, i) => ({
      dest_id: `d${String(i).padStart(4, "0")}`, core_type: "accommodation", slug: `s${i}`, ref: null, updated_at: iso(i),
    }));
    const publications = destinations.map((d, i) => ({ dest_id: d.dest_id, status: i % 2 ? "published" : "draft" }));
    const db = mockDb({ destinations, publications });
    const p1 = await listItems(db, 1);
    expect(p1).toMatchObject({ total: n, published: 500, page: 1, pageCount: Math.ceil(n / PAGE_SIZE) });
    expect(p1.items).toHaveLength(PAGE_SIZE);
    expect(p1.items[0].slug).toBe(`s${n - 1}`); // 新しい順
    const last = await listItems(db, 11);
    expect(last.items.map((i) => i.slug)).toEqual(["s0"]);
    expect((await listItems(db, 99)).page).toBe(11); // 範囲外は端に寄せる
  });

  it("投入が 1000 行を超えても、各 dest の最新の投入キーを取る", async () => {
    const t = base();
    const many = Array.from({ length: 1500 }, (_, i) => ({ id: `m${i}`, dest_id: "a", collector_key_id: "k1", imported_at: `2026-03-${String(1 + (i % 28)).padStart(2, "0")}` }));
    t.dest_imports = [...many, { id: "z", dest_id: "b", collector_key_id: "k2", imported_at: "2026-01-05" }];
    const r = await listItems(mockDb(t));
    expect(Object.fromEntries(r.items.map((i) => [i.slug, i.keyName]))).toEqual({ aaa: "old", bbb: "new", ccc: "-" });
  });
});
