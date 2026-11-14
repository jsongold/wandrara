-- v0 デモデータ。すべてデモ表示（is_demo = true）。事実・料金・評価は捏造しない。
begin;

insert into public.areas (id, parent_id, name, sort) values
  ('hakone', null, '{"ja":"箱根","en":"Hakone"}', 10),
  ('izu', null, '{"ja":"伊豆","en":"Izu"}', 20),
  ('yumoto', 'hakone', '{"ja":"湯本","en":"Yumoto"}', 11),
  ('ashinoko', 'hakone', '{"ja":"芦ノ湖","en":"Lake Ashi"}', 12),
  ('gora', 'hakone', '{"ja":"強羅","en":"Gora"}', 13),
  ('sengokuhara', 'hakone', '{"ja":"仙石原","en":"Sengokuhara"}', 14),
  ('owakudani', 'hakone', '{"ja":"大涌谷","en":"Owakudani"}', 15),
  ('ito', 'izu', '{"ja":"伊東","en":"Ito"}', 21),
  ('shuzenji', 'izu', '{"ja":"修善寺","en":"Shuzenji"}', 22),
  ('nakaizu', 'izu', '{"ja":"中伊豆","en":"Naka-Izu"}', 23),
  ('shimoda', 'izu', '{"ja":"下田","en":"Shimoda"}', 24),
  ('nishiizu', 'izu', '{"ja":"西伊豆","en":"Nishi-Izu"}', 25);

insert into public.categories (id, mode, parent_id, name, icon, sort) values
  ('stay', 'place', null, '{"ja":"宿","en":"Stays"}', 'bed', 10),
  ('onsentown', 'place', null, '{"ja":"温泉街","en":"Onsen towns"}', 'steam', 20),
  ('coast', 'place', null, '{"ja":"海辺","en":"Coast"}', 'sun', 30),
  ('plateau', 'place', null, '{"ja":"高原","en":"Highlands"}', 'tree', 40),
  ('lake', 'place', null, '{"ja":"湖畔","en":"Lakeside"}', 'wave', 50),
  ('onsen', 'experience', null, '{"ja":"温泉","en":"Onsen"}', 'steam', 10),
  ('hike', 'experience', null, '{"ja":"ハイキング","en":"Hiking"}', 'hike', 20),
  ('gourmet', 'experience', null, '{"ja":"グルメ","en":"Food"}', 'fork', 30),
  ('wine', 'experience', null, '{"ja":"ワイン","en":"Wine"}', 'wine', 40),
  ('beach', 'experience', null, '{"ja":"ビーチ","en":"Beach"}', 'umbrella', 50),
  ('bbq', 'experience', null, '{"ja":"BBQ","en":"BBQ"}', 'flame', 60),
  ('camp', 'experience', null, '{"ja":"キャンプ","en":"Camping"}', 'tent', 70);

