-- 座標が同じか（両方 NULL も同じ）。1e-7 度未満の差は同じとみなす
create or replace function public.backfill_same_coord(a double precision, b double precision)
returns boolean
language sql
immutable
set search_path = ''
as $$ select (a is null and b is null) or (a is not null and b is not null and abs(a - b) < 1e-7) $$;
revoke execute on function public.backfill_same_coord(double precision, double precision) from public, anon, authenticated;
grant execute on function public.backfill_same_coord(double precision, double precision) to service_role;

-- backfill_region_apply を置き換える：座標の照合を 1e-7 度（約 1cm）未満の差は同じとみなす。
-- Data API（PostgREST）は double を 15 桁に丸めて返すので、読んだ値をそのまま送ると 16 桁以上の座標が一致しない。
-- 以下は 20261116053627_backfill_region_apply_address と同じ
-- backfill_region_apply：既存の dest の region_id だけを付け直す（scripts/backfill-regions.ts が 1 件ずつ呼ぶ）。
-- 差分を出したときの代表の位置（lat・lng・geo_precision）と旧い region_id が、destinations の行ロックの後に見た今の値と同じときだけ書く。
-- 違えば（その間に取り込みで位置か region_id が変わった）書かずに skipped を返す。公開状態・dest_imports は触らない。
-- 代表の位置：体験は details.locations の meeting を先に、無ければ先頭（dest_cards と同じ）。ほかはコアの lat・lng・geo_precision
-- p: {dest_id, core_type, old_region_id, lat, lng, geo_precision, prefecture, municipality, new_region_id}
-- 戻り値: 'updated' | 'skipped' | 'missing'
create or replace function public.backfill_region_apply(p jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dest uuid := (p->>'dest_id')::uuid;
  v_type text;
  v_region text;
  v_lat double precision;
  v_lng double precision;
  v_prec text;
  v_pref text;
  v_muni text;
begin
  select d.core_type into v_type from public.destinations d where d.dest_id = v_dest for update;
  if not found then
    return 'missing';
  end if;
  if v_type is distinct from p->>'core_type' then
    return 'skipped';
  end if;

  if v_type = 'experience' then
    select e.region_id, j.lat, j.lng, j.prec into v_region, v_lat, v_lng, v_prec
    from public.experiences e
    left join lateral (
      select
        case when jsonb_typeof(x.loc->'lat') = 'number' then (x.loc->>'lat')::double precision end as lat,
        case when jsonb_typeof(x.loc->'lng') = 'number' then (x.loc->>'lng')::double precision end as lng,
        x.loc->>'geo_precision' as prec
      from jsonb_array_elements(
        case when jsonb_typeof(e.details->'locations') = 'array' then e.details->'locations' else '[]'::jsonb end
      ) with ordinality as x(loc, n)
      order by (x.loc->>'kind' = 'meeting') desc, x.n
      limit 1
    ) j on true
    where e.dest_id = v_dest;
  elsif v_type in ('accommodation', 'nature', 'village', 'building', 'hotspring') then
    execute format(
      'select region_id, lat, lng, geo_precision, nullif(btrim(prefecture), ''''), nullif(btrim(municipality), '''') from public.%I where dest_id = $1',
      case v_type when 'accommodation' then 'accommodations' when 'nature' then 'natures' when 'village' then 'villages'
                  when 'building' then 'buildings' else 'hotsprings' end
    ) into v_region, v_lat, v_lng, v_prec, v_pref, v_muni using v_dest;
  else
    return 'skipped';
  end if;

  if v_region is distinct from p->>'old_region_id'
     or not public.backfill_same_coord(v_lat, (p->>'lat')::double precision)
     or not public.backfill_same_coord(v_lng, (p->>'lng')::double precision)
     or v_prec is distinct from p->>'geo_precision'
     or v_pref is distinct from p->>'prefecture'
     or v_muni is distinct from p->>'municipality' then
    return 'skipped';
  end if;

  if v_type = 'experience' then
    update public.experiences set region_id = p->>'new_region_id' where dest_id = v_dest;
  else
    execute format(
      'update public.%I set region_id = $2 where dest_id = $1',
      case v_type when 'accommodation' then 'accommodations' when 'nature' then 'natures' when 'village' then 'villages'
                  when 'building' then 'buildings' else 'hotsprings' end
    ) using v_dest, p->>'new_region_id';
  end if;
  return 'updated';
end;
$$;

revoke execute on function public.backfill_region_apply(jsonb) from public, anon, authenticated;
grant execute on function public.backfill_region_apply(jsonb) to service_role;
