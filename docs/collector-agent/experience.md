目的：体験（アクティビティ・ツアー・施設の利用など）を、details を JSON 1 つの形で集めて登録するための指示。外部のコレクターエージェントにこのまま渡す。

# 体験の集め方（コレクターエージェント向け）

流れ・bundle の形・共通の決まり（推測しない・出典・写真・報告）は [README.md](README.md)。ここには体験だけの決まりを書く。

## 送るもの
- bundle（`bundle_version: "2"`）。dest は `core_type: "experience"`。
- 体験 1 つにつき dest 1 つ。
- 再収集のときは、渡された `ref` のまま使う。変えると別の体験になる。
- 送った中身で丸ごと置き換わる。`core`・`texts`・`photos`・`region`・`categories`・`details` を毎回入れる。
- 体験の `core` の列：`kind`・`region_id`・`duration_minutes`・`reservation_required`・`official_url`。位置の列（`lat`・`lng`）は無い。位置は `details.locations` に書く。
- 全体の例は `scripts/import-bundle/fixtures/bundle.json`（2 件目が体験）。

## 必須の項目
次が 1 つでも無いと、その bundle は通らない（`src/lib/ingest/quality.ts`）。
- `texts` に `name` と `summary`（どの言語でもよい）
- 写真 1 枚以上
- （`core.region_id` は要らない。位置からエリアが自動で決まる。決まらないとき・大涌谷のような点のエリアを指すときだけ書く。無い id は 400。エリアは自動では作らない）
- `core.duration_minutes`（0 より大きい）。`core.kind` が `facility_use`（施設の利用）なら任意
- `details.prices.items` に `amount`（0 より大きい）・`currency`・`per` のある料金が 1 つ以上
- `details.locations` に、日本の範囲（緯度 20〜46・経度 122〜154）の座標を持つ集合場所（`kind: "meeting"`）が 1 つ以上。`facility_use` は実施場所（`kind: "activity"`、施設そのもの）でもよい
- ページへのリンク：`core.official_url` か `details.booking_links[].url`（`sources` だけでは足りない）

**見つからない必須の値は推測しない。** 埋めずに報告する。その体験は送らない。

## details の形
形の正本は `src/lib/experience/details.ts`。使える欄は次だけ。ほかは弾かれる。
- `courses[]`：`key`（英小文字・数字・`_`・`-` の 1〜40 文字。体験の中で重ねない）・`name`（必須）。`description`・`duration_minutes`・`people_min`・`people_max`・`age_min`・`languages`（`ja`・`en` など 2 文字）
- `prices.items[]`：後述
- `schedules[]`：`months_from`・`months_to`（1〜12）・`weekdays`（1=月 … 7=日）・`start_times`（`HH:MM` の配列）・`end_time`・`rain_policy`
- `locations[]`：`kind`（meeting / activity）・`lat`・`lng`・`geo_precision`（4 つとも必須）・`address`・`note`
- `inclusions[]`：`kind`（included / excluded / bring）と `item`
- `cautions[]`：`{ "note": { "ja": "..." } }`
- `booking_links[]`：`label`・`url`・`is_official`
- `sources[]`：後述

## 料金
- 料金は `details.prices.items[]` に 1 つずつ書く。注意点（`cautions`）の文に書かない。
- `per` と `amount` と `currency` は必須。`per`：`person`（1 名）・`group`（1 グループ）・`session`（1 回）。
- コースごとに料金が違うときは `course` に `courses[].key` を書く。空なら全コース。`courses` に無い key は弾かれる。
- 子どもの料金は `audience: "child"` と `age_min`・`age_max`。人数で変わるなら `people_min`・`people_max`。幅があれば `amount` と `amount_max`。税込なら `tax_included: true`。
- 体験の料金には、時期の区分（宿の `seasons`）は無い。時期で違う料金は、型のある行として別々に残し、時期は報告する。型に合わない条件は文にせず報告する。

## 語彙
- 種類の値は `src/lib/vocab/experience.ts` の一覧にあるものだけ：`per`・`audience`（all / adult / child）・場所の `kind`・`inclusions[].kind`。
- 体験の `core.kind`：tour workshop tasting activity facility_use event。

## 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`・`retrieved_at`・`fields`（例：`["prices", "schedules"]`）。決まりは [README.md](README.md)。
- 公式を優先する。予約サイトだけで分かった値は `verification_status: "unverified"`。

## よくある落とし穴
- 施設の利用（`facility_use`）：決まった所要時間が無いので、`duration_minutes` は書いていなければ入れない。場所は施設そのものを `kind: "activity"` で書いてよい。
- 集合場所の座標は、公式のピン ＞ 公式の予約エンジン ＞ OpenStreetMap の順（[README.md](README.md) の「座標」）。
- `locations[]` は `geo_precision` も必須。座標だけでは弾かれる。

## 送る前に
```
pnpm import:bundle --dry-run <bundle.json>
```
`bundle が正しくない:` が出たら、出た path を直してからもう一度流す。

## 報告
次のときは、値を作らずに、体験ごとにまとめて報告する：`ref`・項目（path）・見た出典の URL・分からなかったこと。
- 必須の値が見つからない（`duration_minutes`・料金の `per`・集合場所の座標 など）
- 語彙に無い種類がある
- 型に合わない料金の条件がある
- 出典どうしで値が食い違う

## チェックリスト
- [ ] `duration_minutes` がある（`facility_use` は任意）
- [ ] 料金に `per`・`amount`・`currency` がある。コース別なら `course` を書いた
- [ ] `locations` に範囲内の座標と `geo_precision` がある
- [ ] ページへのリンク（`official_url` か `booking_links`）がある
- [ ] 種類の値は語彙の一覧にある
- [ ] `details.sources` に `retrieved_at` と `fields` がある
- [ ] `pnpm import:bundle --dry-run` が通った
- [ ] 分からなかったことを報告にまとめた
