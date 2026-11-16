-- dest_cards の体験の座標：details.locations の meeting を先に、details が NULL のときだけ experience_locations
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into public.destinations (dest_id, core_type, slug, ref) values
  ('00000000-0000-4000-8000-0000000000c1', 'experience', 't-exp-c1', 'T-exp-c1'),
  ('00000000-0000-4000-8000-0000000000c2', 'experience', 't-exp-c2', 'T-exp-c2');
insert into public.experiences (dest_id, details) values
  ('00000000-0000-4000-8000-0000000000c1',
   '{"locations":[{"kind":"activity","lat":35.0,"lng":139.0},{"kind":"meeting","lat":35.2,"lng":139.1}]}'),
  ('00000000-0000-4000-8000-0000000000c2', null);
insert into public.experience_locations (dest_id, lat, lng, sort) values ('00000000-0000-4000-8000-0000000000c2', 35.3, 139.2, 0);
insert into public.publications (dest_id, status, published_at) values
  ('00000000-0000-4000-8000-0000000000c1', 'published', now()),
  ('00000000-0000-4000-8000-0000000000c2', 'published', now())
on conflict (dest_id) do update set status = 'published', published_at = now();

select is((select lat from public.dest_cards where dest_id = '00000000-0000-4000-8000-0000000000c1'), 35.2::float8, 'details があれば meeting の座標');
select is((select lat from public.dest_cards where dest_id = '00000000-0000-4000-8000-0000000000c2'), 35.3::float8, 'details が NULL なら旧い表');
update public.experiences set details = '{}' where dest_id = '00000000-0000-4000-8000-0000000000c2';
select is((select lat from public.dest_cards where dest_id = '00000000-0000-4000-8000-0000000000c2'), null, 'details があって locations が無ければ旧い表は見ない');

select * from finish();
rollback;
