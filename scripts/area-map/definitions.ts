// エリアの定義をローカル DB（migration を当てた状態）から読む。本番や任意の接続先からは作らない
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import type { PartSource, RegionDef } from "../../src/lib/region/types.ts";
import { SOURCE_VERSIONS } from "./sources.ts";

type RegionRow = { id: string; parent_id: string | null; name: Record<string, string>; sort: number | null; lat: number | null; lng: number | null };
type PartRow = { region_id: string; source: PartSource; source_version: string; code: string };

/** 行から定義を作り、使えない定義を弾く（純関数）。親子は 2 段まで（feed の絞り込みが 2 段までのため） */
export function toDefinitions(regions: RegionRow[], parts: PartRow[]): RegionDef[] {
  const ids = new Set(regions.map((r) => r.id));
  const defs: RegionDef[] = regions.map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    sort: r.sort,
    point: r.lat !== null && r.lng !== null ? [r.lng, r.lat] : null,
    parts: [],
  }));
  const byId = new Map(defs.map((d) => [d.id, d]));
  for (const p of [...parts].sort((a, b) => (a.source + a.code < b.source + b.code ? -1 : 1))) {
    if (p.source_version !== SOURCE_VERSIONS[p.source]) {
      throw new Error(`元データの版が違います: ${p.region_id} ${p.source} ${p.source_version}（使う版は ${SOURCE_VERSIONS[p.source]}）`);
    }
    byId.get(p.region_id)?.parts.push({ source: p.source, version: p.source_version, code: p.code });
  }
  for (const d of defs) {
    if (d.parentId && !ids.has(d.parentId)) throw new Error(`親がありません: ${d.id} → ${d.parentId}`);
    const parent = d.parentId ? byId.get(d.parentId) : undefined;
    if (parent?.parentId) throw new Error(`親子が 3 段以上あります: ${parent.parentId} → ${parent.id} → ${d.id}`);
    if (parent?.id === d.id) throw new Error(`自分が親です: ${d.id}`);
  }
  return defs.sort((a, b) => (a.sort ?? 1e9) - (b.sort ?? 1e9) || (a.id < b.id ? -1 : 1));
}

/** 地図に出せる定義（材料か点を持つもの、または出せる子を持つ親） */
export function mappable(defs: RegionDef[]): RegionDef[] {
  const has = (d: RegionDef) => d.parts.length > 0 || d.point !== null;
  return defs.filter((d) => has(d) || defs.some((c) => c.parentId === d.id && has(c)));
}

function localDb() {
  const out = execFileSync("supabase", ["status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const s = JSON.parse(out) as { API_URL?: string; ANON_KEY?: string };
  if (!s.API_URL || !s.ANON_KEY) throw new Error("ローカルの Supabase が動いていません（supabase start）");
  if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(s.API_URL)) throw new Error("ローカル以外の DB からは作りません");
  return createClient(s.API_URL, s.ANON_KEY, { auth: { persistSession: false } });
}

export async function loadDefinitions(): Promise<RegionDef[]> {
  const db = localDb();
  const [r, p] = await Promise.all([
    db.from("regions").select("id, parent_id, name, sort, lat, lng"),
    db.from("region_parts").select("region_id, source, source_version, code"),
  ]);
  if (r.error) throw new Error(`regions: ${r.error.message}`);
  if (p.error) throw new Error(`region_parts: ${p.error.message}`);
  return toDefinitions(r.data as RegionRow[], p.data as PartRow[]);
}
