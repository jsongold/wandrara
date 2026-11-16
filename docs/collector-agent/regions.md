# 全国のエリア定義を作る（作業指示）

目的：Wandrara の「エリア → 細かいエリア」を全国分作り、DB（regions・region_parts）に入れられる表にする。地方（8 区分）は既にコードにあるので作らない。

## 前提
- リポジトリ：`jsongold/wandrara`（Next.js + Supabase）。エリアの正本は DB の `regions`（id・親・名前）と `region_parts`（材料のコード）
- 段：地方（固定 8 区分。都道府県コードで決まる）→ エリア（regions の親）→ 細かいエリア（regions の子）。DB の親子は 2 段まで
- 対象のユーザーは「その土地に詳しくない旅行者」。エリアは旅行者が聞いて分かる観光地のまとまりにする（例：箱根・伊豆・軽井沢・京都・金沢・富良野）
- 既にあるエリアは触らない：`hakone, yumoto, ashinoko, gora, sengokuhara, owakudani, izu, ito, shuzenji, nakaizu, shimoda, nishiizu, atami, higashi-izu`。次の市区町村コードは使用済みなので、新しいエリアに入れない：`14382, 22205, 22208, 22219, 22222, 22225, 22301, 22302, 22304, 22305, 22306, 22325`

## 作るもの
地方ごとに 1 ファイル、タブ区切り（TSV）。置き場所：`data/regions/<地方>.tsv`（`hokkaido, tohoku, kanto, chubu, kinki, chugoku, shikoku, kyushu`）。`data/` はコミットしない（public repo）。

列（1 行目は見出し）：

| 列 | 中身 |
|---|---|
| id | 英小文字・数字・ハイフンで 1〜40 文字（`^[a-z0-9-]{1,40}$`）。全国で重ならない。ローマ字の地名（例 `karuizawa`、`kyoto-higashiyama`） |
| parent_id | 細かいエリアは親のエリアの id。エリアは空 |
| name_ja | 日本語名（例 軽井沢） |
| name_en | 英語名（例 Karuizawa） |
| sort | 並び順の整数。都道府県コード × 100 ＋ 連番（例 長野 20 → 2001, 2002…）。子は親の値 ＋ 1 桁目 |
| n03_codes | 細かいエリアの材料：市区町村コード 5 桁をカンマ区切り（例 `20323`）。エリアの行は空（エリアの範囲は子の和で決まる） |
| source_url | エリアの行に必須：その区分の根拠（都道府県・市町村の公式観光サイトのエリア分けのページなど）。子は空でよい |

例：

```
id	parent_id	name_ja	name_en	sort	n03_codes	source_url
karuizawa		軽井沢	Karuizawa	2001		https://...
karuizawa-town	karuizawa	軽井沢	Karuizawa	2002	20321
miyota	karuizawa	御代田	Miyota	2003	20323
```

## 決まり
- エリア：都道府県ごとに 3〜8 個。観光で名の通ったまとまりだけ。観光地の無い市区町村は、どのエリアにも入れなくてよい（全域を埋めない）
- 細かいエリア：市区町村の単位（1 つか、隣り合う数個）。1 つのエリアに 2〜8 個。市区町村より細かい区分（町丁・字）は今回作らない
- 1 つの市区町村コードは、全国で 1 つの細かいエリアにだけ入れる（重複は不可）
- エリアが都道府県をまたいでもよい（地図では両方の地方から行ける）
- 市区町村コードは、総務省「全国地方公共団体コード」の 6 桁の先頭 5 桁（最後の検査数字を外す）。2024-01-01 時点のものを使う（国土数値情報 N03-2024 と合わせるため）。出典：https://www.soumu.go.jp/denshijiti/code.html
- 政令指定都市は区のコード（例 京都市東山区 `26105`）を使う。市全体のコード（`26100` など）は使わない
- 名前・区分は出典の言い方に合わせる。出典が無いエリアは作らない（推測で作らない）

## 確かめること（提出前）
- [ ] id が形式どおりで、全国で重ならない
- [ ] 子の parent_id がすべて同じファイルか他のファイルのエリアの id にある
- [ ] n03_codes がすべて 5 桁で、全国で重ならず、上の使用済みコードを含まない
- [ ] エリアの行にすべて source_url がある
- [ ] name_en が全行にある

## 渡したあと（取り込みは別の作業。参考）
1. TSV から migration（`regions` の insert と `region_parts` の insert。`source = 'n03'`、`source_version = 'N03-2024'`）を `pnpm exec drizzle-kit generate --custom` で作る
2. `supabase db reset --local` → `pnpm area-map:build` で地図と位置の索引を作り直す。県ごとの索引の大きさを測り、大きすぎれば `scripts/area-map/build.ts` の `LOOKUP_INTERVAL`（今 10m）を上げる
3. 本番 DB への migration・デプロイ・`pnpm backfill:regions --apply` は、それぞれ実行前にオーナーの確認を取る
