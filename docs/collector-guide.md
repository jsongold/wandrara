目的：エージェント（コレクター）が bundle v2 を作って投入するための、集め方のルールと書き方。出力は `schema/content-bundle.schema.json` に従う JSON。

# WANDRARA コレクター向け収集ガイド

## 守ること
- **推測しない**。見つからない項目は書かない（NULL＝不明）。分かっている値はその型で書く（無い＝`false`・`0`）。「不明」と「無い」は別物。
- **出典を書く**。一次情報（公式・自治体）を優先。宿は `details.sources`（後述）に書く。ほかのコアは dest の `sources`（type・url・retrieved_at・evidence）に書く。`verification_status` は `verified`（一次で確認）/ `unverified`（二次のみ）/ `conflict`（食い違い。出典 2 つ以上）。dest の `sources` と `verification_status` は DB の列にならず、投入の原本に残る。
- **レビュー本文は転載しない**。評価点・件数も入れない。
- **料金は条件ごと**。金額・通貨・人数・食事・時期・税込か・何を含むかを書く。為替換算はしない。
- 同じ場所を集め直すときは `ref` を変えない（同じ dest の更新になる。slug も変わらない）。
- `operator_id` は書かない。`dest_id`・`id`・親を指す列・`sort` も書かない（`sort` は配列の順）。
- 列のキーは DB の列名（snake_case）。`region` / `categories` は無ければ作られる（category は id が名前になる）。

## コアごとの書く場所
`core_type` を選び、`core`（コアの列）と `details` を書く。名前・紹介・住所は `texts`（lang ごと、`name` 必須）。位置を持つコアは `core` に `region_id`・`prefecture`・`municipality`・`district`・`lat`・`lng`・`geo_precision`（exact / street / district / municipality）も書ける。

`details` の書き方はコアで 2 通りある。
- **宿（accommodation）**：`details` は JSON 1 つ。次の節を見る。
- **ほかの 5 つ**：`details` は key ごとの行の配列。入れ子の子は親の行の中に子の key の配列で書く。

| core_type | kind の値 | core の主な列 | details の key（主な列） |
|---|---|---|---|
| accommodation（宿） | hotel ryokan private_rental minshuku pension glamping campsite | kind check_in check_out official_url | 次の節（JSON 1 つ） |
| experience（体験） | tour workshop tasting activity facility_use event | kind region_id duration_minutes reservation_required official_url | courses(name duration_minutes min_people max_people) / prices(unit audience amount currency) / schedules(start_month end_month weekdays start_time end_time) / locations / inclusions / cautions / booking_links |
| nature（自然） | coast mountain lake highland gorge waterfall forest volcano | kind protection | seasons(subject month_from month_to) / hours_fees(open_time close_time amount currency) / access / trails(name distance_km difficulty) / restrictions / cautions |
| village（村） | onsen_town post_town fishing_village temple_town castle_town | kind region_id municipality | walks(area duration_min) / shop_hours / access / events / cautions |
| building（建物） | museum shrine temple castle observatory historic_building | kind official_url | hours(open_time close_time closed_days) / fees(label amount currency) / access(how_to_get has_parking) / events / cautions |
| hotspring（温泉） | day_use public_bath foot_bath | kind official_url | baths(bath_type spring_handling spring_quality) / hours / fees(fee_kind amount currency) / amenities / access / cautions |

列の全部と型は `schema/content-bundle.schema.json` を見る。文（注意点・メモ）は `{"ja": "...", "en": "..."}`。時刻は `HH:MM`、日付は `YYYY-MM-DD`。

## 宿の details
宿の `details` は JSON 1 つ（オブジェクト）。どの欄も省略できる（省略＝不明）。知らない欄は弾かれる。前の表の形（`units`・`bedrooms` を上に置く・`prices` を配列にする など）は弾かれる。

