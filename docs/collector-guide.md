# WANDRARA コレクター向け収集ガイド

目的：カタログを完成させるために集める項目と、守るルールを定める。出力は `schema/content-bundle.schema.json` に従う JSON。

## 守ること
- **推測しない**。見つからない項目は `status: "unknown"` にして値を入れない。「不明」と「無い」は別物。
- **事実には出典**。`verified` / `unverified` / `conflict` には `sources`（種類・URL・見た日・根拠の抜き出し）が必須。
  - `verified`：公式サイト・自治体など一次情報で確認できた
  - `unverified`：OTA・メディア・過去の調査など二次情報だけ
  - `conflict`：出典同士で食い違う（出典を 2 つ以上付ける）
- **写真**は `url`（取り込み時にダウンロード）か `file`（bundle の JSON から見た相対パス）で渡す。利用条件は `license` に書き、分からなければ `none`。spot が 1 件の bundle で写真に `url` / `file` が無ければ、同じ場所の `images/` の画像を名前順に全部使う。
- **レビュー本文は転載しない**。出典リンクと、具体的な観察の要約だけ。評価点・件数は入れない。
- **料金は条件ごと**。金額・通貨・単位（1泊1棟 / 1泊1名 / 1名 など）・前提人数・時期・税込か・清掃料などを含むかを必ず書く。為替換算はしない。
- **対象地域はまず箱根・伊豆**。それ以外は `verification_status: "candidate"` のまま記録だけでよい。
- **エリアとカテゴリは自由に足してよい**。DB に無い `area_id` は市町村名で、無いカテゴリは ID を名前にして取り込み側が作る。名前・親の地域・アイコンを決めたいときは bundle の `areas` / `categories` に書く。
- 同じ施設を集め直すときは `external_ref` を変えない（`hotels.tsv` の `catalog_id` をそのまま使う）。

## 投入のしかた
```
pnpm import:bundle data/<フォルダ>/<bundle>.json --dry-run   # 検証して DB で試し、ロールバックする
pnpm import:bundle data/<フォルダ>/<bundle>.json             # 写真をバケットに置き、1 トランザクションで投入する
```
- 同じ `external_ref` を入れ直すと更新になる（事実・写真・料金・カテゴリは入れ替え）。
- `verification_status: "candidate"` は公開せず、原本（`import_records`）だけに残す。
- 前提：`supabase` CLI にログイン済みで、リポジトリが対象プロジェクトに link 済み。

## 優先順位
1. 名前・所在地（市町村・地区・緯度経度）・公式 URL・カテゴリ
2. 宿の基本事実（下表の ★）と料金 1 件以上
3. 写真
4. それ以外の事実・関連スポット・レビューの観察

## 事実キー一覧
値の型は表のとおり。合うキーが無ければ英小文字のスネークケースで新しく作ってよい。

### 宿（kind: stay）
| key | 意味 | 型 |
|---|---|---|
| max_guests ★ | 最大宿泊人数 | 数値（person） |
| private_rental ★ | 一棟貸しか | 真偽 |
| bedrooms ★ | 寝室数 | 数値 |
| beds | 寝具の構成（ベッド・布団の種類と数） | localized |
| bathrooms | 浴室・トイレの数 | 数値 |
| bath_types ★ | 内風呂・露天・温泉・貸切・サウナ | 配列（indoor / open_air / onsen / private / sauna） |
| kitchen ★ | キッチンの有無と設備 | localized |
| bbq | BBQ の可否と場所 | localized |
| parking_spaces ★ | 駐車台数 | 数値（car） |
| wifi | Wi-Fi の有無 | 真偽 |
| pets_allowed | ペット可否と条件 | localized |
| check_in / check_out | チェックイン・アウト時刻 | 文字列（HH:MM） |
| min_nights | 最低泊数 | 数値 |
| quiet_hours | 騒音の決まり・静粛時間 | localized |
| privacy | 周囲の建物との距離・目隠しなど | localized |
| connectivity | 携帯の電波 | localized |
| nearest_station | 最寄り駅とそこからの手段・時間 | localized |
| access_by_car | 主要 IC からの車の所要時間 | 数値（minute） |
| season_access | 冬季の道路・季節の制限 | localized |

### 体験（kind: experience）
| key | 意味 | 型 |
|---|---|---|
| duration_minutes ★ | 所要時間 | 数値（minute） |
| season_months ★ | できる月 | 配列（1〜12） |
| reservation_required ★ | 予約が要るか | 真偽 |
| meeting_point | 集合場所 | localized |
| operating_hours | 営業時間 | localized |
| closed_days | 定休日 | localized |
| min_age | 年齢制限 | 数値 |
| difficulty | 難易度 | easy / moderate / hard |
| weather_dependency | 雨天時の扱い | localized |

### 場所（kind: place）
| key | 意味 | 型 |
|---|---|---|
| opening_hours | 開いている時間 | localized |
| entry_fee | 入場料（料金は prices にも入れる） | localized |
| best_season | 見頃 | localized |
| parking_spaces | 駐車台数 | 数値（car） |

## 1 件の例
```json
{
  "external_ref": "CHAT-002",
  "kind": "stay",
  "name": { "ja": "COCO VILLA Hakone Sengokuhara" },
  "location": { "prefecture": "神奈川県", "municipality": "箱根町", "district": "仙石原", "area_id": "sengokuhara" },
  "categories": ["stay", "plateau"],
  "official_url": "https://example.com/",
  "facts": [
    { "key": "max_guests", "value": 10, "unit": "person", "status": "unverified",
      "sources": [{ "type": "prior_research", "name": "hotels.tsv", "retrieved_at": "2026-11-13" }] },
    { "key": "wifi", "status": "unknown" }
  ],
  "prices": [],
  "photos": [{ "source_page_url": "https://example.com/gallery", "license": "none" }],
  "verification_status": "collected"
}
```