insert into public.spots (id, kind, area_id, name, summary, editorial_rank, is_demo) values
  ('lakeside-stay', 'stay', 'ashinoko', '{"ja":"芦ノ湖畔の一棟貸し宿","en":"Lakeside private villa at Lake Ashi"}', '{"ja":"（デモ）芦ノ湖のほとりにある一棟貸しの宿の例です。","en":"(Demo) An example of a private villa by Lake Ashi."}', 10, true),
  ('shuzenji-onsen-town', 'place', 'shuzenji', '{"ja":"修善寺温泉街","en":"Shuzenji onsen town"}', '{"ja":"（デモ）川沿いに旅館や外湯が並ぶ温泉街の例です。","en":"(Demo) An example of an onsen town along a river."}', 20, true),
  ('jogasaki-coast', 'place', 'ito', '{"ja":"城ヶ崎海岸","en":"Jogasaki Coast"}', '{"ja":"（デモ）溶岩の断崖が続く海岸の例です。","en":"(Demo) An example of a coastline of lava cliffs."}', 30, true),
  ('sengokuhara-plateau', 'place', 'sengokuhara', '{"ja":"仙石原高原","en":"Sengokuhara Highlands"}', '{"ja":"（デモ）草原が広がる高原の例です。","en":"(Demo) An example of open grassland highlands."}', 40, true),
  ('gora-onsen-inn', 'stay', 'gora', '{"ja":"強羅の温泉宿","en":"Onsen inn in Gora"}', '{"ja":"（デモ）強羅にある温泉宿の例です。","en":"(Demo) An example of an onsen inn in Gora."}', 50, true),
  ('shimoda-seaside-inn', 'stay', 'shimoda', '{"ja":"下田の海辺の宿","en":"Seaside inn in Shimoda"}', '{"ja":"（デモ）下田の海に近い宿の例です。","en":"(Demo) An example of an inn near the sea in Shimoda."}', 60, true),
  ('owakudani-hike', 'experience', 'owakudani', '{"ja":"大涌谷周辺のハイキング","en":"Hiking around Owakudani"}', '{"ja":"（デモ）大涌谷周辺を歩くハイキングの例です。","en":"(Demo) An example of a hike around Owakudani."}', 70, true),
  ('yumoto-day-onsen', 'experience', 'yumoto', '{"ja":"湯本の日帰り湯","en":"Day-trip onsen in Yumoto"}', '{"ja":"（デモ）湯本で立ち寄れる日帰り温泉の例です。","en":"(Demo) An example of a day-trip onsen in Yumoto."}', 80, true),
  ('gora-private-bath', 'experience', 'gora', '{"ja":"貸切露天風呂","en":"Private open-air bath"}', '{"ja":"（デモ）貸切で使える露天風呂の例です。","en":"(Demo) An example of a private open-air bath."}', 90, true),
  ('shimoda-seafood', 'experience', 'shimoda', '{"ja":"港町の地魚ランチ","en":"Local fish lunch in a port town"}', '{"ja":"（デモ）港町で地魚を味わうランチの例です。","en":"(Demo) An example of a local fish lunch in a port town."}', 100, true),
  ('nishiizu-breakfast', 'experience', 'nishiizu', '{"ja":"漁港の朝ごはん","en":"Fishing port breakfast"}', '{"ja":"（デモ）漁港で食べる朝ごはんの例です。","en":"(Demo) An example of breakfast at a fishing port."}', 110, true),
  ('sengokuhara-cafe', 'experience', 'sengokuhara', '{"ja":"高原のカフェ","en":"Highland café"}', '{"ja":"（デモ）高原にあるカフェの例です。","en":"(Demo) An example of a café in the highlands."}', 120, true),
  ('nakaizu-winery', 'experience', 'nakaizu', '{"ja":"ワイナリー見学","en":"Winery visit"}', '{"ja":"（デモ）ワイナリーを見学する体験の例です。","en":"(Demo) An example of a winery visit."}', 130, true),
  ('shirahama-beach', 'experience', 'shimoda', '{"ja":"白浜で海水浴","en":"Swimming at Shirahama"}', '{"ja":"（デモ）白浜の海で泳ぐ体験の例です。","en":"(Demo) An example of swimming at Shirahama beach."}', 140, true),
  ('nakaizu-bbq', 'experience', 'nakaizu', '{"ja":"森のBBQ場","en":"Forest BBQ site"}', '{"ja":"（デモ）森の中のBBQ場の例です。","en":"(Demo) An example of a BBQ site in the forest."}', 150, true),
  ('ashinoko-camp', 'experience', 'ashinoko', '{"ja":"湖畔のキャンプ場","en":"Lakeside campground"}', '{"ja":"（デモ）湖畔のキャンプ場の例です。","en":"(Demo) An example of a lakeside campground."}', 160, true),
  ('nishiizu-camp', 'experience', 'nishiizu', '{"ja":"海辺のキャンプ場","en":"Seaside campground"}', '{"ja":"（デモ）海辺のキャンプ場の例です。","en":"(Demo) An example of a seaside campground."}', 170, true),
  ('ashinoko-walk', 'experience', 'ashinoko', '{"ja":"湖畔の早朝さんぽ","en":"Early-morning lakeside walk"}', '{"ja":"（デモ）湖畔を朝に歩く体験の例です。","en":"(Demo) An example of an early-morning walk by the lake."}', 180, true),
  ('shuzenji-bamboo', 'experience', 'shuzenji', '{"ja":"竹林の小径を歩く","en":"Bamboo grove path walk"}', '{"ja":"（デモ）竹林の小径を歩く体験の例です。","en":"(Demo) An example of a walk along a bamboo grove path."}', 190, true),
  ('ito-rock-pools', 'experience', 'ito', '{"ja":"磯遊び","en":"Rock pool exploring"}', '{"ja":"（デモ）磯の潮だまりで遊ぶ体験の例です。","en":"(Demo) An example of exploring rock pools."}', 200, true);

