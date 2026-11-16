目的：日帰り温泉を、新しい形（details を JSON 1 つ）で集めてもらうための指示。外部のコレクターエージェントにこのまま渡す。

# 日帰り温泉の集め方（コレクターエージェント向け）

書き方の全体は `docs/collector-guide.md`（英語は `docs/agent-upload-guide.md`）。宿は `docs/collector-agent/accommodation.md`。ここには日帰り温泉の決まりだけを書く。ただし、全体のガイドの表のうち 日帰り温泉の details の key は旧い形なので、ここの指示を使う。

## 送るもの
- 新しい形の bundle（`bundle_version: "2"`）。dest は `core_type: "hotspring"`。
- 日帰り温泉 1 つにつき dest 1 つ。
- 今ある日帰り温泉を直すときは `ref` を同じにする。変えると別の日帰り温泉になる。
- 1 件ずつ全部の中身を送る。送った中身で丸ごと置き換わるので、`core`・`texts`・`photos`・`region`・`categories`・`details` を毎回入れる。
- 全体の例は `scripts/import-bundle/fixtures/bundle.json`（hotspring の dest が 1 つ入っている）。この形に合わせる。

## details の形
- 形の正本は `src/lib/hotspring/details.ts`。図と承認済みの型は `docs/proposals/web-output-building-hotspring-village.html`。
- 使える欄：`baths`・`hours`・`fees`・`amenities`・`access`・`cautions`・`sources`。ほかの欄は弾かれる。
- `baths[]`：風呂ごとに 1 つ。`kind`（open_air / indoor / private / sauna）・`hot_spring`（温泉か）・`spring`（泉質。例：アルカリ性単純温泉）・`source`（natural_flow / circulated / heated / diluted / none）・`gender`（separate / mixed / private）・`fee`（貸切風呂など別料金のとき。`amount`・`currency`）・`reservation`（`required` 必須・`slot_minutes`）・`note`。
- **`hours`（営業時間）は配列ではなく 1 つのオブジェクト。**`open`・`close`（`HH:MM`）・`last_entry`（受付の締め切り）・`closed_weekdays`（1=月〜7=日）・`closed_note`。
- `fees[]`：入浴料。大人は `audience: "adult"`、子どもは `"child"`。`amount`・`currency` は必須。`age_min`・`age_max`・`amount_max`・`tax_included`・`note`。
- `amenities`（1 つ）：`towel`（free / rental / sale / none）・`towel_fee`・`rest_area`・`meal`（どちらも true / false）・`note`。
- **`access`（行き方）も 1 つのオブジェクト。**`station`・`mode`（walk / bus / car）・`minutes`・`parking`（`available` 必須・`spaces`・`paid`）・`route`。

## 必須の項目
次が 1 つでも無いと、その bundle は通らない（`src/lib/ingest/quality.ts`）。
- `texts` に `name` と `summary`（どの言語でもよい）
- 写真 1 枚以上
- `core.region_id`
- `core.lat`・`core.lng`（箱根・伊豆の範囲：緯度 34.55〜35.35・経度 138.65〜139.25）
- `details.hours`（営業時間。中身は分かる分だけでよい）
- `details.fees` に、`audience: "adult"`・`amount`（0 以上）・`currency` のある大人の料金
- `details.baths` に、泉質（`spring`）のある風呂が 1 つ以上
- 出どころ：`core.official_url` か `details.sources[].url`

**見つからない必須の値は推測しない。** 埋めずに報告する（後述「報告」）。その日帰り温泉は送らない。

## 料金
- 入浴料などは `details.fees[]` に型のある料金として書く。`cautions` の文に書かない。
- 時期ごとの料金の違いは、画面には出さない。ただし出典にあれば、型のある料金として別々に残す（まとめない・捨てない）。型に合わない条件は文にせず報告する。

## 語彙
- 種類の値は `src/lib/vocab/hotspring.ts` の一覧にあるものだけを使う：`baths[].kind`・`baths[].source`・`baths[].gender`・`amenities.towel`・`fees[].audience`・`access.mode`。
- `core.kind`（day_use / public_bath / foot_bath）も同じ。
- 一覧に無いものは、近いコードに寄せずに報告する。

## 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`（official / ota / map / other）・`retrieved_at`（見た日。`YYYY-MM-DD`）・`fields`（そのページから取った欄。例：`["baths", "fees", "hours"]`）。
- 公式を優先する。公式以外だけで分かった値は `verification_status: "unverified"`。
- レビュー本文・評価点は入れない。

## 写真
- 今ある写真はそのまま入れる。作り直さない。
- `subject`（bath / exterior / view / other など）・`license`（分からなければ `none`）・`source_page_url` を書く。

## 送る前に
```
export WANDRARA_API_URL=https://wandrara.vercel.app
export WANDRARA_API_KEY=wdr_...
pnpm import:bundle --dry-run <bundle.json>
```
- `--dry-run` は API を呼ばないが、環境変数は要る。
- `bundle が正しくない:` が出たら、出た path を直してからもう一度流す。`dry-run: dest N 件 / 写真 N 枚を確認した` が出たら送ってよい。

## 報告
次のときは、値を作らずに、日帰り温泉ごとにまとめて報告する：`ref`・項目（path）・見た出典の URL・分からなかったこと。
- 必須の値が見つからない（座標・営業時間・大人の料金・泉質 など）
- 語彙に無い種類がある
- 型に合わない料金・休みの条件がある
- 出典どうしで値が食い違う

## チェックリスト
- [ ] `ref` は今の日帰り温泉と同じ（新規なら新しい `ref`）
- [ ] 座標が箱根・伊豆の範囲にある
- [ ] `hours`・`amenities`・`access` は配列でなく 1 つのオブジェクト
- [ ] 大人の料金は `audience: "adult"` で書いた
- [ ] 泉質は風呂の `spring` に書いた
- [ ] 種類の値は語彙の一覧にある
- [ ] `details.sources` に `retrieved_at` と `fields` がある
- [ ] `pnpm import:bundle --dry-run` が通った
- [ ] 分からなかったことを報告にまとめた
