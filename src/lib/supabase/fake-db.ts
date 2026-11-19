// テスト用の Supabase の代わり。from(table).select().order()….range() だけ持つ。
// 本物と同じく、range が大きくても 1 回に返すのは maxRows まで（黙って切る）。failAtFrom 以降のページはエラーを返す
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

export function fakeDb(
  tables: Record<string, Row[]>,
  opts: { maxRows?: number; failAtFrom?: number } = {},
): { db: SupabaseClient; ranges: [number, number][] } {
  const ranges: [number, number][] = [];
  const maxRows = opts.maxRows ?? 1000;
  const from = (table: string) => {
    const orders: { column: string; ascending: boolean }[] = [];
    const q = {
      select: () => q,
      order: (column: string, o: { ascending: boolean }) => (orders.push({ column, ascending: o.ascending }), q),
      range: async (a: number, b: number) => {
        ranges.push([a, b]);
        if (opts.failAtFrom !== undefined && a >= opts.failAtFrom) return { data: null, error: { message: "page failed" } };
        const sorted = [...(tables[table] ?? [])].sort((x, y) => {
          for (const { column, ascending } of orders) {
            const [p, r] = [x[column] as string | number, y[column] as string | number];
            if (p !== r) return (p < r ? -1 : 1) * (ascending ? 1 : -1);
          }
          return 0;
        });
        return { data: sorted.slice(a, Math.min(b + 1, a + maxRows)), error: null };
      },
    };
    return q;
  };
  return { db: { from } as unknown as SupabaseClient, ranges };
}
