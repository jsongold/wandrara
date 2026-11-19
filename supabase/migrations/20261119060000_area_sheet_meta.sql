-- MS2c（#110）：トップのカテゴリと、エリアの特性（宿・体験の分類から付くもの）を DB で集計する。
-- これまでは dest 全件をサーバーのメモリに読んで JS で数えていた（件数に比例）。ここでは結果の大きさがマスター（カテゴリ・地域・特性）で決まる。
-- 元は feed_entries（公開中の dest だけ。area_id = 'all' は dest につき 1 行）と dest_categories（category_id の index あり）。
-- どちらも jsonb / text[] の 1 値で返す（行で返すと Data API の max_rows で黙って切れる）。
-- 権限：security invoker（RLS はそのまま効く）。

-- その mode の公開中の dest が直接使っている、親なしのカテゴリ（旧 listCategories と同じ）。
-- カテゴリごとに「使っている dest が 1 件でもあるか」を index で引く（見つかった時点で止まる）
create or replace function public.used_root_categories(p_core_types text[])
returns text[]
language sql stable
as $$
  select coalesce(array_agg(c.id order by c.sort, c.id), '{}'::text[])
  from public.categories c
  where c.parent_id is null
    and exists (
      select 1
      from public.dest_categories dc
      join public.feed_entries fe on fe.dest_id = dc.dest_id and fe.area_id = 'all'
      where dc.category_id = c.id and fe.core_type = any (p_core_types)
    )
$$;

-- 宿・体験の分類から付く特性（traits.source = 'items'）：{ エリア id: [特性 id, ...] }
-- エリアは地区そのもの（親には付けない）。特性に付いた分類のどれかを持つ公開中の dest が、そのエリアに 1 件でもあれば付く（旧 areaTraitsOf の items と同じ）
create or replace function public.area_item_traits()
returns jsonb
language sql stable
as $$
  select coalesce(jsonb_object_agg(x.region_id, x.trait_ids), '{}'::jsonb)
  from (
    select p.region_id, jsonb_agg(p.trait_id order by p.trait_id) as trait_ids
    from (
      select distinct fe.region_id, t.id as trait_id
      from public.traits t
      join public.dest_categories dc on dc.category_id = any (t.category_ids)
      join public.feed_entries fe on fe.dest_id = dc.dest_id and fe.area_id = 'all'
      where t.source = 'items' and fe.region_id is not null
    ) p
    group by p.region_id
  ) x
$$;

grant execute on function public.used_root_categories(text[]) to anon, authenticated;
grant execute on function public.area_item_traits() to anon, authenticated;
