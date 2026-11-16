目的：建物（美術館・神社・寺・城・展望台など）を、details を JSON 1 つの形で集めて登録するための指示。外部のコレクターエージェントにこのまま渡す。

# 建物の集め方（コレクターエージェント向け）

流れ・bundle の形・共通の決まり（推測しない・出典・座標・写真・報告）は [README.md](README.md)。ここには建物だけの決まりを書く。

## 送るもの
- bundle（`bundle_version: "2"`）。dest は `core_type: "building"`。
- 建物 1 つにつき dest 1 つ。
- 再収集のときは、渡された `ref` のまま使う。変えると別の建物になる。
- 送った中身で丸ごと置き換わる。`core`・`texts`・`photos`・`region`・`categories`・`details` を毎回入れる。
- 建物の `core` の列：`kind`・`region_id`・`prefecture`・`municipality`・`district`・`lat`・`lng`・`geo_precision`・`official_url`。
- 全体の例は `scripts/import-bundle/fixtures/bundle.json`（4 件目が建物）。

## 必須の項目
次が 1 つでも無いと、その bundle は通らない（`src/lib/ingest/quality.ts`）。
- `texts` に `name` と `summary`（どの言語でもよい）
- 写真 1 枚以上
- （`core.region_id` は要らない。位置からエリアが自動で決まる。決まらないとき・大涌谷のような点のエリアを指すときだけ書く。無い id は 400。エリアは自動では作らない）
- `core.lat`・`core.lng`（日本の範囲：緯度 20〜46・経度 122〜154）
- `details.hours`（営業時間。オブジェクト 1 つ。中身は分かる分だけでよい）
- `details.fees` に、`amount`（0 以上）と `currency` のある料金が 1 つ以上（無料は `amount: 0`）
- 出どころ：`core.official_url` か `details.sources[].url`

**見つからない必須の値は推測しない。** 埋めずに報告する。その建物は送らない。住所（`texts[].address`）は必須ではないが、分かれば書く。

## details の形
形の正本は `src/lib/building/details.ts` と `src/lib/place-common.ts`。使える欄は次だけ。ほかは弾かれる。
- `hours`（**配列ではなくオブジェクト 1 つ**）：`open`・`close`（`HH:MM`）・`last_entry`（入館の締め切り）・`closed_weekdays`（休みの曜日。1=月〜7=日）・`closed_note`（年末年始など曜日で書けない休み）・`note`
- `fees[]`：`amount`（無料は 0）・`currency` が必須。`audience`（all / adult / child）・`age_min`・`age_max`・`amount_max`・`tax_included`・`label`（団体など）・`note`
- `events[]`：企画展・祭事。`name` が必須。時期は `date_from`・`date_to`（`YYYY-MM-DD`）か `months`（1〜12 の配列）。`note`
- `access`（**オブジェクト 1 つ**）：`station`・`mode`（walk / bus / car）・`minutes`・`parking`（`available` 必須・`spaces`・`paid`）・`route`
- `cautions[]`：`{ "note": { "ja": "..." } }`
- `booking_links[]`：`label`・`url`・`is_official`
- `sources[]`：`name`・`url`・`type`・`retrieved_at`・`fields`

## 料金
- 料金は `details.fees[]` に型のある料金として書く。`cautions` の文に書かない。
- 時期で違う料金は、型のある行として別々に残す（まとめない・捨てない）。型に合わない条件は文にせず報告する。

## 語彙
- 種類の値は `src/lib/vocab/building.ts` の一覧にあるものだけ：`access.mode`・`fees[].audience`。
- `core.kind`：museum shrine temple castle observatory historic_building。
- 一覧に無いものは、近いコードに寄せずに報告する。

## 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`・`retrieved_at`・`fields`（例：`["hours", "fees"]`）。決まりは [README.md](README.md)。
- 公式を優先する。公式以外だけで分かった値は `verification_status: "unverified"`。

## よくある落とし穴
- `hours`・`access` を配列にしない。
- 無料の建物は `fees: [{ "amount": 0, "currency": "JPY" }]`。`fees` を空にすると必須に合わない。
- 休館日が「第 2 水曜」など、曜日の番号で書けない条件は `closed_note` に書く。決まった休みの曜日だけを `closed_weekdays` にする。
- 神社・寺で営業時間・料金が無い（境内はいつでも入れる・拝観無料）ときも、出典で確かめて `hours`・`fees` を書く。確かめられなければ報告して送らない。

## 送る前に
```
pnpm import:bundle --dry-run <bundle.json>
```
`bundle が正しくない:` が出たら、出た path を直してからもう一度流す。

## 報告
次のときは、値を作らずに、建物ごとにまとめて報告する：`ref`・項目（path）・見た出典の URL・分からなかったこと。
- 必須の値が見つからない（座標・営業時間・料金 など）
- 語彙に無い種類がある
- 型に合わない料金・休みの条件がある
- 出典どうしで値が食い違う

## チェックリスト
- [ ] 座標が正しい（エリアは座標から決まる）
- [ ] `hours`・`access` は配列でなく 1 つのオブジェクト
- [ ] 料金は `fees` に型のある料金として書いた（無料は `amount: 0`）
- [ ] 種類の値は語彙の一覧にある
- [ ] `details.sources` に `retrieved_at` と `fields` がある
- [ ] `pnpm import:bundle --dry-run` が通った
- [ ] 分からなかったことを報告にまとめた
