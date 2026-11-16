目的：箱根・伊豆の宿と体験を、写真中心のフィードで見つける Web アプリ WANDRARA（ベータ）。

載せるもの（コア）は 6 つ：宿・体験・自然・まち・建物・日帰り温泉。どれも共通の列と、コアごとの型つき JSON（`details`）で持つ。データモデルは [docs/data-model.md](docs/data-model.md)（正本はコードの `src/db/schema`、取り込みの決まりは `src/lib/ingest/quality.ts`）。

## 使い方

### 開発
```bash
pnpm install
supabase start                # ローカルの Supabase（docker）
supabase db reset --local     # migration と seed を入れ直す
# .env.local に NEXT_PUBLIC_SUPABASE_URL・NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY・SUPABASE_SECRET_KEY（supabase status -o env の値）
pnpm dev                      # http://localhost:3000
pnpm test && pnpm test:e2e
```

### スキーマを変えるとき
1. `src/db/schema/*.ts` を直す
2. `pnpm db:generate`（`supabase/migrations/` に SQL ができる）
3. `supabase db push`（列を足す migration は、それを読むコードより先に本番へ入れる。表を消す migration は、読まなくなったコードのデプロイの後）
4. bundle の型を変えたら `pnpm bundle:schema`（`schema/content-bundle.schema.json` を作り直す）

### エージェントの投入
```bash
export WANDRARA_API_URL=https://<URL>
export WANDRARA_API_KEY=wdr_...
pnpm import:bundle <bundle.json> --dry-run
pnpm import:bundle <bundle.json>    # 下書き（draft）として登録
```
集める agent の手引きは [docs/collector-agent/README.md](docs/collector-agent/README.md)（コアごとの指示書もここ）。

### 管理者
```bash
pnpm collector:key create <名前> --email <メール> [--operator <事業者名>]   # API キーの発行（list / revoke もある）
pnpm dest:status <ref|slug> published   # 公開（draft で下書きに戻す）
pnpm dest:status --list draft           # 下書きの一覧
```
