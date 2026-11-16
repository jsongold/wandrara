目的：まちを、新しい形（details を JSON 1 つ）で集めてもらうための指示。外部のコレクターエージェントにこのまま渡す。

# まちの集め方（コレクターエージェント向け）

書き方の全体は `docs/collector-guide.md`（英語は `docs/agent-upload-guide.md`）。宿は `docs/collector-agent/accommodation.md`。ここにはまちの決まりだけを書く。ただし、全体のガイドの表のうち まちの details の key は旧い形なので、ここの指示を使う。

## 送るもの
- 新しい形の bundle（`bundle_version: "2"`）。dest は `core_type: "village"`。
- まち 1 つにつき dest 1 つ。
- 今あるまちを直すときは `ref` を同じにする。変えると別のまちになる。
- 1 件ずつ全部の中身を送る。送った中身で丸ごと置き換わるので、`core`・`texts`・`photos`・`region`・`categories`・`details` を毎回入れる。
- 全体の例は `scripts/import-bundle/fixtures/bundle.json`（village の dest が 1 つ入っている）。この形に合わせる。

## details の形
- 形の正本は `src/lib/village/details.ts`。図と承認済みの型は `docs/proposals/web-output-building-hotspring-village.html`。
- 使える欄：`walks`・`shop_hours`・`events`・`access`・`cautions`・`sources`。ほかの欄は弾かれる。
- `walks[]`：歩き方ごとに 1 つ。`key`（英小文字・数字・`_`・`-` の 1〜40 文字。まちの中で重ねない）・`name`。`area`（範囲）・`duration_minutes`・`distance_km`・`note`。
- **`shop_hours`（店が開いている時間）は配列ではなく 1 つのオブジェクト。**`open`・`close`（`HH:MM`）・`note`。
- **`access`（行き方）も 1 つのオブジェクト。**`station`・`mode`（walk / bus / car）・`minutes`・`parking`（`available` 必須・`spaces`・`paid`）・`route`。
- `events[]`：祭り・催し。`name`。時期は `date_from`・`date_to`（`YYYY-MM-DD`）か `months`（1〜12 の配列）。`note`。
- `cautions[]`：`{ "note": {...} }`。

## 必須の項目
次が 1 つでも無いと、その bundle は通らない（`src/lib/ingest/quality.ts`）。
- `texts` に `name` と `summary`（どの言語でもよい）
- 写真 1 枚以上
- `core.region_id`
- `core.lat`・`core.lng`（箱根・伊豆の範囲：緯度 34.55〜35.35・経度 138.65〜139.25）
- `details.access`（行き方。中身は空でなければよいが、分かる分だけ書く）
- 出どころ：`sources[].url` か `details.sources[].url`（まちの core に `official_url` の列は無い）

**見つからない必須の値は推測しない。** 埋めずに報告する（後述「報告」）。そのまちは送らない。

## 語彙
- 種類の値は `src/lib/vocab/village.ts` の一覧にあるものだけを使う：`access.mode`。
- `core.kind`（onsen_town / post_town / fishing_village / temple_town / castle_town）も同じ。
- 一覧に無いものは、近いコードに寄せずに報告する。

## 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`（official / ota / map / other）・`retrieved_at`（見た日。`YYYY-MM-DD`）・`fields`（そのページから取った欄。例：`["walks", "access"]`）。
- 公式を優先する。公式以外だけで分かった値は `verification_status: "unverified"`。
- レビュー本文・評価点は入れない。

## 写真
- 今ある写真はそのまま入れる。作り直さない。
- `subject`（landscape / activity / other / other など）・`license`（分からなければ `none`）・`source_page_url` を書く。

## 送る前に
```
export WANDRARA_API_URL=https://wandrara.vercel.app
export WANDRARA_API_KEY=wdr_...
pnpm import:bundle --dry-run <bundle.json>
```
- `--dry-run` は API を呼ばないが、環境変数は要る。
- `bundle が正しくない:` が出たら、出た path を直してからもう一度流す。`dry-run: dest N 件 / 写真 N 枚を確認した` が出たら送ってよい。

## 報告
次のときは、値を作らずに、まちごとにまとめて報告する：`ref`・項目（path）・見た出典の URL・分からなかったこと。
- 必須の値が見つからない（座標・行き方 など）
- 語彙に無い種類がある
- 型に合わない歩き方・店の時間の条件がある
- 出典どうしで値が食い違う

## チェックリスト
- [ ] `ref` は今のまちと同じ（新規なら新しい `ref`）
- [ ] 座標が箱根・伊豆の範囲にある
- [ ] `shop_hours`・`access` は配列でなく 1 つのオブジェクト
- [ ] `walks[].key` はまちの中で重ならない
- [ ] 種類の値は語彙の一覧にある
- [ ] `details.sources` に `retrieved_at` と `fields` がある
- [ ] `pnpm import:bundle --dry-run` が通った
- [ ] 分からなかったことを報告にまとめた
