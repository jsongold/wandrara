目的：まち（温泉街・宿場町・漁村・門前町・城下町）を、details を JSON 1 つの形で集めて登録するための指示。外部のコレクターエージェントにこのまま渡す。

# まちの集め方（コレクターエージェント向け）

流れ・bundle の形・共通の決まり（推測しない・出典・座標・写真・報告）は [README.md](README.md)。ここにはまちだけの決まりを書く。

## 送るもの
- bundle（`bundle_version: "2"`）。dest は `core_type: "village"`。
- まち 1 つにつき dest 1 つ。
- 再収集のときは、渡された `ref` のまま使う。変えると別のまちになる。
- 送った中身で丸ごと置き換わる。`core`・`texts`・`photos`・`region`・`categories`・`details` を毎回入れる。
- まちの `core` の列：`kind`・`region_id`・`prefecture`・`municipality`・`district`・`lat`・`lng`・`geo_precision`。`official_url` の列は無い。
- 全体の例は `scripts/import-bundle/fixtures/bundle.json`（6 件目がまち）。

## 必須の項目
次が 1 つでも無いと、その bundle は通らない（`src/lib/ingest/quality.ts`）。
- `texts` に `name` と `summary`（どの言語でもよい）
- 写真 1 枚以上
- `core.region_id`
- `core.lat`・`core.lng`（箱根・伊豆の範囲：緯度 34.55〜35.35・経度 138.65〜139.25）
- `details.access`（行き方。オブジェクト 1 つ。分かる分だけ書く）
- 出どころ：`details.sources[].url`（`core.official_url` の列はまちに無い。dest の `sources[].url` でもよい）

**見つからない必須の値は推測しない。** 埋めずに報告する。そのまちは送らない。

## details の形
形の正本は `src/lib/village/details.ts` と `src/lib/place-common.ts`。使える欄は次だけ。ほかは弾かれる。
- `walks[]`：歩き方ごとに 1 つ。`key`（英小文字・数字・`_`・`-` の 1〜40 文字。まちの中で重ねない）・`name` が必須。`area`（範囲）・`duration_minutes`・`distance_km`・`note`
- `shop_hours`（**配列ではなくオブジェクト 1 つ**）：店が開いている時間。`open`・`close`（`HH:MM`）・`note`
- `events[]`：祭り・催し。`name` が必須。時期は `date_from`・`date_to`（`YYYY-MM-DD`）か `months`（1〜12 の配列）。`note`
- `access`（**オブジェクト 1 つ**）：`station`・`mode`（walk / bus / car）・`minutes`・`parking`（`available` 必須・`spaces`・`paid`）・`route`
- `cautions[]`：`{ "note": { "ja": "..." } }`
- `sources[]`：`name`・`url`・`type`・`retrieved_at`・`fields`

## 語彙
- 種類の値は `src/lib/vocab/village.ts` の一覧にあるものだけ：`access.mode`。
- `core.kind`：onsen_town post_town fishing_village temple_town castle_town。
- 一覧に無いものは、近いコードに寄せずに報告する。

## 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`・`retrieved_at`・`fields`（例：`["walks", "access"]`）。決まりは [README.md](README.md)。
- 公式（自治体・観光協会）を優先する。公式以外だけで分かった値は `verification_status: "unverified"`。

## よくある落とし穴
- `shop_hours`・`access` を配列にしない。
- `core.official_url` はまちに無い。書くと弾かれる。URL は `details.sources[].url` に書く。
- 座標の優先順は [README.md](README.md) の「座標」。`geo_precision` は使った座標の確かさに合わせる。

## 送る前に
```
pnpm import:bundle --dry-run <bundle.json>
```
`bundle が正しくない:` が出たら、出た path を直してからもう一度流す。

## 報告
次のときは、値を作らずに、まちごとにまとめて報告する：`ref`・項目（path）・見た出典の URL・分からなかったこと。
- 必須の値が見つからない（座標・行き方 など）
- 語彙に無い種類がある
- 型に合わない歩き方・店の時間の条件がある
- 出典どうしで値が食い違う

## チェックリスト
- [ ] 座標が箱根・伊豆の範囲にある
- [ ] `shop_hours`・`access` は配列でなく 1 つのオブジェクト
- [ ] `walks[].key` はまちの中で重ならない
- [ ] 種類の値は語彙の一覧にある
- [ ] `details.sources` に `retrieved_at` と `fields` がある
- [ ] `pnpm import:bundle --dry-run` が通った
- [ ] 分からなかったことを報告にまとめた
