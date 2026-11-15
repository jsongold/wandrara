// 検証済みの DestInput を、表ごとの行（DB の列名）に平たくする純関数。書き込み自体は SQL 関数 dest_apply が行う
import { getTableName } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm/utils";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { CoreDef } from "../../db/schema/_shared.ts";
import type { DestInput } from "./bundle.ts";
import { contentHash } from "./hash.ts";

type Row = Record<string, unknown>;

export type DestRefs = {
  destByRef: Map<string, { destId: string; slug: string; coreType?: string; createdBy?: string | null }>;
  slugs: Set<string>;
  regions: Set<string>;
  categories: Set<string>;
};

export type PlanCtx = { userId: string; keyId: string; uuid: () => string };

export type DestWritePlan = {
  destination: { dest_id: string; core_type: string; slug: string; ref: string | null; created_by: string };
  regions: Row[];
  categories: Row[];
  /** コアの表 → texts → details（CoreDef の順）→ dest_photos */
  tables: { table: string; rows: Row[] }[];
  dest_categories: Row[];
  import: { dest_id: string; ref: string | null; collector_key_id: string; payload: unknown; content_hash: string };
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 55)
    .replace(/-+$/g, "");
}

function makeSlug(input: DestInput, slugs: Set<string>, uuid: () => string): string {
  let base = input.slug ?? slugify(input.ref ?? "");
  if (base.length < 3) base = `dest-${uuid().slice(0, 8)}`;
  let slug = base;
  for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export function planDestWrite(core: CoreDef, input: DestInput, refs: DestRefs, ctx: PlanCtx): DestWritePlan {
  const ref = input.ref ?? null;
  const existing = ref ? refs.destByRef.get(ref) : undefined;
  const destId = existing?.destId ?? ctx.uuid();
  const slug = existing?.slug ?? makeSlug(input, refs.slugs, ctx.uuid);

  const tables: { table: string; rows: Row[] }[] = [];
  const push = (table: string, rows: Row[]) => {
    if (rows.length) tables.push({ table, rows });
  };

  push(getTableName(core.table), [{ dest_id: destId, ...input.core }]);
  push(
    getTableName(core.texts),
    input.texts.map((t) => ({ dest_id: destId, ...t })),
  );

  // 詳細：親が先の順。各行は子の配列（key 名）を取り除き、子を親の id つきで集める
  const detailRows = new Map<string, Row[]>(core.details.map((d) => [d.key, []]));
  const children = (key: string) => core.details.filter((d) => d.parent?.key === key);
  const add = (key: string, items: Row[], parentId?: string, parentCol?: string) => {
    items.forEach((item, sort) => {
      const row: Row = { ...item };
      const kids = children(key);
      for (const k of kids) delete row[k.key];
      const id = ctx.uuid();
      detailRows.get(key)!.push({ id, dest_id: destId, ...(parentCol ? { [parentCol]: parentId } : {}), ...row, sort });
      for (const k of kids) add(k.key, (item[k.key] as Row[] | undefined) ?? [], id, columnName(k));
    });
  };
  const columnName = (d: CoreDef["details"][number]): string => {
    const col = (getTableColumns(d.table) as Record<string, PgColumn>)[d.parent!.column];
    return col.name;
  };
  for (const d of core.details.filter((x) => !x.parent)) {
    add(d.key, (input.details?.[d.key] as Row[] | undefined) ?? []);
  }
  for (const d of core.details) push(getTableName(d.table), detailRows.get(d.key)!);

  const photoRows = (input.photos ?? []).map((p, sort) => ({ id: ctx.uuid(), dest_id: destId, ...p, sort }));
  push("dest_photos", photoRows);

  // 足す region：input.region か、無い region_id なら id を名前にした行
  const regions: Row[] = [];
  const regionId = input.core.region_id as string | null | undefined;
  if (input.region && !refs.regions.has(input.region.id)) {
    regions.push({ id: input.region.id, name: input.region.name, parent_id: input.region.parent_id ?? null });
  } else if (regionId && !refs.regions.has(regionId) && input.region?.id !== regionId) {
    regions.push({ id: regionId, name: { ja: regionId } });
  }

  const catIds = [...new Set(input.categories ?? [])];
  const categories = catIds.filter((c) => !refs.categories.has(c)).map((c) => ({ id: c, name: { ja: c } }));

  return {
    destination: { dest_id: destId, core_type: core.coreType, slug, ref, created_by: ctx.userId },
    regions,
    categories,
    tables,
    dest_categories: catIds.map((c) => ({ dest_id: destId, category_id: c })),
    import: { dest_id: destId, ref, collector_key_id: ctx.keyId, payload: input, content_hash: contentHash(input) },
  };
}
