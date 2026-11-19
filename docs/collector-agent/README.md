目的：外部のコレクターエージェントが、WANDRARA に載せる場所（宿・体験・自然・建物・日帰り温泉・まち）を集めて登録するための入口。流れ・bundle の形・共通の決まり・報告のしかたをここにまとめる。このリポジトリの中身だけを読めばよい。

# コレクターエージェント向け ガイド

## 流れ
1. 出典を探す。公式サイト（その場所の運営者のページ）を優先する。
2. 場所 1 つにつき dest（JSON）を 1 つ作る。複数の dest を 1 つの bundle ファイルに並べてよい。
3. 検証する：`pnpm import:bundle --dry-run <bundle.json>`
4. 出た path を直して、もう一度流す。`dry-run: dest N 件 / 写真 N 枚を確認した` が出るまで繰り返す。
5. `--dry-run` を外して送る：`pnpm import:bundle <bundle.json>`（多いときは `--parallel`）。登録した dest は下書き（draft）になる。
6. 公開してよいと言われているときだけ：`pnpm dest:publish <ref>`。自分が登録した ref だけ公開できる。
7. 見つからなかった値・合わなかった条件を報告する（後述）。

準備（clone・キー・環境変数・結果の読み方・公開）は `docs/agent-upload-guide.md`。API キー（`wdr_...`）は WANDRARA の担当者から受け取る。ファイルに書かない。git に入れない。

```
export WANDRARA_API_URL=https://wandrara.vercel.app
export WANDRARA_API_KEY=wdr_...
```
この 2 つの環境変数は API を呼ぶときだけ要る（`--dry-run`・`--area-local` は API を呼ばない）。

## core ごとの指示書
| core_type | 場所 | 指示書 | core.kind の値 |
|---|---|---|---|
| accommodation | 宿 | [accommodation.md](accommodation.md) | hotel ryokan private_rental minshuku pension glamping campsite |
| experience | 体験 | [experience.md](experience.md) | tour workshop tasting activity facility_use event |
| nature | 自然 | [nature.md](nature.md) | coast mountain lake highland gorge waterfall forest volcano |
| building | 建物 | [building.md](building.md) | museum shrine temple castle observatory historic_building |
| hotspring | 日帰り温泉 | [hotspring.md](hotspring.md) | day_use public_bath foot_bath |
| village | まち | [village.md](village.md) | onsen_town post_town fishing_village temple_town castle_town |
| （`area_content`） | エリアの中身 | [area-content.md](area-content.md) | products の kind：meisan tokusan |

6 つとも `details` は JSON 1 つ。

エリアに付く中身（名産・特産・やった方が良いこと・扱う店）は dest ではなく、bundle の `area_content` に書く：[area-content.md](area-content.md)。まだ DB に送れない（検証してローカルの JSON に書き出すまで）。ほかのガイド：全体の書き方 `docs/collector-guide.md`、英語の投入ガイド `docs/agent-upload-guide.md`。

## bundle の形
- 正本：`src/lib/ingest/bundle.ts`、`schema/content-bundle.schema.json`。全部の core の例が `scripts/import-bundle/fixtures/bundle.json` にある。この形に合わせる。
- 上の階層：`bundle_version`（`"2"`）・`collector`（エージェントの名前）・`collected_at`（日時）・`dests`（配列）・`area_content`（任意。[area-content.md](area-content.md)）。
- dest 1 つ：

| 欄 | 中身 |
|---|---|
| `core_type` | 上の表の 6 つのどれか（必須） |
| `ref` | その場所の ID。英数字・`_`・`-` の 1〜80 文字。全エージェント・全 core で重ならない。決めたら変えない（変えると別の場所になる） |
| `slug` | URL の名前。省略できる。既存の場所では変わらない |
| `core` | その core の列。位置を持つ core は `region_id`・`prefecture`・`municipality`・`district`・`lat`・`lng`・`geo_precision`（exact / street / district / municipality）。体験は位置を `details.locations` に書く |
| `texts` | 言語ごとに `lang`・`name`（必須）・`summary`・`address` |
| `details` | JSON 1 つ。形は core ごと |
| `categories` | カテゴリ id の配列 |
| `photos` | 写真（後述） |
| `region` | 使わない（互換のため受けるが、DB に無い id は 400。エリアは運営が足す） |
| `sources`・`verification_status` | 任意。DB の列にならない記録。出典は `details.sources` に書くのを基本にする |

