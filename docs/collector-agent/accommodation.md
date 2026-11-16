目的：宿（旅館・ホテル・一棟貸しなど）を、details を JSON 1 つの形で集めて登録するための指示。外部のコレクターエージェントにこのまま渡す。

# 宿の集め方（コレクターエージェント向け）

流れ・bundle の形・共通の決まり（推測しない・出典・座標・写真・報告）は [README.md](README.md)。ここには宿だけの決まりを書く。

## 送るもの
- bundle（`bundle_version: "2"`）。dest は `core_type: "accommodation"`。
- 宿 1 つにつき dest 1 つ。
- `details` は JSON 1 つ（`rooms`・`prices: { seasons, items }`・`sources` など）。前の表の形（`units`・配列の `prices` など）は弾かれる。
- 再収集のときは、渡された `ref` のまま使う。変えると別の宿になる。
- 送った中身で丸ごと置き換わる。写真・設備なども毎回全部入れる。
- 全体の例は `scripts/import-bundle/fixtures/bundle.json`（1 件目が宿）と `docs/collector-guide.md` の例。

## 必須の項目
次が 1 つでも無いと、その bundle は通らない（`src/lib/ingest/quality.ts`）。
- `core.check_in` と `core.check_out`（`HH:MM`）
- `details.rooms` に `capacity`（泊まれる最大人数。0 より大きい）のある部屋が 1 つ以上
- `details.prices.items` に `kind: "room"`・`amount`（0 より大きい）・`currency` の料金が 1 つ以上
- `texts[].address`（住所）
- `core.lat`・`core.lng`（箱根・伊豆の範囲：緯度 34.55〜35.35・経度 138.65〜139.25）
- `core.region_id`
- `texts` に `name` と `summary`
- 写真 1 枚以上。`photos[].room` を書くなら `details.rooms` にある key
- `core.official_url` か `details.sources[].url`

**見つからない必須の値は推測しない。** 埋めずに報告する。その宿は送らない。

## details の欄
どの欄も省略できる（省略＝不明）。知らない欄は弾かれる。形の正本は `src/lib/accommodation/details.ts`・`prices.ts`・`schema.ts`。
- `rooms[]`：`key`（必須）・`name`・`capacity`・`area_sqm`・`tatami`・`style`（japanese / western / japanese_western）・`view`・`smoking`（none / designated / allowed）・`bedrooms[].beds[]`（`type`・`count`）
- `baths[]`：`kind`（必須）・`sauna_style`（kind が `sauna` のときだけ）・`hot_spring`・`spring`・`source`・`capacity`・`cold_bath`・`outdoor_rest`・`open_from`・`open_to`・`gender`・`reservation`・`fee`・`note`
- `meals[]`：`meal`（breakfast / dinner）・`offered`（必須）・`style`・`place`・`served_from`・`served_to`・`slots`・`fee`・`allergy_consult`・`self_cook`・`note`
- `amenities[]`：`code`・`options`・`count`・`paid`・`note`
- `internet`・`pets`・`rules`・`parking`・`access`・`surroundings`：それぞれオブジェクト 1 つ
- `cautions[]`：`{ "note": { "ja": "..." } }`
- `licenses[]`：`kind`（ryokan_business / minpaku / special_zone_minpaku / simple_lodging）・`number`
- `booking_links[]`：`label`・`url`・`is_official`
- `sources[]`：後述

## 部屋と key
- 部屋ごとに `rooms[].key` を付ける。英小文字・数字・`_`・`-` の 1〜40 文字。宿の中で重ねない。
- 一棟貸しは部屋 1 つ（例：`house`）にして、`capacity` は棟の定員。
- ベッドは `bedrooms[].beds[]`（`type`・`count`）に書く。出典の文の中にだけ残さない。

## 料金
- 料金は `details.prices.items[]` に 1 つずつ書く。注意点（`cautions`）の文に書かない。
- 必須の欄：`kind`・`per`・`currency`。`amount` と `rate_percent` はどちらか一方だけ。
- `per`：宿泊料は `house_night`（1 棟 1 泊）・`room_night`（1 室 1 泊）・`person_night`（1 名 1 泊）のどれか。1 回の滞在にかかる料金は `stay`。
- どの部屋の料金かは `room` に `rooms[].key` を書く。無い key は弾かれる。
- 時期・曜日で変わる料金は、`prices.seasons[]` に区分を作り、料金の `season` で指す。
  - 区分は `key`・`valid_from`・`valid_to`（`YYYY-MM-DD`）が要る。
  - ほかの区分に当たらない日の区分は `is_default: true`。
  - 曜日は `weekdays`（1=月 … 7=日）、日付は `dates`（`from`・`to`。区分の期間の中）、祝日は `holidays`・`day_before_holiday`。重なるときは `priority` の大きいほうが勝つ。
  - 「繁忙期」などの名前だけで日付が分からないときは、区分を作らずに報告する。
- 諸経費は `kind: "service_fee"`、入湯税は `kind: "bath_tax"`、清掃料は `kind: "cleaning"`、宿泊税は `kind: "lodging_tax"` の料金として書く。
- 宿泊料にすでに含まれているものは、宿泊料の `includes` に書く（例：`"includes": ["service_fee"]`）。別に書かない。自分の `kind` は入れない。
- 子どもの料金は `audience: "child"` と `age_min`・`age_max`。大人の何割かで決まるなら `amount` の代わりに `rate_percent`（0〜100）。
- 人数で変わる料金は `guests_min`・`guests_max`。幅がある料金は `amount` と `amount_max`。食事は `meals`（none / breakfast / dinner / both）。税込なら `tax_included: true`。
- 型に合わない条件は、文で書かずに報告する。例：5 人目から 1 人いくら、子どもを人数に数えない、手数料込み、区分ごとの子ども料金、連泊の割引、早割、プラン名だけの料金、キャンセル料。

