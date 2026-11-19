目的：WANDRARA のビジネスモデルと、それに沿ったテーブルの構成を決める。データ構造はこのサービスの中心なので、migration はこの資料が決まってから書く。

# WANDRARA データモデル

状態：改訂案（2026-11-15）。詳細の表をコアごとの型つき JSON（details）にまとめる案。今の実装は詳細を表で持っている（移行は 5 章）。正本はコード（`src/db/schema` と details の zod）で、この資料は考え方を書く。

## 1. ビジネスモデル

```mermaid
flowchart TB
  User
  Operator
  Tour
  subgraph cores[" "]
    direction LR
    Accommodation --- Experience --- Nature --- Village --- Building --- Hotspring
  end

  User -- 所属する --> Operator
  User -- 登録する --> Tour
  Operator -- 登録する --> cores
  Tour -- 含む --> cores
```

- Tour は、運営者に所属する User も、所属しない User も登録できる
- コア（宿・体験・自然・村・建物・温泉）を登録するのは、運営者に所属する User
- コアは同じ段に並び、どれかが他を含んだり、他に属したりしない。コアどうしは距離（近さ）でつながる
- コアはこれからも増える。増やすときは 3 章の決まりに従う

| モデル | 意味 | 例 |
|---|---|---|
| User | 使う人 | |
| Operator | 宿や体験などを運営する事業者。ログインしない事業者もいる。1 つの事業者に複数の User、1 人の User が複数の事業者に所属できる | |
| Tour | 旅の計画。コアを順に含む | |
| Accommodation | 宿 | ヴィラ キング 熱海 |
| Experience | 体験 | ワイナリー見学、磯遊び |
| Nature | 自然 | 城ヶ崎海岸、芦ノ湖、仙石原高原 |
| Village | 村・町並み（温泉街・宿場町・漁村など） | 修善寺温泉街、箱根湯本 |
| Building | 建物（美術館・神社・寺・城・展望台など） | 箱根神社、修禅寺 |
| Hotspring | 日帰り温泉・外湯 | 修善寺の外湯 |

## 2. テーブル

### 共通の ID
```
destinations          dest_id・core_type（accommodation / experience / nature / village / building / hotspring）・slug・is_demo
```
どのコアも destinations に 1 行を持ち、コアの表の主キーは dest_id。Tour・保存・写真・分類・公開は dest_id を指す。

### 利用者と運営者
```
users                 表示名・ログイン・表示の言語と通貨
operators             事業者名・種別（会社・個人・自治体・団体）・連絡先
operator_memberships  user_id・operator_id（運営者であるかは所属で決まる。掲載を承認できる権限とは別）
user_saves            user_id・dest_id
```

### Tour
```
tours                 名前・説明・登録した User・公開/非公開
├ tour_stops          順番・何日目・メモ・dest_id
└ tour_shares         閲覧だけのリンク
```

### コアと詳細

列にするか details にするかは、取り込みの決まり（`src/lib/ingest/quality.ts`）に合わせる。

| 決まりでの扱い | 置き場所 | 守り方 |
|---|---|---|
| 1 つの値で必須（地域・位置・チェックイン/アウト・所要時間） | コアの表の列 | DB の NOT NULL・CHECK と取り込みの決まり |
| 「1 つ以上要る」一覧（部屋・料金・営業時間・行き方 など） | details の中 | details の zod で 1 件以上 |
| 決まりに無い（任意） | details の中 | details の zod（書かなくてよい） |
| 検索・並び替えに使う（任意でも） | コアの表の列 | details から作る（正は details） |

details はコアごとの型つき JSON（jsonb）1 つ。形は core_type ごとの zod で決める。下の「必須」は quality.ts の決まり。