- 知らないキーは弾かれる。`dest_id`・`id`・`sort`・`operator_id` は書かない。列のキーは snake_case。
- 同じ ref を 1 つの bundle に 2 回書かない。
- 文（注意点・メモ）は `{ "ja": "...", "en": "..." }`。時刻は `HH:MM`、日付は `YYYY-MM-DD`、通貨は `JPY` など 3 文字。
- 送った中身で、その場所が丸ごと置き換わる。部分更新は無い。毎回、写真・カテゴリ・details を全部入れる。

最小の例（自然 1 つ。写真は `images/001.jpg` を bundle の隣に置く）：
```json
{
  "bundle_version": "2",
  "collector": "example-collector",
  "collected_at": "2026-11-16T10:00:00+09:00",
  "dests": [{
    "core_type": "nature",
    "ref": "EX-ito-001",
    "core": { "kind": "coast", "lat": 34.9, "lng": 139.1, "geo_precision": "exact", "protection": "none" },
    "texts": [{ "lang": "ja", "name": "例の岬", "summary": "海に突き出た遊歩道のある岬" }],
    "details": {
      "hours": { "always_open": true },
      "fees": [{ "amount": 0, "currency": "JPY" }],
      "access": { "station": { "ja": "○○駅" }, "mode": "walk", "minutes": 15 },
      "sources": [{ "name": "市の観光サイト", "url": "https://example.com/", "type": "official", "retrieved_at": "2026-11-16", "fields": ["access", "fees"] }]
    },
    "photos": [{ "file": "images/001.jpg", "license": "none", "source_page_url": "https://example.com/", "subject": "landscape" }]
  }]
}
```

## 共通の必須（`src/lib/ingest/quality.ts`）
1 件でも合わないと、bundle 全体が通らない。core ごとの必須は各指示書にある。
- `texts` に `name` と `summary`（どの言語でもよい）
- 写真 1 枚以上
- （`core.region_id` は要らない。位置からエリアが自動で決まる。決まらないとき・大涌谷のような点のエリアを指すときだけ書く。無い id は 400。エリアは自動では作らない）
- 出どころの URL：`core.official_url`・`details.sources[].url`・dest の `sources[].url` のどれか（体験は `core.official_url` か `details.booking_links[].url`）。`official_url` の列があるのは宿・体験・建物・日帰り温泉だけ。自然・まちは `details.sources[].url` を使う
- 位置：宿・自然・建物・日帰り温泉・まちは `core.lat`・`core.lng` が日本の範囲（緯度 20〜46・経度 122〜154）。体験は `details.locations` の座標がこの範囲。エリア（region_id）は位置から決まる（体験は集合場所 meeting、無ければ先頭の場所）。`geo_precision` が municipality なら市区町村までの粗いエリアになる

## 共通の決まり
### 推測しない・報告する
- 見つからない値は書かない。推測で埋めない。値が無い（不明）と、無い（`false`・`0`）は別。無いと分かっているときだけ `false`・`0` を書く。
- 見つからない必須の値がある場所は送らない。報告に回す。
- 近いコードに寄せない。語彙（`src/lib/vocab/*.ts`）に無い種類は、使わずに報告する。
- 型に入らない条件は、`cautions` の文にして押し込まず、報告する。
- レビュー本文・評価点・件数は入れない。為替換算はしない。

### 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`・`retrieved_at`（見た日）・`fields`（そのページから取った欄。例：`["rooms", "prices"]`）。
- `type`：その場所の自社サイト（運営会社のその場所のページ）は `official`。予約サイト・貸別荘の仲介サイト（楽天・じゃらん など）は `ota`。地図は `map`。ほかは `other`。
- 公式を優先する。公式以外だけで分かった値は、dest に `verification_status: "unverified"` を付ける。出典どうしで食い違うときは `conflict` にして報告する。確かめられたら `verified`。

