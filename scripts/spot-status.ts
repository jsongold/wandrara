// スポットの公開状態を変える（headless の Admin）。
// 使い方: pnpm spot:status <external_ref|id>... <published|draft>
//         pnpm spot:status --list [draft|published]

import { adminClient } from "./lib/admin-client.ts";

const STATUSES = ["published", "draft"] as const;
type Status = (typeof STATUSES)[number];

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const db = adminClient();

  if (args[0] === "--list") {
    let q = db.from("spots").select("id, external_ref, publish_status, name").order("publish_status").order("id");
    if (args[1]) q = q.eq("publish_status", args[1]);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    for (const s of data ?? []) console.log(`${s.publish_status}\t${s.external_ref ?? "-"}\t${s.id}\t${(s.name as { ja?: string; en?: string }).ja ?? (s.name as { en?: string }).en ?? ""}`);
    return 0;
  }

  const status = args.at(-1) as Status;
  const targets = args.slice(0, -1);
  if (!STATUSES.includes(status) || targets.length === 0) {
    console.error("使い方: pnpm spot:status <external_ref|id>... <published|draft>\n        pnpm spot:status --list [draft|published]");
    return 2;
  }

  let failed = 0;
  for (const t of targets) {
    // フィルタ式に入るので、ID に使う文字だけを許す
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(t)) { console.error(`${t}: 英数字・ハイフン・下線だけで指定する`); failed++; continue; }
    // external_ref でも id（URL の slug）でも指定できる
    const { data, error } = await db
      .from("spots")
      .update({ publish_status: status, updated_at: new Date().toISOString() })
      .or(`external_ref.eq.${t},id.eq.${t}`)
      .select("id, external_ref");
    if (error) { console.error(`${t}: ${error.message}`); failed++; continue; }
    if (!data?.length) { console.error(`${t}: 見つからない`); failed++; continue; }
    for (const s of data) console.log(`${status}: ${s.external_ref ?? "-"} (/spots/${s.id})`);
  }
  return failed > 0 ? 1 : 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; },
);
