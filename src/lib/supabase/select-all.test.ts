import { describe, expect, it } from "vitest";
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
