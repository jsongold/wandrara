-- feed_page の点数の並び（#156）：ページを順にたどった結果が、全件を点数順（同点は dest_id）に並べたものと一致する。
-- 使い捨ての DB で、feed_page_fixture.sql と feed_scores_apply を流した後に：
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -1 -f supabase/tests/feed_page_score.test.sql   （-1：1 つの transaction。最後の確認は点数を書き換える）
do $$
declare
  v_types text[] := array['accommodation','experience','nature','village','building','hotspring'];
  v_area text;
  v_page jsonb;
  v_got uuid[];
  v_want uuid[];
  v_after_score double precision;
  v_after_id uuid;
  v_guard int;
begin
  foreach v_area in array array['all', (select top_region_id from public.feed_entries where top_region_id is not null group by 1 order by count(*) desc limit 1)] loop
    v_got := '{}';
    v_after_score := null;
    v_after_id := null;
    v_guard := 0;
    loop
      v_page := public.feed_page(v_types, v_types, v_area, 'all', '', 'score', 7, null, v_after_id, false, 0, v_after_score);
      v_got := v_got || array(select (c ->> 'dest_id')::uuid from jsonb_array_elements(v_page -> 'cards') c);
      exit when not (v_page ->> 'has_more')::boolean;
      v_after_score := (v_page -> 'cards' -> -1 ->> 'sort_key')::double precision;
      v_after_id := (v_page -> 'cards' -> -1 ->> 'dest_id')::uuid;
      v_guard := v_guard + 1;
      if v_guard > 1000 then raise exception 'ページ送りが終わらない'; end if;
    end loop;
    v_want := array(select dest_id from public.feed_entries where area_id = v_area order by score desc, dest_id);
    if v_got is distinct from v_want then
      raise exception 'area %: ページをたどった結果（% 件）が全件の点数順（% 件）と違う', v_area, cardinality(v_got), cardinality(v_want);
    end if;
    raise notice 'area %: % 件 ok', v_area, cardinality(v_got);
  end loop;
end $$;

-- 写しを作り直しても点数が残る。点数の無い dest は種類の平均になる
do $$
declare v_dest uuid; v_core text; v_got double precision[];
begin
  select dest_id, core_type into v_dest, v_core from public.feed_entries where area_id = 'all' order by dest_id limit 1;
  insert into public.feed_scores (dest_id, score, algorithm) values (v_dest, 0.777, 'test')
    on conflict (dest_id) do update set score = excluded.score;
  perform public.feed_entry_refresh(v_dest);
  v_got := array(select distinct score from public.feed_entries where dest_id = v_dest);
  if v_got is distinct from array[0.777::double precision] then raise exception '作り直した後の点数が %', v_got; end if;

  delete from public.feed_scores where dest_id = v_dest;
  insert into public.feed_score_priors (core_type, score, algorithm) values (v_core, 0.123, 'test')
    on conflict (core_type) do update set score = excluded.score;
  perform public.feed_entry_refresh(v_dest);
  v_got := array(select distinct score from public.feed_entries where dest_id = v_dest);
  if v_got is distinct from array[0.123::double precision] then raise exception '点数の無い dest が種類の平均にならない: %', v_got; end if;
  raise notice '作り直し: ok';
end $$;
