目的：自然（海岸・山・湖・滝など）を、details を JSON 1 つの形で集めて登録するための指示。外部のコレクターエージェントにこのまま渡す。

# 自然の集め方（コレクターエージェント向け）

流れ・bundle の形・共通の決まり（推測しない・出典・座標・写真・報告）は [README.md](README.md)。ここには自然だけの決まりを書く。

## 送るもの
- bundle（`bundle_version: "2"`）。dest は `core_type: "nature"`。
- 自然 1 つにつき dest 1 つ。
- 再収集のときは、渡された `ref` のまま使う。変えると別の自然になる。
- 送った中身で丸ごと置き換わる。`core`・`texts`・`photos`・`region`・`categories`・`details` を毎回入れる。
- 自然の `core` の列：`kind`・`region_id`・`prefecture`・`municipality`・`district`・`lat`・`lng`・`geo_precision`・`protection`。`official_url` の列は無い。
- 全体の例は `scripts/import-bundle/fixtures/bundle.json`（3 件目が自然）と、[README.md](README.md) の最小の例。

## 必須の項目
次が 1 つでも無いと、その bundle は通らない（`src/lib/ingest/quality.ts`）。
- `texts` に `name` と `summary`（どの言語でもよい）
- 写真 1 枚以上
- （`core.region_id` は要らない。位置からエリアが自動で決まる。決まらないとき・大涌谷のような点のエリアを指すときだけ書く。無い id は 400。エリアは自動では作らない）
- `core.lat`・`core.lng`（日本の範囲：緯度 20〜46・経度 122〜154）
- `details.access`（行き方。オブジェクト 1 つ。分かる分だけ書く）
- 出どころ：`details.sources[].url`（`core.official_url` の列は自然に無い。dest の `sources[].url` でもよい）

**見つからない必須の値は推測しない。** 埋めずに報告する。その自然は送らない。

## details の形
形の正本は `src/lib/nature/details.ts`。使える欄は次だけ。ほかは弾かれる。
- `seasons[]`：見どころの時期。`subject`・`month_from`・`month_to`（1〜12。3 つとも必須）
- `hours`（オブジェクト 1 つ）：`always_open` か、`open`・`close`（`HH:MM`）。休みは `closed_note`
- `fees[]`：`amount`（無料は 0）・`currency` が必須。`audience`・`amount_max`・`note`
- `access`（**配列ではなくオブジェクト 1 つ**）：`station`・`mode`（walk / bus / car）・`minutes`・`parking`（`available` 必須・`spaces`・`paid`）・`route`
- `trails[]`：`key`（英小文字・数字・`_`・`-` の 1〜40 文字。自然の中で重ねない）・`name` が必須。`distance_km`・`elevation_gain_m`・`difficulty`（easy / moderate / hard）・`duration_minutes`
- `restrictions[]`：`kind`（closure / volcanic_gas / other）が必須。`note`・`date_from`・`date_to`
- `cautions[]`：`{ "note": { "ja": "..." } }`
- `sources[]`：`name`・`url`・`type`・`retrieved_at`・`fields`

## 料金
- 入場料などは `details.fees[]` に型のある料金として書く。`cautions` の文に書かない。
- 時期で違う料金は、型のある行として別々に残す（まとめない・捨てない）。型に合わない条件は文にせず報告する。

## 語彙
- 種類の値は `src/lib/vocab/nature.ts` の一覧にあるものだけ：`difficulty`・`restrictions[].kind`・`access.mode`・`fees[].audience`（all / adult / child）。
- `core.kind`：coast mountain lake highland gorge waterfall forest volcano。`core.protection`：national_park quasi_national_park prefectural_park geopark none。
- 一覧に無いものは、近いコードに寄せずに報告する。

## 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`・`retrieved_at`・`fields`（例：`["access", "fees"]`）。決まりは [README.md](README.md)。
- 公式（自治体・管理者）を優先する。公式以外だけで分かった値は `verification_status: "unverified"`。

## よくある落とし穴
- `access` を配列にしない。1 つのオブジェクト。
- `core.official_url` は自然に無い。書くと弾かれる。URL は `details.sources[].url` に書く。
- 立入禁止・火山ガスなどの規制は `restrictions` に型で書く。`cautions` に埋めない。
- 座標の優先順は [README.md](README.md) の「座標」。`geo_precision` は使った座標の確かさに合わせる。

## 送る前に
```
pnpm import:bundle --dry-run <bundle.json>
```
`bundle が正しくない:` が出たら、出た path を直してからもう一度流す。

## 報告
次のときは、値を作らずに、自然ごとにまとめて報告する：`ref`・項目（path）・見た出典の URL・分からなかったこと。
- 必須の値が見つからない（座標・行き方 など）
- 語彙に無い種類がある
- 型に合わない料金・規制の条件がある
- 出典どうしで値が食い違う

## チェックリスト
- [ ] 座標が正しい（エリアは座標から決まる）
- [ ] `access` は配列でなく 1 つのオブジェクト
- [ ] 入場料は `fees` に型のある料金として書いた（無料は `amount: 0`）
- [ ] 種類の値は語彙の一覧にある
- [ ] `details.sources` に `retrieved_at` と `fields` がある
- [ ] `pnpm import:bundle --dry-run` が通った
- [ ] 分からなかったことを報告にまとめた
