// 画面の一覧（カード）用のビュー。公開中の dest だけ。security_invoker なので読む人の RLS がそのまま効く
import { sql } from "drizzle-orm";
import { boolean, doublePrecision, jsonb, pgView, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { LocalizedText } from "./_shared.ts";

export type DestCardPhoto = { storage_key: string; license: string | null; credit: string | null; alt: LocalizedText | null };

export const destCards = pgView("dest_cards", {
  destId: uuid("dest_id").notNull(),
  coreType: text("core_type").notNull(),
  slug: text("slug").notNull(),
  isDemo: boolean("is_demo").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  regionId: text("region_id"),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  name: jsonb("name").$type<LocalizedText>(),
  summary: jsonb("summary").$type<LocalizedText>(),
  categoryIds: text("category_ids").array().notNull(),
  photos: jsonb("photos").$type<DestCardPhoto[]>().notNull(),
})
  .with({ securityInvoker: true })
  .as(sql`
with texts as (
  select dest_id, lang, name, summary from public.accommodation_texts
  union all select dest_id, lang, name, summary from public.experience_texts
  union all select dest_id, lang, name, summary from public.nature_texts
  union all select dest_id, lang, name, summary from public.village_texts
  union all select dest_id, lang, name, summary from public.building_texts
  union all select dest_id, lang, name, summary from public.hotspring_texts
),
places as (
  select dest_id, region_id, lat, lng from public.accommodations
  union all select dest_id, region_id, lat, lng from public.natures
  union all select dest_id, region_id, lat, lng from public.villages
  union all select dest_id, region_id, lat, lng from public.buildings
  union all select dest_id, region_id, lat, lng from public.hotsprings
  union all
  select e.dest_id, e.region_id, l.lat, l.lng
  from public.experiences e
  left join lateral (
    select x.lat, x.lng from public.experience_locations x where x.dest_id = e.dest_id order by x.sort, x.id limit 1
  ) l on true
)
select
  d.dest_id, d.core_type, d.slug, d.is_demo, d.created_at, pub.published_at,
  pl.region_id, pl.lat, pl.lng,
  t.name, t.summary,
  coalesce(c.category_ids, '{}'::text[]) as category_ids,
  coalesce(ph.photos, '[]'::jsonb) as photos
from public.destinations d
join public.publications pub on pub.dest_id = d.dest_id and pub.status = 'published'
left join places pl on pl.dest_id = d.dest_id
left join lateral (
  select
    jsonb_object_agg(x.lang, x.name) as name,
    jsonb_object_agg(x.lang, x.summary) filter (where x.summary is not null) as summary
  from texts x where x.dest_id = d.dest_id
) t on true
left join lateral (
  select array_agg(x.category_id order by x.category_id) as category_ids
  from public.dest_categories x where x.dest_id = d.dest_id
) c on true
left join lateral (
  select jsonb_agg(
    jsonb_build_object('storage_key', x.storage_key, 'license', x.license, 'credit', x.credit, 'alt', x.alt)
    order by x.sort, x.id
  ) as photos
  from public.dest_photos x where x.dest_id = d.dest_id
) ph on true
`);
