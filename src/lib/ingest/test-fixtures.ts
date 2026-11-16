// テスト用：宿の最小の入力に、中身の決まり（quality.ts）が求める項目を足す。入力にある値はそのまま使う
import { z } from "zod";
import { accommodationCore } from "../../db/schema/accommodation.ts";
import { buildingCore } from "../../db/schema/building.ts";
import { sampleExperienceDetails } from "../experience/sample.ts";
import { sampleNatureDetails } from "../nature/sample.ts";
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

/** テスト用：体験の最小の入力に、中身の決まり（quality.ts）が求める項目（新しい形の details）を足す */
export function withExperienceQuality<T extends Body>(body: T, photo: "file" | "storage_key" = "storage_key"): T {
  return {
    ...body,
    core: { region_id: "izu", duration_minutes: 90, reservation_required: true, official_url: "https://example.com/", ...body.core },
    texts: (body.texts ?? [{ lang: "ja", name: "テスト" }]).map((t) => ({ summary: "テスト用", ...t })),
    details: body.details ?? { ...sampleExperienceDetails() },
    photos: body.photos ?? [photo === "file" ? { file: "images/001.jpg" } : { storage_key: "a.jpg" }],
  };
}

/** テスト用：自然の最小の入力に、中身の決まり（quality.ts）が求める項目（新しい形の details）を足す */
export function withNatureQuality<T extends Body>(body: T, photo: "file" | "storage_key" = "storage_key"): T {
  return {
    ...body,
    core: { region_id: "ito", lat: 34.9, lng: 139.1, geo_precision: "exact", ...body.core },
    texts: (body.texts ?? [{ lang: "ja", name: "テスト" }]).map((t) => ({ summary: "テスト用", ...t })),
    details: body.details ?? { ...sampleNatureDetails() },
    photos: body.photos ?? [photo === "file" ? { file: "images/001.jpg" } : { storage_key: "a.jpg" }],
  };
}

/** テスト用：宿のコアに、details を JSON 1 つで受ける小さなスキーマを付けたもの。中身の決まり（quality.ts）は外すため種類の名前を変える */
export const jsonDetailsCore: CoreDef = {
  ...accommodationCore,
  coreType: "accommodation_json" as CoreDef["coreType"],
  detailsSchema: z.strictObject({ rooms: z.array(z.strictObject({ key: z.string() })).optional() }),
};

/** テスト用：建物のコアから中身の決まり（quality.ts）を外したもの。詳細の表（hours・fees ほか）で受けるコアの入力と書き込みを確かめる */
export const tableDetailsCore: CoreDef = {
  ...buildingCore,
  coreType: "building_tables" as CoreDef["coreType"],
};
