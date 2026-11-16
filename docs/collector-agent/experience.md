目的：体験（アクティビティ・ツアーなど）を、新しい形（details を JSON 1 つ）で集めてもらうための指示。外部のコレクターエージェントにこのまま渡す。

# 体験の集め方（コレクターエージェント向け）

書き方の全体は `docs/collector-guide.md`（英語は `docs/agent-upload-guide.md`）。宿は `docs/collector-agent/accommodation.md`。ここには体験の決まりだけを書く。

## 送るもの
- 新しい形の bundle（`bundle_version: "2"`）。dest は `core_type: "experience"`。
- 体験 1 つにつき dest 1 つ。
- 今ある体験を直すときは `ref` を同じにする。変えると別の体験になる。
- 1 件ずつ全部の中身を送る。送った中身で丸ごと置き換わるので、`core`・`texts`・`photos`・`region`・`categories`・`details` を毎回入れる。
- 全体の例は `scripts/import-bundle/fixtures/bundle.json`（体験 1 つ・自然 1 つが入っている）。この形に合わせる。

## details の形
- 形の正本は `src/lib/experience/details.ts`。図と承認済みの型は `docs/proposals/web-output-experience-nature.html`。
- 使える欄：`courses`・`prices.items`・`schedules`・`locations`・`inclusions`・`cautions`・`booking_links`・`sources`。ほかの欄は弾かれる。
- コース（`courses[]`）：`key`（英小文字・数字・`_`・`-` の 1〜40 文字。体験の中で重ねない）・`name`。必要なら `duration_minutes`・`people_min`・`people_max`・`age_min`・`languages`。
- 場所（`locations[]`）：`kind`（meeting / activity）・`lat`・`lng`・`geo_precision`。
- 含むもの（`inclusions[]`）：`kind`（included / excluded / bring）と `item`。

## 必須の項目
次が 1 つでも無いと、その bundle は通らない（`src/lib/ingest/quality.ts`）。
- `texts` に `name` と `summary`（どの言語でもよい）
- 写真 1 枚以上
- `core.region_id`
- `core.duration_minutes`（0 より大きい）
- `details.prices.items` に `amount`（0 より大きい）・`currency`・`per` のある料金が 1 つ以上
- `details.locations` に、箱根・伊豆の範囲（緯度 34.55〜35.35・経度 138.65〜139.25）の座標を持つ場所が 1 つ以上
- ページへのリンク：`core.official_url`・`details.booking_links[].url`・`details.sources[].url` のどれか

**見つからない必須の値は推測しない。** 埋めずに報告する（後述「報告」）。その体験は送らない。

## 料金
- 料金は `details.prices.items[]` に 1 つずつ書く。注意点（`cautions`）の文に書かない。
- `per` は必須：`person`（1 名）・`group`（1 グループ）・`session`（1 回）。
- コースごとに料金が違うときは `course` に `courses[].key` を書く。空なら全コース。`courses` に無い key は弾かれる。
- 子どもの料金は `audience: "child"` と `age_min`・`age_max`。人数で変わるなら `people_min`・`people_max`。幅があれば `amount` と `amount_max`。税込なら `tax_included: true`。
- 時期ごとの料金の違いは、画面には出さない。ただし出典にあれば、型のある料金として別々に残す（まとめない・捨てない）。時期の区分に合わない条件は文にせず報告する。

## 語彙
- 種類の値は `src/lib/vocab/experience.ts` の一覧にあるものだけを使う：`per`・`audience`・場所の `kind`・`inclusions[].kind`。
- 体験の `core.kind` は DB の一覧（`src/db/schema/experience.ts` の `KIND_LABELS`）にあるものだけ。
- 一覧に無いものは、近いコードに寄せずに報告する。

## 出典
- `details.sources[]` に、使ったページごとに 1 つ書く：`name`・`url`・`type`（official / ota / map / other）・`retrieved_at`（見た日。`YYYY-MM-DD`）・`fields`（そのページから取った欄。例：`["prices", "schedules"]`）。
- 公式を優先する。予約サイトだけで分かった値は `verification_status: "unverified"`。
- レビュー本文・評価点は入れない。

## 写真
- 今ある写真はそのまま入れる。作り直さない。
- `subject`（exterior / bath / view / food / activity / landscape / other）・`license`（分からなければ `none`）・`source_page_url` を書く。

## 送る前に
```
export WANDRARA_API_URL=https://wandrara.vercel.app
export WANDRARA_API_KEY=wdr_...
pnpm import:bundle --dry-run <bundle.json>
```
- `--dry-run` は API を呼ばないが、環境変数は要る。
- `bundle が正しくない:` が出たら、出た path を直してからもう一度流す。`dry-run: dest N 件 / 写真 N 枚を確認した` が出たら送ってよい。

## 報告
次のときは、値を作らずに、体験ごとにまとめて報告する：`ref`・項目（path）・見た出典の URL・分からなかったこと。
- 必須の値が見つからない（`duration_minutes`・料金の `per`・集合場所などの座標 など）
- 語彙に無い種類がある
- 型に合わない料金の条件がある
- 出典どうしで値が食い違う

## チェックリスト
- [ ] `ref` は今の体験と同じ（新規なら新しい `ref`）
- [ ] `duration_minutes` がある
- [ ] 料金に `per`・`amount`・`currency` がある。コース別なら `course` を書いた
- [ ] `locations` に範囲内の座標がある
- [ ] ページへのリンクがある
- [ ] 種類の値は語彙の一覧にある
- [ ] `details.sources` に `retrieved_at` と `fields` がある
- [ ] `pnpm import:bundle --dry-run` が通った
- [ ] 分からなかったことを報告にまとめた
