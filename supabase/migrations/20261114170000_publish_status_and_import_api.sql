-- 投入したスポットは下書き（draft）で入り、公開（published）にしたものだけを画面に出す。
-- 投入は scripts/import-bundle.ts が import_apply を API（シークレットキー）で呼ぶ。公開状態は scripts/spot-status.ts が変える。

alter table public.spots
  add column publish_status text not null default 'draft' check (publish_status in ('draft', 'published'));

-- これまでのデモと動作確認のデータは公開のまま
update public.spots set publish_status = 'published';

drop policy "public read" on public.spots;
create policy "public read" on public.spots for select to anon, authenticated using (publish_status = 'published');

-- シークレットキー（service_role）から読む・公開状態を変えるための権限
grant usage on schema public to service_role;
grant select on public.areas, public.categories, public.spots, public.spot_categories, public.spot_photos,
  public.spot_facts, public.spot_prices, public.import_records to service_role;
grant update (publish_status, updated_at) on public.spots to service_role;

-- 投入計画を 1 トランザクションで保存する。dry_run なら最後に例外で取り消す。
create function public.import_apply(p jsonb, dry_run boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  spot_ids text[];
begin
  select coalesce(array_agg(x.id), '{}') into spot_ids from jsonb_to_recordset(p->'spots') as x(id text);

  -- エリア・カテゴリ：bundle に書かれたものは更新、取り込み側が作るものはすでにあれば触らない
  insert into public.areas (id, parent_id, name, sort)
  select x.id, x.parent_id, x.name, x.sort from jsonb_to_recordset(p->'areas') as x(id text, parent_id text, name jsonb, sort int, overwrite boolean)
  where x.overwrite
  on conflict (id) do update set parent_id = excluded.parent_id, name = excluded.name;
  insert into public.areas (id, parent_id, name, sort)
  select x.id, x.parent_id, x.name, x.sort from jsonb_to_recordset(p->'areas') as x(id text, parent_id text, name jsonb, sort int, overwrite boolean)
  where not x.overwrite
  on conflict (id) do nothing;

  insert into public.categories (id, mode, parent_id, name, icon, sort)
  select x.id, x.mode, x.parent_id, x.name, x.icon, x.sort from jsonb_to_recordset(p->'categoryDefs') as x(id text, mode text, parent_id text, name jsonb, icon text, sort int, overwrite boolean)
  where x.overwrite
  on conflict (id) do update set mode = excluded.mode, parent_id = excluded.parent_id, name = excluded.name, icon = excluded.icon;
  insert into public.categories (id, mode, parent_id, name, icon, sort)
  select x.id, x.mode, x.parent_id, x.name, x.icon, x.sort from jsonb_to_recordset(p->'categoryDefs') as x(id text, mode text, parent_id text, name jsonb, icon text, sort int, overwrite boolean)
  where not x.overwrite
  on conflict (id) do nothing;

  -- 候補に戻ったスポットは外す（原本は import_records に残る）
  delete from public.spots where external_ref in (select jsonb_array_elements_text(p->'removeRefs'));

  insert into public.import_records (external_ref, spot_id, verification_status, record, collector, collected_at)
  select x.external_ref, x.spot_id, x.verification_status, x.record, x.collector, x.collected_at
  from jsonb_to_recordset(p->'records') as x(external_ref text, spot_id text, verification_status text, record jsonb, collector text, collected_at timestamptz)
  on conflict (external_ref) do update set spot_id = excluded.spot_id, verification_status = excluded.verification_status,
    record = excluded.record, collector = excluded.collector, collected_at = excluded.collected_at, imported_at = now();

  -- 同じ external_ref なら更新して下書きに戻す。id（URL）は変えない
  insert into public.spots (id, external_ref, kind, area_id, name, summary, location, official_url, booking_links, verification_status, is_demo, publish_status)
  select x.id, x.external_ref, x.kind, x.area_id, x.name, x.summary, x.location, x.official_url, x.booking_links, x.verification_status, false, 'draft'
  from jsonb_to_recordset(p->'spots') as x(id text, external_ref text, kind text, area_id text, name jsonb, summary jsonb, location jsonb, official_url text, booking_links jsonb, verification_status text)
  on conflict (external_ref) do update set kind = excluded.kind, area_id = excluded.area_id, name = excluded.name, summary = excluded.summary,
    location = excluded.location, official_url = excluded.official_url, booking_links = excluded.booking_links,
    verification_status = excluded.verification_status, is_demo = false, publish_status = 'draft', updated_at = now();

  -- 子の行は入れ替える
  delete from public.spot_categories where spot_id = any (spot_ids);
  delete from public.spot_facts where spot_id = any (spot_ids);
  delete from public.spot_photos where spot_id = any (spot_ids);
  delete from public.spot_prices where spot_id = any (spot_ids);

  insert into public.spot_categories (spot_id, category_id)
  select x.spot_id, x.category_id from jsonb_to_recordset(p->'categories') as x(spot_id text, category_id text);

  insert into public.spot_facts (spot_id, key, label, value, status, source_name, source_url, checked_at, detail, sources, sort)
  select x.spot_id, x.key, x.label, x.value, x.status, x.source_name, x.source_url, x.checked_at, x.detail, x.sources, x.sort
  from jsonb_to_recordset(p->'facts') as x(spot_id text, key text, label jsonb, value jsonb, status text, source_name text, source_url text, checked_at date, detail jsonb, sources jsonb, sort int);

  insert into public.spot_photos (spot_id, sort, url, license, credit, is_demo, source_page_url, alt, original_url)
  select x.spot_id, x.sort, x.url, x.license, x.credit, false, x.source_page_url, x.alt, x.original_url
  from jsonb_to_recordset(p->'photos') as x(spot_id text, sort int, url text, license text, credit text, source_page_url text, alt jsonb, original_url text);

  insert into public.spot_prices (spot_id, sort, amount, amount_max, currency, unit, guests, applies_to, taxes_included, fees_included, fees_note, sources)
  select x.spot_id, x.sort, x.amount, x.amount_max, x.currency, x.unit, x.guests, x.applies_to, x.taxes_included, x.fees_included, x.fees_note, x.sources
  from jsonb_to_recordset(p->'prices') as x(spot_id text, sort int, amount numeric, amount_max numeric, currency text, unit text, guests int, applies_to jsonb, taxes_included boolean, fees_included boolean, fees_note jsonb, sources jsonb);

  if dry_run then
    raise exception 'WANDRARA_DRY_RUN' using errcode = 'P0001';
  end if;
  return jsonb_build_object('spot_ids', to_jsonb(spot_ids));
end;
$$;

revoke execute on function public.import_apply(jsonb, boolean) from public, anon, authenticated;
grant execute on function public.import_apply(jsonb, boolean) to service_role;
