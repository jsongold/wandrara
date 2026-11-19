-- feed_page のカードに地区の id（region_id）と親の id（parent_region_id）を足す。
-- なぜ：カルーセルのエリアの一言（Area Stories）をカードの地区で決めるため（src/lib/carousel.ts）。名前だけでは地区を引けない。
-- 足すだけなので、読むコードより先に入れてよい（無い間はコードが Stories を出さないだけ）。引数・ほかの戻り値は 20261119040000 と同じ
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
    select dc.dest_id, dc.slug, dc.core_type, dc.name, dc.photos, dc.region_id, r.parent_id as parent_region_id, r.name as region_name, pr.name as parent_region_name
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
        'region_id', d.region_id,
        'parent_region_id', d.parent_region_id,
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
