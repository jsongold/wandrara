// テスト用：宿の最小の入力に、中身の決まり（quality.ts）が求める項目を足す。入力にある値はそのまま使う
type Body = Record<string, unknown> & {
  core?: Record<string, unknown>;
  texts?: Record<string, unknown>[];
  details?: Record<string, unknown>;
  photos?: unknown[];
};

export function withAccommodationQuality<T extends Body>(body: T, photo: "file" | "storage_key" = "storage_key"): T {
  return {
    ...body,
    core: { lat: 35.1, lng: 139.07, check_in: "15:00", check_out: "10:00", official_url: "https://example.com/", ...body.core },
    texts: (body.texts ?? [{ lang: "ja", name: "テスト" }]).map((t) => ({ summary: "テスト用", address: "静岡県熱海市", ...t })),
    details: {
      prices: [{ amount: 10000, currency: "JPY", guests: 2 }],
      ...body.details,
      units: (body.details?.units as unknown[] | undefined) ?? [{ capacity: 2 }],
    },
    photos: body.photos ?? [photo === "file" ? { file: "images/001.jpg" } : { storage_key: "a.jpg" }],
  };
}
