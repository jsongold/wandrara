-- 体験・自然の古い詳細の表（13 個）を消す。詳細は experiences.details / natures.details（JSON）に持つ
-- 表を消す前に、dest_cards（experience_locations を見ない）と dest_apply（allowed から 13 個を外す）を作り直す
-- dest_apply の本体は 20261116011812_drop_accommodation_detail_tables と同じ（allowed から外しただけ）
-- DROP VIEW すると select の grant が消えるので、view は OR REPLACE で置き換える（列は同じ）
CREATE OR REPLACE VIEW "public"."dest_cards" WITH (security_invoker = true) AS (
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
  select e.dest_id, e.region_id, j.lat, j.lng
  from public.experiences e
  -- details があれば details.locations から（meeting を先に、なければ先頭の場所）
  left join lateral (
    select
      case when jsonb_typeof(x.loc->'lat') = 'number' then (x.loc->>'lat')::double precision end as lat,
      case when jsonb_typeof(x.loc->'lng') = 'number' then (x.loc->>'lng')::double precision end as lng
    from jsonb_array_elements(
      case when jsonb_typeof(e.details->'locations') = 'array' then e.details->'locations' else '[]'::jsonb end
    ) with ordinality as x(loc, n)
    order by (x.loc->>'kind' = 'meeting') desc, x.n
    limit 1
  ) j on e.details is not null
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
);
--> statement-breakpoint
-- dest_apply ---------------------------------------------------------------
-- 1 件の dest を 1 トランザクションで書く（API の POST /api/{path} から service_role で呼ぶ）
create or replace function public.dest_apply(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
-- p: { destination: {dest_id, core_type, slug, ref, created_by, is_demo?},  既存の dest なら slug・created_by は変えない
--      regions: [{id, parent_id?, name}], categories: [{id, parent_id?, name, icon?}],  無ければ作る（あれば触らない）
--      tables: [{table: "accommodations", rows: [...]}, ..., {table: "dest_photos", rows: [...]}],  親が先の順。表は allowed のどれか
--      dest_categories: [{dest_id, category_id}],  import: {ref, collector_key_id, payload, content_hash} }
-- rows の列は DB の列名（行に無い列は default、表に無いキーは無視）。親を指す列は TS（planDestWrite）が入れる。dest_id は関数が入れ直す
-- allowed の表の行はこの dest の分を全部消してから入れ直す。publications は draft に戻す
-- ただし既存の dest で、行ロックを取った後に見た最新の投入の content_hash が import.content_hash と同じなら、何も書かずに返す
--   （ロックの外で比べると、同じ中身の投入が 2 つ同時に来たとき両方が書き、間に公開されたものを draft に戻してしまう）
-- 戻り値: {dest_id, slug, unchanged, status}。unchanged=true のとき status は今の公開状態、false のとき 'draft'
declare
  -- 親が先の順。消すときは逆順（子から）
  allowed constant text[] := array[
    'accommodations', 'accommodation_texts',
    'experiences', 'experience_texts',
    'natures', 'nature_texts',
    'villages', 'village_texts', 'village_walks', 'village_shop_hours', 'village_access', 'village_events',
    'village_cautions',
    'buildings', 'building_texts', 'building_hours', 'building_fees', 'building_access', 'building_events',
    'building_cautions',
    'hotsprings', 'hotspring_texts', 'hotspring_baths', 'hotspring_hours', 'hotspring_fees', 'hotspring_amenities',
    'hotspring_access', 'hotspring_cautions',
    'dest_categories', 'dest_photos'
  ];
  d jsonb := p->'destination';
  v_dest_id uuid := coalesce((d->>'dest_id')::uuid, gen_random_uuid());
  v_slug text;
  item jsonb;
  t text;
  r jsonb;
  v_cols text[];
  v_list text;
begin
  -- 既存の dest：先に行ロックを取り（トランザクションの終わりまで持つ）、中身が前回と同じなら何も書かない
  select x.slug into v_slug from public.destinations x where x.dest_id = v_dest_id for update;
  if found and (p->'import'->>'content_hash') is not null and (p->'import'->>'content_hash') is not distinct from (
    select i.content_hash from public.dest_imports i where i.dest_id = v_dest_id order by i.imported_at desc limit 1
  ) then
    return jsonb_build_object(
      'dest_id', v_dest_id, 'slug', v_slug, 'unchanged', true,
      'status', (select pb.status from public.publications pb where pb.dest_id = v_dest_id)
    );
  end if;

  insert into public.regions (id, parent_id, name, municipality_code, sort)
  select x.id, x.parent_id, x.name, x.municipality_code, x.sort
  from jsonb_populate_recordset(null::public.regions, coalesce(p->'regions', '[]')) x
  on conflict (id) do nothing;

  insert into public.categories (id, parent_id, name, icon, sort)
  select x.id, x.parent_id, x.name, coalesce(x.icon, 'tag'), x.sort
  from jsonb_populate_recordset(null::public.categories, coalesce(p->'categories', '[]')) x
  on conflict (id) do nothing;

  insert into public.destinations (dest_id, core_type, slug, ref, is_demo, created_by)
  values (v_dest_id, d->>'core_type', d->>'slug', d->>'ref', coalesce((d->>'is_demo')::boolean, false), (d->>'created_by')::uuid)
  on conflict (dest_id) do update set core_type = excluded.core_type, ref = excluded.ref, updated_at = now()
  returning slug into v_slug;

  for i in reverse array_length(allowed, 1)..1 loop
    execute format('delete from public.%I where dest_id = $1', allowed[i]) using v_dest_id;
  end loop;

  for item in
    select x from jsonb_array_elements(
      coalesce(p->'tables', '[]')
      || jsonb_build_array(jsonb_build_object('table', 'dest_categories', 'rows', coalesce(p->'dest_categories', '[]')))
    ) x
  loop
    t := item->>'table';
    if t is null or not (t = any (allowed)) then
      raise exception 'dest_apply: table not allowed: %', t using errcode = '22023';
    end if;
    select array_agg(a.attname::text) into v_cols
    from pg_catalog.pg_attribute a
    where a.attrelid = format('public.%I', t)::regclass and a.attnum > 0 and not a.attisdropped;
    -- 1 行ずつ、その行にある列だけを入れる（無い列は default が効く。populate_recordset の select * だと NULL になる）
    for r in select x || jsonb_build_object('dest_id', v_dest_id) from jsonb_array_elements(coalesce(item->'rows', '[]')) x loop
      select string_agg(format('%I', k), ', ') into v_list
      from jsonb_object_keys(r) k where k = any (v_cols);
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', t, v_list, v_list, t)
        using r;
    end loop;
  end loop;

  insert into public.publications (dest_id, status, published_at, approved_by, updated_at)
  values (v_dest_id, 'draft', null, null, now())
  on conflict (dest_id) do update set status = 'draft', published_at = null, approved_by = null, updated_at = now();

  -- imported_at は clock_timestamp()（今の時刻）。default の now() はトランザクションの開始時刻なので、
  -- 重なった投入 A（先に開始）・B（後に開始）が B → A の順に書くと、表の中身は A なのに最新の行が B になる。
  -- ここは destinations の行ロック（上の upsert）を取った後なので、書いた順と imported_at の順が一致する
  insert into public.dest_imports (dest_id, ref, collector_key_id, payload, content_hash, imported_at)
  values (v_dest_id, p->'import'->>'ref', (p->'import'->>'collector_key_id')::uuid, p->'import'->'payload', p->'import'->>'content_hash', clock_timestamp());

  return jsonb_build_object('dest_id', v_dest_id, 'slug', v_slug, 'unchanged', false, 'status', 'draft');
end;
$$;

revoke execute on function public.dest_apply(jsonb) from public, anon, authenticated;
grant execute on function public.dest_apply(jsonb) to service_role;
--> statement-breakpoint
DROP POLICY "public read" ON "experience_booking_links" CASCADE;--> statement-breakpoint
DROP TABLE "experience_booking_links" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "experience_cautions" CASCADE;--> statement-breakpoint
DROP TABLE "experience_cautions" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "experience_courses" CASCADE;--> statement-breakpoint
DROP TABLE "experience_courses" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "experience_inclusions" CASCADE;--> statement-breakpoint
DROP TABLE "experience_inclusions" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "experience_locations" CASCADE;--> statement-breakpoint
DROP TABLE "experience_locations" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "experience_prices" CASCADE;--> statement-breakpoint
DROP TABLE "experience_prices" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "experience_schedules" CASCADE;--> statement-breakpoint
DROP TABLE "experience_schedules" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "nature_access" CASCADE;--> statement-breakpoint
DROP TABLE "nature_access" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "nature_cautions" CASCADE;--> statement-breakpoint
DROP TABLE "nature_cautions" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "nature_hours_fees" CASCADE;--> statement-breakpoint
DROP TABLE "nature_hours_fees" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "nature_restrictions" CASCADE;--> statement-breakpoint
DROP TABLE "nature_restrictions" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "nature_seasons" CASCADE;--> statement-breakpoint
DROP TABLE "nature_seasons" CASCADE;--> statement-breakpoint
DROP POLICY "public read" ON "nature_trails" CASCADE;--> statement-breakpoint
DROP TABLE "nature_trails" CASCADE;--> statement-breakpoint
