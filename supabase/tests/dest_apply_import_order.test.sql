-- 重なった投入の順：先に開始したトランザクション A が、後に開始した B より後に書いたとき、
-- dest_imports の最新（imported_at が最大）の行が A（表に残った中身）になること。
-- B（A の開始後に始まり、先にコミットした投入）は、A の開始後の時刻を持つ行として直接入れて表す。
-- imported_at が now()（A の開始時刻）だと A の行が B より古くなり、この試験は落ちる
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

select public.dest_apply('{"destination":{"dest_id":"00000000-0000-4000-8000-0000000000a1","core_type":"accommodation","slug":"t-order-001","ref":"T-order-001","created_by":null},
  "import":{"ref":"T-order-001","collector_key_id":null,"payload":{},"content_hash":"h0"}}'::jsonb);

select pg_sleep(0.05);
insert into public.dest_imports (dest_id, ref, payload, content_hash, imported_at)
values ('00000000-0000-4000-8000-0000000000a1', 'T-order-001', '{}', 'hB', clock_timestamp());

select ok(
  (select imported_at from public.dest_imports where content_hash = 'hB') > now(),
  'B の行は A の開始より後の時刻'
);

-- A が最後に書く
select public.dest_apply('{"destination":{"dest_id":"00000000-0000-4000-8000-0000000000a1","core_type":"accommodation","slug":"t-order-001","ref":"T-order-001","created_by":null},
  "import":{"ref":"T-order-001","collector_key_id":null,"payload":{},"content_hash":"hA"}}'::jsonb);

select is(
  (select content_hash from public.dest_imports where dest_id = '00000000-0000-4000-8000-0000000000a1'
   order by imported_at desc limit 1),
  'hA',
  '最後に書いた投入（A）が最新の行になる'
);

select * from finish();
rollback;
