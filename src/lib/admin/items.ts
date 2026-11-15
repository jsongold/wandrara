// /admin の表の行を作る。db は Supabase クライアント（シークレットキー）
import { getTableName } from "drizzle-orm";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CORES } from "../ingest/cores.ts";

export type AdminItem = {
  destId: string;
  slug: string;
  name: string;
  typeLabel: string;
  ref: string | null;
  status: string;
  updatedAt: string;
  keyName: string;
};

/** ADMIN_USER_IDS（カンマ区切りの uuid）に userId が入っているか */
export function isAdmin(userId: string, env: string | undefined): boolean {
  if (!userId || !env) return false;
  return env.split(",").some((s) => s.trim() === userId);
}

type Rows<T> = { data: T[] | null };
type Dest = { dest_id: string; core_type: string; slug: string; ref: string | null; updated_at: string };

export async function listItems(db: SupabaseClient): Promise<AdminItem[]> {
  const [dests, pubs, imports, keys] = (await Promise.all([
    db.from("destinations").select("dest_id, core_type, slug, ref, updated_at"),
    db.from("publications").select("dest_id, status"),
    db.from("dest_imports").select("dest_id, collector_key_id, imported_at").order("imported_at", { ascending: false }),
    db.from("collector_keys").select("id, name"),
  ])) as [Rows<Dest>, Rows<{ dest_id: string; status: string }>, Rows<{ dest_id: string | null; collector_key_id: string | null }>, Rows<{ id: string; name: string }>];
  const texts = (await Promise.all(
    CORES.map((c) => db.from(getTableName(c.texts)).select("dest_id, lang, name")),
  )) as Rows<{ dest_id: string; lang: string; name: string }>[];

  const status = new Map((pubs.data ?? []).map((p) => [p.dest_id, p.status]));
  const keyName = new Map((keys.data ?? []).map((k) => [k.id, k.name]));
  const latestKey = new Map<string, string | null>(); // imports は新しい順。最初に出たものが最新
  for (const i of imports.data ?? []) if (i.dest_id && !latestKey.has(i.dest_id)) latestKey.set(i.dest_id, i.collector_key_id);
  const names = new Map<string, Record<string, string>>();
  for (const t of texts.flatMap((r) => r.data ?? [])) names.set(t.dest_id, { ...names.get(t.dest_id), [t.lang]: t.name });

  return (dests.data ?? [])
    .map((d) => {
      const n = names.get(d.dest_id);
      const kid = latestKey.get(d.dest_id);
      return {
        destId: d.dest_id,
        slug: d.slug,
        name: n?.ja || n?.en || d.slug,
        typeLabel: CORES.find((c) => c.coreType === d.core_type)?.label ?? d.core_type,
        ref: d.ref,
        status: status.get(d.dest_id) ?? "draft",
        updatedAt: d.updated_at,
        keyName: (kid && keyName.get(kid)) || "-",
      };
    })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/** JST の YYYY-MM-DD HH:mm */
export function formatJst(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return d.toISOString().slice(0, 16).replace("T", " ");
}
