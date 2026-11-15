// photos[].url の画像を取ってくる（import:bundle と bundle:validate で共通）。
// 大きすぎる画像を全部メモリに読まないように、Content-Length と読んだ量の両方で上限（MAX_BYTES）を見て、超えたら途中でやめる
import { MAX_BYTES } from "./collect.ts";

export async function download(url: string, fetchFn: typeof fetch = fetch, maxBytes = MAX_BYTES): Promise<Uint8Array> {
  const res = await fetchFn(url, { headers: { "user-agent": "wandrara-import" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const tooBig = () => new Error(`${Math.round(maxBytes / 1024 / 1024)}MB を超えている`);
  const declared = Number(res.headers.get("content-length"));
  if (declared > maxBytes) {
    await res.body?.cancel();
    throw tooBig();
  }
  if (!res.body) return new Uint8Array(await res.arrayBuffer());

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw tooBig();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}
