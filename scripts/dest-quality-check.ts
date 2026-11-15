// 今ある dest 全部に中身の決まり（quality.ts）を当て、結果を dest_quality_check に入れる（dest ごとに 1 行。あれば上書き）。
// シークレットキーを使う（管理者の作業）。使い方: pnpm dest:quality-check
import { adminClient } from "../src/lib/supabase/admin.ts";
import { buildQualityRows, latestPayloads, summarize } from "./dest-quality-check/rows.ts";

const PAGE = 1000; // api.max_rows
const WRITE_CHUNK = 200;

type Q = PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

/** range で上限ずつ全部たどる */
async function readAll<T>(what: string, page: (from: number, to: number) => Q): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`${what}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if ((data ?? []).length < PAGE) return out;
  }
}

async function main(): Promise<number> {
  const db = adminClient();
  const dests = await readAll<{ dest_id: string; core_type: string }>("destinations", (f, t) =>
    db.from("destinations").select("dest_id, core_type").order("dest_id").range(f, t),
  );
  const imports = await readAll<{ dest_id: string | null; payload: unknown }>("dest_imports", (f, t) =>
    db.from("dest_imports").select("dest_id, payload").order("imported_at", { ascending: false }).order("id").range(f, t),
  );
  const rows = buildQualityRows(dests, latestPayloads(imports));

  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
    const chunk = rows.slice(i, i + WRITE_CHUNK).map((r) => ({ ...r, updated_at: now }));
    const { error } = await db.from("dest_quality_check").upsert(chunk, { onConflict: "dest_id" });
    if (error) throw new Error(`dest_quality_check: ${error.message}`);
  }

  for (const line of summarize(dests, rows)) console.log(line);
  const full = rows.filter((r) => r.quality === 100).length;
  console.log(`dest_quality_check に ${rows.length} 件を入れた（全部満たす ${full} 件）`);
  return 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (e) => { console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; },
);