| 欄 | 中身 |
|---|---|
| `rooms` | 部屋の配列。`key`（必須）・`name`・`capacity`（泊まれる最大人数）・`area_sqm`・`tatami`・`style`・`view`・`smoking`・`bedrooms[].beds[]`（`type`・`count`） |
| `baths` | 風呂の配列。`kind`（必須。サウナも `sauna`）・`sauna_style`（kind=sauna のときだけ）・`hot_spring`・`spring`・`source`・`gender`・`open_from`・`open_to`・`reservation`・`fee` など |
| `meals` | 食事の配列。`meal`（breakfast / dinner）・`offered`（必須）・`style`・`place`・`served_from`・`served_to`・`fee` など |
| `prices` | `{ seasons, items }`。料金の区分と料金（後述） |
| `amenities` | 設備の配列。`code`（語彙）・`options`・`count`・`paid`・`note` |
| `internet` / `pets` / `rules` / `parking` / `access` / `surroundings` | それぞれオブジェクト 1 つ |
| `cautions` | 注意点の配列。`{ "note": { "ja": "..." } }` |
| `licenses` | 許可の配列。`kind`（ryokan_business / minpaku / special_zone_minpaku / simple_lodging）・`number` |
| `booking_links` | 予約先の配列。`label`・`url`・`is_official` |
| `sources` | 出典の配列。`name`・`url`・`type`（official / ota / map / other）・`retrieved_at`（YYYY-MM-DD）・`fields`（その出典から取った欄。例：`["prices", "rooms"]`） |

値の種類（code）は `src/lib/vocab/accommodation.ts` の一覧から選ぶ。形の正本は `src/lib/accommodation/details.ts` と `prices.ts`。金額は `{ "amount": 0 以上の数, "currency": "JPY", "tax_included": true }` の形。

### key と参照
- 部屋は `rooms[].key` で名前を付ける。英小文字・数字・`_`・`-` の 1〜40 文字。dest の中で重ねない。一棟貸しは部屋 1 つ（例：`house`）にする。
- 料金の区分は `prices.seasons[].key` で名前を付ける（同じ決まり）。
- 料金は `prices.items[].room` で部屋を、`prices.items[].season` で区分を指す。無い key を指すと弾かれる。`season` が無い料金は全部の日に当たる。
- 部屋の写真は `photos[].room` で部屋を指す。`rooms` に無い key は弾かれる。
- id は使わない。指すのはいつも dest の中の key。

### 料金（prices）
- `items[]` は `kind`（room / meal / service_fee / bath_tax / lodging_tax / cleaning）・`per`（house_night / room_night / person_night / stay）・`currency` が必須。`amount` と `rate_percent` はどちらか一方だけ書く。
- 諸経費・入湯税・清掃料は、それぞれ別の料金（`kind`）として書く。注意点（`cautions`）の文には書かない。宿泊料にすでに含まれているものは、宿泊料の `includes` に書く。
- 子どもの料金は `audience: "child"` と `age_min`・`age_max` で書く。大人の何割かで決まるなら `rate_percent`。
- 人数で変わる料金は `guests_min`・`guests_max`。幅のある料金は `amount` と `amount_max`。食事は `meals`（none / breakfast / dinner / both）。
- `seasons[]` は `valid_from`・`valid_to` が必須。ほかの区分に当たらない日の区分は `is_default: true`。週末・繁忙期は `weekdays`（1=月 … 7=日）・`dates`・`holidays`・`day_before_holiday` と `priority`（大きいほど優先）で書く。

## 写真
`photos` に `file`（bundle から見た相対パス）か `url` と、`license`（分からなければ `none`）・`source_page_url`・`credit`・`subject`（exterior / room / bath / view / food / activity / landscape / other）を書く。宿の部屋の写真は `room` に `rooms[].key` を書く。jpeg / png / webp / avif、10MB まで。アップロードは投入のスクリプトがやる。

## 必須（宿）
宿は次が無いと投入できない（`src/lib/ingest/quality.ts`）。言語はどれでもよい。
- `texts` に `name` と `summary`・`address`
- 写真 1 枚以上
- `core.region_id`、`core.lat`・`core.lng`（箱根・伊豆の範囲：緯度 34.55〜35.35・経度 138.65〜139.25）
- `core.check_in` と `core.check_out`
- `details.rooms` に `capacity` のある部屋 1 つ以上
- `details.prices.items` に `kind: "room"`・`amount` > 0・`currency` の料金 1 つ以上
- 出どころ：`core.official_url` か `details.sources[].url`（dest の `sources[].url` でもよい）
- `photos[].room` を書くなら `rooms` にある key

