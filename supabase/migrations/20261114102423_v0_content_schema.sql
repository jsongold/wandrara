-- v0: 探索と詳細に必要なコンテンツのテーブル。誰でも読めて、書き込みはサービスキーのみ。

create table public.areas (
  id text primary key,
  parent_id text references public.areas (id),
  name jsonb not null,            -- {"ja": "...", "en": "..."}
  sort int not null default 0
);

create table public.categories (
  id text primary key,
  mode text not null check (mode in ('place', 'experience')),
  parent_id text references public.categories (id),
  name jsonb not null,
  icon text not null,
  sort int not null default 0
);

create table public.spots (
  id text primary key,            -- URL に使う slug
  kind text not null check (kind in ('stay', 'place', 'experience')),
  area_id text not null references public.areas (id),
  name jsonb not null,
  summary jsonb,
  editorial_rank int not null default 1000,  -- 人気データが無い間の編集部の並び順
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.spot_categories (
  spot_id text not null references public.spots (id) on delete cascade,
  category_id text not null references public.categories (id),
  primary key (spot_id, category_id)
);

create table public.spot_photos (
  id bigint generated always as identity primary key,
  spot_id text not null references public.spots (id) on delete cascade,
  sort int not null default 0,
  url text,
  license text,
  credit text,
  is_demo boolean not null default true,
  placeholder_sky text,           -- 写真が無いデモ用の色面
  placeholder_land text,
  -- 権利の明示が無い写真は公開しない。デモ表示ならよい
  constraint photo_rights check (is_demo or (url is not null and license is not null))
);

create table public.spot_facts (
  id bigint generated always as identity primary key,
  spot_id text not null references public.spots (id) on delete cascade,
  key text not null,
  label jsonb not null,
  value jsonb,                    -- 不明なら null
  status text not null check (status in ('verified', 'unverified', 'unknown')),
  source_name text,
  source_url text,
  checked_at date,
  detail jsonb,
  sort int not null default 0,
  -- 確認済み・未検証の事実には出典と確認日が要る
  constraint fact_provenance check (status = 'unknown' or (source_name is not null and checked_at is not null)),
  unique (spot_id, key)
);

create index spots_area_idx on public.spots (area_id);
create index spot_categories_category_idx on public.spot_categories (category_id);

alter table public.areas enable row level security;
alter table public.categories enable row level security;
alter table public.spots enable row level security;
alter table public.spot_categories enable row level security;
alter table public.spot_photos enable row level security;
alter table public.spot_facts enable row level security;

create policy "public read" on public.areas for select to anon, authenticated using (true);
create policy "public read" on public.categories for select to anon, authenticated using (true);
create policy "public read" on public.spots for select to anon, authenticated using (true);
create policy "public read" on public.spot_categories for select to anon, authenticated using (true);
create policy "public read" on public.spot_photos for select to anon, authenticated using (true);
create policy "public read" on public.spot_facts for select to anon, authenticated using (true);
