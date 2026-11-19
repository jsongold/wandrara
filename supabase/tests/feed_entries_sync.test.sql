-- feed_entries（フィードの索引の表）が、公開・非公開・日付・地域の変更に追従して、いつも feed_index の定義と一致する
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
-- 写しは commit 時に作り直される（deferred）。この test は 1 つの transaction の中で見るので、文ごとに作り直させる
set constraints all immediate;

-- feed_entries が feed_index（あるべき中身）と 1 行も違わない
create or replace function pg_temp.drift() returns bigint language sql as $$
  select count(*) from (
    (select i.dest_id, a.area_id, i.core_type, i.dest_created_at, i.published_at, i.region_id, i.parent_region_id, i.top_region_id
       from public.feed_index i cross join lateral (values ('all'), (i.region_id), (i.parent_region_id), ('r:' || i.region_id)) a(area_id) where a.area_id is not null
     except
     select dest_id, area_id, core_type, dest_created_at, published_at, region_id, parent_region_id, top_region_id from public.feed_entries)
    union all
    (select dest_id, area_id, core_type, dest_created_at, published_at, region_id, parent_region_id, top_region_id from public.feed_entries
     except
     select i.dest_id, a.area_id, i.core_type, i.dest_created_at, i.published_at, i.region_id, i.parent_region_id, i.top_region_id
       from public.feed_index i cross join lateral (values ('all'), (i.region_id), (i.parent_region_id), ('r:' || i.region_id)) a(area_id) where a.area_id is not null)
  ) x
$$;

insert into public.regions (id, parent_id, name) values ('t-top', null, '{"ja":"上"}'), ('t-top2', null, '{"ja":"上2"}'), ('t-leaf', 't-top', '{"ja":"下"}');
insert into public.destinations (dest_id, core_type, slug, ref) values ('00000000-0000-4000-8000-0000000000f1', 'accommodation', 't-feed-f1', 'T-feed-f1');
insert into public.accommodations (dest_id, region_id) values ('00000000-0000-4000-8000-0000000000f1', 't-leaf');
select is((select count(*) from public.feed_entries where dest_id = '00000000-0000-4000-8000-0000000000f1'), 0::bigint, '下書きは索引に入らない');

insert into public.publications (dest_id, status, published_at) values ('00000000-0000-4000-8000-0000000000f1', 'published', '2026-01-01 00:00:00+00')
  on conflict (dest_id) do update set status = 'published', published_at = '2026-01-01 00:00:00+00';
select is((select array_agg(area_id order by area_id) from public.feed_entries where dest_id = '00000000-0000-4000-8000-0000000000f1'),
          array['all', 'r:t-leaf', 't-leaf', 't-top'], '公開すると all・自分の地区・親・r:地区の 4 行');
select is(pg_temp.drift(), 0::bigint, '公開後も定義と一致');

update public.publications set published_at = null where dest_id = '00000000-0000-4000-8000-0000000000f1';
select is((select pub_key from public.feed_entries where dest_id = '00000000-0000-4000-8000-0000000000f1' and area_id = 'all'), '-infinity'::timestamptz, '公開日なしは -infinity');

update public.accommodations set region_id = 't-top2' where dest_id = '00000000-0000-4000-8000-0000000000f1';
select is((select array_agg(area_id order by area_id) from public.feed_entries where dest_id = '00000000-0000-4000-8000-0000000000f1'),
          array['all', 'r:t-top2', 't-top2'], '地域を付け替えると行も付け替わる（親なしは 3 行）');

update public.regions set parent_id = 't-top' where id = 't-top2';
select is((select top_region_id from public.feed_entries where dest_id = '00000000-0000-4000-8000-0000000000f1' and area_id = 'all'), 't-top', '地域の親を変えると上位エリアが追従する');
select is(pg_temp.drift(), 0::bigint, '付け替え後も定義と一致');

update public.publications set status = 'draft' where dest_id = '00000000-0000-4000-8000-0000000000f1';
select is((select count(*) from public.feed_entries where dest_id = '00000000-0000-4000-8000-0000000000f1'), 0::bigint, '非公開にすると索引から消える');

update public.publications set status = 'published' where dest_id = '00000000-0000-4000-8000-0000000000f1';
delete from public.destinations where dest_id = '00000000-0000-4000-8000-0000000000f1';
select is((select count(*) from public.feed_entries where dest_id = '00000000-0000-4000-8000-0000000000f1'), 0::bigint, 'dest を消しても索引に残らない（外部キー無し）');

select * from finish();
rollback;
