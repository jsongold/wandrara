// 表を全件読む。Data API は 1 回の select を max_rows（1000）で黙って切るので、キーの順にページを送って読み切る
import type { SupabaseClient } from "@supabase/supabase-js";

export const PAGE = 1000;

export async function selectAll<T>(db: SupabaseClient, table: string, columns: string, orderBy: string[]): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(columns);
    for (const c of orderBy) q = q.order(c, { ascending: true });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
