-- dest_apply：dest_imports に content_hash も入れる（中身が前回と同じ投入を API が飛ばすため）。ほかは 20261115052521_functions_after と同じ
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
    'accommodations', 'accommodation_texts', 'accommodation_units', 'accommodation_bedrooms', 'accommodation_beds',
    'accommodation_baths', 'accommodation_meals', 'accommodation_booking_links', 'accommodation_prices',
    'accommodation_amenities', 'accommodation_parkings', 'accommodation_internet', 'accommodation_rules',
    'accommodation_access', 'accommodation_surroundings', 'accommodation_cautions', 'accommodation_licenses',
    'experiences', 'experience_texts', 'experience_courses', 'experience_prices', 'experience_schedules',
    'experience_locations', 'experience_inclusions', 'experience_cautions', 'experience_booking_links',
    'natures', 'nature_texts', 'nature_seasons', 'nature_hours_fees', 'nature_access', 'nature_trails',
    'nature_restrictions', 'nature_cautions',
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

