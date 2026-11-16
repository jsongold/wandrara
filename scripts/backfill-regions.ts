// 既存の宿・体験などの region_id を、位置から決め直す（取り込みと同じ規則。src/lib/region）。
// 使い方: pnpm backfill:regions                → 差分を表示し、.cache/backfill-regions/<版>.json に保存する（書かない）
//         pnpm backfill:regions --apply <file> → 保存した差分だけを 1 件ずつ書く。書く直前に位置と旧い値を照合し、変わっていれば飛ばす
// 決まらないものは今の値のまま。公開状態は変えない。本番に --apply するのは確認してから
import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupManifest, resolveLocation } from "../src/lib/region/lookup.ts";
import { representativeLocation } from "../src/lib/region/representative.ts";
import { decideRegion } from "../src/lib/region/resolve.ts";
import type { LookupManifest, RepresentativeLocation, ResolveResult } from "../src/lib/region/types.ts";
import { adminClient } from "../src/lib/supabase/admin.ts";

type Row = Record<string, unknown>;
export type DestRow = { dest_id: string; core_type: string; slug: string; region_id: string | null; core: Row; details: unknown };
export type Change = {
  dest_id: string;
  core_type: string;
  slug: string;
  old_region_id: string | null;
  new_region_id: string;
  lat: number | null;
  lng: number | null;
  geo_precision: string | null;
};
export type Kept = { dest_id: string; slug: string; region_id: string | null; reason: string };
export type BackfillPlan = { lookup_version: string; changes: Change[]; kept: Kept[] };

const TABLES: Record<string, string> = {
  accommodation: "accommodations",
  experience: "experiences",
  nature: "natures",
  village: "villages",
  building: "buildings",
  hotspring: "hotsprings",
};

/** 付け直しの差分を作る。今の値を「明示」として扱う（大涌谷のような点のエリアは残る） */
export async function planBackfill(
  rows: DestRow[],
  resolve: (loc: RepresentativeLocation) => Promise<ResolveResult>,
  manifest: LookupManifest,
  exists: (id: string) => boolean,
): Promise<BackfillPlan> {
  const changes: Change[] = [];
  const kept: Kept[] = [];
  for (const r of [...rows].sort((a, b) => (a.dest_id < b.dest_id ? -1 : 1))) {
    const loc = representativeLocation(r.core_type, r.core, r.details);
    const d = decideRegion(await resolve(loc), r.region_id, exists, manifest);
    if (!d.ok) {
      kept.push({ dest_id: r.dest_id, slug: r.slug, region_id: r.region_id, reason: d.reason });
      continue;
    }
    if (d.regionId === r.region_id) continue;
    changes.push({
      dest_id: r.dest_id,
      core_type: r.core_type,
      slug: r.slug,
      old_region_id: r.region_id,
      new_region_id: d.regionId,
      lat: loc.lat,
      lng: loc.lng,
      geo_precision: loc.precision,
    });
  }
  return { lookup_version: manifest.version, changes, kept };
}

async function loadRows(db: SupabaseClient): Promise<DestRow[]> {
  const { data: dests, error } = await db.from("destinations").select("dest_id, core_type, slug");
  if (error) throw new Error(`destinations: ${error.message}`);
  const out: DestRow[] = [];
  for (const [type, table] of Object.entries(TABLES)) {
    const cols = type === "experience" ? "dest_id, region_id, details" : "dest_id, region_id, lat, lng, geo_precision, prefecture, municipality";
    const { data, error: e } = await db.from(table).select(cols);
    if (e) throw new Error(`${table}: ${e.message}`);
    const byId = new Map(((data ?? []) as unknown as Row[]).map((r) => [r.dest_id as string, r]));
    for (const d of (dests ?? []).filter((x) => x.core_type === type)) {
      const core = byId.get(d.dest_id);
      if (!core) continue;
      out.push({ dest_id: d.dest_id, core_type: type, slug: d.slug, region_id: (core.region_id as string | null) ?? null, core, details: core.details ?? null });
    }
  }
  return out;
}

async function existingRegions(db: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await db.from("regions").select("id");
  if (error) throw new Error(`regions: ${error.message}`);
  return new Set((data ?? []).map((r) => r.id as string));
}

/** 保存した差分を 1 件ずつ書く。結果は updated / skipped（その間に変わった）/ missing（消えた） */
export async function applyBackfill(db: SupabaseClient, plan: BackfillPlan): Promise<Record<string, number>> {
  const counts: Record<string, number> = { updated: 0, skipped: 0, missing: 0 };
  for (const c of plan.changes) {
    const { data, error } = await db.rpc("backfill_region_apply", { p: c });
    if (error) throw new Error(`backfill_region_apply ${c.slug}: ${error.message}`);
    counts[String(data)] = (counts[String(data)] ?? 0) + 1;
    if (data !== "updated") console.log(`${data}: ${c.slug}`);
  }
  return counts;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const db = adminClient();
  if (args[0] === "--apply") {
    const file = args[1];
    if (!file) {
      console.error("使い方: pnpm backfill:regions --apply <差分の .json>");
      return 2;
    }
    const plan = JSON.parse(fs.readFileSync(file, "utf8")) as BackfillPlan;
    if (plan.lookup_version !== lookupManifest.version) {
      console.error(`差分の索引の版（${plan.lookup_version}）が今の索引（${lookupManifest.version}）と違う。差分を出し直す`);
      return 1;
    }
    console.log(JSON.stringify(await applyBackfill(db, plan)));
    return 0;
  }
  const regions = await existingRegions(db);
  const plan = await planBackfill(await loadRows(db), resolveLocation, lookupManifest, (id) => regions.has(id));
  for (const c of plan.changes) console.log(`${c.slug}: ${c.old_region_id ?? "(なし)"} → ${c.new_region_id}`);
  for (const k of plan.kept) console.log(`そのまま（${k.reason}）: ${k.slug} ${k.region_id ?? "(なし)"}`);
  const out = path.resolve(".cache/backfill-regions", `${lookupManifest.version}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(plan, null, 2) + "\n");
  console.log(`変える ${plan.changes.length} 件・決まらずそのまま ${plan.kept.length} 件。差分: ${path.relative(process.cwd(), out)}`);
  return 0;
}

if (process.argv[1]?.endsWith("backfill-regions.ts")) process.exitCode = await main();
