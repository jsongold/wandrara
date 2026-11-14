-- コレクターの収集データ（schema/content-bundle.schema.json）を取り込むための列とテーブル。
-- 投入は scripts/import-bundle.ts が行う。

-- 同じ施設を入れ直したときに更新できるよう、元データの ID を持つ
alter table public.spots
  add column external_ref text unique,
  add column location jsonb,                 -- prefecture, municipality, district, address, lat, lng, geo_precision
  add column official_url text,
  add column booking_links jsonb not null default '[]',
  add column verification_status text not null default 'collected'
    check (verification_status in ('collected', 'verified')),
  add column updated_at timestamptz not null default now();

-- 事実の出典を全部残す（source_name / source_url / checked_at は表示用に先頭の 1 件）
alter table public.spot_facts
  add column sources jsonb not null default '[]';

alter table public.spot_photos
  add column source_page_url text,
  add column alt jsonb;

-- 料金は条件ごとに 1 行
create table public.spot_prices (
  id bigint generated always as identity primary key,
  spot_id text not null references public.spots (id) on delete cascade,
  sort int not null default 0,
  amount numeric not null check (amount >= 0),
  amount_max numeric check (amount_max >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  unit text not null,
  guests int,
  applies_to jsonb,
  taxes_included boolean not null,
  fees_included boolean,
  fees_note jsonb,
  sources jsonb not null check (jsonb_array_length(sources) > 0)
);
create index spot_prices_spot_idx on public.spot_prices (spot_id);
alter table public.spot_prices enable row level security;
create policy "public read" on public.spot_prices for select to anon, authenticated using (true);
grant select on public.spot_prices to anon, authenticated;

-- 収集データの原本。候補（名前だけ）・レビューの観察・権利のない写真・メモもここに残る。
-- 非公開：ポリシーも grant も付けない。
create table public.import_records (
  external_ref text primary key,
  spot_id text,                              -- 公開した spots.id。候補なら null
  verification_status text not null,
  record jsonb not null,
  collector text not null,
  collected_at timestamptz not null,
  imported_at timestamptz not null default now()
);
alter table public.import_records enable row level security;
