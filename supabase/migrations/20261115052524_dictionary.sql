-- 辞書：地域と分類の最初の行（本番にも入る）。すでにあれば触らない
insert into public.regions (id, parent_id, name, sort) values
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
  ('nishiizu', 'izu', '{"ja":"西伊豆","en":"Nishi-Izu"}', 25)
on conflict (id) do nothing;

insert into public.categories (id, parent_id, name, icon, sort) values
  ('stay', null, '{"ja":"宿","en":"Stays"}', 'bed', 10),
  ('onsentown', null, '{"ja":"温泉街","en":"Onsen towns"}', 'steam', 20),
  ('coast', null, '{"ja":"海辺","en":"Coast"}', 'sun', 30),
  ('plateau', null, '{"ja":"高原","en":"Highlands"}', 'tree', 40),
  ('lake', null, '{"ja":"湖畔","en":"Lakeside"}', 'wave', 50),
  ('onsen', null, '{"ja":"温泉","en":"Onsen"}', 'steam', 10),
  ('hike', null, '{"ja":"ハイキング","en":"Hiking"}', 'hike', 20),
  ('gourmet', null, '{"ja":"グルメ","en":"Food"}', 'fork', 30),
  ('wine', null, '{"ja":"ワイン","en":"Wine"}', 'wine', 40),
  ('beach', null, '{"ja":"ビーチ","en":"Beach"}', 'umbrella', 50),
  ('bbq', null, '{"ja":"BBQ","en":"BBQ"}', 'flame', 60),
  ('camp', null, '{"ja":"キャンプ","en":"Camping"}', 'tent', 70)
on conflict (id) do nothing;
