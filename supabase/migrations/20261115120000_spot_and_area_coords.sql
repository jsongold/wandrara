-- 場所と体験の関連を距離で結ぶための座標。
-- スポット：投入した location の lat / lng をそのまま列にする（生成列なので投入側の変更は要らない）。
-- エリア：代表地点。座標の無いスポット（デモなど）は、そのエリアの代表地点で距離を測る。

alter table public.spots
  add column lat double precision generated always as ((location->>'lat')::double precision) stored,
  add column lng double precision generated always as ((location->>'lng')::double precision) stored;

alter table public.areas
  add column lat double precision,
  add column lng double precision,
  add column geo_source text; -- 代表地点をどこから取ったか

-- 国土地理院 地名検索 API（https://msearch.gsi.go.jp/address-search/AddressSearch）で 2026-11-15 に引いた値
update public.areas a set lat = v.lat, lng = v.lng, geo_source = v.src
from (values
  ('hakone',      35.2324, 139.1069, 'GSI 地名検索「箱根町」'),
  ('ashinoko',    35.2104, 139.0025, 'GSI 地名検索「芦ノ湖」'),
  ('gora',        35.2486, 139.0391, 'GSI 地名検索「箱根町強羅」'),
  ('sengokuhara', 35.2606, 139.0045, 'GSI 地名検索「箱根町仙石原」'),
  ('owakudani',   35.2444, 139.0204, 'GSI 地名検索「大涌谷駅」'),
  ('yumoto',      35.2323, 139.1052, 'GSI 地名検索「箱根町湯本」'),
  ('izu',         34.9766, 138.9467, 'GSI 地名検索「伊豆市」'),
  ('ito',         34.9658, 139.1019, 'GSI 地名検索「伊東市」'),
  ('shuzenji',    34.9687, 138.8861, 'GSI 地名検索「伊豆市修善寺」'),
  ('nakaizu',     34.9318, 139.0066, 'GSI 地名検索「伊豆市中伊豆」（伊豆市中原戸）'),
  ('shimoda',     34.6987, 138.9387, 'GSI 地名検索「下田市」'),
  ('nishiizu',    34.7717, 138.7753, 'GSI 地名検索「西伊豆町」'),
  ('atami',       35.0964, 139.0717, 'GSI 地名検索「熱海市」')
) as v(id, lat, lng, src)
where a.id = v.id;
