-- ローカルの開発と e2e 用のデモ（本番には入らない）。すべて is_demo = true・公開済み。事実・料金・位置は入れない（NULL＝不明）
-- 辞書（regions・categories）は migration の dictionary が入れる
begin;

insert into public.destinations (dest_id, core_type, slug, is_demo) values
  ('00000000-0000-4000-8000-000000000001', 'accommodation', 'lakeside-stay', true),
  ('00000000-0000-4000-8000-000000000002', 'experience', 'owakudani-hike', true),
  ('00000000-0000-4000-8000-000000000003', 'nature', 'jogasaki-coast', true),
  ('00000000-0000-4000-8000-000000000004', 'building', 'shuzenji-temple', true);

insert into public.accommodations (dest_id, kind, region_id) values
  ('00000000-0000-4000-8000-000000000001', 'private_rental', 'ashinoko');
insert into public.accommodation_texts (dest_id, lang, name, summary) values
  ('00000000-0000-4000-8000-000000000001', 'ja', '芦ノ湖畔の一棟貸し宿', '（デモ）芦ノ湖のほとりにある一棟貸しの宿の例です。');

insert into public.experiences (dest_id, kind, region_id) values
  ('00000000-0000-4000-8000-000000000002', 'activity', 'owakudani');
insert into public.experience_texts (dest_id, lang, name, summary) values
  ('00000000-0000-4000-8000-000000000002', 'ja', '大涌谷周辺のハイキング', '（デモ）大涌谷周辺を歩くハイキングの例です。');

insert into public.natures (dest_id, kind, region_id) values
  ('00000000-0000-4000-8000-000000000003', 'coast', 'ito');
insert into public.nature_texts (dest_id, lang, name, summary) values
  ('00000000-0000-4000-8000-000000000003', 'ja', '城ヶ崎海岸', '（デモ）溶岩の断崖が続く海岸の例です。');

insert into public.buildings (dest_id, kind, region_id) values
  ('00000000-0000-4000-8000-000000000004', 'temple', 'shuzenji');
insert into public.building_texts (dest_id, lang, name, summary) values
  ('00000000-0000-4000-8000-000000000004', 'ja', '温泉街の寺', '（デモ）温泉街にある寺の例です。');

insert into public.dest_categories (dest_id, category_id) values
  ('00000000-0000-4000-8000-000000000001', 'lake'),
  ('00000000-0000-4000-8000-000000000002', 'hike'),
  ('00000000-0000-4000-8000-000000000003', 'coast'),
  ('00000000-0000-4000-8000-000000000004', 'onsentown');

insert into public.publications (dest_id, status, published_at)
select dest_id, 'published', now() from public.destinations where is_demo;

commit;
