-- 権利が明示された写真を置く公開バケット。アップロードは scripts/import-bundle.ts が行う。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spot-photos', 'spot-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

-- バケットに置く前の元の画像 URL（出典の確認用）
alter table public.spot_photos
  add column original_url text;
