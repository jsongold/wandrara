-- 熱海・東伊豆を正式なエリアにする（以前の取り込みで材料なしに作られていた行）。どちらも伊豆の子
-- 本番には ja の名前だけの行がある：親・並び順を直し、無い言語の名前を足す（あれば今の名前を残す）
insert into public.regions (id, parent_id, name, sort) values
  ('atami', 'izu', '{"ja":"熱海","en":"Atami"}', 26),
  ('higashi-izu', 'izu', '{"ja":"東伊豆・稲取・河津","en":"Higashi-Izu & Kawazu"}', 27)
on conflict (id) do update set parent_id = excluded.parent_id, sort = excluded.sort, name = excluded.name || public.regions.name;

-- 材料：熱海市（22205）は伊豆の残りから熱海へ、東伊豆町（22301）・河津町（22302）は東伊豆へ
update public.region_parts set region_id = 'atami', updated_at = now()
  where source = 'n03' and source_version = 'N03-2024' and code = '22205';
update public.region_parts set region_id = 'higashi-izu', updated_at = now()
  where source = 'n03' and source_version = 'N03-2024' and code in ('22301', '22302');
