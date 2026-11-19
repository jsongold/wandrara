// 公開中の写真の枚数から、画像変換の月間件数と Pro の費用を見積もる（読むだけ。DB と Storage には何も書かない）。#125
// 使い方: pnpm perf:image-forecast   （.env.local の NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY）
import { existsSync } from "node:fs";
import { forecast, HOBBY_TRANSFORMS_PER_MONTH, hobbyLimitPhotos, TRANSFORMS_PER_PHOTO } from "../../src/lib/image-forecast.ts";
import { adminClient } from "../../src/lib/supabase/admin.ts";
import { selectAll } from "../../src/lib/supabase/select-all.ts";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const db = adminClient();
const published = new Set(
  (await selectAll<{ dest_id: string }>(db, "publications", "dest_id,status", ["dest_id"]).then((rows) => rows as unknown as { dest_id: string; status: string }[]))
    .filter((r) => r.status === "published")
    .map((r) => r.dest_id),
);
const photos = await selectAll<{ dest_id: string; storage_key: string }>(db, "dest_photos", "id,dest_id,storage_key", ["id"]);
const distinct = new Set(photos.filter((p) => published.has(p.dest_id)).map((p) => p.storage_key)).size;

console.log(`公開中の dest ${published.size} 件・dest_photos ${photos.length} 行・公開中の写真（storage_key の種類）${distinct} 枚`);
console.log(`見積もり（全写真が月内に見られる上限側。実際は閲覧数で決まる）：1 枚あたり月 ${TRANSFORMS_PER_PHOTO} 件（MS1c）。Hobby の上限 ${HOBBY_TRANSFORMS_PER_MONTH} 件に当たるのは ${hobbyLimitPhotos()} 枚`);
console.log("倍率\t写真\t変換/月\tHobby比\tPro(USD/月)");
for (const m of [1, 2, 5, 10]) {
  const f = forecast(distinct * m);
  console.log(`${m}x\t${f.photos}\t${f.transforms}\t${Math.round(f.hobbyShare * 100)}%${f.overHobby ? " 超過" : ""}\t${f.proUsd.toFixed(2)}`);
}