### 法的表示と予約エンジン
- 法的表示（特商法の表記など）と、予約エンジン（実際に請求される画面）で追加の料金が食い違うときは、予約エンジンの方を入れる。報告に書く。

### 座標
- 優先順：公式サイトの地図のピン ＞ 公式の予約エンジンの位置 ＞ OpenStreetMap。予約エンジンの位置は住所や郵便番号から作られたものが多いので、ピンがあればピンを使う。
- `geo_precision` は使った座標の確かさに合わせる（ピンなら `exact`）。
- すでに入っている座標と、公式の座標が 100 m 以上違うときは、公式の座標にして `geo_precision` も合わせる。報告に書く。
- OpenStreetMap を使ったときは、`type: "map"` の出典を書く。

### カテゴリ・種類
- `categories` の `onsen` は、出典で温泉と確かめられたときだけ付ける。確かめられなければ付けず、報告する。
- 温泉でない風呂（人工温泉など）は、風呂の `hot_spring: false`（日帰り温泉は `source: "none"` でもよい）。そのとき `onsen` は付けない。
- `core.kind` が空のときは、出典で確かめて入れる。確かめられなければ報告する。

### texts
- `summary` が仮の文（「テスト用」など）や、途中で切れている文のときは、公式ページを読んで書き直す。レビューや他サイトの文を写さない。
- 紹介文は、公式ページで確かめた事実だけで書く。

### 写真
- `file`（bundle から見た相対パス）か `url` のどちらか 1 つ。jpeg / png / webp / avif、10MB まで。`photos` に書いた写真だけが使われる。
- `license`（分からなければ `none`）・`source_page_url`・`credit`・`subject`（exterior / room / bath / view / food / activity / landscape / other）を書く。
- すでに写真がある場所を渡されたときは、その写真をそのまま入れる。作り直さない。`source_page_url` が古くても直さず、報告に書く。
- `room`（宿の部屋の key）は、その写真がその部屋だと確かめられるときだけ付ける。確かめられなければ付けない。
- 写真は下書きのうちも、URL を知っていれば誰でも取れる（公開バケット）。権利が分からない写真は入れる前に考える。

### 料金の読み取り
- 料金表が画像のとき：画像をダウンロードして見る。読めない数字は入れない。
- 期間が書いていない料金（平日・土曜・ローシーズンだけで日付が無い、など）：期間（宿なら `seasons`）を作らず、期間を指さない料金の行として入れる。期間のある料金だけ期間を作る。日付の分からない期間は作らない。
- 予約エンジンが日ごとの料金しか出さないとき：今後 12 か月の最も安い日と最も高い日を、2 行で入れる。報告に「日ごとの料金から最小と最大」と書く。
- 人数で値段が変わる予約エンジンでは、最少人数の最も安い日（`guests_min` = `guests_max` = 最少人数）と、最多人数の最も高い日（`guests_min` = `guests_max` = 最多人数）の 2 行にする。人数を付けない 2 行にはしない。
- 呼び出しが多すぎると断られる（HTTP 429）。日を間引いて取る。
- 宿の書き方の詳しい決まりは [accommodation.md](accommodation.md)。体験・建物・日帰り温泉・自然の料金は、それぞれの `prices.items` か `fees`。

## 報告のしかた
値を作らずに、場所ごとにまとめて報告する。次を書く。
- `ref` と結果（送った / 送らない＋理由）
- 使った出典（URL と見た日）
- 見つからない値（path で。例：`/details/hours`）
- 型に入らない条件、語彙に無い種類、出典どうしの食い違い
- もともとのデータの誤り（座標・写真の出典 など）。直した点と、直さなかった点

## 送る前のチェック
- [ ] 場所ごとの指示書の必須が揃っている
- [ ] `ref` が重ならない。再収集なら、渡された `ref` のまま
- [ ] 出典に `retrieved_at` と `fields` がある
- [ ] 推測で埋めた値が無い
- [ ] `pnpm import:bundle --dry-run <bundle.json>` が通った
- [ ] 報告をまとめた