## 投入のしかた
```
export WANDRARA_API_URL=https://<本番のURL>
export WANDRARA_API_KEY=wdr_...
pnpm import:bundle <bundle.json> --dry-run   # 検証と写真の読み込みまで。API は呼ばない
pnpm import:bundle <bundle.json>             # 写真を上げて、下書き（draft）として登録する
```
- 登録した dest は draft で、管理者が公開するまで画面に出ない。公開中のものを入れ直すと draft に戻る。
- 中身が前と同じなら書き込まない。宿の `details.sources` は details の一部なので、`retrieved_at` だけ変えても「変わった」になる。
- キーは管理者が `pnpm collector:key create <名前> --email <メール>` で発行して渡す。失くしたら再発行する。
- 公開は管理者が `pnpm dest:status <ref|slug> published`（一覧は `--list draft`）。

## 1 件の例（宿）
架空の宿。最小の例は `scripts/import-bundle/fixtures/bundle.json`。
```json
{
  "bundle_version": "2",
  "collector": "hotel-collector",
  "collected_at": "2026-11-15T10:00:00+09:00",
  "dests": [{
    "core_type": "accommodation",
    "ref": "EX-atami-001",
    "slug": "example-ryokan-atami",
    "verification_status": "verified",
    "core": { "kind": "ryokan", "region_id": "atami", "prefecture": "静岡県", "municipality": "熱海市", "lat": 35.1, "lng": 139.07, "geo_precision": "street", "check_in": "15:00", "check_out": "10:00", "official_url": "https://example.com/" },
    "texts": [{ "lang": "ja", "name": "例の宿 熱海", "summary": "温泉の大浴場がある旅館", "address": "静岡県熱海市..." }],
    "details": {
      "rooms": [{ "key": "washitsu", "name": { "ja": "和室" }, "capacity": 2, "tatami": 8, "style": "japanese", "bedrooms": [{ "beds": [{ "type": "futon", "count": 2 }] }] }],
      "baths": [{ "kind": "public", "hot_spring": true, "gender": "separate" }],
      "prices": {
        "seasons": [
          { "key": "regular", "valid_from": "2026-04-01", "valid_to": "2027-03-31", "is_default": true },
          { "key": "saturday", "valid_from": "2026-04-01", "valid_to": "2027-03-31", "weekdays": [6], "priority": 1 }
        ],
        "items": [
          { "kind": "room", "per": "person_night", "room": "washitsu", "season": "regular", "amount": 20000, "currency": "JPY", "tax_included": true, "meals": "both", "audience": "adult", "includes": ["service_fee"] },
          { "kind": "room", "per": "person_night", "room": "washitsu", "season": "saturday", "amount": 24000, "currency": "JPY", "tax_included": true, "meals": "both", "audience": "adult", "includes": ["service_fee"] },
          { "kind": "room", "per": "person_night", "room": "washitsu", "audience": "child", "age_min": 6, "age_max": 11, "rate_percent": 70, "currency": "JPY", "meals": "both" },
          { "kind": "bath_tax", "per": "person_night", "amount": 150, "currency": "JPY", "audience": "adult" }
        ]
      },
      "amenities": [{ "code": "wifi" }, { "code": "hair_dryer" }],
      "sources": [{ "name": "公式サイト", "url": "https://example.com/", "type": "official", "retrieved_at": "2026-11-14", "fields": ["rooms", "prices"] }]
    },
    "categories": ["onsen"],
    "photos": [
      { "file": "images/001.jpg", "license": "none", "source_page_url": "https://example.com/", "subject": "exterior" },
      { "file": "images/002.jpg", "license": "none", "source_page_url": "https://example.com/", "subject": "room", "room": "washitsu" }
    ],
    "region": { "id": "atami", "name": { "ja": "熱海" } }
  }]
}
```
