目的：すでに入っている宿を、新しい形（details を JSON 1 つ）で集め直してもらうための指示。外部のコレクターエージェントにこのまま渡す。

# 宿の集め直し（コレクターエージェント向け）

書き方の全体は `docs/collector-guide.md`（英語は `docs/agent-upload-guide.md`）にある。ここには宿を集め直すときの決まりだけを書く。

## 送るもの
- 新しい形の bundle（`bundle_version: "2"`）。宿の `details` は JSON 1 つ（`rooms`・`prices: { seasons, items }`・`sources` など）。前の表の形（`units`・`prices` の配列 など）は弾かれる。
- 宿 1 つにつき dest 1 つ。
- `ref` は今の宿と同じものを使う。変えると別の宿になる。
- 1 件ずつ全部の中身を送る。送った中身で丸ごと置き換わるので、写真・設備なども毎回入れる。
- 全体の例は `scripts/import-bundle/fixtures/bundle.json`。この形に合わせる。

## 必須の項目
次が 1 つでも無いと、その bundle は通らない（`src/lib/ingest/quality.ts`）。
- `core.check_in` と `core.check_out`（`HH:MM`）
- `details.rooms` に `capacity`（泊まれる最大人数）のある部屋が 1 つ以上
- `details.prices.items` に `kind: "room"`・`amount`（0 より大きい）・`currency` の料金が 1 つ以上
- `texts[].address`（住所）
- `core.lat`・`core.lng`（箱根・伊豆の範囲：緯度 34.55〜35.35・経度 138.65〜139.25）
- `core.region_id`
- `texts` に `name` と `summary`
- 写真 1 枚以上
- `core.official_url` か `details.sources[].url`

**見つからない必須の値は推測しない。** 埋めずに報告する（後述「報告」）。その宿は送らない。

## 部屋と key
- 部屋ごとに `rooms[].key` を付ける。英小文字・数字・`_`・`-` の 1〜40 文字。宿の中で重ねない。
- 一棟貸しは部屋 1 つ（例：`house`）にして、`capacity` は棟の定員。
- ベッドは `bedrooms[].beds[]`（`type`・`count`）に書く。出典の文の中にだけ残さない。

## 料金
- 料金は `details.prices.items[]` に 1 つずつ書く。注意点（`cautions`）の文に書かない。
- `per`：宿泊料は `house_night`（1 棟 1 泊）・`room_night`（1 室 1 泊）・`person_night`（1 名 1 泊）のどれか。1 回の滞在にかかる料金は `stay`。
- どの部屋の料金かは `room` に `rooms[].key` を書く。
- 時期・曜日で変わる料金は、`prices.seasons[]` に区分を作り、料金の `season` で指す。
  - 区分は `key`・`valid_from`・`valid_to`（`YYYY-MM-DD`）が要る。
  - ほかの区分に当たらない日の区分は `is_default: true`。
  - 曜日は `weekdays`（1=月 … 7=日）、日付は `dates`（`from`・`to`）、祝日は `holidays`・`day_before_holiday`。重なるときは `priority` の大きいほうが勝つ。
  - 「繁忙期」などの名前だけで日付が分からないときは、区分を作らずに報告する。
- 諸経費は `kind: "service_fee"`、入湯税は `kind: "bath_tax"`、清掃料は `kind: "cleaning"`、宿泊税は `kind: "lodging_tax"` の料金として書く。
- 宿泊料にすでに含まれているものは、宿泊料の `includes` に書く（例：`"includes": ["service_fee"]`）。別に書かない。
- 子どもの料金は `audience: "child"` と `age_min`・`age_max`。大人の何割かで決まるなら `amount` の代わりに `rate_percent`。
- 人数で変わる料金は `guests_min`・`guests_max`。幅がある料金は `amount` と `amount_max`。食事は `meals`（none / breakfast / dinner / both）。税込なら `tax_included: true`。
- 型に合わない条件（連泊の割引・早割・プラン名だけの料金 など）は、文で書かずに報告する。

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
- 一覧に無いものは、近いコードに寄せずに報告する。

## 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`（official / ota / map / other）・`retrieved_at`（見た日。`YYYY-MM-DD`）・`fields`（そのページから取った欄。例：`["rooms", "prices"]`）。
- 公式を優先する。予約サイトだけで分かった値は `verification_status: "unverified"`。
- レビュー本文・評価点は入れない。

## 写真
- 部屋の写真は `subject: "room"` と `room`（`rooms[].key`）を書く。`rooms` に無い key は弾かれる。
- ほかは `subject`（exterior / bath / view / food / activity / landscape / other）を書く。
- `license`（分からなければ `none`）・`source_page_url` も書く。

## 送る前に
```
export WANDRARA_API_URL=https://wandrara.vercel.app
export WANDRARA_API_KEY=wdr_...
pnpm import:bundle --dry-run <bundle.json>
```
- `--dry-run` は API を呼ばないが、環境変数は要る。
- `bundle が正しくない:` が出たら、出た path を直してからもう一度流す。`dry-run: dest N 件 / 写真 N 枚を確認した` が出たら送ってよい。

## 報告
次のときは、値を作らずに、宿ごとにまとめて報告する：`ref`・項目・見た出典の URL・分からなかったこと。
- 必須の値が見つからない
- 語彙に無い種類がある
- 型に合わない料金の条件がある
- 出典どうしで値が食い違う

## チェックリスト
- [ ] `ref` は今の宿と同じ
- [ ] `details` は JSON 1 つ。`units` や配列の `prices` が無い
- [ ] check_in・check_out がある
- [ ] 部屋ごとに key と capacity がある。ベッドは `beds` に書いた
- [ ] 宿泊料に `per`・`room`・`amount`・`currency` がある
- [ ] 時期の料金は区分（seasons）を作って指した
- [ ] 諸経費・入湯税・清掃料は料金として書いた。`cautions` に料金の文が無い
- [ ] 種類の値は語彙の一覧にある
- [ ] `details.sources` に `retrieved_at` と `fields` がある
- [ ] 部屋の写真に `room` がある
- [ ] `pnpm import:bundle --dry-run` が通った
- [ ] 分からなかったことを報告にまとめた

## 今のデータにある問題（例：wr-ito-033）
今のデータは前の形で入っていて、次のような問題がある。集め直しでは、これを新しい形の項目に直す。値は出典で確かめ直す。
- 諸経費などの料金が、注意点の文として 19 回書かれていた。→ `prices.items` の料金にする。
- ベッドの情報が、出典の文の中にだけあった。→ `rooms[].bedrooms[].beds[]` に書く。
- check-in・check-out が無かった。→ 出典で探して書く。見つからなければ報告する。
