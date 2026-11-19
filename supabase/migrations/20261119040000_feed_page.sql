-- MS2b（#109）：フィードを DB で 1 ページ分だけ返す。全件を読み込んでから切り出さない。
--
-- なぜ索引の表（feed_entries）を持つか：dest は 6 つのコアの表（region_id）・publications（公開日）・destinations（作成日）に分かれている。
--   ビューで結合したまま並べ替えると、planner は結合してから並べるので 1 リクエストが件数に比例した（56,000 件で約 500ms を実測）。
--   並びと絞り込みに要る列だけを 1 つの表に写し、複合 index で「並びの順に 13 行だけ読む」形にする。
--   エリアの絞り込み（地区そのもの OR その子）は、dest ごとに area_id の行（最大 4 行）を持たせ、1 つの等号で引けるようにする（OR だと planner が全件を読む計画を選ぶ）。
--   写しは trigger が保つ（公開・非公開・投入・地域の付け替えのたびに、その dest の 1 行だけ作り直す）。
-- 並び（buildFeed の orderEditorial と同じ）：editorial は published_at の新しい順（NULL は最後）、fresh は作成日の新しい順。
--   同じ値は dest_id の昇順（buildFeed は dest_id 昇順で読んだ配列を安定ソートしていた）。続きの位置は (並びの値, dest_id) の keyset。
-- 関連タイル：もう片方の mode の dest で、カードと同じ上位エリアのもの。同じ地区を先に、公開日の新しい順、上限つき（relatedOtherMode と同じ）。
--   直前のカードとの重複の間引き（dedupeRelatedTiles）は直前の結果に依存するので DB では行わず、アプリ側（src/lib/feed-page.ts）が行う。
-- 総件数：p_with_total のときだけ、1000 件を上限に数える（超えたら total_capped）。
-- 権限：security invoker（RLS はそのまま効く）。feed_entries は公開中の dest だけを持つ。

-- 絞り込みと並びの元になるビュー（feed_entries の中身の定義。trigger の作り直しと、テストの突き合わせに使う）-----------
create or replace view public.feed_index with (security_invoker = true) as
with places as (
  select dest_id, region_id from public.accommodations
  union all select dest_id, region_id from public.experiences
  union all select dest_id, region_id from public.natures
  union all select dest_id, region_id from public.villages
  union all select dest_id, region_id from public.buildings
  union all select dest_id, region_id from public.hotsprings
)
select
  d.dest_id,
  d.core_type,
  d.created_at as dest_created_at,
  pub.published_at,
  coalesce(pub.published_at, '-infinity'::timestamptz) as pub_key,
  pl.region_id,
  r.parent_id as parent_region_id,
  coalesce(r.parent_id, pl.region_id) as top_region_id
from public.destinations d
join public.publications pub on pub.dest_id = d.dest_id and pub.status = 'published'
left join places pl on pl.dest_id = d.dest_id
left join public.regions r on r.id = pl.region_id;

-- 索引の表 -----------------------------------------------------------------------
-- 1 つの dest につき最大 4 行：area_id = 'all'、自分の地区、親のエリア、'r:' + 自分の地区（関連タイルの「同じ地区」。地区が上位エリアのとき子の地区を含まない）
create table if not exists public.feed_entries (
  dest_id uuid not null references public.destinations (dest_id) on delete cascade,
  area_id text not null,
  core_type text not null,
  dest_created_at timestamptz not null,
  published_at timestamptz,
  pub_key timestamptz not null,      -- published_at。NULL は -infinity（最後に並べ、keyset を 1 つの比較で書くため）
  region_id text,
  parent_region_id text,
  top_region_id text,                -- 親があれば親、無ければ自分
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (dest_id, area_id)
);
alter table public.feed_entries enable row level security;
drop policy if exists "public read" on public.feed_entries;
create policy "public read" on public.feed_entries for select to anon, authenticated using (true);
grant select on public.feed_entries to anon, authenticated;
grant all on public.feed_entries to service_role;

-- 並び（editorial / fresh）。どちらも area_id の等号 + 並びの順
create index if not exists feed_entries_pub_idx on public.feed_entries (area_id, pub_key desc, dest_id);
create index if not exists feed_entries_created_idx on public.feed_entries (area_id, dest_created_at desc, dest_id);
-- カテゴリの絞り込み
create index if not exists dest_categories_category_idx on public.dest_categories (category_id, dest_id);

