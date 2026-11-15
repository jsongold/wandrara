// 本番の API（API キーで認証）を呼ぶ。

export type Upload = { sha256: string; storage_key: string; signed_url: string | null };

export class ApiError extends Error {}

export function createClient(baseUrl: string, apiKey: string, fetchFn: typeof fetch = fetch) {
  const base = baseUrl.replace(/\/+$/, "");

  async function post(path: string, body: unknown): Promise<unknown> {
    const res = await fetchFn(`${base}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: { errors?: string[] } | null = null;
    try {
      json = JSON.parse(text);
    } catch {}
    if (!res.ok) {
      const reason = json?.errors?.join(" / ") ?? text.slice(0, 200);
      throw new ApiError(`HTTP ${res.status} ${reason}`);
    }
    return json;
  }

  return {
    async uploadUrls(files: { sha256: string; content_type: string }[]): Promise<Upload[]> {
      const r = (await post("/api/upload-urls", { files })) as { uploads: Upload[] };
      return r.uploads;
    },
    async put(signedUrl: string, bytes: Uint8Array, contentType: string): Promise<void> {
      const res = await fetchFn(signedUrl, { method: "PUT", headers: { "content-type": contentType }, body: bytes as BodyInit });
      if (!res.ok) throw new ApiError(`写真の PUT が HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    },
    async registerDest(path: string, dest: unknown): Promise<{ dest_id: string; slug: string; status: string }> {
      return (await post(`/api/${path}`, dest)) as { dest_id: string; slug: string; status: string };
    },
  };
}
