-- used_root_categories / area_item_traits の実行時間（MS2c）。feed_page_fixture.sql を流した使い捨ての DB で、n を変えて比べる：
--   psql -v n=560 -f supabase/tests/perf/feed_page_fixture.sql && psql -f supabase/tests/perf/area_sheet_meta_bench.sql
-- 5 回ずつ流して最後の 3 回（キャッシュが温まった後）を見る。EXPLAIN は関数の中が見えないので、本体と同じ文を直接流してバッファを見る。
\timing on
select cardinality(public.used_root_categories(array['accommodation'])) from generate_series(1, 5);
select count(*) from (select public.area_item_traits() from generate_series(1, 5)) x;

-- バッファ（area_item_traits の本体と同じ文）
explain (analyze, buffers, costs off, timing off)
select distinct fe.region_id, t.id as trait_id
from public.traits t
join public.dest_categories dc on dc.category_id = any (t.category_ids)
join public.feed_entries fe on fe.dest_id = dc.dest_id and fe.area_id = 'all'
where t.source = 'items' and fe.region_id is not null;
