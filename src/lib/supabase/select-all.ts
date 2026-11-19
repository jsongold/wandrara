// 表を全件読む。Data API は 1 回の select を max_rows（1000）で黙って切るので、キーの順にページを送って読み切る
import type { SupabaseClient } from "@supabase/supabase-js";

export const PAGE = 1000;

// 並び順の 1 キー。文字列は昇順。最後のキーまでで行が一意になること（同じ値が並ぶとページの境目で行が落ちる・重なる）
export type OrderKey = string | { column: string; ascending: boolean };

// maxRows を渡すと、それを超えた時点で読むのをやめて throw する（件数に比例して読み続けないための歯止め。ページ単位なので最大 maxRows + PAGE 行まで）
export class TooManyRowsError extends Error {}

export async function selectAll<T>(db: SupabaseClient, table: string, columns: string, orderBy: OrderKey[], maxRows?: number): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(columns);
    for (const k of orderBy) q = typeof k === "string" ? q.order(k, { ascending: true }) : q.order(k.column, { ascending: k.ascending });
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (maxRows !== undefined && out.length > maxRows) throw new TooManyRowsError(`${table}: ${maxRows} 行を超えた`);
    if (rows.length < PAGE) return out;
  }
}
