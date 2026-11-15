// 自分が登録した dest を公開する（API キーだけで動く）。
// 使い方: pnpm dest:publish <ref>... [--draft]
//   環境変数 WANDRARA_API_URL / WANDRARA_API_KEY
//   --draft: 公開をやめて下書きに戻す

type Result = { ref: string; ok: true; slug: string; status: string } | { ref: string; ok: false; error: string };

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const draft = args.includes("--draft");
  const refs = args.filter((a) => !a.startsWith("--"));
  const apiUrl = process.env.WANDRARA_API_URL;
  const apiKey = process.env.WANDRARA_API_KEY;
  if (refs.length === 0 || !apiUrl || !apiKey) {
    console.error("使い方: pnpm dest:publish <ref>... [--draft]\n  環境変数 WANDRARA_API_URL（例 https://wandrara.vercel.app）と WANDRARA_API_KEY（wdr_...）が要る");
    return 2;
  }
  const status = draft ? "draft" : "published";

  const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/api/publications`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ refs, status }),
  });
  const text = await res.text();
  let json: { results?: Result[]; errors?: string[] } | null = null;
  try {
    json = JSON.parse(text);
  } catch {}
  if (!res.ok || !json?.results) {
    console.error(`error: HTTP ${res.status} ${json?.errors?.join(" / ") ?? text.slice(0, 200)}`);
    return 1;
  }

  let failed = 0;
  for (const r of json.results) {
    if (r.ok) console.log(`${r.status}: ${r.ref} → /d/${r.slug}`);
    else {
      console.error(`error: ${r.ref}: ${r.error}`);
      failed++;
    }
  }
  return failed > 0 ? 1 : 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; },
);
