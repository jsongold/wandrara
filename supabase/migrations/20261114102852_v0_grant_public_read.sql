-- 新しいテーブルには anon / authenticated の権限が自動で付かないため、読み取りだけ明示する。
-- 行の可否は RLS のポリシー（public read）が決める。
grant usage on schema public to anon, authenticated;
grant select on public.areas, public.categories, public.spots, public.spot_categories, public.spot_photos, public.spot_facts to anon, authenticated;
