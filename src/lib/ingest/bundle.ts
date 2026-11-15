// bundle v2 と API の入力（DestInput）の検証。core・details の中身は drizzle-zod の insert スキーマから作る
import { getTableName } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm/utils";
import { getTableConfig, type PgColumn, type PgTable } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { CORES } from "./cores.ts";
import type { CoreDef } from "../../db/schema/_shared.ts";

export type DestInput = Record<string, unknown> & {
  ref?: string | null;
  slug?: string | null;
  core: Record<string, unknown>;
  texts: Record<string, unknown>[];
  details?: Record<string, Record<string, unknown>[]>;
  categories?: string[];
  photos?: Record<string, unknown>[];
  region?: { id: string; name: Record<string, string>; parent_id?: string | null };
};

const localizedSchema = z.record(z.string(), z.string());
const numericSchema = z.union([z.number(), z.string()]).transform((v) => String(v));

/** 元のスキーマが optional / nullable ならそれを引き継ぐ */
function wrapOptional(base: z.ZodType, orig: z.ZodType): z.ZodType {
  let s = base;
  if (orig.safeParse(null).success) s = s.nullable();
  if (orig.safeParse(undefined).success) s = s.optional();
  return s;
}

/** 表の insert スキーマの shape を、DB の列名のキーにして返す（skip の列は除く） */
function columnShape(table: PgTable, skip: (col: PgColumn) => boolean): Record<string, z.ZodType> {
  const cols = getTableColumns(table) as Record<string, PgColumn>;
  const overrides: Record<string, (s: z.ZodType) => z.ZodType> = {};
  for (const [prop, col] of Object.entries(cols)) {
    if (col.columnType === "PgNumeric") overrides[prop] = (s) => wrapOptional(numericSchema, s);
    else if (col.columnType === "PgJsonb") overrides[prop] = (s) => wrapOptional(localizedSchema, s);
  }
  const schema = createInsertSchema(table, overrides as never) as unknown as z.ZodObject;
  const shape: Record<string, z.ZodType> = {};
  for (const [prop, col] of Object.entries(cols)) {
    if (skip(col)) continue;
    shape[col.name] = schema.shape[prop] as z.ZodType;
  }
  return shape;
}

/** 詳細の表を指す外部キーの列名（親を指す列も含む）。NULL＝dest 全体 の列は入力で受けない */
function detailFkColumns(table: PgTable, detailTables: PgTable[]): Set<string> {
  const names = new Set(detailTables.map((t) => getTableName(t)));
  const out = new Set<string>();
  for (const fk of getTableConfig(table).foreignKeys) {
    const ref = fk.reference();
    if (names.has(getTableName(ref.foreignTable))) for (const c of ref.columns) out.add(c.name);
  }
  return out;
}

const COMMON_SKIP = new Set(["id", "dest_id", "sort"]);

function detailSchema(core: CoreDef, key: string): z.ZodType {
  const d = core.details.find((x) => x.key === key)!;
  const fks = detailFkColumns(d.table, core.details.map((x) => x.table));
  const shape = columnShape(d.table, (c) => COMMON_SKIP.has(c.name) || fks.has(c.name));
  for (const child of core.details.filter((x) => x.parent?.key === key)) {
    shape[child.key] = z.array(detailSchema(core, child.key)).optional();
  }
  return z.strictObject(shape);
}

const photoBase = {
  license: z.string().nullish(),
  credit: z.string().nullish(),
  source_page_url: z.string().nullish(),
  original_url: z.string().nullish(),
  subject: z.enum(["exterior", "room", "bath", "view", "food", "activity", "landscape", "other"]).nullish(),
  alt: localizedSchema.nullish(),
};

const regionSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: localizedSchema,
  parent_id: z.string().nullish(),
});

