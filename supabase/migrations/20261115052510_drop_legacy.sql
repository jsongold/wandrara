-- 古い表と関数（v0 の spot のモデル）を消す。バケット spot-photos は残す（中身の写真は別に扱う）
drop function if exists public.import_apply(jsonb, boolean);
drop table if exists public.spot_prices;
drop table if exists public.spot_facts;
drop table if exists public.spot_photos;
drop table if exists public.spot_categories;
drop table if exists public.spots;
drop table if exists public.import_records;
drop table if exists public.categories;
drop table if exists public.areas;
