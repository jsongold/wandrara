-- region_parts の権限。このプロジェクトでは新しい表に権限が自動で付かないので明示する（行の可否は RLS の anyone read）
grant select on public.region_parts to anon, authenticated;
grant all on public.region_parts to service_role;