### 期間の書いていない料金
平日・土曜・ローシーズンなどで日付が無いときは、`seasons` を作らない。`season` を書かない行にする。画面は最小・最大だけを出す。
```json
{
  "items": [
    { "kind": "room", "per": "house_night", "room": "house", "amount": 38000, "currency": "JPY", "tax_included": true },
    { "kind": "room", "per": "house_night", "room": "house", "amount": 52000, "currency": "JPY", "tax_included": true }
  ]
}
```

### 日ごとの料金しか出ない予約エンジン
今後 12 か月の最も安い日と最も高い日を、区分を作らずに 2 行で入れる。`room`・`per`・人数は 2 行で同じ。報告に「日ごとの料金から最小と最大」と書く。

人数で値段が変わるときは、最少人数の最も安い日と、最多人数の最も高い日の 2 行にする。人数を付けない 2 行にはしない。
```json
{
  "items": [
    { "kind": "room", "per": "house_night", "room": "house", "amount": 29000, "currency": "JPY", "guests_min": 2, "guests_max": 2 },
    { "kind": "room", "per": "house_night", "room": "house", "amount": 78000, "currency": "JPY", "guests_min": 8, "guests_max": 8 }
  ]
}
```
日を全部取ると呼び出しが多すぎて断られる（HTTP 429）。日を間引いて取る。

### 料金表が画像のとき
画像をダウンロードして見て、数字を読む。読めない数字は入れない。報告に書く。

### 法的表示と予約エンジン
追加の料金が食い違うときは、予約エンジン（実際に請求される方）を入れる。報告に書く。

## 語彙
- 種類の値（風呂の `kind`・設備の `code`・ベッドの `type` など）は `src/lib/vocab/accommodation.ts` の一覧にあるものだけを使う。
- 設備（`amenities[].code`）の中カテゴリと主なもの：
  - kitchen：kitchen stove microwave refrigerator rice_cooker cookware tableware dishwasher coffee_maker
  - outdoor：bbq fire_pit terrace garden pool
  - internet：wifi wired_lan workspace
  - toiletries：towel shampoo toothbrush hair_dryer pajamas
  - laundry：washing_machine dryer coin_laundry iron
  - room：air_conditioner floor_heating tv projector safe
  - entertainment：karaoke mahjong game_console board_games
  - kids：crib high_chair kids_amenities
  - facility：shop lounge gym vending_machine
  - service：front_24h luggage_storage self_checkin
  - accessibility：step_free elevator
- `options` は設備ごとに決まった値だけ（例：bbq の electric_grill・charcoal・gas・covered）。一覧はファイルを見る。
- 風呂の `kind`：public open_air indoor private room_open_air room sauna。サウナの `sauna_style`：barrel dry steam tent。フィンランド式サウナは `dry`。
- 一覧に無いものは、近いコードに寄せずに報告する。例：暖炉・薪ストーブ・エアベッドは設備の一覧に無い。入れずに報告する。

## 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`（official / ota / map / other）・`retrieved_at`（見た日。`YYYY-MM-DD`）・`fields`（そのページから取った欄。例：`["rooms", "prices"]`）。
- `type` の分け方は [README.md](README.md) の「出典」。
- 公式を優先する。予約サイトだけで分かった値は `verification_status: "unverified"`。
- レビュー本文・評価点は入れない。

## 写真
- 部屋の写真は `subject: "room"` と `room`（`rooms[].key`）を書く。`rooms` に無い key は弾かれる。ただし、その部屋の写真だと確かめられないときは `room` を付けない。
- ほかは `subject`（exterior / bath / view / food / activity / landscape / other）を書く。
- `license`（分からなければ `none`）・`source_page_url` も書く。

## よくある落とし穴
- `categories` の `onsen` は、出典で温泉と確かめられたときだけ。人工温泉・トロマトロンなどは `hot_spring: false`（`source: "none"`）にして、`onsen` を付けない。
- 公式サイトの料金と予約サイトの料金が違うときは、公式を入れて報告する。
- 予約サイトの座標だけで済ませない。公式サイトの地図のピンを先に探す（[README.md](README.md) の「座標」）。
- 区分には `valid_from`・`valid_to` が必須。日付を想像して入れない。分からなければ区分を作らない。

## 送る前に
```
pnpm import:bundle --dry-run <bundle.json>
```
- `bundle が正しくない:` が出たら、出た path を直してからもう一度流す。`dry-run: dest N 件 / 写真 N 枚を確認した` が出たら送ってよい。

## 報告
次のときは、値を作らずに、宿ごとにまとめて報告する：`ref`・項目（path）・見た出典の URL・分からなかったこと。
- 必須の値が見つからない
- 語彙に無い種類がある
- 型に合わない料金の条件がある
- 出典どうしで値が食い違う
- 公式の座標が今の座標と 100 m 以上違う

## チェックリスト
- [ ] `details` は JSON 1 つ。`units` や配列の `prices` が無い
- [ ] check_in・check_out がある
- [ ] 部屋ごとに key と capacity がある。ベッドは `beds` に書いた
- [ ] 宿泊料に `per`・`room`・`amount`・`currency` がある
- [ ] 時期の料金は区分（seasons）を作って指した。期間の無い料金は区分を作っていない
- [ ] 諸経費・入湯税・清掃料は料金として書いた。`cautions` に料金の文が無い
- [ ] 種類の値は語彙の一覧にある
- [ ] `details.sources` に `retrieved_at` と `fields` がある
- [ ] `pnpm import:bundle --dry-run` が通った
- [ ] 分からなかったことを報告にまとめた
