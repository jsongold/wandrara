// /admin の表の行を作る。db は Supabase クライアント（シークレットキー）
// dest は 1 ページずつ読み、関係する行（公開状態・名前・投入）はそのページの dest の分だけ読む。
// Supabase は 1 回に返す行数に上限（api.max_rows）があるので、関係する行も上限より小さい塊で全部たどる
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

/** total・published は全体の件数（このページだけではない） */
export type AdminPage = { items: AdminItem[]; total: number; published: number; page: number; pageCount: number };

export const PAGE_SIZE = 100;
/** 関係する行を読む 1 回の行数。api.max_rows（1000）以下にする */
const CHUNK = 500;

/** ADMIN_USER_IDS（カンマ区切りの uuid）に userId が入っているか */
export function isAdmin(userId: string, env: string | undefined): boolean {
  if (!userId || !env) return false;
  return env.split(",").some((s) => s.trim() === userId);
}

type Res<T> = { data: T[] | null; error: { message: string } | null; count?: number | null };

/** Supabase の失敗は reject ではなく error に入るので、ここで投げる */
function rows<T>(r: Res<T>, what: string): T[] {
  if (r.error) throw new Error(`${what} の読み込みに失敗した: ${r.error.message}`);
  return r.data ?? [];
}

/** range(from, to) を CHUNK ずつ進め、返った行が CHUNK より少なくなるまで読む */
async function readAll<T>(what: string, query: (from: number, to: number) => PromiseLike<Res<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const got = rows(await query(from, from + CHUNK - 1), what);
    out.push(...got);
    if (got.length < CHUNK) return out;
  }
}

type Dest = { dest_id: string; core_type: string; slug: string; ref: string | null; updated_at: string };

/** page は 1 始まり。範囲外は端に寄せる */
export async function listItems(db: SupabaseClient, page = 1): Promise<AdminPage> {
  const want = Math.max(1, Math.floor(page) || 1);
  const destPage = (p: number) =>
    db
      .from("destinations")
      .select("dest_id, core_type, slug, ref, updated_at", { count: "exact" })
      .order("updated_at", { ascending: false })
      .order("dest_id")
      .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1) as unknown as PromiseLike<Res<Dest>>;

  const [first, pubCount] = await Promise.all([
    destPage(want),
    db.from("publications").select("dest_id", { count: "exact", head: true }).eq("status", "published") as unknown as PromiseLike<Res<never>>,
  ]);
  rows(pubCount, "publications(count)");
  const published = pubCount.count ?? 0;
  let res = first;
  let dests = rows(res, "destinations");
  const total = res.count ?? dests.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  let current = want;
  if (want > pageCount) {
    current = pageCount;
    res = await destPage(current);
    dests = rows(res, "destinations");
  }
  const ids = dests.map((d) => d.dest_id);
  if (ids.length === 0) return { items: [], total, published, page: current, pageCount };

  const [pubs, imports, ...texts] = await Promise.all([
    readAll<{ dest_id: string; status: string }>("publications", (f, t) =>
      db.from("publications").select("dest_id, status").in("dest_id", ids).order("dest_id").range(f, t) as never,
    ),
    // 新しい順。dest ごとに最初に出たものが最新
    readAll<{ dest_id: string | null; collector_key_id: string | null }>("dest_imports", (f, t) =>
      db
        .from("dest_imports")
        .select("dest_id, collector_key_id")
        .in("dest_id", ids)
        .order("imported_at", { ascending: false })
        .order("id")
        .range(f, t) as never,
    ),
    ...CORES.map((c) =>
      readAll<{ dest_id: string; lang: string; name: string }>(getTableName(c.texts), (f, t) =>
        db.from(getTableName(c.texts)).select("dest_id, lang, name").in("dest_id", ids).order("dest_id").order("lang").range(f, t) as never,
      ),
    ),
  ]);

  const latestKey = new Map<string, string | null>();
  for (const i of imports) if (i.dest_id && !latestKey.has(i.dest_id)) latestKey.set(i.dest_id, i.collector_key_id);
  const keyIds = [...new Set([...latestKey.values()].filter((v): v is string => !!v))];
  const keys = keyIds.length
    ? rows((await db.from("collector_keys").select("id, name").in("id", keyIds)) as Res<{ id: string; name: string }>, "collector_keys")
    : [];

  const status = new Map(pubs.map((p) => [p.dest_id, p.status]));
  const keyName = new Map(keys.map((k) => [k.id, k.name]));
  const names = new Map<string, Record<string, string>>();
  for (const t of texts.flat()) names.set(t.dest_id, { ...names.get(t.dest_id), [t.lang]: t.name });

  const items = dests.map((d) => {
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
  });
  return { items, total, published, page: current, pageCount };
}

/** JST の YYYY-MM-DD HH:mm */
export function formatJst(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return d.toISOString().slice(0, 16).replace("T", " ");
}
