目的：エージェント（コレクター）が bundle v2 を作って投入するための、集め方のルールと書き方。出力は `schema/content-bundle.schema.json` に従う JSON。

# WANDRARA コレクター向け収集ガイド

## 守ること
- **推測しない**。見つからない項目は書かない（NULL＝不明）。分かっている値はその型で書く（無い＝`false`・`0`）。「不明」と「無い」は別物。
- **出典は `sources` に**。事実の出典（type・url・retrieved_at・evidence）を dest ごとに書く。一次情報（公式・自治体）を優先。`verification_status` は `verified`（一次で確認）/ `unverified`（二次のみ）/ `conflict`（食い違い。出典 2 つ以上）。`sources` と `verification_status` は DB の列にならず、投入の原本に残る。
- **レビュー本文は転載しない**。評価点・件数も入れない。
- **料金は条件ごと**。金額・通貨・人数・食事・時期・税込か・清掃料などを含むかを書く。為替換算はしない。
- 同じ場所を集め直すときは `ref` を変えない（同じ dest の更新になる。slug も変わらない）。
- `operator_id` は書かない。`dest_id`・`id`・親を指す列・`sort` も書かない（`sort` は配列の順）。
- 列のキーは DB の列名（snake_case）。`region` / `categories` は無ければ作られる（category は id が名前になる）。

## コアごとの書く場所
`core_type` を選び、`core`（コアの列）と `details`（key の配列）を書く。名前・紹介・住所は `texts`（lang ごと、`name` 必須）。位置を持つコアは `core` に `region_id`・`prefecture`・`municipality`・`district`・`lat`・`lng`・`geo_precision`（exact / street / district / municipality）も書ける。入れ子の子は親の行の中に子の key の配列で書く（例：`units[].bedrooms[].beds[]`）。

| core_type | kind の値 | core の主な列 | details の key（主な列） |
|---|---|---|---|
| accommodation（宿） | hotel ryokan private_rental minshuku pension glamping campsite | kind check_in check_out official_url | units(name capacity area_sqm style) > bedrooms > beds(bed_type count) / baths(kind spring open_from open_to amount) / meals / booking_links / prices(amount currency guests meals valid_from valid_to tax_included cleaning_fee_included) / amenities / parkings / internet / rules / access / surroundings / cautions / licenses |
| experience（体験） | tour workshop tasting activity facility_use event | kind region_id duration_minutes reservation_required official_url | courses(name duration_minutes min_people max_people) / prices(unit audience amount currency) / schedules(start_month end_month weekdays start_time end_time) / locations / inclusions / cautions / booking_links |
| nature（自然） | coast mountain lake highland gorge waterfall forest volcano | kind protection | seasons(subject month_from month_to) / hours_fees(open_time close_time amount currency) / access / trails(name distance_km difficulty) / restrictions / cautions |
| village（村） | onsen_town post_town fishing_village temple_town castle_town | kind region_id municipality | walks(area duration_min) / shop_hours / access / events / cautions |
| building（建物） | museum shrine temple castle observatory historic_building | kind official_url | hours(open_time close_time closed_days) / fees(label amount currency) / access(how_to_get has_parking) / events / cautions |
| hotspring（温泉） | day_use public_bath foot_bath | kind official_url | baths(bath_type spring_handling spring_quality) / hours / fees(fee_kind amount currency) / amenities / access / cautions |

列の全部と型は `schema/content-bundle.schema.json` を見る。文（注意点・メモ）は `{"ja": "...", "en": "..."}`。時刻は `HH:MM`、期間は `YYYY-MM-DD`。

## 写真
`photos` に `file`（bundle から見た相対パス）か `url` と、`license`（分からなければ `none`）・`source_page_url`・`credit`・`subject`（exterior / room / bath / view / food / activity / landscape / other）を書く。jpeg / png / webp / avif、10MB まで。アップロードは投入のスクリプトがやる。

## 投入のしかた
```
export WANDRARA_API_URL=https://<本番のURL>
export WANDRARA_API_KEY=wdr_...
pnpm import:bundle <bundle.json> --dry-run   # 検証と写真の読み込みまで。API は呼ばない
pnpm import:bundle <bundle.json>             # 写真を上げて、下書き（draft）として登録する
```
- 登録した dest は draft で、管理者が公開するまで画面に出ない。公開中のものを入れ直すと draft に戻る。
- キーは管理者が `pnpm collector:key create <名前> --email <メール>` で発行して渡す。失くしたら再発行する。
- 公開は管理者が `pnpm dest:status <ref|slug> published`（一覧は `--list draft`）。

## 1 件の例（宿）
```json
{
  "bundle_version": "2",
  "collector": "hotel-collector",
  "collected_at": "2026-11-15T10:00:00+09:00",
  "dests": [{
    "core_type": "accommodation",
    "ref": "WR-atami-008",
    "slug": "villa-king-atami",
    "verification_status": "verified",
    "core": { "kind": "private_rental", "region_id": "atami", "prefecture": "静岡県", "municipality": "熱海市", "lat": 35.03, "lng": 139.08, "official_url": "https://example.com/" },
    "texts": [{ "lang": "ja", "name": "ヴィラ キング 熱海", "summary": "海を望む一棟貸し", "address": "静岡県熱海市..." }],
    "details": {
      "units": [{ "capacity": 10, "bedrooms": [{ "beds": [{ "bed_type": "double", "count": 2 }] }] }],
      "prices": [{ "amount": 80000, "currency": "JPY", "guests": 10, "meals": "none", "tax_included": true, "cleaning_fee_included": false }]
    },
    "categories": ["onsen", "bbq"],
    "photos": [{ "file": "images/001.jpg", "license": "none", "source_page_url": "https://example.com/", "subject": "exterior" }],
    "region": { "id": "atami", "name": { "ja": "熱海" }, "parent_id": "izu" },
    "sources": [{ "type": "official", "url": "https://example.com/", "retrieved_at": "2026-11-14", "evidence": "公式の料金表" }]
  }]
}
```
