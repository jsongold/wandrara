// 計画を 1 トランザクションの SQL にする。データは 1 つの JSON リテラルにまとめて渡し、値を SQL に埋め込まない。

import type { ImportPlan } from "./plan.ts";
import type { PhotoRow } from "./photo.ts";

export function quoteLiteral(s: string): string {
  return `'${s.replaceAll("'", "''")}'`;
}

const CHILD_TABLES = ["spot_categories", "spot_facts", "spot_photos", "spot_prices"] as const;

// commit=false なら最後に rollback する（dry-run で DB の制約まで確かめる）
export function renderSql(plan: ImportPlan, photos: PhotoRow[], { commit = true } = {}): string {
  const data = {
    areas: plan.areas, categoryDefs: plan.categoryDefs, records: plan.records, removeRefs: plan.removeRefs, spots: plan.spots,
    categories: plan.categories, facts: plan.facts, photos, prices: plan.prices,
  };
  const rs = (key: keyof typeof data, cols: string) => `from _plan, jsonb_to_recordset(_plan.p->'${key}') as x(${cols})`;
  return [
    "begin;",
    `create temp table _plan on commit drop as select ${quoteLiteral(JSON.stringify(data))}::jsonb as p;`,

    // エリア・カテゴリ：bundle に書かれたものは更新、取り込み側が作るものはすでにあれば触らない
    ...[true, false].map((overwrite) => `insert into public.areas (id, parent_id, name, sort)
select x.id, x.parent_id, x.name, x.sort ${rs("areas", "id text, parent_id text, name jsonb, sort int, overwrite boolean")} where x.overwrite = ${overwrite}
on conflict (id) do ${overwrite ? "update set parent_id = excluded.parent_id, name = excluded.name" : "nothing"};`),
    ...[true, false].map((overwrite) => `insert into public.categories (id, mode, parent_id, name, icon, sort)
select x.id, x.mode, x.parent_id, x.name, x.icon, x.sort ${rs("categoryDefs", "id text, mode text, parent_id text, name jsonb, icon text, sort int, overwrite boolean")} where x.overwrite = ${overwrite}
on conflict (id) do ${overwrite ? "update set mode = excluded.mode, parent_id = excluded.parent_id, name = excluded.name, icon = excluded.icon" : "nothing"};`),

    // 候補に戻ったスポットは公開から外す（原本は import_records に残る）
    "delete from public.spots where external_ref in (select jsonb_array_elements_text(p->'removeRefs') from _plan);",

    `insert into public.import_records (external_ref, spot_id, verification_status, record, collector, collected_at)
select x.external_ref, x.spot_id, x.verification_status, x.record, x.collector, x.collected_at
${rs("records", "external_ref text, spot_id text, verification_status text, record jsonb, collector text, collected_at timestamptz")}
on conflict (external_ref) do update set spot_id = excluded.spot_id, verification_status = excluded.verification_status,
  record = excluded.record, collector = excluded.collector, collected_at = excluded.collected_at, imported_at = now();`,

    // 同じ external_ref なら更新。id（URL）は変えない
    `insert into public.spots (id, external_ref, kind, area_id, name, summary, location, official_url, booking_links, verification_status, is_demo)
select x.id, x.external_ref, x.kind, x.area_id, x.name, x.summary, x.location, x.official_url, x.booking_links, x.verification_status, false
${rs("spots", "id text, external_ref text, kind text, area_id text, name jsonb, summary jsonb, location jsonb, official_url text, booking_links jsonb, verification_status text")}
on conflict (external_ref) do update set kind = excluded.kind, area_id = excluded.area_id, name = excluded.name, summary = excluded.summary,
  location = excluded.location, official_url = excluded.official_url, booking_links = excluded.booking_links,
  verification_status = excluded.verification_status, is_demo = false, updated_at = now();`,

    // 子の行は入れ替える
    ...CHILD_TABLES.map((t) => `delete from public.${t} where spot_id in (select x.id ${rs("spots", "id text")});`),

    `insert into public.spot_categories (spot_id, category_id)
select x.spot_id, x.category_id ${rs("categories", "spot_id text, category_id text")};`,

    `insert into public.spot_facts (spot_id, key, label, value, status, source_name, source_url, checked_at, detail, sources, sort)
select x.spot_id, x.key, x.label, x.value, x.status, x.source_name, x.source_url, x.checked_at, x.detail, x.sources, x.sort
${rs("facts", "spot_id text, key text, label jsonb, value jsonb, status text, source_name text, source_url text, checked_at date, detail jsonb, sources jsonb, sort int")};`,

    `insert into public.spot_photos (spot_id, sort, url, license, credit, is_demo, source_page_url, alt, original_url)
select x.spot_id, x.sort, x.url, x.license, x.credit, false, x.source_page_url, x.alt, x.original_url
${rs("photos", "spot_id text, sort int, url text, license text, credit text, source_page_url text, alt jsonb, original_url text")};`,

    `insert into public.spot_prices (spot_id, sort, amount, amount_max, currency, unit, guests, applies_to, taxes_included, fees_included, fees_note, sources)
select x.spot_id, x.sort, x.amount, x.amount_max, x.currency, x.unit, x.guests, x.applies_to, x.taxes_included, x.fees_included, x.fees_note, x.sources
${rs("prices", "spot_id text, sort int, amount numeric, amount_max numeric, currency text, unit text, guests int, applies_to jsonb, taxes_included boolean, fees_included boolean, fees_note jsonb, sources jsonb")};`,

    commit ? "commit;" : "rollback;",
  ].join("\n");
}
