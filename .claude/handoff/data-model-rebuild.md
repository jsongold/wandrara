# handoff: data-model-rebuild

最終更新：2026-11-16（JST）
目的：DB を docs/data-model.md のデータモデルに作り直す（spots 1 表に kind で詰めた構造をやめる）。データモデルは必ずコード（Drizzle ORM 案：drizzle-orm 0.45.4 / drizzle-kit 0.31.11。pgPolicy・check()・unique は docs で確認済み）で定義する
完了条件：新スキーマが Drizzle で定義され migration が本番に入り、トップ・詳細 /d/[slug]・取り込み・公開が新しい表で動き、古い表（spots など）が消え、単体テストと e2e が通る

決定事項（理由はユーザー判断。正本は docs/data-model.md、メモリ data-model-layers.md）
- コア 6 つ：accommodations・experiences・natures・villages・buildings（美術館・神社・寺など建物系すべて）・hotsprings（日帰り温泉・外湯）。同じ段で、含む・属するは無し。コアは今後も増える
- 共通 ID は dest_id（表 destinations）。Tour・保存・写真・分類・公開は dest_id を指す。コアごとに専用の詳細テーブル（core → details。分け方は「別の対象か・独立して複数行か・更新単位が違うか」）
- operators は独立し、operator_memberships で User と結ぶ（Codex レビュー採用）。Tour は全 User が登録、コアは運営者に所属する User が登録
- 項目が無いときは NULL。公開は publications（dest_id）1 表。翻訳はコアごとの *_texts（列と型を保つ）。spot という語は使わない
- コアどうしは距離だけ（計算で出す）。トップは全コアをカード用ビュー 1 つでフィードに混ぜる。詳細は共通の /d/[slug]（core_type で出し分け、シートは @sheet/(.)d/[slug]）
- トップの切り替えは「宿 / 体験」のまま。MODES = { stay: ["accommodation"], do: ["experience","nature","village","building","hotspring"] } を設定 1 か所に明示（自動で体験に入る既定は作らない）。categories.mode はやめる
- フィードは書き直しのときに並べ方を変えやすい形にする：点を付ける処理を独立した関数に切り出し、並べ方に名前と版を持たせる（今の strategy 差し替え＝feed-config.ts は残す）。4 段のパイプライン化・API 化（/api/feed）はしない。API にするのはトップ以外から呼ぶとき、か並べ方を A/B で比べるとき。この作業に /design・/cco は使わない
- デモ 21 件（is_demo）は捨てる。実データ（熱海のヴィラ wr-atami-008 など）だけ移す
却下：spot 1 表＋kind（構造が悪い）、places/Location（広すぎる）、出典を行に 1 つ、role 付きの relations、Supabase declarative schemas（SQL でありコードでない）
次のマイルストーン：近さで分からないつながり（宿泊者限定・集合場所。案：持ち主のコアに相手の dest_id カラム）、出典・根拠の仕組み、承認した版の扱い

現在の状態
- Issue: なし
- branch docs/data-model（origin/main 基準、未 push）に docs/data-model.md をコミット済み。feat/nearby-experiences（距離で関連、push 済み・PR なし）は新スキーマで作り直す前提
- エージェント用投入 API の設計（/api/upload-urls・/api/accommodations・/api/experiences、collector:key）は保留。scratchpad の design-agent-api は消えうる

次の一手
1. ユーザーに残りの確認：モデルの割り振り（推奨：土台・データ移し替え・RLS・最後のまとめは Opus、コアごとのスキーマと画面・取り込みの書き換えは Sonnet medium、置き換え・テスト・docs は Sonnet low）
2. docs/data-model.md を読み、/taskman で Task に分ける（土台：Drizzle 設定・destinations・命名・RLS の型 → コアごとのスキーマ並行 → migration 生成は 1 本 → データ移し替え → 画面・フィード・取り込み・spot:status 置き換え → 古い表を消す）
3. 本番 DB（Supabase ifozgrjshxwjeogtgctp）への push と古い表の削除は、実行前にユーザーに確認する

注意・未解決
- .env.local は読まない、秘密は出さない、Deployment Protection は外さない、data/ はコミットしない（public repo）
- AGENTS.md：Next.js 16 は同梱 docs（node_modules/next/dist/docs）を読んでから書く
- opencode の API キーが期限切れ（/findbetterway が動かない）
- 未コミットの他変更あり（.claude/changegraph/、data/）
