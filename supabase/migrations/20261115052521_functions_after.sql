-- data_model の後に要るもの：grant・dest_apply・auth.users の trigger・バケット dest-photos
-- このプロジェクトでは新しい表に anon / authenticated の権限が自動で付かないので、ここで明示する。行の可否は RLS が決める

-- grant ----------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- コンテンツの表（destinations・コア・詳細・texts・写真・分類）と辞書・公開・一覧のビュー：読むだけ
grant select on
  public.destinations, public.publications, public.regions, public.categories, public.dest_cards,
  public.dest_photos, public.dest_categories,
  public.accommodations, public.accommodation_texts, public.accommodation_units, public.accommodation_bedrooms,
  public.accommodation_beds, public.accommodation_baths, public.accommodation_meals, public.accommodation_booking_links,
  public.accommodation_prices, public.accommodation_amenities, public.accommodation_parkings, public.accommodation_internet,
  public.accommodation_rules, public.accommodation_access, public.accommodation_surroundings, public.accommodation_cautions,
  public.accommodation_licenses,
  public.experiences, public.experience_texts, public.experience_courses, public.experience_prices,
  public.experience_schedules, public.experience_locations, public.experience_inclusions, public.experience_cautions,
  public.experience_booking_links,
  public.natures, public.nature_texts, public.nature_seasons, public.nature_hours_fees, public.nature_access,
  public.nature_trails, public.nature_restrictions, public.nature_cautions,
  public.villages, public.village_texts, public.village_walks, public.village_shop_hours, public.village_access,
  public.village_events, public.village_cautions,
  public.buildings, public.building_texts, public.building_hours, public.building_fees, public.building_access,
  public.building_events, public.building_cautions,
  public.hotsprings, public.hotspring_texts, public.hotspring_baths, public.hotspring_hours, public.hotspring_fees,
  public.hotspring_amenities, public.hotspring_access, public.hotspring_cautions
to anon, authenticated;

-- 利用者の表：本人の行だけ（RLS）。公開の tour は anon も読む（ポリシー public read）
grant select, update on public.users to authenticated;
grant select on public.operator_memberships to authenticated;
grant select, insert, delete on public.user_saves to authenticated;
grant select, insert, update, delete on public.tours, public.tour_stops, public.tour_shares to authenticated;
grant select on public.tours to anon;

-- シークレットキー（service_role）は全部
grant all on all tables in schema public to service_role;
grant usage on all sequences in schema public to service_role;

grant execute on function public.is_published(uuid) to anon, authenticated, service_role;

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
--      dest_categories: [{dest_id, category_id}],  import: {ref, collector_key_id, payload} }
-- rows の列は DB の列名（行に無い列は default、表に無いキーは無視）。親を指す列は TS（planDestWrite）が入れる。dest_id は関数が入れ直す
-- allowed の表の行はこの dest の分を全部消してから入れ直す。publications は draft に戻す
-- 戻り値: {dest_id, slug}
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

  insert into public.dest_imports (dest_id, ref, collector_key_id, payload)
  values (v_dest_id, p->'import'->>'ref', (p->'import'->>'collector_key_id')::uuid, p->'import'->'payload');

  return jsonb_build_object('dest_id', v_dest_id, 'slug', v_slug);
end;
$$;

revoke execute on function public.dest_apply(jsonb) from public, anon, authenticated;
grant execute on function public.dest_apply(jsonb) to service_role;

-- auth.users → public.users ----------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- storage --------------------------------------------------------------------
-- 写真の公開バケット。キーは <sha256>.<拡張子>。アップロードは API の署名付き URL から
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dest-photos', 'dest-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;
