// 1 件の dest を登録する：検証 → 既存の引き当て → 中身が前回と同じなら飛ばす → 行に平たくする → dest_apply
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoreDef } from "../../db/schema/_shared.ts";
import { parseDestInput, type DestInput } from "./bundle.ts";
import { contentHash } from "./hash.ts";
import { planDestWrite, type DestRefs, type DestWritePlan } from "./plan.ts";

export type RegisterResult =
  | { ok: true; dest_id: string; slug: string; status: "draft"; unchanged: false }
  | { ok: true; dest_id: string; slug: string; status: string; unchanged: true }
  | { ok: false; status: 400 | 409; errors: string[] };

/** 最後に書き込んだ投入のハッシュと、今の公開状態。dest_apply が同じトランザクションで dest_imports に残すので、最新の行が表の中身と一致する */
async function loadLast(db: SupabaseClient, destId: string): Promise<{ hash: string | null; status: string | null }> {
  const { data: imp, error: e1 } = await db
    .from("dest_imports")
    .select("content_hash")
    .eq("dest_id", destId)
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  fail(e1, "dest_imports");
  const { data: pub, error: e2 } = await db.from("publications").select("status").eq("dest_id", destId).maybeSingle();
  fail(e2, "publications");
  return { hash: (imp?.content_hash as string | null) ?? null, status: (pub?.status as string | null) ?? null };
}

function fail(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what}: ${error.message}`);
}

function slugPrefix(input: DestInput): string {
  const s = String(input.slug ?? input.ref ?? "");
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 55);
}

export async function loadRefs(db: SupabaseClient, input: DestInput): Promise<DestRefs> {
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
  const regionIds = [input.region?.id, input.region?.parent_id].filter((v): v is string => !!v);
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

export async function applyDestWrite(db: SupabaseClient, plan: DestWritePlan): Promise<{ dest_id: string; slug: string }> {
  const { data, error } = await db.rpc("dest_apply", { p: plan });
  if (error) throw new Error(`dest_apply: ${error.message}`);
  return data as { dest_id: string; slug: string };
}

export async function registerDest(
  db: SupabaseClient,
  core: CoreDef,
  json: unknown,
  principal: { keyId: string; userId: string },
): Promise<RegisterResult> {
  const parsed = parseDestInput(core, json);
  if (!parsed.ok) return { ok: false, status: 400, errors: parsed.errors };
  const refs = await loadRefs(db, parsed.value);
  const existing = parsed.value.ref ? refs.destByRef.get(parsed.value.ref) : undefined;
  if (existing) {
    const ref = parsed.value.ref;
    if (existing.coreType !== core.coreType) {
      return { ok: false, status: 409, errors: [`ref ${ref} は別の種類（${existing.coreType}）で登録済み`] };
    }
    if (existing.createdBy !== principal.userId) {
      return { ok: false, status: 409, errors: [`ref ${ref} は別の登録者のもの。運営に引き継ぎを依頼する`] };
    }
    const last = await loadLast(db, existing.destId);
    if (last.hash && last.hash === contentHash(parsed.value)) {
      // 中身が同じ：何も書かない（公開中ならそのまま）
      return { ok: true, dest_id: existing.destId, slug: existing.slug, status: last.status ?? "draft", unchanged: true };
    }
  }
  const plan = planDestWrite(core, parsed.value, refs, { userId: principal.userId, keyId: principal.keyId, uuid: randomUUID });
  const res = await applyDestWrite(db, plan);
  return { ok: true, dest_id: res.dest_id, slug: res.slug, status: "draft", unchanged: false };
}
