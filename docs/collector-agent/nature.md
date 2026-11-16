目的：自然（海岸・山・湖・滝など）を、新しい形（details を JSON 1 つ）で集めてもらうための指示。外部のコレクターエージェントにこのまま渡す。

# 自然の集め方（コレクターエージェント向け）

書き方の全体は `docs/collector-guide.md`（英語は `docs/agent-upload-guide.md`）。宿は `docs/collector-agent/accommodation.md`。ここには自然の決まりだけを書く。

## 送るもの
- 新しい形の bundle（`bundle_version: "2"`）。dest は `core_type: "nature"`。
- 自然 1 つにつき dest 1 つ。
- 今ある自然を直すときは `ref` を同じにする。変えると別の自然になる。
- 1 件ずつ全部の中身を送る。送った中身で丸ごと置き換わるので、`core`・`texts`・`photos`・`region`・`categories`・`details` を毎回入れる。
- 全体の例は `scripts/import-bundle/fixtures/bundle.json`（体験 1 つ・自然 1 つが入っている）。この形に合わせる。

## details の形
- 形の正本は `src/lib/nature/details.ts`。図と承認済みの型は `docs/proposals/web-output-experience-nature.html`。
- 使える欄：`seasons`・`hours`・`fees`・`access`・`trails`・`restrictions`・`cautions`・`sources`。ほかの欄は弾かれる。
- **`access`（行き方）は配列ではなく 1 つのオブジェクト。**`station`・`mode`（walk / bus / car）・`minutes`・`parking`（`available` 必須・`spaces`・`paid`）・`route`。
- `hours`：`always_open` か `open`・`close`（`HH:MM`）。休みは `closed_note`。
- `fees[]`：無料は `amount: 0`。`audience`・`amount_max`・`currency`。
- `trails[]`：`key`（英小文字・数字・`_`・`-` の 1〜40 文字。自然の中で重ねない）・`name`。`distance_km`・`elevation_gain_m`・`difficulty`（easy / moderate / hard）・`duration_minutes`。
- `restrictions[]`：`kind`（closure / volcanic_gas / other）・`note`・`date_from`・`date_to`。
- `seasons[]`：見どころの時期。`subject`・`month_from`・`month_to`。

## 必須の項目
次が 1 つでも無いと、その bundle は通らない（`src/lib/ingest/quality.ts`）。
- `texts` に `name` と `summary`（どの言語でもよい）
- 写真 1 枚以上
- `core.region_id`
- `core.lat`・`core.lng`（箱根・伊豆の範囲：緯度 34.55〜35.35・経度 138.65〜139.25）
- `details.access`（行き方。中身は空でなければよいが、分かる分だけ書く）
- 出どころ：`core.official_url` か `details.sources[].url`

**見つからない必須の値は推測しない。** 埋めずに報告する（後述「報告」）。その自然は送らない。

## 料金
- 入場料などは `details.fees[]` に型のある料金として書く。`cautions` の文に書かない。
- 時期ごとの料金の違いは、画面には出さない。ただし出典にあれば、型のある料金として別々に残す（まとめない・捨てない）。型に合わない条件は文にせず報告する。

## 語彙
- 種類の値は `src/lib/vocab/nature.ts` の一覧にあるものだけを使う：`difficulty`・`restrictions[].kind`・`access.mode`・`fees[].audience`。
- `core.kind`（coast / mountain / lake / highland / gorge / waterfall / forest / volcano）と `protection`（national_park / quasi_national_park / prefectural_park / geopark / none）も同じ。
- 一覧に無いものは、近いコードに寄せずに報告する。

## 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`（official / ota / map / other）・`retrieved_at`（見た日。`YYYY-MM-DD`）・`fields`（そのページから取った欄。例：`["access", "fees"]`）。
- 公式を優先する。公式以外だけで分かった値は `verification_status: "unverified"`。
- レビュー本文・評価点は入れない。

## 写真
- 今ある写真はそのまま入れる。作り直さない。
- `subject`（view / landscape / activity / other など）・`license`（分からなければ `none`）・`source_page_url` を書く。

## 送る前に
```
export WANDRARA_API_URL=https://wandrara.vercel.app
export WANDRARA_API_KEY=wdr_...
pnpm import:bundle --dry-run <bundle.json>
```
- `--dry-run` は API を呼ばないが、環境変数は要る。
- `bundle が正しくない:` が出たら、出た path を直してからもう一度流す。`dry-run: dest N 件 / 写真 N 枚を確認した` が出たら送ってよい。

## 報告
次のときは、値を作らずに、自然ごとにまとめて報告する：`ref`・項目（path）・見た出典の URL・分からなかったこと。
- 必須の値が見つからない（座標・行き方 など）
- 語彙に無い種類がある
- 型に合わない料金・規制の条件がある
- 出典どうしで値が食い違う

## チェックリスト
- [ ] `ref` は今の自然と同じ（新規なら新しい `ref`）
- [ ] 座標が箱根・伊豆の範囲にある
- [ ] `access` は配列でなく 1 つのオブジェクト
- [ ] 入場料は `fees` に型のある料金として書いた
- [ ] 種類の値は語彙の一覧にある
- [ ] `details.sources` に `retrieved_at` と `fields` がある
- [ ] `pnpm import:bundle --dry-run` が通った
- [ ] 分からなかったことを報告にまとめた