function destShape(core: CoreDef, photos: z.ZodType): Record<string, z.ZodType> {
  const coreShape = columnShape(core.table, (c) => c.name === "dest_id" || c.name === "operator_id");
  const kinds = Object.keys(core.kindLabels);
  if (coreShape.kind && kinds.length) coreShape.kind = z.enum(kinds as [string, ...string[]]).nullish();
  const textsShape = columnShape(core.texts, (c) => c.name === "dest_id");
  const details: Record<string, z.ZodType> = {};
  for (const d of core.details.filter((x) => !x.parent)) details[d.key] = z.array(detailSchema(core, d.key)).optional();
  return {
    ref: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/, "ref は英数字・_・- の 1〜80 文字").nullish(),
    slug: z
      .string()
      .regex(/^[a-z0-9-]{3,60}$/)
      .nullish(),
    verification_status: z.string().nullish(),
    core: z.strictObject(coreShape),
    texts: z.array(z.strictObject(textsShape)).min(1),
    details: z.strictObject(details).optional(),
    categories: z.array(z.string().min(1)).optional(),
    photos: z.array(photos).optional(),
    region: regionSchema.optional(),
    sources: z.array(z.record(z.string(), z.unknown())).optional(),
  };
}

const bundlePhoto = z
  .strictObject({ file: z.string().optional(), url: z.string().optional(), ...photoBase })
  .refine((p) => (p.file ? 1 : 0) + (p.url ? 1 : 0) === 1, { message: "file か url のどちらか 1 つ" });

const apiPhoto = z.strictObject({ storage_key: z.string().min(1), ...photoBase });

/** API が受ける 1 件（core_type を除く）。photos は storage_key */
export function destInputSchema(core: CoreDef) {
  return z.strictObject(destShape(core, apiPhoto));
}

/** bundle の 1 件（core_type つき）。photos は file / url */
function bundleDestSchema(core: CoreDef) {
  return z.strictObject({ core_type: z.literal(core.coreType), ...destShape(core, bundlePhoto) });
}

function bundleSchema() {
  const dests = z.discriminatedUnion("core_type", CORES.map(bundleDestSchema) as never) as unknown as z.ZodType;
  return z.strictObject({
    bundle_version: z.literal("2"),
    collector: z.string().min(1),
    collected_at: z.string().min(1),
    // 同じ ref を 2 回書いた bundle は受けない（並列で送ると、新規なら 2 つ目が ref の重複で落ち、既存ならどちらが残るか決まらない）
    dests: z.array(dests).superRefine((ds, ctx) => {
      const first = new Map<string, number>();
      (ds as { ref?: string | null }[]).forEach((d, i) => {
        if (!d.ref) return;
        const j = first.get(d.ref);
        if (j === undefined) first.set(d.ref, i);
        else ctx.addIssue({ code: "custom", path: [i, "ref"], message: `ref ${d.ref} が /dests/${j} と重なっている。1 つの bundle に同じ ref は 1 回だけ` });
      });
    }),
  });
}

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => {
    const path = i.path.map((p) => `/${String(p)}`).join("");
    return `${path || "/"} ${i.message}`;
  });
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export type Bundle = {
  bundle_version: "2";
  collector: string;
  collected_at: string;
  dests: (DestInput & { core_type: string })[];
};

/** bundle ファイル用（photos は file / url） */
export function parseBundle(json: unknown): ParseResult<Bundle> {
  const r = bundleSchema().safeParse(json);
  return r.success ? { ok: true, value: r.data as unknown as Bundle } : { ok: false, errors: formatIssues(r.error) };
}

/** API 用（photos は storage_key 必須） */
export function parseDestInput(core: CoreDef, json: unknown): ParseResult<DestInput> {
  const r = destInputSchema(core).safeParse(json);
  return r.success ? { ok: true, value: r.data as unknown as DestInput } : { ok: false, errors: formatIssues(r.error) };
}

/** bundle の JSON Schema（i5 が schema/ に書き出す） */
export function bundleJsonSchema(): unknown {
  return z.toJSONSchema(bundleSchema(), { io: "input", unrepresentable: "any" });
}