insert into public.spot_categories (spot_id, category_id) values
  ('lakeside-stay', 'stay'), ('lakeside-stay', 'lake'),
  ('shuzenji-onsen-town', 'onsentown'), ('shuzenji-onsen-town', 'onsen'),
  ('jogasaki-coast', 'coast'), ('jogasaki-coast', 'hike'),
  ('sengokuhara-plateau', 'plateau'), ('sengokuhara-plateau', 'hike'),
  ('gora-onsen-inn', 'stay'), ('gora-onsen-inn', 'onsentown'), ('gora-onsen-inn', 'onsen'),
  ('shimoda-seaside-inn', 'stay'), ('shimoda-seaside-inn', 'coast'), ('shimoda-seaside-inn', 'beach'),
  ('owakudani-hike', 'hike'),
  ('yumoto-day-onsen', 'onsen'),
  ('gora-private-bath', 'onsen'),
  ('shimoda-seafood', 'gourmet'),
  ('nishiizu-breakfast', 'gourmet'),
  ('sengokuhara-cafe', 'gourmet'),
  ('nakaizu-winery', 'wine'),
  ('shirahama-beach', 'beach'),
  ('nakaizu-bbq', 'bbq'),
  ('ashinoko-camp', 'camp'), ('ashinoko-camp', 'bbq'),
  ('nishiizu-camp', 'camp'),
  ('ashinoko-walk', 'hike'),
  ('shuzenji-bamboo', 'hike'),
  ('ito-rock-pools', 'beach');

insert into public.spot_photos (spot_id, sort, url, license, credit, is_demo, placeholder_sky, placeholder_land) values
  ('lakeside-stay', 0, null, null, null, true, '#8fa3a8', '#2f3b36'),
  ('shuzenji-onsen-town', 0, null, null, null, true, '#a89a86', '#3d332b'),
  ('jogasaki-coast', 0, null, null, null, true, '#9fb6c2', '#23404d'),
  ('sengokuhara-plateau', 0, null, null, null, true, '#c2b48f', '#5a5232'),
  ('gora-onsen-inn', 0, null, null, null, true, '#7d8a86', '#2a2a26'),
  ('shimoda-seaside-inn', 0, null, null, null, true, '#a7c0c8', '#28485a'),
  ('owakudani-hike', 0, null, null, null, true, '#b3ab9a', '#4a4234'),
  ('yumoto-day-onsen', 0, null, null, null, true, '#a39686', '#3f342b'),
  ('gora-private-bath', 0, null, null, null, true, '#8a8f88', '#30302b'),
  ('shimoda-seafood', 0, null, null, null, true, '#c1ae94', '#503e2d'),
  ('nishiizu-breakfast', 0, null, null, null, true, '#a4b8c0', '#2b4752'),
  ('sengokuhara-cafe', 0, null, null, null, true, '#b9aa8e', '#4d4230'),
  ('nakaizu-winery', 0, null, null, null, true, '#a7b08f', '#3d4630'),
  ('shirahama-beach', 0, null, null, null, true, '#bcd2d7', '#335a6b'),
  ('nakaizu-bbq', 0, null, null, null, true, '#a2ab92', '#3a4332'),
  ('ashinoko-camp', 0, null, null, null, true, '#7f99a6', '#24394a'),
  ('nishiizu-camp', 0, null, null, null, true, '#98aebd', '#2c4250'),
  ('ashinoko-walk', 0, null, null, null, true, '#a9b8bb', '#3c4a44'),
  ('shuzenji-bamboo', 0, null, null, null, true, '#9fae8e', '#344230'),
  ('ito-rock-pools', 0, null, null, null, true, '#93aeb9', '#264652');

-- 宿の設備・条件はすべて「不明」。値・出典は入れない
insert into public.spot_facts (spot_id, key, label, value, status, source_name, source_url, checked_at, detail, sort)
select s.spot_id, f.key, f.label::jsonb, null, 'unknown', null, null, null,
       '{"ja":"公式情報に記載がありません。直接確認してください。","en":"Not listed in official information. Please check directly."}'::jsonb,
       f.sort
from (values ('lakeside-stay'), ('gora-onsen-inn'), ('shimoda-seaside-inn')) as s (spot_id)
cross join (values
  ('capacity', '{"ja":"定員","en":"Capacity"}', 1),
  ('bedrooms', '{"ja":"寝室・寝具","en":"Bedrooms & bedding"}', 2),
  ('bath', '{"ja":"風呂","en":"Bath"}', 3),
  ('kitchen', '{"ja":"キッチン","en":"Kitchen"}', 4),
  ('bbq', '{"ja":"BBQ","en":"BBQ"}', 5),
  ('parking', '{"ja":"駐車場","en":"Parking"}', 6),
  ('wifi', '{"ja":"Wi-Fi","en":"Wi-Fi"}', 7),
  ('winter_road', '{"ja":"冬季の道路","en":"Winter road conditions"}', 8)
) as f (key, label, sort);

commit;
