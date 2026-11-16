// テスト用：宿の最小の入力に、中身の決まり（quality.ts）が求める項目を足す。入力にある値はそのまま使う
import { z } from "zod";
import { accommodationCore } from "../../db/schema/accommodation.ts";
import { index, numeric, pgTable, primaryKey, text, time, uuid } from "drizzle-orm/pg-core";
import { destChildColumns, langCheck, locationColumns, textsColumns } from "../../db/schema/_shared.ts";
import { destinations } from "../../db/schema/common.ts";
import { sampleBuildingDetails } from "../building/sample.ts";
import { sampleHotspringDetails } from "../hotspring/sample.ts";
import { sampleVillageDetails } from "../village/sample.ts";
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

/** テスト用：建物の最小の入力に、中身の決まり（quality.ts）が求める項目（新しい形の details）を足す */
export function withBuildingQuality<T extends Body>(body: T, photo: "file" | "storage_key" = "storage_key"): T {
  return {
    ...body,
    core: { region_id: "hakone", lat: 35.25, lng: 139.0, geo_precision: "exact", official_url: "https://example.com/", ...body.core },
    texts: (body.texts ?? [{ lang: "ja", name: "テスト" }]).map((t) => ({ summary: "テスト用", ...t })),
    details: body.details ?? { ...sampleBuildingDetails() },
    photos: body.photos ?? [photo === "file" ? { file: "images/001.jpg" } : { storage_key: "a.jpg" }],
  };
}

/** テスト用：日帰り温泉の最小の入力に、中身の決まり（quality.ts）が求める項目（新しい形の details）を足す */
export function withHotspringQuality<T extends Body>(body: T, photo: "file" | "storage_key" = "storage_key"): T {
  return {
    ...body,
    core: { region_id: "shuzenji", lat: 34.97, lng: 138.93, geo_precision: "exact", official_url: "https://example.com/", ...body.core },
    texts: (body.texts ?? [{ lang: "ja", name: "テスト" }]).map((t) => ({ summary: "テスト用", ...t })),
    details: body.details ?? { ...sampleHotspringDetails() },
    photos: body.photos ?? [photo === "file" ? { file: "images/001.jpg" } : { storage_key: "a.jpg" }],
  };
}

/** テスト用：まちの最小の入力に、中身の決まり（quality.ts）が求める項目（新しい形の details）を足す */
export function withVillageQuality<T extends Body>(body: T, photo: "file" | "storage_key" = "storage_key"): T {
  return {
    ...body,
    core: { region_id: "shuzenji", lat: 34.97, lng: 138.93, geo_precision: "district", ...body.core },
    texts: (body.texts ?? [{ lang: "ja", name: "テスト" }]).map((t) => ({ summary: "テスト用", ...t })),
    details: body.details ?? { ...sampleVillageDetails() },
    photos: body.photos ?? [photo === "file" ? { file: "images/001.jpg" } : { storage_key: "a.jpg" }],
  };
}

/** テスト用：宿のコアに、details を JSON 1 つで受ける小さなスキーマを付けたもの。中身の決まり（quality.ts）は外すため種類の名前を変える */
export const jsonDetailsCore: CoreDef = {
  ...accommodationCore,
  coreType: "accommodation_json" as CoreDef["coreType"],
  detailsSchema: z.strictObject({ rooms: z.array(z.strictObject({ key: z.string() })).optional() }),
};

// 詳細の表で受けるコアの入力と書き込みを確かめる、架空の表（DB には無い）。どのコアも今は詳細の表を使わないため、ここで作る
const fakeCores = pgTable("fake_cores", {
  destId: uuid("dest_id").primaryKey().references(() => destinations.destId, { onDelete: "cascade" }),
  kind: text("kind"),
  ...locationColumns(),
});
const fakeTexts = pgTable("fake_texts", { ...textsColumns() }, (t) => [primaryKey({ columns: [t.destId, t.lang] }), langCheck("fake_texts", t)]);
const fakeHours = pgTable("fake_hours", { ...destChildColumns(), openTime: time("open_time") }, (t) => [index("fake_hours_dest_id_idx").on(t.destId)]);
const fakeFees = pgTable("fake_fees", { ...destChildColumns(), amount: numeric("amount").notNull(), currency: text("currency").notNull(), note: text("note") }, (t) => [
  index("fake_fees_dest_id_idx").on(t.destId),
]);

/** テスト用：詳細の表（hours・fees）で受ける架空のコア。coreType は建物と同じ型の名前を借りる（中身の決まり quality.ts は引かない） */
export const tableDetailsCore: CoreDef = {
  coreType: "building_tables" as CoreDef["coreType"],
  path: "fake_cores",
  label: "架空",
  table: fakeCores,
  texts: fakeTexts,
  columns: { kind: "種類" },
  kindLabels: { museum: "資料館" },
  details: [
    { key: "hours", table: fakeHours, label: "時間", columns: { openTime: "開く時刻" } },
    { key: "fees", table: fakeFees, label: "料金", columns: { amount: "料金", currency: "通貨", note: "メモ" } },
  ],
};
