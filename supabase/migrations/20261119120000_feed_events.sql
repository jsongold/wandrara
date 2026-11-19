-- #156：フィードの表示とクリックの生の記録。点数（重み付きアクション）の batch がここから数える。
-- 書くのは /api/feed/events（サーバーのキー）だけ。anon・authenticated には読み書きを許さない（RLS を有効にして policy を置かない）。
-- 自由入力の検索語（q）は残さない。session_id はページを開くたびにブラウザが作る乱数で、人には結び付けない。
create table if not exists public.feed_events (
  id bigint generated always as identity primary key,
  name text not null check (name in ('card_view', 'card_click', 'tile_click')),
  dest_id uuid not null,            -- card_*：カードの dest。tile_click：押されたタイルの dest
  position int not null check (position between 0 and 9999),  -- 0 始まりの並び位置（tile_click はタイルの位置）
  from_dest_id uuid,                -- tile_click だけ：タイルが載っていたカードの dest
  session_id uuid not null,
  algorithm text not null,
  mode text not null,
  sort text not null,
  area text not null,
  cat text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.feed_events enable row level security;
revoke all on public.feed_events from anon, authenticated;
grant all on public.feed_events to service_role;

-- batch は「直近 N 日」を読む
create index if not exists feed_events_created_idx on public.feed_events (created_at);
