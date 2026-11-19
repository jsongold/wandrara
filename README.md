目的：定番はもう回った人が「2 周目」の行き先を見つける Web アプリ WANDRARA（ベータ）。特に、自然の中でゆったり過ごす体験と宿。人間も agent も、まずここから読む。

旅行先の情報を網羅するメディアではない。範囲は全世界で、まず日本から（今のデータは箱根・伊豆だけ）。

載せるもの（コア）は 6 つ：宿・体験・自然・まち・建物・日帰り温泉。どれも共通の列と、コアごとの型つき JSON（`details`）で持つ。

## どこを読むか

| やりたいこと | 読むもの |
| --- | --- |
| 場所を集めて投入する（collector agent） | [docs/collector-agent/README.md](docs/collector-agent/README.md)（コアごとの指示書もここ）。英語版は [docs/agent-upload-guide.md](docs/agent-upload-guide.md) |
| データモデルを知る | [docs/data-model.md](docs/data-model.md)。正本はコードの `src/db/schema`、取り込みの決まりは `src/lib/ingest/quality.ts` |
| アプリのコードを書く（coding agent） | [AGENTS.md](AGENTS.md)。Next.js 16 は学習データと API が違うので `node_modules/next/dist/docs/` を先に読む |

## 構成

```
src/app/[lang]/     画面（App Router）
src/app/api/        API（取り込み・公開など）
src/components/     UI。コアごとのディレクトリあり
src/db/schema/      DB スキーマ（drizzle。正本）
src/lib/            フィード・取り込み（ingest）・エリア判定（region）・Supabase クライアント・コアごとの表示
src/generated/      生成物（area-map:build が作る。手で直さない）
scripts/            CLI（下のコマンド表）
supabase/           migration と seed
schema/             bundle の JSON Schema（生成物）
e2e/                Playwright
```

## 開発

```bash
pnpm install
supabase start                # ローカルの Supabase（docker）
supabase db reset --local     # migration と seed を入れ直す
# .env.local に NEXT_PUBLIC_SUPABASE_URL・NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY・SUPABASE_SECRET_KEY（supabase status -o env の値）
pnpm dev                      # http://localhost:3000
```

確認：`pnpm lint`・`pnpm test`（vitest）・`pnpm test:e2e`（Playwright）・`pnpm build`

デプロイ：Vercel。`main` だけがデプロイされる（`vercel.json`）。

## コマンド

| コマンド | 使う人 | 要るもの | すること |
| --- | --- | --- | --- |
| `pnpm import:bundle <bundle.json> [--dry-run]` | collector | `WANDRARA_API_URL`・`WANDRARA_API_KEY` | bundle を下書き（draft）として登録 |
| `pnpm dest:publish <ref>... [--draft]` | collector | 同上 | 自分が登録したものを公開（`--draft` で戻す） |
| `pnpm collector:key create <名前> --email <メール> [--operator <事業者名>]` | 管理者 | `SUPABASE_SECRET_KEY` | API キーの発行（`list`・`revoke` もある） |
| `pnpm dest:status <ref\|slug>... published\|draft` | 管理者 | 同上 | 公開状態を変える。`--list draft` で下書きの一覧 |
| `pnpm backfill:regions [--apply <file>]` | 管理者 | 同上 | 既存の行の region を位置から決め直す。引数なしは差分を保存するだけ |
| `pnpm area-map:build` | 開発 | ローカル DB | エリア地図と位置の索引を `src/generated/` に作る（先に `supabase db reset`） |
| `pnpm bundle:schema` | 開発 | なし | `schema/content-bundle.schema.json` を作り直す |
| `pnpm db:generate` | 開発 | なし | スキーマから migration を作る |

`WANDRARA_API_KEY` は `wdr_...`。管理者に発行してもらう。

## スキーマを変えるとき

1. `src/db/schema/*.ts` を直す
2. `pnpm db:generate`（`supabase/migrations/` に SQL ができる）
3. `supabase db push`（列を足す migration は、それを読むコードより先に本番へ入れる。表を消す migration は、読まなくなったコードのデプロイの後）
4. bundle の型を変えたら `pnpm bundle:schema`
