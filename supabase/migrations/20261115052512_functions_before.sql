-- ポリシー（data_model の public read）が使う関数。ポリシーより先に要るので表より前に作る（plpgsql は作る時に表を見ない）

-- dest が公開中（publications に status = 'published' の行がある）か
create or replace function public.is_published(p_dest_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.publications p where p.dest_id = p_dest_id and p.status = 'published'
  );
end;
$$;
