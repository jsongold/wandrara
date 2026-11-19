目的：エリアに付く中身（名産・特産＝products、やった方が良いこと＝services、扱う店＝shops、店が扱うもの＝shop_items）を集めて、検証し、画面が読むローカルの JSON に書き出すための指示。外部のコレクターエージェントにこのまま渡す。

# エリアの中身の集め方（コレクターエージェント向け）

流れ・bundle の上の階層・報告のしかたは [README.md](README.md)。ここにはエリアの中身だけの決まりを書く。DB の表はまだ無い（#114 で作る）。今は検証して、ローカルの JSON に書き出すところまで。

## 送るもの
- bundle（`bundle_version: "2"`）のいちばん上に `area_content` を 1 つ。1 つの bundle に 1 エリア。
- dest を送らないときは `"dests": []`。
- 例：`scripts/import-bundle/fixtures/area-content.json`（熱海の一部）。形の正本：`src/lib/ingest/area-content.ts`、`schema/content-bundle.schema.json`。

## area_content の形
欄は snake_case。知らないキーは弾かれる。文（`name`・`summary`・`description`・`hours`・`closed`・`price_note`）は `{ "ja": "...", "en": "..." }`（両方必須）。

| 欄 | 中身 |
|---|---|
| `region_id` | エリアの id（英小文字・数字・`-`）。形だけ確かめる |
| `products[]` | `id`・`kind`（`meisan` 名産 / `tokusan` 特産）・`name`・`summary`（一言）・`description`・`season`・`photo`・`sources` |
| `services[]` | products から `kind` を除いたもの（やった方が良いこと） |
| `shops[]` | `id`・`name`・`online`（通販なら true）・`address`・`lat`・`lng`・`hours`・`closed`（定休）・`url`・`photos[]`・`sources` |
| `shop_items[]` | `shop`（shops の id）・`product` か `service`（ちょうど 1 つ）・`price`（円の整数）・`price_note`・`checked_at`（確かめた日、必須）・`url`・`sources` |
| `popular` | 人気の候補。products か services の `id` を見せたい順に（任意） |

- `id`：英小文字・数字・`-` の 1〜60 文字。products と services の中で重ねない。決めたら変えない。
- `season`：`{ "from": 11, "to": 1 }`（月は 1〜12。年をまたぐときは from > to）。旬が無ければ `null`。
- `photo`：`url`・`license`・`credit`・`source`（写真のページの URL）が全部必須。
- `sources`：使ったページの URL の配列。1 件以上。
- 分からない欄は `null` にするか書かない。推測で埋めない。

## 集め方の決まり
- **事実だけ。** 出典で確かめたことだけ書く。宣伝文やレビューを写さない。一言・説明は自分の言葉で短く。
- **全件に出典。** products・services・shops・shop_items のどれも `sources` が 1 件以上。
- **公式を優先。** 店・施設の公式サイト ＞ 自治体・観光協会 ＞ 予約サイト・通販サイト。公式が無い店は報告に書く。
- **閉店を確かめる。** 公式サイト・観光協会・地図で今も営業しているかを見る。閉店・休業中・確かめられない店は入れず、報告する。
- **写真は自由なライセンスだけ。** CC BY・CC BY-SA・CC0・Public domain など。`license` に `none` は書けない。店のサイトの写真は許可が無ければ使わない。使える写真が無ければ `photo: null`。
- **価格は参考。** 公開されている価格だけを、税込かどうか・単位を `price_note` に添えて書く。目方で変わるなど 1 つに決まらないときは `price: null` にして `price_note` に書く。
- **確かめた日。** `shop_items[].checked_at` に、価格・扱いを確かめた日（`YYYY-MM-DD`）。
- **ja と en。** `name`・`summary`・`description`・`hours`・`closed`・`price_note` は両方書く。en は直訳でなく、意味が通る短い英語に。
- 住所は都道府県から書く（画面で市までを省く）。緯度経度は公式の地図のピンで確かめられたときだけ。

## 検証と書き出し
```
pnpm import:bundle --dry-run <bundle.json>
pnpm import:bundle <bundle.json> --area-local=src/lib/area-local
```
- `--dry-run` は `dry-run: エリアの中身 <region_id>：products N / ... を確認した` が出れば通っている。
- `--area-local=<dir>` は `<dir>/<region_id>.json` を画面が読む形（camelCase）で書く。API は呼ばない。
- `--dry-run` も `--area-local` も無いと、`area_content` のある bundle は送らずに止まる（まだ DB に送れない）。

## 報告
エリアごとに：入れなかった候補と店（閉店・確かめられない・公式が無い）、使える写真が無かった候補、出典どうしの食い違い。

## チェックリスト
- [ ] 全件に `sources` がある
- [ ] 写真は自由なライセンスで、`license`・`credit`・`source` がある
- [ ] 閉店していないことを確かめた
- [ ] `shop_items` に `checked_at` があり、価格は公開されているもの
- [ ] 文は ja と en の両方
- [ ] `pnpm import:bundle --dry-run <bundle.json>` が通った