-- 写しを保つ ---------------------------------------------------------------------
create or replace function public.feed_entry_refresh(p_dest uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- 同じ dest を別の transaction が書いている間に作り直すと、古い値で作ってしまう。dest ごとに待ち合わせる（待った後の各文は、書き終えた側の変更を見る）。
  -- trigger は commit 時に走らせる（下）ので、この lock を持っている間に元の表の行を待つことが無く、dest_apply・公開との lock の順の食い違い（deadlock）が起きない
  perform pg_advisory_xact_lock(hashtextextended(p_dest::text, 0));
  delete from public.feed_entries where dest_id = p_dest;
  insert into public.feed_entries (dest_id, area_id, core_type, dest_created_at, published_at, pub_key, region_id, parent_region_id, top_region_id)
  select i.dest_id, a.area_id, i.core_type, i.dest_created_at, i.published_at, i.pub_key, i.region_id, i.parent_region_id, i.top_region_id
  from public.feed_index i
  cross join lateral (values ('all'), (i.region_id), (i.parent_region_id), ('r:' || i.region_id)) a(area_id)
  where i.dest_id = p_dest and a.area_id is not null;
end;
$$;
revoke execute on function public.feed_entry_refresh(uuid) from public, anon, authenticated;

create or replace function public.feed_entry_touch() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.feed_entry_refresh(coalesce(new.dest_id, old.dest_id));
  return null;
end;
$$;
revoke execute on function public.feed_entry_touch() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['destinations', 'publications', 'accommodations', 'experiences', 'natures', 'villages', 'buildings', 'hotsprings'] loop
    execute format('drop trigger if exists feed_entry_sync on public.%I', t);
    execute format('create constraint trigger feed_entry_sync after insert or update or delete on public.%I deferrable initially deferred for each row execute function public.feed_entry_touch()', t);
  end loop;
end $$;

-- 地域の付け替え（parent_id の更新）：その地域の dest の行を作り直す
create or replace function public.feed_entry_regions_touch() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.feed_entry_refresh(d.dest_id) from (select distinct dest_id from public.feed_entries where region_id = new.id) d;
  return null;
end;
$$;
revoke execute on function public.feed_entry_regions_touch() from public, anon, authenticated;
drop trigger if exists feed_entry_sync on public.regions;
create constraint trigger feed_entry_sync after update of parent_id on public.regions deferrable initially deferred for each row execute function public.feed_entry_regions_touch();

-- 今ある分を写す
insert into public.feed_entries (dest_id, area_id, core_type, dest_created_at, published_at, pub_key, region_id, parent_region_id, top_region_id)
select i.dest_id, a.area_id, i.core_type, i.dest_created_at, i.published_at, i.pub_key, i.region_id, i.parent_region_id, i.top_region_id
from public.feed_index i
cross join lateral (values ('all'), (i.region_id), (i.parent_region_id), ('r:' || i.region_id)) a(area_id)
where a.area_id is not null
on conflict (dest_id, area_id) do nothing;

-- 絞り込み（findCandidates の area・q と primaryByMode の mode・cat）------------------------------
-- area_id の等号 1 つで、エリア（地区そのものと、その子の地区）が並びの順の索引で引ける
create or replace function public.feed_candidates(p_core_types text[], p_area text, p_cat text, p_q text)
returns setof public.feed_entries
language sql stable
as $$
  select fe.*
  from public.feed_entries fe
  where fe.area_id = p_area and fe.core_type = any (p_core_types)
    and (p_cat = 'all' or exists (
      select 1 from public.dest_categories dc where dc.dest_id = fe.dest_id and dc.category_id = p_cat))
    -- 文字列検索は索引が効かず、候補の件数に比例する（今の画面は検索を出していない）。name・summary の ja・en を空白でつないで部分一致（findCandidates と同じ）
    and (p_q = '' or exists (
      select 1 from public.dest_cards dc
      where dc.dest_id = fe.dest_id
        and strpos(lower(concat_ws(' ', nullif(dc.name ->> 'ja', ''), nullif(dc.name ->> 'en', ''),
                                   nullif(dc.summary ->> 'ja', ''), nullif(dc.summary ->> 'en', ''))), lower(p_q)) > 0))
$$;

-- 1 ページ分 ---------------------------------------------------------------------
-- 戻り値は jsonb 1 つ（Data API の max_rows に掛からない）：
--   { cards: [{dest_id, core_type, slug, name, photos, region_name, parent_region_name, sort_key, tiles: [...]}],
--     has_more, total（p_with_total のときだけ）, total_capped }
-- 続きの位置は p_after_key（直前の最後のカードの sort_key）と p_after_id（その dest_id）。p_after_key が NULL なら先頭から
-- plan_cache_mode：条件ごとに計画を立て直す（条件が定数になり、使わない分岐が消えて索引が効く）
-- enable_bitmapscan = off：関連タイルで「そのエリア全体を bitmap で読んでから並べる」計画が選ばれると、dest が集中するエリアで件数に比例する。
--   並びの順の索引を上限まで読む計画に固定する（このファンクションの中だけ）
create or replace function public.feed_page(
  p_core_types text[],
  p_related_core_types text[],
  p_area text default 'all',
  p_cat text default 'all',
  p_q text default '',
  p_sort text default 'editorial',
  p_limit int default 12,
  p_after_key timestamptz default null,
  p_after_id uuid default null,
  p_with_total boolean default false,
  p_tiles int default 6
) returns jsonb
language plpgsql stable
set plan_cache_mode = force_custom_plan
set enable_bitmapscan = off
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 12), 1), 50);
  v_tiles int := least(greatest(coalesce(p_tiles, 6), 0), 12);
  v_cap constant int := 1000;
  v_total int;
  v_out jsonb;
