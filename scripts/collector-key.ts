// エージェント用の API キーを発行・一覧・取り消しする
// 使い方:
//   pnpm collector:key create <名前> --email <ログインのメール> [--operator <事業者名>]
//   pnpm collector:key list
//   pnpm collector:key revoke <id>
import { parseArgs } from "node:util";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { generateApiKey } from "../src/lib/ingest/keys.ts";
import { adminClient } from "../src/lib/supabase/admin.ts";

const USAGE = `使い方:
  pnpm collector:key create <名前> --email <ログインのメール> [--operator <事業者名>]
  pnpm collector:key list
  pnpm collector:key revoke <id>`;

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function listAllAuthUsers(db: SupabaseClient): Promise<User[]> {
  const all: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`auth のユーザー取得に失敗: ${error.message}`);
    all.push(...data.users);
    if (data.users.length < 1000) return all;
  }
}

async function create(db: SupabaseClient, name: string, email: string, operatorName?: string) {
  const user = (await listAllAuthUsers(db)).find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) fail(`${email} のユーザーが無い。先に Web でログインして`);

  const { data: row, error: e1 } = await db.from("users").select("id").eq("id", user.id).maybeSingle();
  if (e1) fail(`users の取得に失敗: ${e1.message}`);
  if (!row) {
    const { error } = await db.from("users").insert({ id: user.id });
    if (error) fail(`users の作成に失敗: ${error.message}`);
  }

  if (operatorName) {
    let { data: op } = await db.from("operators").select("id").eq("name", operatorName).limit(1).maybeSingle();
    if (!op) {
      const r = await db.from("operators").insert({ name: operatorName }).select("id").single();
      if (r.error) fail(`operators の作成に失敗: ${r.error.message}`);
      op = r.data;
    }
    const { error } = await db
      .from("operator_memberships")
      .upsert({ user_id: user.id, operator_id: op!.id }, { onConflict: "user_id,operator_id" });
    if (error) fail(`operator_memberships の作成に失敗: ${error.message}`);
  } else {
    const { data: ms, error } = await db.from("operator_memberships").select("operator_id").eq("user_id", user.id).limit(1);
    if (error) fail(`operator_memberships の取得に失敗: ${error.message}`);
    if (!ms || ms.length === 0) fail("この User はどの運営者にも所属していない。--operator <事業者名> を付けて");
  }

  const { key, hash } = generateApiKey();
  const { data: ck, error } = await db
    .from("collector_keys")
    .insert({ user_id: user.id, name, key_hash: hash })
    .select("id")
    .single();
  if (error) fail(`collector_keys の作成に失敗: ${error.message}`);
  console.log(`id: ${ck.id}`);
  console.log(key);
  console.error("この値は二度と出せない。今ここで控える");
}

async function list(db: SupabaseClient) {
  const { data, error } = await db
    .from("collector_keys")
    .select("id, name, user_id, created_at, last_used_at, revoked_at")
    .order("created_at");
  if (error) fail(`collector_keys の取得に失敗: ${error.message}`);
  const emails = new Map((await listAllAuthUsers(db)).map((u) => [u.id, u.email ?? ""]));
  console.log(["id", "名前", "メール", "作成", "最終使用", "取り消し"].join("\t"));
  for (const r of data ?? []) {
    console.log([r.id, r.name, emails.get(r.user_id) ?? r.user_id, r.created_at, r.last_used_at ?? "-", r.revoked_at ?? "-"].join("\t"));
  }
}

async function revoke(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("collector_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null)
    .select("id");
  if (error) fail(`取り消しに失敗: ${error.message}`);
  if (!data || data.length === 0) fail(`${id} は無いか、すでに取り消し済み`);
  console.log(`取り消した: ${id}`);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: { email: { type: "string" }, operator: { type: "string" } },
});
const [cmd, arg] = positionals;

if (cmd === "create" && arg) {
  if (!values.email) fail("--email が要る\n" + USAGE);
  await create(adminClient(), arg, values.email, values.operator);
} else if (cmd === "list") {
  await list(adminClient());
} else if (cmd === "revoke" && arg) {
  await revoke(adminClient(), arg);
} else {
  fail(USAGE);
}
