目的：日帰り温泉（日帰り入浴・外湯・足湯）を、details を JSON 1 つの形で集めて登録するための指示。外部のコレクターエージェントにこのまま渡す。

# 日帰り温泉の集め方（コレクターエージェント向け）

流れ・bundle の形・共通の決まり（推測しない・出典・座標・写真・報告）は [README.md](README.md)。ここには日帰り温泉だけの決まりを書く。宿の風呂は [accommodation.md](accommodation.md)。

## 送るもの
- bundle（`bundle_version: "2"`）。dest は `core_type: "hotspring"`。
- 日帰り温泉 1 つにつき dest 1 つ。
- 再収集のときは、渡された `ref` のまま使う。変えると別の場所になる。
- 送った中身で丸ごと置き換わる。`core`・`texts`・`photos`・`region`・`categories`・`details` を毎回入れる。
- 日帰り温泉の `core` の列：`kind`・`region_id`・`prefecture`・`municipality`・`district`・`lat`・`lng`・`geo_precision`・`official_url`。
- 全体の例は `scripts/import-bundle/fixtures/bundle.json`（5 件目が日帰り温泉）。

## 必須の項目
次が 1 つでも無いと、その bundle は通らない（`src/lib/ingest/quality.ts`）。
- `texts` に `name` と `summary`（どの言語でもよい）
- 写真 1 枚以上
- `core.region_id`
- `core.lat`・`core.lng`（箱根・伊豆の範囲：緯度 34.55〜35.35・経度 138.65〜139.25）
- `details.hours`（営業時間。オブジェクト 1 つ。中身は分かる分だけでよい）
- `details.fees` に、`audience: "adult"`・`amount`（0 以上）・`currency` のある大人の料金
- `details.baths` に、泉質（`spring`）のある風呂が 1 つ以上
- 出どころ：`core.official_url` か `details.sources[].url`

**見つからない必須の値は推測しない。** 埋めずに報告する。その日帰り温泉は送らない。住所（`texts[].address`）は必須ではないが、分かれば書く。

## details の形
形の正本は `src/lib/hotspring/details.ts` と `src/lib/place-common.ts`。使える欄は次だけ。ほかは弾かれる。
- `baths[]`：風呂ごとに 1 つ。`kind`（必須。open_air / indoor / private / sauna）・`hot_spring`（温泉か）・`spring`（泉質。文字列。例：アルカリ性単純温泉）・`source`（natural_flow / circulated / heated / diluted / none）・`gender`（separate / mixed / private）・`fee`（貸切風呂など別料金のとき。`amount`・`currency`）・`reservation`（`required` 必須・`slot_minutes`）・`note`
- `hours`（**配列ではなくオブジェクト 1 つ**）：`open`・`close`（`HH:MM`）・`last_entry`（受付の締め切り）・`closed_weekdays`（1=月〜7=日）・`closed_note`。`note` は無い
- `fees[]`：入浴料。`amount`（0 以上）・`currency` が必須。大人は `audience: "adult"`、子どもは `"child"`。`age_min`・`age_max`・`amount_max`・`tax_included`・`note`
- `amenities`（オブジェクト 1 つ）：`towel`（free / rental / sale / none）・`towel_fee`（`amount`・`currency`）・`rest_area`・`meal`（どちらも true / false）・`note`
- `access`（**オブジェクト 1 つ**）：`station`・`mode`（walk / bus / car）・`minutes`・`parking`（`available` 必須・`spaces`・`paid`）・`route`
- `cautions[]`：`{ "note": { "ja": "..." } }`
- `sources[]`：`name`・`url`・`type`・`retrieved_at`・`fields`

## 料金
- 入浴料などは `details.fees[]` に型のある料金として書く。`cautions` の文に書かない。
- 貸切風呂の料金は、その風呂の `fee` に書く。
- 時期で違う料金は、型のある行として別々に残す（まとめない・捨てない）。型に合わない条件は文にせず報告する。

## 語彙
- 種類の値は `src/lib/vocab/hotspring.ts` の一覧にあるものだけ：`baths[].kind`・`baths[].source`・`baths[].gender`・`amenities.towel`・`fees[].audience`（all / adult / child）・`access.mode`。
- `core.kind`：day_use public_bath foot_bath。
- 風呂の `kind`：`public`（大浴場）・`open_air`・`indoor`・`private`・`sauna`・`foot`（足湯）。足湯は日帰り温泉だけの値。
- 一覧に無いものは、近いコードに寄せずに報告する。

## 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`・`retrieved_at`・`fields`（例：`["baths", "fees", "hours"]`）。決まりは [README.md](README.md)。
- 公式を優先する。公式以外だけで分かった値は `verification_status: "unverified"`。

## よくある落とし穴
- 足湯：`core.kind` を `foot_bath`、風呂の `kind` を `foot` にする。`open_air` などを代わりに当てない。
- 温泉でない風呂（人工温泉など）は `hot_spring: false`、`source: "none"`。`categories` に `onsen` を付けない。必須の `spring`（泉質）が出典に無いときは、書かずに報告して送らない。
- `hours`・`access` は配列にしない。`amenities` もオブジェクト 1 つ。
- 大人の料金は `audience: "adult"` を付ける。`all` だけだと必須に合わない。
- 泉質は `baths[].spring` に書く。`cautions` やテキストに書かない。

## 送る前に
```
pnpm import:bundle --dry-run <bundle.json>
```
`bundle が正しくない:` が出たら、出た path を直してからもう一度流す。

## 報告
次のときは、値を作らずに、日帰り温泉ごとにまとめて報告する：`ref`・項目（path）・見た出典の URL・分からなかったこと。
- 必須の値が見つからない（座標・営業時間・大人の料金・泉質 など）
- 語彙に無い種類がある
- 型に合わない料金・休みの条件がある
- 出典どうしで値が食い違う

## チェックリスト
- [ ] 座標が箱根・伊豆の範囲にある
- [ ] `hours`・`amenities`・`access` は配列でなく 1 つのオブジェクト
- [ ] 大人の料金は `audience: "adult"` で書いた
- [ ] 泉質は風呂の `spring` に書いた
- [ ] 種類の値は語彙の一覧にある
- [ ] `details.sources` に `retrieved_at` と `fields` がある
- [ ] `pnpm import:bundle --dry-run` が通った
- [ ] 分からなかったことを報告にまとめた
