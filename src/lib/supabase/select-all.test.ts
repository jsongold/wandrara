import { describe, expect, it } from "vitest";
import { fakeDb } from "./fake-db.ts";
import { PAGE, selectAll } from "./select-all.ts";

// range(from, to) で切って返すモック。order の列も記録する
function mockDb(n: number) {
  const orders: string[] = [];
  const rows = Array.from({ length: n }, (_, i) => ({ id: i }));
  const q = {
    select: () => q,
    order: (c: string) => (orders.push(c), q),
    range: async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }),
  };
  return { db: { from: () => q } as never, orders };
}

describe("selectAll", () => {
  it("1000 行を超えても最後の行まで読む（1001 件目が落ちない）", async () => {
    const { db, orders } = mockDb(PAGE * 2 + 1);
    const out = await selectAll<{ id: number }>(db, "t", "id", ["id"]);
    expect(out).toHaveLength(PAGE * 2 + 1);
    expect(out.at(-1)).toEqual({ id: PAGE * 2 });
    expect(orders.every((c) => c === "id")).toBe(true);
  });
  it("ちょうど 1000 行なら次のページで空を受けて終わる", async () => {
    expect(await selectAll(mockDb(PAGE).db, "t", "id", ["id"])).toHaveLength(PAGE);
  });
});

describe("selectAll の並び順と失敗", () => {
  it("降順を指定でき、同じ値の行は第 2 キーで一意に並ぶ（ページの境目で落ちない・重ならない）", async () => {
    // t は 7 件ずつ同じ。PAGE をまたいで読む
    const rows = Array.from({ length: PAGE * 2 + 5 }, (_, i) => ({ id: i, t: Math.floor(i / 7) }));
    const { db } = fakeDb({ x: rows });
    const out = await selectAll<{ id: number; t: number }>(db, "x", "id, t", [
      { column: "t", ascending: false },
      { column: "id", ascending: false },
    ]);
    expect(out.map((r) => r.id)).toEqual(rows.map((r) => r.id).reverse());
  });
  it("max_rows（1000）と同じ PAGE で、1500 件を 2 ページで読み切る", async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ id: i }));
    expect(await selectAll(fakeDb({ x: rows }, { maxRows: 1000 }).db, "x", "id", ["id"])).toHaveLength(1500);
  });
  it("途中のページが失敗したら throw（欠けた結果を返さない）", async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    await expect(selectAll(fakeDb({ x: rows }, { failAtFrom: 2000 }).db, "x", "id", ["id"])).rejects.toThrow("x: page failed");
  });
});
