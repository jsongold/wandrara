-- feed_page の計測用 fixture。使い捨ての DB にだけ流す（destinations を truncate する）。
-- 使い方：psql -v n=560 -f supabase/tests/perf/feed_page_fixture.sql   （n = dest の件数。今は 560、2 倍 1120、5 倍 2800）
-- 乱数は固定（同じ n なら同じ中身）。公開 90%・公開日なし 8%・同時刻の公開（同値の並び）あり・写真 0〜8 枚・カテゴリ 0〜3 個・
-- 地区の 30% は 1 つの上位エリア（hot）に集中させる（関連タイルの重い側を見るため）
\set ON_ERROR_STOP on
select setseed(0.42);
truncate public.destinations cascade;

create temp table fx as
with leaves as (select id, row_number() over (order by id) as rn from public.regions where parent_id is not null),
     tops as (select id, row_number() over (order by id) as rn from public.regions where parent_id is null),
     hot as (select parent_id as top from public.regions where parent_id is not null group by 1 order by count(*) desc, 1 limit 1),
     hotleaves as (select id, row_number() over (order by id) as rn from public.regions where parent_id = (select top from hot)),
     g as (select i, random() as r1, random() as r2, random() as r3 from generate_series(1, :n) i)
select
  g.i,
  md5('fx-dest-' || g.i)::uuid as dest_id,
  (array['accommodation','experience','nature','village','building','hotspring'])[1 + (g.i % 6)] as core_type,
  case
    when g.r1 < 0.03 then null
    when g.r1 < 0.10 then (select id from tops where rn = 1 + floor(g.r2 * (select count(*) from tops))::int)
    when g.r1 < 0.40 then (select id from hotleaves where rn = 1 + floor(g.r2 * (select count(*) from hotleaves))::int)
    else (select id from leaves where rn = 1 + floor(g.r2 * (select count(*) from leaves))::int)
  end as region_id,
  g.r3
from g;

insert into public.destinations (dest_id, core_type, slug, ref, created_at)
select dest_id, core_type, 'fx-' || i, 'FX-' || i,
       timestamptz '2025-06-01 00:00:00+00' + (floor(r3 * 20000) * interval '37 seconds')  -- 同時刻あり
from fx;

insert into public.accommodations (dest_id, region_id) select dest_id, region_id from fx where core_type = 'accommodation';
insert into public.experiences (dest_id, region_id) select dest_id, region_id from fx where core_type = 'experience';
insert into public.natures (dest_id, region_id) select dest_id, region_id from fx where core_type = 'nature';
insert into public.villages (dest_id, region_id) select dest_id, region_id from fx where core_type = 'village';
insert into public.buildings (dest_id, region_id) select dest_id, region_id from fx where core_type = 'building';
insert into public.hotsprings (dest_id, region_id) select dest_id, region_id from fx where core_type = 'hotspring';

-- 公開日は 7 件ずつ同時刻（秒の単位。同値の並びを試す）。公開日なしの公開と、下書きも混ぜる
insert into public.publications (dest_id, status, published_at)
select dest_id,
       case when i % 10 = 0 then 'draft' else 'published' end,
       case when i % 10 = 0 or i % 12 = 1 then null
            else timestamptz '2026-01-01 00:00:00+00' + ((i / 7) * interval '1 minute') end
from fx;

insert into public.accommodation_texts (dest_id, lang, name, summary) select dest_id, 'ja', '宿' || i, case when i % 3 = 0 then '温泉のある宿' end from fx where core_type = 'accommodation';
insert into public.experience_texts (dest_id, lang, name, summary) select dest_id, 'ja', '体験' || i, case when i % 3 = 0 then '温泉街を歩く' end from fx where core_type = 'experience';
insert into public.nature_texts (dest_id, lang, name, summary) select dest_id, 'ja', '自然' || i, case when i % 3 = 0 then 'Onsen の湯けむり' end from fx where core_type = 'nature';
insert into public.village_texts (dest_id, lang, name, summary) select dest_id, 'ja', '村' || i, null from fx where core_type = 'village';
insert into public.building_texts (dest_id, lang, name, summary) select dest_id, 'ja', '建物' || i, null from fx where core_type = 'building';
insert into public.hotspring_texts (dest_id, lang, name, summary) select dest_id, 'ja', '湯' || i, case when i % 3 = 0 then 'かけ流し' end from fx where core_type = 'hotspring';
-- en は 4 割。name だけ
insert into public.accommodation_texts (dest_id, lang, name) select dest_id, 'en', 'Stay ' || i from fx where core_type = 'accommodation' and i % 5 < 2;
insert into public.experience_texts (dest_id, lang, name) select dest_id, 'en', 'Activity ' || i from fx where core_type = 'experience' and i % 5 < 2;
insert into public.nature_texts (dest_id, lang, name) select dest_id, 'en', 'Nature ' || i from fx where core_type = 'nature' and i % 5 < 2;

insert into public.dest_photos (dest_id, sort, storage_key, license, credit)
select dest_id, n, 'fx/' || i || '-' || n || '.jpg', 'cc-by', 'fx' from fx, generate_series(1, i % 9) n;

insert into public.dest_categories (dest_id, category_id)
select distinct f.dest_id, (select id from public.categories order by id offset ((f.i * (n + 3)) % 12) limit 1)
from fx f, generate_series(1, f.i % 4) n;

analyze public.destinations, public.publications, public.accommodations, public.experiences, public.natures, public.villages, public.buildings, public.hotsprings, public.regions, public.dest_categories, public.dest_photos, public.feed_entries;
select count(*) as dests, count(*) filter (where status = 'published') as published from public.publications;
