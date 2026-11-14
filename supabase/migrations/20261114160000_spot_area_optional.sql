-- エリアを取り込みの制限にしない。エリアが分からないスポットも入れられるようにする。
alter table public.spots alter column area_id drop not null;
