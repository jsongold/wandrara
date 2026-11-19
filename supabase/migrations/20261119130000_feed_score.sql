-- #156：フィードを点数（重み付きアクション）で並べる。
-- 点数は batch（pnpm feed:score → src/lib/feed-score-batch.ts）が計算して feed_scores に書き、feed_entries.score に写す。
-- feed_entries の行は公開・投入のたびに trigger が作り直すので、点数の正は feed_scores に置き、作り直すときに写す。
-- まだ点数の無い dest（batch の後に公開されたもの）は、種類の平均（feed_score_priors）で並べる。

create table if not exists public.feed_scores (
  dest_id uuid primary key,          -- feed_entries と同じく destinations への外部キーは張らない（feed_page.sql の理由）
  score double precision not null,
  algorithm text not null,           -- 計算した重みの版（例 order=score@1）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.feed_score_priors (
  core_type text primary key,
  score double precision not null,
  algorithm text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.feed_scores enable row level security;
alter table public.feed_score_priors enable row level security;
revoke all on public.feed_scores, public.feed_score_priors from anon, authenticated;
grant all on public.feed_scores, public.feed_score_priors to service_role;

alter table public.feed_entries add column if not exists score double precision not null default 0;
create index if not exists feed_entries_score_idx on public.feed_entries (area_id, score desc, dest_id);

-- 写しを作り直すときに点数も写す（feed_page.sql の版に、点数と下の共有 lock を足した）。
-- 点数の書き込み（feed_scores_apply）と同時に走ると、古い点数で作り直した行が残る。作り直しは共有、書き込みは排他で同じ lock を取り、
-- 書き込みは進行中の作り直しが終わるのを待ち、作り直しは書き込みの後の点数を読む（作り直しどうしは待たない）
create or replace function public.feed_entry_refresh(p_dest uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock_shared(hashtextextended('feed_scores_apply', 0));
  perform pg_advisory_xact_lock(hashtextextended(p_dest::text, 0));
  delete from public.feed_entries where dest_id = p_dest;
  insert into public.feed_entries (dest_id, area_id, core_type, dest_created_at, published_at, pub_key, region_id, parent_region_id, top_region_id, score)
  select i.dest_id, a.area_id, i.core_type, i.dest_created_at, i.published_at, i.pub_key, i.region_id, i.parent_region_id, i.top_region_id,
         coalesce(fs.score, fp.score, 0)
  from public.feed_index i
  left join public.feed_scores fs on fs.dest_id = i.dest_id
  left join public.feed_score_priors fp on fp.core_type = i.core_type
  cross join lateral (values ('all'), (i.region_id), (i.parent_region_id), ('r:' || i.region_id)) a(area_id)
  where i.dest_id = p_dest and a.area_id is not null;
end;
$$;
revoke execute on function public.feed_entry_refresh(uuid) from public, anon, authenticated;

-- batch が読むもの：点数を付ける dest（公開中の全部と種類）と、dest × アクション × 位置（50 位以降はまとめる）の回数。
-- 同じ session の同じ組は 1 回と数える（何度も見た・連打・ページの再訪で水増ししない）。保存は人（user_id）ごとに 1 回、位置なし。
-- 戻り値は jsonb 1 つ（Data API の max_rows に掛からない）：{ targets: [{dest_id, core_type}], counts: [{dest_id, action, position, n}] }
create or replace function public.feed_score_inputs(p_since timestamptz)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with live as (select dest_id, core_type from public.feed_entries where area_id = 'all'),
  ev as (
    select e.dest_id, e.name as action, least(e.position, 50) as position, count(distinct e.session_id) as n
    from public.feed_events e join live l on l.dest_id = e.dest_id
    where e.created_at >= p_since
    group by 1, 2, 3
  ),
  sv as (
    select s.dest_id, 'save'::text as action, null::int as position, count(*) as n
    from public.user_saves s join live l on l.dest_id = s.dest_id
    where s.created_at >= p_since
    group by 1
  )
  select jsonb_build_object(
    'targets', coalesce((select jsonb_agg(jsonb_build_object('dest_id', l.dest_id, 'core_type', l.core_type)) from live l), '[]'::jsonb),
    'counts', coalesce((select jsonb_agg(jsonb_build_object('dest_id', x.dest_id, 'action', x.action, 'position', x.position, 'n', x.n))
                        from (select * from ev union all select * from sv) x), '[]'::jsonb))
$$;
revoke execute on function public.feed_score_inputs(timestamptz) from public, anon, authenticated;
grant execute on function public.feed_score_inputs(timestamptz) to service_role;

-- batch の書き込み：点数と種類の平均を置き換え、feed_entries に写す。何度呼んでも同じ結果。
-- p_scores：[{dest_id, score}]、p_priors：[{core_type, score}]
create or replace function public.feed_scores_apply(p_scores jsonb, p_priors jsonb, p_algorithm text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare v_n int;
begin
  -- 同時に 2 つ走らせない。進行中の作り直し（feed_entry_refresh は同じ lock を共有で取る）が終わるのも待つ。
  -- 以降の文は lock を取った後の snapshot で読む（read committed）ので、作り直した行も見える
  perform pg_advisory_xact_lock(hashtextextended('feed_scores_apply', 0));

  delete from public.feed_score_priors where true;  -- Data API 経由は WHERE の無い DELETE を拒む（safeupdate）
  insert into public.feed_score_priors (core_type, score, algorithm)
  select x.core_type, x.score, p_algorithm from jsonb_to_recordset(p_priors) as x(core_type text, score double precision);

  delete from public.feed_scores where true;
  insert into public.feed_scores (dest_id, score, algorithm)
  select x.dest_id, x.score, p_algorithm from jsonb_to_recordset(p_scores) as x(dest_id uuid, score double precision);
  get diagnostics v_n = row_count;

  -- 点数の無い dest（この batch の後に公開されたものなど）は種類の平均
  update public.feed_entries fe
  set score = coalesce(fs.score, fp.score, 0), updated_at = now()
  from public.feed_entries x
  left join public.feed_scores fs on fs.dest_id = x.dest_id
  left join public.feed_score_priors fp on fp.core_type = x.core_type
  where fe.dest_id = x.dest_id and fe.area_id = x.area_id
    and fe.score is distinct from coalesce(fs.score, fp.score, 0);
  return v_n;
end;
$$;
revoke execute on function public.feed_scores_apply(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.feed_scores_apply(jsonb, jsonb, text) to service_role;

-- feed_page に点数の並び（p_sort = 'score'）を足す。続きの位置は (score, dest_id) の keyset で、p_after_score に直前の最後のカードの点数を渡す。
-- 並びの式は「使わない側が NULL の定数」になる形で書く（plan_cache_mode = force_custom_plan で p_sort が定数になり、索引の順で読める）。
-- それ以外は feed_page.sql の版と同じ
drop function if exists public.feed_page(text[], text[], text, text, text, text, int, timestamptz, uuid, boolean, int);
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
  p_tiles int default 6,
  p_after_score double precision default null
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
      case when p_sort = 'score' then null when p_sort = 'fresh' then c.dest_created_at else c.pub_key end as k,
      case when p_sort = 'score' then c.score end as s
    from public.feed_candidates(p_core_types, p_area, p_cat, p_q) c
    where case
      when p_sort = 'score' then
        p_after_score is null or p_after_id is null
        or c.score <= p_after_score and (c.score < p_after_score or c.dest_id > p_after_id)
      else
        p_after_key is null
        or (case when p_sort = 'fresh' then c.dest_created_at else c.pub_key end) <= p_after_key
           and ((case when p_sort = 'fresh' then c.dest_created_at else c.pub_key end) < p_after_key or c.dest_id > p_after_id)
    end
    order by case when p_sort = 'score' then c.score end desc,
             case when p_sort = 'score' then null when p_sort = 'fresh' then c.dest_created_at else c.pub_key end desc,
             c.dest_id
    limit v_limit + 1
  ),
  page as (select t.*, row_number() over (order by t.s desc, t.k desc, t.dest_id) as rn from top t),
  prim as (select * from page where rn <= v_limit),
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
        'sort_key', case when p_sort = 'score' then p.s::text else p.k::text end,
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
grant execute on function public.feed_page(text[], text[], text, text, text, text, int, timestamptz, uuid, boolean, int, double precision) to anon, authenticated;
