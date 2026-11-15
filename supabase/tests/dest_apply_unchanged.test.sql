-- dest_apply が行ロックの中で、前回と同じ content_hash の投入を飛ばすこと（公開状態を変えない・dest_imports を足さない）
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

create temp table r (n int, v jsonb);
create function pg_temp.apply(h text) returns jsonb language sql as $$
  select public.dest_apply(jsonb_build_object(
    'destination', jsonb_build_object('dest_id', '00000000-0000-4000-8000-0000000000b1', 'core_type', 'accommodation',
      'slug', 't-same-001', 'ref', 'T-same-001', 'created_by', null),
    'import', jsonb_build_object('ref', 'T-same-001', 'collector_key_id', null, 'payload', '{}'::jsonb, 'content_hash', h)))
$$;

insert into r values (1, pg_temp.apply('h1'));
select is((select v->>'unchanged' from r where n = 1), 'false', '新しい dest は書く');

update public.publications set status = 'published', published_at = now() where dest_id = '00000000-0000-4000-8000-0000000000b1';

insert into r values (2, pg_temp.apply('h1'));
select is((select v->>'unchanged' from r where n = 2), 'true', '同じ中身は unchanged');
select is((select v->>'status' from r where n = 2), 'published', 'unchanged は今の公開状態を返す');
select is((select status from public.publications where dest_id = '00000000-0000-4000-8000-0000000000b1'), 'published', '公開のまま');
select is((select count(*)::int from public.dest_imports where dest_id = '00000000-0000-4000-8000-0000000000b1'), 1, 'dest_imports は増えない');

insert into r values (3, pg_temp.apply('h2'));
select is((select status from public.publications where dest_id = '00000000-0000-4000-8000-0000000000b1'), 'draft', '中身が変われば draft');

insert into r values (4, pg_temp.apply(null));
select is((select v->>'unchanged' from r where n = 4), 'false', 'content_hash が無い（古い呼び方）なら書く');

select * from finish();
rollback;
