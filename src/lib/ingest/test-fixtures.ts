// テスト用：宿の最小の入力に、中身の決まり（quality.ts）が求める項目を足す。入力にある値はそのまま使う
import { z } from "zod";
import { accommodationCore } from "../../db/schema/accommodation.ts";
import type { CoreDef } from "../../db/schema/_shared.ts";

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
      rooms: [{ key: "main", capacity: 2 }],
      prices: { items: [{ kind: "room", per: "room_night", room: "main", amount: 10000, currency: "JPY" }] },
      ...body.details,
    },
    photos: body.photos ?? [photo === "file" ? { file: "images/001.jpg" } : { storage_key: "a.jpg" }],
  };
}

/** テスト用：宿のコアに、details を JSON 1 つで受ける小さなスキーマを付けたもの。中身の決まり（quality.ts）は外すため種類の名前を変える */
export const jsonDetailsCore: CoreDef = {
  ...accommodationCore,
  coreType: "accommodation_json" as CoreDef["coreType"],
  detailsSchema: z.strictObject({ rooms: z.array(z.strictObject({ key: z.string() })).optional() }),
};

/** テスト用：宿のコアから detailsSchema を外し、詳細の表（入れ子の units → bedrooms → beds）で受けるもの。表で受けるコアの入力と書き込みを確かめる */
export const tableDetailsCore: CoreDef = {
  ...accommodationCore,
  coreType: "accommodation_tables" as CoreDef["coreType"],
  detailsSchema: undefined,
};