```
accommodations                 operator_id・種類（ホテル・旅館・一棟貸し・民宿・ペンション・グランピング・キャンプ場）・公式 URL・details
                               必須の列：地域・位置（範囲の中）・チェックイン・チェックアウト
└ details                      必須：rooms（定員のある部屋が 1 つ以上）・prices（金額・通貨・人数のある料金が 1 つ以上）
                               rooms（key・定員・㎡・畳・和洋・眺望・喫煙・寝室と寝具）
                               baths（種類〔サウナを含む〕・温泉か・泉質・時間・男女・予約・料金・水風呂・外気浴）
                               meals（朝/夕・出るか・形式・場所・時間・選べる時刻・料金・アレルギー・自炊）
                               prices（seasons〔key・期間・曜日・祝日・日付〕・items〔種類・単位・room と season の key・人数・対象と年齢・割合・含むもの〕）
                               amenities（語彙の code・付いているもの・数・有料か）・internet（上り/下り・測った日・机）
                               pets・rules・parking・access（手段と時間・送迎・坂）・surroundings・cautions・licenses・booking_links・sources

experiences                    operator_id・種類・要予約・公式 URL・details
                               必須の列：地域・所要時間
└ details                      必須：prices（1 つ以上）・locations（範囲の中の座標が 1 つ以上）
                               courses（key）・prices（course の key）・schedules・locations（座標が 1 つとは限らない）・inclusions・cautions・booking_links・sources

natures                        種類・保護の区分・details
                               必須の列：地域・位置
└ details                      必須：access（1 つ以上）
                               seasons・hours・fees・access・trails・restrictions・cautions・sources

villages                       種類・details
                               必須の列：地域・位置
└ details                      必須：access（1 つ以上）
                               walks・shop_hours・access・events・cautions・sources

buildings                      operator_id・種類・公式 URL・details
                               必須の列：地域・位置
└ details                      必須：hours（1 つ以上）・fees（無料は 0）
                               hours・fees・access・events・cautions・sources

hotsprings                     operator_id・種類・公式 URL・details
                               必須の列：地域・位置
└ details                      必須：hours・fees（大人の料金）・baths（泉質のある浴槽）
                               baths・hours・fees・amenities・access・cautions・sources

*_texts                        名前・紹介・住所（言語ごと。名前で検索するので表のまま。名前と紹介は必須、住所は位置を持つコアで必須）
```

- 検索や並び替えに使う値は、details から列に出す（例：宿の料金の最小・最大で並べるなら、取り込みのときに列にも書く）。出した列の正は details
- 料金の区分ごとの値も details に型で持つ。画面には出さない（不正確だとクレームの元）
- 詳細の中の参照（料金→部屋・料金→区分・写真→部屋）は dest の中の key で指す。id は使わない

### 全コアで共通
```
dest_photos           dest_id・写真・何を写しているか（部屋やコースは details の key で指す）
dest_categories       dest_id・category_id
publications          dest_id・状態・公開日時・承認者
```

### 辞書
```
regions               箱根・伊豆などの範囲（自治体コードも）
categories            分類（親子を持つ）
語彙                   設備（中カテゴリ → 小カテゴリの 2 段）・風呂の種類・料金の種類など。表にせず、コードに一覧を 1 つ置く。details の zod・表示名・OTA や Google のコードへの対応が同じ一覧を見る
languages             訳文を持てる言語の正本（tag：ja・en・zh-Hant など）。*_texts.lang と users.locale が外部キーで指す
currencies・fx_rates（まだ作っていない）
```

### 投入
```
collector_keys        エージェント用の API キー（User ごと。sha256 だけを持つ・取り消せる）
dest_imports          投入された入力の原本（出典・確認の状態もここに残る）
```

## 3. 決まり
- **コアを増やすとき**：コアの表（主キー dest_id）と details の zod を作る。Tour・保存・写真・分類・公開の表は直さない
- **列にするか details にするか**：取り込みの決まり（quality.ts）に合わせる（2 章の表）。1 つの値で必須なものと検索・並び替えに使うものは列、一覧の必須と任意は details
- **表にするもの**：ほかの dest や機能から指されるもの（destinations・写真・分類・公開・Tour）と、ファイルとつながるもの（写真と Storage）
- **決まりの正は 1 か所**：必須の決まりは quality.ts に置き、列の NOT NULL・CHECK と details の zod（1 件以上）が同じ決まりに合うようにする。決まりを変えたら両方を同じ PR で直す
- **「どちらか一方」の決まり**（公式 URL か出典のどちらか など）は列の制約にできないので、取り込みの決まりだけで確かめる
- **details の形**：core_type ごとの zod で決め、書き込む前に必ず確かめる。値の種類は語彙の一覧から選ぶ。DB 側でも JSON Schema（Supabase の pg_jsonschema）で確かめる（使えるかは確かめてから決める）
- **形を変えるとき**：zod を直し、投入の原本（dest_imports）から作り直す。migration は表の列を変えるときだけ
- **項目が無いとき**：欄を書かない（JSON にキーが無い）。分かっている値は、その型（false・0 など）で持つ
- **公開**：コアの列には持たせず、publications で持つ
- **翻訳**：名前・紹介・住所はコアごとの *_texts に、列と型を保ったまま持つ。details の中の文（注意点・メモなど）、地域・分類の名前、写真の alt は LocalizedText（`{"ja": "...", "en": "..."}`）。型・zod・表示での選び方は `src/lib/i18n/localized.ts` 1 か所
- **言語は 3 種類**
  - 訳文の言語：languages 表が正本。足すのは 1 行の insert で、デプロイは要らない。使われている言語は外部キー（restrict）で消せない
  - 画面の言語：`src/lib/i18n/locale.ts` の LOCALES（ja / en）。languages の一部。画面の文言を訳すにはコードを変えるので、コードに持つ
  - 案内言語：体験のガイドが話せる言語（details の courses[].languages）。値は languages のタグ。画面の言語とは関係ない
