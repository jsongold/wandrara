// 1 件の dest を登録する：形と中身の検証 → 言語が languages 表にあるか → 代表の位置からエリアを決める → 既存と辞書の引き当て → region_id を確定（無ければ 400）
// → 行に平たくする → dest_apply（中身が前回と同じなら dest_apply が行ロックの中で飛ばす）
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoreDef } from "../../db/schema/_shared.ts";
import { parseDestInput, type DestInput } from "./bundle.ts";
import { planDestWrite, type DestRefs, type DestWritePlan } from "./plan.ts";
import { lookupManifest, resolveLocation } from "../region/lookup.ts";
import { representativeLocation } from "../region/representative.ts";
import { decideRegion } from "../region/resolve.ts";
import type { LookupManifest, RegionDecision, RepresentativeLocation, ResolveResult } from "../region/types.ts";

export type RegisterResult =
  | { ok: true; dest_id: string; slug: string; status: "draft"; unchanged: false }
  | { ok: true; dest_id: string; slug: string; status: string; unchanged: true }
  | { ok: false; status: 400 | 409; errors: string[] };

function fail(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

function slugPrefix(input: DestInput): string {
  const s = String(input.slug ?? input.ref ?? "");
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 55);
}

export async function loadRefs(db: SupabaseClient, input: DestInput, extraRegions: (string | null | undefined)[] = []): Promise<DestRefs> {
  const destByRef: DestRefs["destByRef"] = new Map();
  if (input.ref) {
    const { data, error } = await db.from("destinations").select("dest_id, slug, core_type, created_by").eq("ref", input.ref).maybeSingle();
    fail(error, "destinations(ref)");
    if (data) destByRef.set(input.ref, { destId: data.dest_id, slug: data.slug, coreType: data.core_type, createdBy: data.created_by });
  }

  // slug の重なり確認：同じ接頭辞のものだけ引く
  const slugs = new Set<string>();
  const prefix = slugPrefix(input);
  if (prefix) {
    const { data, error } = await db.from("destinations").select("slug").like("slug", `${prefix}%`).limit(1000);
    fail(error, "destinations(slug)");
    for (const r of data ?? []) slugs.add(r.slug);
  }

  const regions = new Set<string>();
  const regionIds = [...new Set([input.region?.id, input.region?.parent_id, input.core.region_id as string | undefined, ...extraRegions])].filter(
    (v): v is string => typeof v === "string" && v !== "",
  );
  if (regionIds.length) {
    const { data, error } = await db.from("regions").select("id").in("id", regionIds);
    fail(error, "regions");
    for (const r of data ?? []) regions.add(r.id);
  }

  const categories = new Set<string>();
  if (input.categories?.length) {
    const { data, error } = await db.from("categories").select("id").in("id", input.categories);
    fail(error, "categories");
    for (const r of data ?? []) categories.add(r.id);
  }

  return { destByRef, slugs, regions, categories };
}

/** languages 表に無い言語タグ（言語は自動では作らない。足すのは運営） */
export async function unknownLanguages(db: SupabaseClient, tags: string[]): Promise<string[]> {
  if (!tags.length) return [];
  const { data, error } = await db.from("languages").select("tag").in("tag", tags);
  fail(error, "languages");
  const known = new Set((data ?? []).map((r) => r.tag as string));
  return tags.filter((t) => !known.has(t));
}

export type ApplyResult = { dest_id: string; slug: string; unchanged: boolean; status: string };

export async function applyDestWrite(db: SupabaseClient, plan: DestWritePlan): Promise<ApplyResult> {
  const { data, error } = await db.rpc("dest_apply", { p: plan });
  if (error) throw new Error(`dest_apply: ${error.message}`);
  const r = data as Partial<ApplyResult> & { dest_id: string; slug: string };
  return { dest_id: r.dest_id, slug: r.slug, unchanged: r.unchanged === true, status: r.status ?? "draft" };
}

function regionError(d: Extract<RegionDecision, { ok: false }>, explicit: string | undefined): string {
  if (d.reason === "unknown_region") return `/core/region_id ${explicit} は無い。エリアは自動では作らない（運営が足す）`;
  const why = { outside: "どのエリアの中でもない", no_location: "位置（lat・lng か 都道府県＋市区町村）が無い", ambiguous: "複数のエリアの境目で決められない" }[d.reason];
  return `/core/region_id 位置からエリアを決められない（${why}）。region_id を指定する`;
}

/** 位置からエリアを決める部品（テストでは fixture の索引に差し替える） */
export type RegionDeps = { resolve: (loc: RepresentativeLocation) => Promise<ResolveResult>; manifest: LookupManifest };
const defaultRegionDeps: RegionDeps = { resolve: resolveLocation, manifest: lookupManifest };

export async function registerDest(
  db: SupabaseClient,
  core: CoreDef,
  json: unknown,
  principal: { keyId: string; userId: string },
  deps: RegionDeps = defaultRegionDeps,
  // 公開済みかもしれない既存の dest を書き換える直前に slug を知らせる（dest_apply は公開を draft に戻す）。新規は公開されていないので呼ばない
  onWrite?: (slug: string) => void,
): Promise<RegisterResult> {
  const parsed = parseDestInput(core, json);
  if (!parsed.ok) return { ok: false, status: 400, errors: parsed.errors };
  const input = parsed.value;
  const missing = await unknownLanguages(db, parsed.languages ?? []);
  if (missing.length) return { ok: false, status: 400, errors: missing.map((t) => `言語 ${t} は languages 表に無い。言語は自動では作らない（運営が足す）`) };
  const resolved = await deps.resolve(representativeLocation(core.coreType, input.core, input.details));
  const explicit = (input.core.region_id as string | undefined) ?? input.region?.id;
  const refs = await loadRefs(db, input, [resolved.ok ? resolved.regionId : null]);
  if (input.region && !refs.regions.has(input.region.id)) {
    return { ok: false, status: 400, errors: [`/region ${input.region.id} は無い。エリアは自動では作らない（運営が足す）`] };
  }
  const region = decideRegion(resolved, explicit, (id) => refs.regions.has(id), deps.manifest);
  if (!region.ok) return { ok: false, status: 400, errors: [regionError(region, explicit)] };
  // 索引と DB がずれていても FK エラー（500）にしない
  if (!refs.regions.has(region.regionId)) return { ok: false, status: 400, errors: [`/core/region_id ${region.regionId} は DB に無い（索引と DB がずれている）`] };
  const existing = parsed.value.ref ? refs.destByRef.get(parsed.value.ref) : undefined;
  if (existing) {
    const ref = parsed.value.ref;
    if (existing.coreType !== core.coreType) {
      return { ok: false, status: 409, errors: [`ref ${ref} は別の種類（${existing.coreType}）で登録済み`] };
    }
    if (existing.createdBy !== principal.userId) {
      return { ok: false, status: 409, errors: [`ref ${ref} は別の登録者のもの。運営に引き継ぎを依頼する`] };
    }
  }
  const plan = planDestWrite(core, input, refs, {
    userId: principal.userId,
    keyId: principal.keyId,
    uuid: randomUUID,
    region: { regionId: region.regionId, lookupVersion: deps.manifest.version },
  });
  if (existing) onWrite?.(existing.slug);
  const res = await applyDestWrite(db, plan);
  // unchanged: 中身が前回と同じで何も書かなかった（公開中ならそのまま）
  if (res.unchanged) return { ok: true, dest_id: res.dest_id, slug: res.slug, status: res.status, unchanged: true };
  return { ok: true, dest_id: res.dest_id, slug: res.slug, status: "draft", unchanged: false };
}
