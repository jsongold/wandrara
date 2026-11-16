-- backfill_region_apply：差分を出したときと同じ位置・region_id のときだけ region_id を書く。公開状態は変えない
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into public.destinations (dest_id, core_type, slug, ref) values
  ('00000000-0000-4000-8000-0000000000b1', 'accommodation', 't-bf-b1', 'T-bf-b1'),
  ('00000000-0000-4000-8000-0000000000b2', 'experience', 't-bf-b2', 'T-bf-b2');
insert into public.destinations (dest_id, core_type, slug, ref) values
  ('00000000-0000-4000-8000-0000000000b3', 'accommodation', 't-bf-b3', 'T-bf-b3');
insert into public.accommodations (dest_id, region_id, lat, lng, geo_precision, prefecture, municipality) values
  ('00000000-0000-4000-8000-0000000000b1', 'izu', 34.9753, 139.0925, 'exact', null, null),
  ('00000000-0000-4000-8000-0000000000b3', null, null, null, 'municipality', ' 静岡県 ', '伊豆市');
insert into public.experiences (dest_id, region_id, details) values
  ('00000000-0000-4000-8000-0000000000b2', 'hakone',
   '{"locations":[{"kind":"activity","lat":35.0,"lng":139.0,"geo_precision":"exact"},{"kind":"meeting","lat":35.2496,"lng":139.0475,"geo_precision":"exact"}]}');
insert into public.publications (dest_id, status, published_at) values
  ('00000000-0000-4000-8000-0000000000b1', 'published', now())
on conflict (dest_id) do update set status = 'published', published_at = now();

select is(public.backfill_region_apply('{"dest_id":"00000000-0000-4000-8000-0000000000b1","core_type":"accommodation","old_region_id":"izu","lat":34.9753,"lng":139.0925,"geo_precision":"exact","new_region_id":"ito"}'),
  'updated', '同じ位置・旧い値なら書く');
select is((select region_id from public.accommodations where dest_id = '00000000-0000-4000-8000-0000000000b1'), 'ito', 'region_id が変わる');
select is((select status from public.publications where dest_id = '00000000-0000-4000-8000-0000000000b1'), 'published', '公開状態は変えない');

update public.accommodations set lat = 34.98 where dest_id = '00000000-0000-4000-8000-0000000000b1';
select is(public.backfill_region_apply('{"dest_id":"00000000-0000-4000-8000-0000000000b1","core_type":"accommodation","old_region_id":"ito","lat":34.9753,"lng":139.0925,"geo_precision":"exact","new_region_id":"izu"}'),
  'skipped', '座標だけ変わっていたら書かない');

select is(public.backfill_region_apply('{"dest_id":"00000000-0000-4000-8000-0000000000b2","core_type":"experience","old_region_id":"hakone","lat":35.2496,"lng":139.0475,"geo_precision":"exact","new_region_id":"gora"}'),
  'updated', '体験は meeting の場所で照合する');
select is(public.backfill_region_apply('{"dest_id":"00000000-0000-4000-8000-0000000000b2","core_type":"experience","old_region_id":"hakone","lat":35.2496,"lng":139.0475,"geo_precision":"exact","new_region_id":"gora"}'),
  'skipped', '旧い値が変わっていたら書かない（2 回目）');

-- 座標の無い行は住所で照合する（前後の空白は除く）。住所だけ変わっていたら書かない
update public.accommodations set municipality = '箱根町' where dest_id = '00000000-0000-4000-8000-0000000000b3';
select is(public.backfill_region_apply('{"dest_id":"00000000-0000-4000-8000-0000000000b3","core_type":"accommodation","old_region_id":null,"lat":null,"lng":null,"geo_precision":"municipality","prefecture":"静岡県","municipality":"伊豆市","new_region_id":"izu"}'),
  'skipped', '住所だけ変わっていたら書かない');
select is(public.backfill_region_apply('{"dest_id":"00000000-0000-4000-8000-0000000000b3","core_type":"accommodation","old_region_id":null,"lat":null,"lng":null,"geo_precision":"municipality","prefecture":"静岡県","municipality":"箱根町","new_region_id":"hakone"}'),
  'updated', '住所が同じなら書く');

select * from finish();
rollback;
