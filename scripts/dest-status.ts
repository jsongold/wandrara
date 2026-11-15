// dest の公開状態を変える（headless の Admin。シークレットキーを使う）。
// 使い方: pnpm dest:status <ref|slug>... <published|draft>
//         pnpm dest:status --list [draft|published]

import { getTableName } from "drizzle-orm";
import { coreByType } from "../src/lib/ingest/cores.ts";
import { adminClient } from "../src/lib/supabase/admin.ts";

const STATUSES = ["published", "draft"] as const;
type Status = (typeof STATUSES)[number];
const USAGE = "使い方: pnpm dest:status <ref|slug>... <published|draft>\n        pnpm dest:status --list [draft|published]";

type Row = { status: string; destinations: { dest_id: string; ref: string | null; slug: string; core_type: string } };

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(USAGE);
    return 2;
  }
  const db = adminClient();

  if (args[0] === "--list") {
    if (args[1] && !STATUSES.includes(args[1] as Status)) {
      console.error(USAGE);
      return 2;
    }
    let q = db.from("publications").select("status, destinations!inner(dest_id, ref, slug, core_type)");
    if (args[1]) q = q.eq("status", args[1]);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Row[];
    // 名前（texts の ja）は core ごとの texts 表から引く
    const names = new Map<string, string>();
    for (const t of new Set(rows.map((r) => r.destinations.core_type))) {
      const core = coreByType(t);
      if (!core) continue;
      const { data: tx, error: e } = await db.from(getTableName(core.texts)).select("dest_id, name").eq("lang", "ja");
      if (e) throw new Error(e.message);
      for (const x of tx ?? []) names.set(x.dest_id as string, x.name as string);
    }
    rows.sort((a, b) => a.status.localeCompare(b.status) || a.destinations.slug.localeCompare(b.destinations.slug));
    for (const r of rows) {
      const d = r.destinations;
      console.log(`${r.status}\t${d.ref ?? "-"}\t${d.slug}\t${d.core_type}\t${names.get(d.dest_id) ?? ""}`);
    }
    return 0;
  }

  const status = args.at(-1) as Status;
  const targets = args.slice(0, -1);
  if (!STATUSES.includes(status) || targets.length === 0) {
    console.error(USAGE);
    return 2;
  }

  let failed = 0;
  for (const t of targets) {
    // フィルタ式に入るので、ID に使う文字だけを許す
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(t)) { console.error(`${t}: 英数字・ハイフン・下線だけで指定する`); failed++; continue; }
    // ref でも slug でも指定できる
    const { data: found, error: fe } = await db.from("destinations").select("dest_id, ref, slug").or(`ref.eq.${t},slug.eq.${t}`);
    if (fe) { console.error(`${t}: ${fe.message}`); failed++; continue; }
    if (!found?.length) { console.error(`${t}: 見つからない`); failed++; continue; }
    const now = new Date().toISOString();
    const { error } = await db
      .from("publications")
      .update({ status, updated_at: now, ...(status === "published" ? { published_at: now } : {}) })
      .in("dest_id", found.map((d) => d.dest_id as string));
    if (error) { console.error(`${t}: ${error.message}`); failed++; continue; }
    for (const d of found) console.log(`${status}: ${d.ref ?? "-"} (/d/${d.slug})`);
  }
  return failed > 0 ? 1 : 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; },
);