- **言語タグの形**：BCP 47 の 言語[-文字][-地域]（ja・en・zh-Hant・pt-BR）。大文字小文字はこの形にそろえる（languages_tag_check）
- **言語を確かめる場所**：*_texts.lang と users.locale は DB の外部キー。jsonb のキーと案内言語は、取り込み（registerDest）が languages 表と照らし、無ければ 400。DB に jsonb のキーを照らす check や trigger は作らない（languages を変えても確かめ直されないため）
- **取り込みはその国の言語が必須**：その国の言語（日本は ja。`src/lib/ingest/quality.ts` の COUNTRY）の texts に name と summary が要る。ほかの言語は任意で、languages 表にあれば受ける
- **表示の言語**：要求した言語の文だけを出し、無ければ空。別の言語では出さない。訳は取り込みの前に済ませ、そろっているかは Review で確かめる（Push → Pipeline → Review → Publish）
- **取り込みは全部入れ直す**：dest_apply はその dest の行を全部消して入れ直し、公開を draft に戻す。1 つの言語だけ送ると、ほかの言語は消える。送るときは全部の言語を入れる
- **辞書は migration と seed で管理する**：取り込みは regions・categories を作り直さない（on conflict do nothing）。名前や訳を直すのは migration か seed
- **何でも入る形にしない**：field_name / text の形（EAV）にはしない。details は欄と型が zod で決まっているので、これに当たらない
- **近さ**：コアの位置から計算する。テーブルには持たない
- **spot という語は使わない**

### 実装で決めたこと
- **投入**：エージェントは API キー（collector_keys）で `POST /api/{core}` に送り、受け取った入力そのものは dest_imports に残す。登録すると publications は draft になり、管理者が公開する
- **ログイン**：メールのリンク（Supabase Auth）。Google は後で（`NEXT_PUBLIC_AUTH_GOOGLE=1` のときだけ出る）

## 4. 次のマイルストーンで検討
- 近さで分からないつながり（宿泊者限定の体験、宿が手配する体験、集合場所など）。案：つながりの持ち主のコアに、相手の dest_id をカラムで持つ。role は使わない
- 出典・根拠：details の sources に、どの項目の出典かを持つ（fields）。値の 1 つずつに付けるかは後で決める
- 承認した版：公開中の内容を見せながら、新しい内容を審査する仕組み

## 5. 移行（詳細の表 → details）

なぜ変えるか
| | 詳細を表に分ける（今） | details（型つき JSON） |
|---|---|---|
| 形を変えるとき | 毎回 migration | zod を直し、原本から作り直す |
| 詳細どうしの参照 | 外部キーが要り、今の取り込みでは受けられない | dest の中の key で指す |
| 値の正しさ | DB の CHECK・外部キー | 書き込み前の zod（DB でも JSON Schema で確かめられる） |
| dest をまたぐ検索 | SQL で素直に書ける | よく使う条件は列に出す。それ以外は JSON の検索と GIN 索引 |
| 書き込み | 表ごとに消して入れ直す | dest ごとに 1 つ置き換える（コレクターは毎回全部を送るので合う） |
| 公開の権限（RLS） | 詳細の表すべてに要る | コアの行だけ |
| 人が DB を直接見る・直す | 見やすい | JSON を読む（直接直すのは不向き） |

今変える理由：beta 前で本番は開発環境として扱える。投入の原本が dest_imports に全部残っていて作り直せる。投入の作り直し（handoff ingest-pipeline）の structure の段の書き込み先をこの形にすれば、二度作らずに済む

手順
0. 必須の列は先に作り、NOT NULL は付けずに始める。今は必須の値が欠けた dest が公開されている（チェックイン/アウトなし 77・座標なし 122、2026-11-15 の点検）。直し終わってから NOT NULL を付ける
1. 宿だけで移す：accommodations に details を足し、zod・取り込み（plan・apply）・画面用の型（docs/proposals/web-output-model-spec.html の 2 章）・詳細の画面を直す。wr-ito-033 で確かめる
2. 原本から宿の details を作り直すスクリプトで、全部の宿を移す。移ったら宿の詳細の表を消す
3. 残りの 5 種類を同じ形で移す
4. collector-guide・agent-upload-guide の送り方を直す

未決
- pg_jsonschema を使うか（Supabase で使えるか、zod から JSON Schema を作れるか）
- quality.ts の決まりから、列の制約と details の zod をどう作るか（手で合わせるか、1 つの定義から作るか）
- 料金の最小・最大など、どの値を列に出すか（画面の並び替え・絞り込みで決める）
- 体験の locations（座標が複数）を details に入れたとき、近さの計算をどうするか