begin
  if p_with_total then
    select count(*) into v_total
    from (select 1 from public.feed_candidates(p_core_types, p_area, p_cat, p_q) limit v_cap + 1) x;
  end if;

  with top as (
    select
      c.dest_id, c.region_id, c.top_region_id,
      case when p_sort = 'fresh' then c.dest_created_at else c.pub_key end as k
    from public.feed_candidates(p_core_types, p_area, p_cat, p_q) c
    where p_after_key is null
       or (case when p_sort = 'fresh' then c.dest_created_at else c.pub_key end) <= p_after_key
          and ((case when p_sort = 'fresh' then c.dest_created_at else c.pub_key end) < p_after_key or c.dest_id > p_after_id)
    order by case when p_sort = 'fresh' then c.dest_created_at else c.pub_key end desc, c.dest_id
    limit v_limit + 1
  ),
  page as (select t.*, row_number() over (order by t.k desc, t.dest_id) as rn from top t),
  prim as (select * from page where rn <= v_limit),
  -- 関連タイル：同じ地区の分と、同じ上位エリアのほかの地区の分を、それぞれ並びの順に上限まで読んで合わせる。
  -- タイルもエリアの中だけ（inArea と同じ）：同じ地区の分はカードと同じ地区なので常にエリアの中。ほかの地区の分は、エリア指定が無いか
  -- 上位エリアのときだけ（地区を指定したときは同じ地区しか入らない）
  rel as (
    select x.anchor_id, x.dest_id as tile_id,
           row_number() over (partition by x.anchor_id order by x.same desc, x.pub_key desc, x.dest_id) as n
    from (
      select pr.dest_id as anchor_id, t.dest_id, t.same, t.pub_key
      from prim pr
      cross join lateral (
        select u.dest_id, u.same, u.pub_key from (
          (select c.dest_id, true as same, c.pub_key
           from public.feed_candidates(p_related_core_types, 'r:' || pr.region_id, 'all', '') c
           where pr.region_id is not null and c.dest_id <> pr.dest_id
           order by c.pub_key desc, c.dest_id limit v_tiles)
          union all
          (select c.dest_id, false, c.pub_key
           from public.feed_candidates(p_related_core_types, pr.top_region_id, 'all', '') c
           where (p_area = 'all' or p_area = pr.top_region_id) and pr.top_region_id is not null
             and c.region_id is distinct from pr.region_id and c.dest_id <> pr.dest_id
           order by c.pub_key desc, c.dest_id limit v_tiles)
        ) u
        order by u.same desc, u.pub_key desc, u.dest_id
        limit v_tiles
      ) t
    ) x
  ),
  -- 本文・写真は、必要な dest_id だけ dest_cards から引く。lateral + offset 0 で「1 件ずつ主キーで引く」形に固定する
  -- （IN (...) だと dest_cards 全件を作ってから絞る計画になり、件数に比例する）
  det as (
    select dc.dest_id, dc.slug, dc.core_type, dc.name, dc.photos, r.name as region_name, pr.name as parent_region_name
    from (select dest_id from prim union select tile_id from rel) i
    cross join lateral (
      select x.dest_id, x.slug, x.core_type, x.name, x.photos, x.region_id
      from public.dest_cards x where x.dest_id = i.dest_id offset 0
    ) dc
    left join public.regions r on r.id = dc.region_id
    left join public.regions pr on pr.id = r.parent_id
  )
  select jsonb_build_object(
    'cards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dest_id', p.dest_id,
        'core_type', d.core_type,
        'slug', d.slug,
        'name', d.name,
        'photos', coalesce(jsonb_path_query_array(d.photos, '$[0 to 5]'), '[]'::jsonb),
        'region_name', d.region_name,
        'parent_region_name', d.parent_region_name,
        'sort_key', p.k::text,
        'tiles', coalesce((
          select jsonb_agg(jsonb_build_object(
            'dest_id', td.dest_id, 'slug', td.slug, 'name', td.name, 'photo', td.photos -> 0,
            'region_name', td.region_name, 'parent_region_name', td.parent_region_name
          ) order by rl.n)
          from rel rl join det td on td.dest_id = rl.tile_id
          where rl.anchor_id = p.dest_id
        ), '[]'::jsonb)
      ) order by p.rn)
      from prim p join det d on d.dest_id = p.dest_id
    ), '[]'::jsonb),
    'has_more', (select count(*) from page) > v_limit,
    'total', case when p_with_total then least(v_total, v_cap) end,
    'total_capped', coalesce(v_total > v_cap, false)
  ) into v_out;
  return v_out;
end;
$$;

grant execute on function public.feed_candidates(text[], text, text, text) to anon, authenticated;
grant execute on function public.feed_page(text[], text[], text, text, text, text, int, timestamptz, uuid, boolean, int) to anon, authenticated;
