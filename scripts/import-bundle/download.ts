// photos[].url の画像を取ってくる（import:bundle と bundle:validate で共通）
export async function download(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "user-agent": "wandrara-import" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
